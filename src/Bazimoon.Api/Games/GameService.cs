using Bazimoon.Domain;
using Bazimoon.Infrastructure;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Admin;
using Microsoft.EntityFrameworkCore;
using Bazimoon.Infrastructure.Sessions;

namespace Bazimoon.Api.Games;

public sealed class GameService
{
    private readonly IGameSessionStore _sessionStore;
    private readonly IGameHistoryRepository _historyRepository;
    private readonly IGameNotifier _notifier;
    private readonly IChatGameIndex _chatGameIndex;
    private readonly IGameRosterStore _rosterStore;
    private readonly IBotSettingsService _settings;
    private readonly BazimoonDbContext _db;
    private readonly GameMutationLock _mutationLock;

    public GameService(
        IGameSessionStore sessionStore,
        IGameHistoryRepository historyRepository,
        IGameNotifier notifier,
        IChatGameIndex chatGameIndex,
        IGameRosterStore rosterStore, IBotSettingsService settings, BazimoonDbContext db, GameMutationLock mutationLock)
    {
        _sessionStore = sessionStore;
        _historyRepository = historyRepository;
        _notifier = notifier;
        _chatGameIndex = chatGameIndex;
        _rosterStore = rosterStore;
        _settings = settings;
        _db = db;
        _mutationLock = mutationLock;
    }

    /// <summary>Creates a lobby. <paramref name="telegramChatId"/> is the group a bot <c>/newgame</c> came from;
    /// tables opened in the app have none and are shared by their invite link instead.</summary>
    public async Task<Guid> CreateGameAsync(long? telegramChatId, long creatorTelegramUserId, string creatorUsername, string? chatTitle = null, TableOptions? table = null)
    {
        var settings = await _settings.GetAsync();
        if (!settings.IsGameOn("mafia")) throw new GameException(BotSettingsDefaults.MafiaOff);
        int seats = Math.Clamp(table?.Seats ?? settings.MaxPlayers, settings.MinPlayers, settings.MaxPlayers);
        var game = new GameState(BuildConfig(settings.MinPlayers, seats, table?.Rules), telegramChatId: telegramChatId);
        var creatorId = PlayerIdentity.DeriveId(game.GameId, creatorTelegramUserId);
        game.AddPlayer(new Player(creatorId, creatorUsername));

        await _sessionStore.SaveAsync(game);
        if (telegramChatId is { } chat) await _chatGameIndex.SetActiveGameAsync(chat, game.GameId);
        await _rosterStore.AddAsync(game.GameId, creatorTelegramUserId, creatorUsername);
        await TrackActivityAsync(telegramChatId, creatorTelegramUserId, creatorUsername, chatTitle);
        _db.MafiaTables.Add(new()
        {
            GameId = game.GameId,
            TelegramChatId = telegramChatId ?? 0,
            CreatorTelegramUserId = creatorTelegramUserId,
            Name = string.IsNullOrWhiteSpace(table?.Name) ? null : table.Name.Trim()[..Math.Min(40, table.Name.Trim().Length)],
            IsOpen = table?.IsOpen ?? false,
            InviteCode = await NewInviteCodeAsync(),
        });
        _db.OperationalEvents.Add(new() { Category = "Game", Message = "Game created", TargetType = "Game", TargetId = game.GameId.ToString() });
        await _db.SaveChangesAsync();
        return game.GameId;
    }

    public async Task<GameState> LoadOrThrowAsync(Guid gameId) =>
        await _sessionStore.GetAsync(gameId) ?? throw new GameNotFoundException(gameId);

    public async Task<Guid> GetActiveGameForChatOrThrowAsync(long telegramChatId) =>
        await _chatGameIndex.GetActiveGameAsync(telegramChatId)
            ?? throw GameNotFoundException.ForChat(telegramChatId);

    public async Task JoinGameAsync(Guid gameId, long telegramUserId, string username)
    {
        var game = await LoadOrThrowAsync(gameId);
        var playerId = PlayerIdentity.DeriveId(gameId, telegramUserId);

        if (game.GetPlayer(playerId) is null)
        {
            game.AddPlayer(new Player(playerId, username));
            await SaveAndNotifyAsync(game);
            await _rosterStore.AddAsync(gameId, telegramUserId, username);
            await TrackActivityAsync(game.TelegramChatId, telegramUserId, username);
            await _db.SaveChangesAsync();
        }
    }

    /// <summary>Starts (or joins) a follow-up game at the same table (and chat, if any) from a finished game.</summary>
    public async Task<Guid> RematchAsync(Guid gameId, long telegramUserId, string username)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        if (game.CurrentPhase != GamePhase.Ended)
            throw new GameException("A rematch can only be started once the game is over.");
        if (game.GetPlayer(PlayerIdentity.DeriveId(gameId, telegramUserId)) is null)
            throw new ForbiddenGameActionException("You are not a player in this game.");

