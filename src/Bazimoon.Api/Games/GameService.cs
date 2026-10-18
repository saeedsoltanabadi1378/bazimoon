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
    private readonly IGameRosterStore _rosterStore;
    private readonly IAppSettingsService _settings;
    private readonly BazimoonDbContext _db;
    private readonly GameMutationLock _mutationLock;
    private readonly Lounge.IPushNotifier _push;

    public GameService(
        IGameSessionStore sessionStore,
        IGameHistoryRepository historyRepository,
        IGameNotifier notifier,
        IGameRosterStore rosterStore, IAppSettingsService settings, BazimoonDbContext db, GameMutationLock mutationLock,
        Lounge.IPushNotifier push)
    {
        _push = push;
        _sessionStore = sessionStore;
        _historyRepository = historyRepository;
        _notifier = notifier;
        _rosterStore = rosterStore;
        _settings = settings;
        _db = db;
        _mutationLock = mutationLock;
    }

    /// <summary>Creates a lobby, shared by its table's invite link.</summary>
    public async Task<Guid> CreateGameAsync(Guid creatorUserId, string creatorUsername, TableOptions? table = null)
    {
        var settings = await _settings.GetAsync();
        if (!settings.IsGameOn("mafia")) throw new GameException(AppSettingsDefaults.MafiaOff);
        int seats = Math.Clamp(table?.Seats ?? settings.MaxPlayers, settings.MinPlayers, settings.MaxPlayers);
        var game = new GameState(BuildConfig(settings.MinPlayers, seats, table?.Rules));
        var creatorId = PlayerIdentity.DeriveId(game.GameId, creatorUserId);
        game.AddPlayer(new Player(creatorId, creatorUsername));

        await _sessionStore.SaveAsync(game);
        await _rosterStore.AddAsync(game.GameId, creatorUserId, creatorUsername);
        await TrackActivityAsync(creatorUserId);
        _db.MafiaTables.Add(new()
        {
            GameId = game.GameId,
            CreatorUserId = creatorUserId,
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

    public async Task JoinGameAsync(Guid gameId, Guid userId, string username)
    {
        var game = await LoadOrThrowAsync(gameId);
        var playerId = PlayerIdentity.DeriveId(gameId, userId);

        if (game.GetPlayer(playerId) is null)
        {
            game.AddPlayer(new Player(playerId, username));
            await SaveAndNotifyAsync(game);
            await _rosterStore.AddAsync(gameId, userId, username);
            await TrackActivityAsync(userId);
            await _db.SaveChangesAsync();
        }
    }

    /// <summary>Starts (or joins) a follow-up game at the same table from a finished game.</summary>
    public async Task<Guid> RematchAsync(Guid gameId, Guid userId, string username)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        if (game.CurrentPhase != GamePhase.Ended)
            throw new GameException("A rematch can only be started once the game is over.");
        if (game.GetPlayer(PlayerIdentity.DeriveId(gameId, userId)) is null)
            throw new ForbiddenGameActionException("You are not a player in this game.");

        if (game.RematchGameId is { } existing && await _sessionStore.GetAsync(existing) is { CurrentPhase: GamePhase.Lobby })
        {
            await JoinGameAsync(existing, userId, username);
            return existing;
        }

        var previous = await _db.MafiaTables.FindAsync(gameId);
        var rematchId = await CreateGameAsync(userId, username,
            previous is null ? null : new TableOptions(previous.Name, previous.IsOpen, game.Config.MaxPlayers, TableRules.From(game.Config)));
        game.SetRematch(rematchId);
        // The finished game is already in history; only refresh the live copy so players see the rematch.
        await _sessionStore.SaveAsync(game);
        await _notifier.NotifyGameUpdatedAsync(game);
        return rematchId;
    }

    public async Task LeaveGameAsync(Guid gameId, Guid userId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        var playerId = PlayerIdentity.DeriveId(gameId, userId);
        if (game.CurrentPhase == GamePhase.Lobby) game.RemovePlayer(playerId);
        else game.LeaveMidGame(playerId, DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task SetReadyAsync(Guid gameId, Guid userId, bool ready)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.SetReady(PlayerIdentity.DeriveId(gameId, userId), ready, DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task StartGameAsync(Guid gameId, Guid userId)
    {
        var game = await LoadOrThrowAsync(gameId);
        EnsureController(game, userId);
        game.AssignRoles();
        await SaveAndNotifyAsync(game);
        await NotifyGameStartedAsync(game, userId);
    }

    /// <summary>Tells everyone else at the table that the game began, so nobody misses their role.</summary>
    private async Task NotifyGameStartedAsync(GameState game, Guid starterUserId)
    {
        var settings = await _settings.GetAsync();
        string creator = game.GetPlayer(PlayerIdentity.DeriveId(game.GameId, starterUserId))?.DisplayName ?? "";
        string table = await _db.MafiaTables.Where(t => t.GameId == game.GameId).Select(t => t.Name).FirstOrDefaultAsync() ?? "Mafia";
        var text = new Lounge.PushText(
            settings.TableStartMessage.Replace("{creator}", creator).Replace("{table}", table),
            settings.TableStartMessageFa.Replace("{creator}", creator).Replace("{table}", table == "Mafia" ? "مافیا" : table));
        foreach (var seat in await _rosterStore.GetAsync(game.GameId))
        {
            if (seat.UserId != starterUserId) await _push.NotifyAsync(seat.UserId, text, $"/g/{game.GameId}");
        }
    }

    public async Task SubmitNightActionAsync(Guid gameId, Guid userId, Guid targetPlayerId, NightActionType actionType)
    {
        var game = await LoadOrThrowAsync(gameId);
        var actorId = PlayerIdentity.DeriveId(gameId, userId);
        game.SubmitNightAction(actorId, targetPlayerId, actionType);
        await SaveAndNotifyAsync(game);
    }

    public async Task<NightResult> ResolveNightAsync(Guid gameId, Guid userId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        EnsureController(game, userId);
        if (game.CurrentPhase == GamePhase.Night && !game.AreRequiredNightActionsComplete())
            throw new GameException("All living night roles must submit their actions before night can end.");
        var result = game.ResolveNight(DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
        return result;
    }

    public async Task SubmitVoteAsync(Guid gameId, Guid userId, Guid? targetPlayerId)
    {
        var game = await LoadOrThrowAsync(gameId);
        var voterId = PlayerIdentity.DeriveId(gameId, userId);
        game.SubmitVote(voterId, targetPlayerId);
        await SaveAndNotifyAsync(game);
    }

    public async Task<VotingResult> ResolveVotingAsync(Guid gameId, Guid userId)
    {
        var game = await LoadOrThrowAsync(gameId);
        EnsureController(game, userId);
        var result = game.ResolveVoting(DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
        return result;
    }

    public async Task StartVotingAsync(Guid gameId, Guid userId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        EnsureController(game, userId);
        game.StartVoting(DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task RequestChallengeAsync(Guid gameId, Guid userId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.RequestChallenge(PlayerIdentity.DeriveId(gameId, userId), DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task CancelChallengeAsync(Guid gameId, Guid userId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.CancelChallenge(PlayerIdentity.DeriveId(gameId, userId), DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task AcceptChallengeAsync(Guid gameId, Guid userId, Guid challengerId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.AcceptChallenge(PlayerIdentity.DeriveId(gameId, userId), challengerId, DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task RejectChallengeAsync(Guid gameId, Guid userId, Guid challengerId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.RejectChallenge(PlayerIdentity.DeriveId(gameId, userId), challengerId, DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task FinishDiscussionAsync(Guid gameId, Guid userId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.FinishDiscussionSegment(PlayerIdentity.DeriveId(gameId, userId), DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task FinishLastWordsAsync(Guid gameId, Guid userId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.FinishLastWords(PlayerIdentity.DeriveId(gameId, userId), DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    public async Task RevealMayorAsync(Guid gameId, Guid userId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.RevealMayor(PlayerIdentity.DeriveId(gameId, userId));
        await SaveAndNotifyAsync(game);
    }

    public async Task CallInquiryAsync(Guid gameId, Guid userId)
    {
        using var held = await _mutationLock.EnterAsync(gameId);
        var game = await LoadOrThrowAsync(gameId);
        game.CallInquiry(PlayerIdentity.DeriveId(gameId, userId));
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

    public async Task StartNightAsync(Guid gameId, Guid userId)
    {
        var game = await LoadOrThrowAsync(gameId);
        EnsureController(game, userId);
        game.StartNight(DateTimeOffset.UtcNow);
        await SaveAndNotifyAsync(game);
    }

    private async Task SaveAndNotifyAsync(GameState game)
    {
        await _sessionStore.SaveAsync(game);

        if (game.CurrentPhase == GamePhase.Ended)
        {
            await _historyRepository.SaveCompletedGameAsync(game);
            await _rosterStore.RemoveAsync(game.GameId);
        }

        await _notifier.NotifyGameUpdatedAsync(game);
    }

    private static void EnsureController(GameState game, Guid userId)
    {
        var controller = game.Controller
            ?? throw new ForbiddenGameActionException("This game has no controller.");
        var callerId = PlayerIdentity.DeriveId(game.GameId, userId);
        if (controller.Id != callerId)
            throw new ForbiddenGameActionException("Only the game creator can manage game phases.");
    }

    public async Task<bool> CancelByAdminAsync(Guid gameId, string reason, string actor)
    {
        var game = await _sessionStore.GetAsync(gameId);
        if (game is null) return await _db.Games.AnyAsync(x => x.Id == gameId && x.Status == "Cancelled");
        var roster = await _rosterStore.GetAsync(gameId);
        _db.Games.Add(new GameRecord { Id=game.GameId, CreatedAt=game.CreatedAt.UtcDateTime, EndedAt=DateTime.UtcNow, Result=WinCondition.None, Status="Cancelled", CancellationReason=reason, Players=game.Players.Select(p => new GamePlayerRecord { Id=Guid.NewGuid(), PlayerId=p.Id, UserId=roster.FirstOrDefault(r=>r.Username==p.DisplayName)?.UserId, DisplayName=p.DisplayName, Role=p.Role, SurvivedToEnd=p.IsAlive, GodfatherRank=p.GodfatherRank }).ToList() });
        _db.OperationalEvents.Add(new() { Category="AdminAudit", Message="Game cancelled", IsAdminAudit=true, TargetType="Game", TargetId=gameId.ToString(), MetadataJson=System.Text.Json.JsonSerializer.Serialize(new { reason, actor }) });
        await _db.SaveChangesAsync();
        await _sessionStore.RemoveAsync(gameId); await _rosterStore.RemoveAsync(gameId); await _notifier.NotifyGameUpdatedAsync(game); return true;
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

    private async Task TrackActivityAsync(Guid userId)
    {
        if (await _db.Users.FindAsync(userId) is { } user) user.LastSeenAt = DateTime.UtcNow;
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