        if (game.RematchGameId is { } existing && await _sessionStore.GetAsync(existing) is { CurrentPhase: GamePhase.Lobby })
        {
            await JoinGameAsync(existing, telegramUserId, username);
            return existing;
        }

        var previous = await _db.MafiaTables.FindAsync(gameId);
        var rematchId = await CreateGameAsync(game.TelegramChatId, telegramUserId, username, null,
            previous is null ? null : new TableOptions(previous.Name, previous.IsOpen, game.Config.MaxPlayers, TableRules.From(game.Config)));
        game.SetRematch(rematchId);
        // The finished game is already in history; only refresh the live copy so players see the rematch.
        await _sessionStore.SaveAsync(game);
        await _notifier.NotifyGameUpdatedAsync(game);
        return rematchId;
    }

    public async Task LeaveGameAsync(Guid gameId, long telegramUserId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        var playerId = PlayerIdentity.DeriveId(gameId, telegramUserId);
        if (game.CurrentPhase == GamePhase.Lobby) game.RemovePlayer(playerId);
        else game.LeaveMidGame(playerId, DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task SetReadyAsync(Guid gameId, long telegramUserId, bool ready)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.SetReady(PlayerIdentity.DeriveId(gameId, telegramUserId), ready, DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task StartGameAsync(Guid gameId, long telegramUserId)
    {
        var game = await LoadOrThrowAsync(gameId);
        EnsureController(game, telegramUserId);
        game.AssignRoles();
        await SaveAndNotifyAsync(game);
    }

    public async Task SubmitNightActionAsync(Guid gameId, long telegramUserId, Guid targetPlayerId, NightActionType actionType)
    {
        var game = await LoadOrThrowAsync(gameId);
        var actorId = PlayerIdentity.DeriveId(gameId, telegramUserId);
        game.SubmitNightAction(actorId, targetPlayerId, actionType);
        await SaveAndNotifyAsync(game);
    }

    public async Task<NightResult> ResolveNightAsync(Guid gameId, long telegramUserId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        EnsureController(game, telegramUserId);
        if (game.CurrentPhase == GamePhase.Night && !game.AreRequiredNightActionsComplete())
            throw new GameException("All living night roles must submit their actions before night can end.");
        var result = game.ResolveNight(DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
        return result;
    }

    public async Task SubmitVoteAsync(Guid gameId, long telegramUserId, Guid? targetPlayerId)
    {
        var game = await LoadOrThrowAsync(gameId);
        var voterId = PlayerIdentity.DeriveId(gameId, telegramUserId);
        game.SubmitVote(voterId, targetPlayerId);
        await SaveAndNotifyAsync(game);
    }

    public async Task<VotingResult> ResolveVotingAsync(Guid gameId, long telegramUserId)
    {
        var game = await LoadOrThrowAsync(gameId);
        EnsureController(game, telegramUserId);
        var result = game.ResolveVoting(DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
        return result;
    }

    public async Task StartVotingAsync(Guid gameId, long telegramUserId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        EnsureController(game, telegramUserId);
        game.StartVoting(DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task RequestChallengeAsync(Guid gameId, long telegramUserId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.RequestChallenge(PlayerIdentity.DeriveId(gameId, telegramUserId), DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task CancelChallengeAsync(Guid gameId, long telegramUserId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.CancelChallenge(PlayerIdentity.DeriveId(gameId, telegramUserId), DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task AcceptChallengeAsync(Guid gameId, long telegramUserId, Guid challengerId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.AcceptChallenge(PlayerIdentity.DeriveId(gameId, telegramUserId), challengerId, DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task RejectChallengeAsync(Guid gameId, long telegramUserId, Guid challengerId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.RejectChallenge(PlayerIdentity.DeriveId(gameId, telegramUserId), challengerId, DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task FinishDiscussionAsync(Guid gameId, long telegramUserId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.FinishDiscussionSegment(PlayerIdentity.DeriveId(gameId, telegramUserId), DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task FinishLastWordsAsync(Guid gameId, long telegramUserId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.FinishLastWords(PlayerIdentity.DeriveId(gameId, telegramUserId), DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task RevealMayorAsync(Guid gameId, long telegramUserId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.RevealMayor(PlayerIdentity.DeriveId(gameId, telegramUserId));
        await SaveAndNotifyAsync(game);
    }

    public async Task CallInquiryAsync(Guid gameId, long telegramUserId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.CallInquiry(PlayerIdentity.DeriveId(gameId, telegramUserId));
        await SaveAndNotifyAsync(game);
    }

    /// <summary>Moves a game on when its current turn or phase timer has run out. Called every second
    /// by <see cref="PhaseDeadlineService"/>; finished games are written to history like any other end.</summary>
    public async Task AdvanceExpiredAsync(Guid gameId, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        using var held = await _mutationLock.EnterAsync(gameId, cancellationToken);
        var game = await _sessionStore.GetAsync(gameId);
        if (game is null || !game.AdvanceExpiredPhase(now)) return;
        await SaveAndNotifyAsync(game);
    }

    public async Task StartNightAsync(Guid gameId, long telegramUserId)
    {
        var game = await LoadOrThrowAsync(gameId);
        EnsureController(game, telegramUserId);
        game.StartNight(DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    private async Task SaveAndNotifyAsync(GameState game)
    {
        await _sessionStore.SaveAsync(game);

        if (game.CurrentPhase == GamePhase.Ended)
        {
            await _historyRepository.SaveCompletedGameAsync(game);
            if (game.TelegramChatId is { } chatId)
            {
                await _chatGameIndex.ClearActiveGameAsync(chatId);
            }
            await _rosterStore.RemoveAsync(game.GameId);
        }

        await _notifier.NotifyGameUpdatedAsync(game);
    }

    private static void EnsureController(GameState game, long telegramUserId)
    {
        var controller = game.Controller
            ?? throw new ForbiddenGameActionException("This game has no controller.");
        var callerId = PlayerIdentity.DeriveId(game.GameId, telegramUserId);
        if (controller.Id != callerId)
            throw new ForbiddenGameActionException("Only the game creator can manage game phases.");
    }

    public async Task<bool> CancelByAdminAsync(Guid gameId, string reason, string actor)
    {
        var game = await _sessionStore.GetAsync(gameId);
        if (game is null) return await _db.Games.AnyAsync(x => x.Id == gameId && x.Status == "Cancelled");
        var roster = await _rosterStore.GetAsync(gameId);
        _db.Games.Add(new GameRecord { Id=game.GameId, TelegramChatId=game.TelegramChatId ?? 0, CreatedAt=game.CreatedAt.UtcDateTime, EndedAt=DateTime.UtcNow, Result=WinCondition.None, Status="Cancelled", CancellationReason=reason, Players=game.Players.Select(p => new GamePlayerRecord { Id=Guid.NewGuid(), PlayerId=p.Id, TelegramUserId=roster.FirstOrDefault(r=>r.Username==p.TelegramUsername)?.TelegramUserId, TelegramUsername=p.TelegramUsername, Role=p.Role, SurvivedToEnd=p.IsAlive, GodfatherRank=p.GodfatherRank }).ToList() });
        _db.OperationalEvents.Add(new() { Category="AdminAudit", Message="Game cancelled", IsAdminAudit=true, TargetType="Game", TargetId=gameId.ToString(), MetadataJson=System.Text.Json.JsonSerializer.Serialize(new { reason, actor }) });
        await _db.SaveChangesAsync();
        await _sessionStore.RemoveAsync(gameId); if(game.TelegramChatId is { } chat) await _chatGameIndex.ClearActiveGameAsync(chat); await _rosterStore.RemoveAsync(gameId); await _notifier.NotifyGameUpdatedAsync(game); return true;
    }

    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    /// <summary>A six-character code without look-alike letters (no I, L, O, 0 or 1).</summary>
    private async Task<string> NewInviteCodeAsync()
    {
        while (true)
        {
            var code = string.Create(6, 0, (span, _) =>
            {
                for (int i = 0; i < span.Length; i++) span[i] = CodeAlphabet[System.Security.Cryptography.RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
            });
            if (!await _db.MafiaTables.AnyAsync(t => t.InviteCode == code)) return code;
        }
    }

    private async Task TrackActivityAsync(long? chatId, long userId, string username, string? chatTitle = null)
    {
        var now=DateTime.UtcNow; var user=await _db.UserProfiles.FindAsync(userId); if(user is null)_db.UserProfiles.Add(new(){TelegramUserId=userId,Username=username,FirstSeenAt=now,LastSeenAt=now}); else {user.Username=username;user.LastSeenAt=now;}
        if (chatId is not { } id) return;
        var chat=await _db.ChatProfiles.FindAsync(id); if(chat is null)_db.ChatProfiles.Add(new(){TelegramChatId=id,Title=chatTitle,FirstSeenAt=now,LastSeenAt=now}); else { chat.LastSeenAt=now; if(!string.IsNullOrWhiteSpace(chatTitle)) chat.Title=chatTitle; }
        var member = await _db.ChatMembers.FindAsync(id, userId);
        if (member is null) _db.ChatMembers.Add(new() { TelegramChatId = id, TelegramUserId = userId, LastSeenAt = now });
        else member.LastSeenAt = now;
    }

    /// <summary>The table's rules, with each timer the creator picked checked against the allowed choices.</summary>
    internal static GameConfig BuildConfig(int minPlayers, int maxPlayers, TableRules? rules)
    {
        var d = GameConfig.Default;
        if (rules is null) return new GameConfig { MinPlayers = minPlayers, MaxPlayers = maxPlayers };
        return new GameConfig
        {
            MinPlayers = minPlayers,
            MaxPlayers = maxPlayers,
            SpeakerSeconds = Pick(rules.SpeakerSeconds, GameConfig.SpeakerChoices, d.SpeakerSeconds, "speaking turn"),
            ChallengeSeconds = Pick(rules.ChallengeSeconds, GameConfig.ChallengeChoices, d.ChallengeSeconds, "challenge"),
            DefenceSeconds = Pick(rules.DefenceSeconds, GameConfig.DefenceChoices, d.DefenceSeconds, "defence"),
            LastWordsSeconds = Pick(rules.LastWordsSeconds, GameConfig.LastWordsChoices, d.LastWordsSeconds, "last words"),
            NightSeconds = PickOptional(rules.NightSeconds, GameConfig.NightChoices, "night"),
            VotingSeconds = PickOptional(rules.VotingSeconds, GameConfig.VotingChoices, "voting"),
            LastWordsForNightKills = rules.LastWordsForNightKills ?? false,
            Roles = BuildSetup(rules),
            // The Iranian preset turns "Godfather looks innocent" on unless the creator says otherwise.
            GodfatherAppearsInnocent = rules.GodfatherAppearsInnocent ?? rules.Preset == RolePreset.Iranian,
            JokerWinEndsGame = rules.JokerWinEndsGame ?? true,
            RevealRolesOnDeath = rules.RevealRolesOnDeath ?? true,
        };
    }

    private static RoleSetup BuildSetup(TableRules rules)
    {
        switch (rules.Preset ?? RolePreset.Classic)
        {
            case RolePreset.Classic: return RoleSetup.Classic;
            case RolePreset.Iranian: return RoleSetup.Iranian;
            default:
                var optional = (rules.OptionalRoles ?? []).Distinct().ToList();
                if (optional.Any(r => !RoleSetup.OptionalRoles.Contains(r)))
                    throw new GameException("Only optional roles can be switched on.");
                int mafia = rules.MafiaCount ?? 1;
                if (mafia < 1 || mafia > 5)
                    throw new GameException("A custom setup needs between 1 and 5 Mafia players.");
                return new RoleSetup(RolePreset.Custom, mafia, optional);
        }
    }

    private static int Pick(int? value, IReadOnlyList<int> choices, int fallback, string name) =>
        value is not { } v ? fallback
        : choices.Contains(v) ? v
        : throw new GameException($"The {name} timer must be one of {string.Join(", ", choices)} seconds.");

    // 0 or null means off: the creator moves the phase on by hand.
    private static int? PickOptional(int? value, IReadOnlyList<int> choices, string name) =>
        value is null or 0 ? null : Pick(value, choices, 0, name);
}

/// <summary>How a table is set up when it is created from the app (or copied into a rematch).
/// <paramref name="IsOpen"/>: public (listed in Open tables) or private (invite link or code only).</summary>
public sealed record TableOptions(string? Name, bool IsOpen, int? Seats, TableRules? Rules = null);

/// <summary>Timers (seconds) and rule switches the creator picks on Create a table. Missing values keep
/// the defaults; NightSeconds and VotingSeconds of 0 or null mean the creator ends that phase by hand.</summary>
public sealed record TableRules(
    int? SpeakerSeconds = null,
    int? ChallengeSeconds = null,
    int? DefenceSeconds = null,
    int? LastWordsSeconds = null,
    int? NightSeconds = null,
    int? VotingSeconds = null,
    bool? LastWordsForNightKills = null,
    RolePreset? Preset = null,
    int? MafiaCount = null,
    IReadOnlyList<Role>? OptionalRoles = null,
    bool? GodfatherAppearsInnocent = null,
    bool? JokerWinEndsGame = null,
    bool? RevealRolesOnDeath = null)
{
    public static TableRules From(GameConfig config) => new(
        config.SpeakerSeconds, config.ChallengeSeconds, config.DefenceSeconds, config.LastWordsSeconds,
        config.NightSeconds, config.VotingSeconds, config.LastWordsForNightKills,
        config.Roles.Preset, config.Roles.MafiaCount, config.Roles.Optional,
        config.GodfatherAppearsInnocent, config.JokerWinEndsGame, config.RevealRolesOnDeath);
}
