using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Nightfall.Domain;
using Nightfall.Infrastructure.Auth;
using Nightfall.Infrastructure.Sessions;
using Nightfall.Infrastructure.Admin;
using Telegram.Bot.Types;

namespace Nightfall.Bot;

public sealed class CommandDispatcher
{
    private readonly INightfallApiClient _api;
    private readonly IBotMessenger _messenger;
    private readonly IChatGameIndex _chatGameIndex;
    private readonly IGameRosterStore _rosterStore;
    private readonly BotOptions _botOptions;
    private readonly ILogger<CommandDispatcher> _logger;
    private readonly IBotSettingsService? _settings;
    private BotSettingsSnapshot? _currentSettings;
    // The sender's Telegram language and the chat's title for the message being handled.
    private string? _currentLanguage;
    private string? _currentChatTitle;

    public CommandDispatcher(
        INightfallApiClient api,
        IBotMessenger messenger,
        IChatGameIndex chatGameIndex,
        IGameRosterStore rosterStore,
        IOptions<BotOptions> botOptions,
        ILogger<CommandDispatcher> logger, IBotSettingsService? settings = null)
    {
        _api = api;
        _messenger = messenger;
        _chatGameIndex = chatGameIndex;
        _rosterStore = rosterStore;
        _botOptions = botOptions.Value;
        _logger = logger;
        _settings = settings;
    }

    public async Task HandleMessageAsync(Message message)
    {
        if (message.Text is not { Length: > 0 } text || message.From is null)
            return;

        string? command = ParseCommand(text);
        if (command is null)
            return;

        _currentSettings = _settings is null ? null : await _settings.GetAsync();
        if (_currentSettings is not null && !_currentSettings.EnabledCommands.Contains(command)) return;

        long chatId = message.Chat.Id;
        var actor = ToIdentity(message.From);
        _currentLanguage = message.From.LanguageCode;
        _currentChatTitle = message.Chat.Title;

        try
        {
            switch (command)
            {
                case "newgame" when _currentSettings?.IsGameOn("mafia") == false:
                    await _messenger.SendTextAsync(chatId, BotMessages.Pick(BotSettingsDefaults.MafiaOff, BotSettingsDefaults.MafiaOffFa, _currentLanguage));
                    break;
                case "newgame": await HandleNewGameAsync(chatId, actor); break;
                case "join": await HandleJoinAsync(chatId, actor); break;
                case "startgame": await HandleStartGameAsync(chatId, actor); break;
                case "resolvenight": await HandleResolveNightAsync(chatId, actor); break;
                case "startvoting": await HandleStartVotingAsync(chatId, actor); break;
                case "resolvevoting": await HandleResolveVotingAsync(chatId, actor); break;
                case "startnight": await HandleStartNightAsync(chatId, actor); break;
                case "myrole": await HandleMyRoleAsync(chatId, actor); break;
                case "solotest": await HandleSoloTestAsync(chatId, actor); break;
                case "solonext": await HandleSoloNextAsync(chatId, actor); break;
                case "help": case "start": await HandleHelpAsync(chatId); break;
            }
        }
        catch (NightfallApiException ex)
        {
            await _messenger.SendTextAsync(chatId, $"⚠️ {ex.Message}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled error processing command {Command} in chat {ChatId}", command, chatId);
            await _messenger.SendTextAsync(chatId, "⚠️ Something went wrong handling that command.");
        }
    }

    /// <summary>Extracts the command word from a message like "/newgame", "/newgame@BotName", or
    /// "/newgame extra args" -> "newgame". Returns null for non-command text.</summary>
    internal static string? ParseCommand(string text)
    {
        if (!text.StartsWith('/'))
            return null;

        int end = text.IndexOfAny(new[] { ' ', '\n', '\t' });
        string firstToken = end < 0 ? text : text[..end];

        int at = firstToken.IndexOf('@');
        string command = at >= 0 ? firstToken[1..at] : firstToken[1..];

        return command.Length == 0 ? null : command.ToLowerInvariant();
    }

    internal static TelegramIdentity ToIdentity(User user) =>
        new(user.Id, user.FirstName, user.LastName, user.Username, user.LanguageCode);

    internal static string DisplayName(TelegramIdentity identity) =>
        identity.Username is { Length: > 0 } username ? $"@{username}" : identity.FirstName;

    private async Task<Guid?> GetActiveGameOrReplyAsync(long chatId)
    {
        var gameId = await _chatGameIndex.GetActiveGameAsync(chatId);
        if (gameId is null)
        {
            await _messenger.SendTextAsync(chatId, "No active game in this chat. Use /newgame to start one.");
        }
        return gameId;
    }

    private async Task HandleNewGameAsync(long chatId, TelegramIdentity actor)
    {
        if (await RejectMaintenanceAsync(chatId)) return;
        var existing = await _chatGameIndex.GetActiveGameAsync(chatId);
        if (existing is not null)
        {
            await _messenger.SendTextAsync(chatId, "A game is already in progress in this chat.");
            return;
        }

        var gameId = await _api.CreateGameAsync(chatId, actor, _currentChatTitle);
        await _messenger.SendWithUrlButtonAsync(chatId,
            (_currentSettings is { } welcome ? BotMessages.Pick(welcome.WelcomeMessage, welcome.WelcomeMessageFa, _currentLanguage) : "🌙 New Nightfall game created by {creator}! Open the lobby to join, or use /join. Once everyone's in, /startgame.").Replace("{creator}", DisplayName(actor)),
            BuildMiniAppUrl(gameId));
    }

    private async Task HandleJoinAsync(long chatId, TelegramIdentity actor)
    {
        if (await RejectMaintenanceAsync(chatId)) return;
        var gameId = await GetActiveGameOrReplyAsync(chatId);
        if (gameId is null)
            return;

        await _api.JoinGameAsync(gameId.Value, actor);
        await _messenger.SendTextAsync(chatId, $"{DisplayName(actor)} joined the game.");
    }

    private async Task HandleStartGameAsync(long chatId, TelegramIdentity actor)
    {
        var gameId = await GetActiveGameOrReplyAsync(chatId);
        if (gameId is null)
            return;

        await _api.StartGameAsync(gameId.Value, actor);
        await _messenger.SendWithUrlButtonAsync(chatId,
            "🎭 Roles have been assigned! Open Nightfall to play, and check your DMs for your role.",
            BuildMiniAppUrl(gameId.Value));

        await RevealRolesAsync(chatId, gameId.Value);
    }

    private async Task RevealRolesAsync(long chatId, Guid gameId)
    {
        var roster = await _rosterStore.GetAsync(gameId);
        var couldNotReach = new List<string>();
        string? miniAppUrl = BuildMiniAppUrl(gameId);

        foreach (var entry in roster)
        {
            try
            {
                var playerIdentity = new TelegramIdentity(entry.TelegramUserId, entry.Username, null, entry.Username, null);
                var view = await _api.GetGameAsync(gameId, playerIdentity);
                await _messenger.SendWithMiniAppButtonAsync(entry.TelegramUserId, FormatRoleReveal(view), miniAppUrl);
            }
            catch (Exception ex)
            {
                // Most commonly: Telegram refuses to let a bot DM a user who hasn't started a
                // conversation with it yet. Not fatal to the game — just tell them in the group.
                _logger.LogWarning(ex, "Could not DM role reveal to {TelegramUserId}", entry.TelegramUserId);
                couldNotReach.Add(entry.Username);
            }
        }

        if (couldNotReach.Count > 0)
        {
            string names = string.Join(", ", couldNotReach.Select(u => $"@{u}"));
            await _messenger.SendTextAsync(chatId, $"{names}: please message me privately first so I can DM you your role.");
        }
    }

    private static string FormatRoleReveal(GameViewDto view) => view.YourRole switch
    {
        Role.Villager => "👤 You are a *Villager*. Work with the town to find the Mafia.",
        Role.Detective => "🔍 You are the *Detective*. Each night, investigate one player to learn if they're Mafia-aligned.",
        Role.Doctor => "💉 You are the *Doctor*. Each night, choose one player to protect from the Mafia's kill.",
        Role.Mafia => "🔪 You are *Mafia*. Work with your team to eliminate the Villagers without being caught.",
        Role.Godfather => "👑 You are the *Godfather*, leader of the Mafia. Choose who dies each night.",
        Role.Sniper => "🎯 You are the *Sniper*. You have one night shot: hit a Mafia member and they die, hit the town and you die.",
        Role.DieHard => "🛡 You are the *Die Hard*. You survive the first night kill, and once per game can call an Inquiry.",
        Role.Silencer => "🤫 You are the *Silencer* (Mafia). Each night, silence one player for the next day.",
        Role.Joker => "🃏 You are the *Joker*. You win if the town votes you out.",
        Role.Mayor => "🏛 You are the *Mayor*. Reveal yourself on your turn and your vote counts twice.",
        _ => "Your role hasn't been assigned yet."
    } + "\n\nOpen the Mini App to play.";

    private async Task HandleResolveNightAsync(long chatId, TelegramIdentity actor)
    {
        var gameId = await GetActiveGameOrReplyAsync(chatId);
        if (gameId is null)
            return;

        var result = await _api.ResolveNightAsync(gameId.Value, actor);
        var view = await _api.GetGameAsync(gameId.Value, actor);

        await _messenger.SendTextAsync(chatId, FormatNightResult(result, view));
        await AnnounceIfGameEndedAsync(chatId, view);
    }

    private static string FormatNightResult(NightResult result, GameViewDto view)
    {
        if (!result.Eliminated.HasValue)
        {
            return result.TargetWasSaved
                ? "🌅 The Doctor saved the target! Nobody died last night."
                : "🌅 Nobody was targeted last night.";
        }

        var victim = view.Players.FirstOrDefault(p => p.PlayerId == result.Eliminated.Value);
        string name = victim?.TelegramUsername ?? "Someone";
        string roleText = victim?.RevealedRole is { } role ? $" They were a {role}." : "";
        return $"🌅 {name} was found dead this morning.{roleText}";
    }

    private async Task HandleStartVotingAsync(long chatId, TelegramIdentity actor)
    {
        var gameId = await GetActiveGameOrReplyAsync(chatId);
        if (gameId is null)
            return;

        await _api.StartVotingAsync(gameId.Value, actor);
        await _messenger.SendTextAsync(chatId, "🗳️ Voting is open. Cast your votes, then /resolvevoting.");
    }

    private async Task HandleResolveVotingAsync(long chatId, TelegramIdentity actor)
    {
        var gameId = await GetActiveGameOrReplyAsync(chatId);
        if (gameId is null)
            return;

        var result = await _api.ResolveVotingAsync(gameId.Value, actor);
        var view = await _api.GetGameAsync(gameId.Value, actor);

        await _messenger.SendTextAsync(chatId, FormatVotingResult(result, view));
        await AnnounceIfGameEndedAsync(chatId, view);
    }

    private static string FormatVotingResult(VotingResult result, GameViewDto view)
    {
        if (result.WasTie)
            return result.Round == 1
                ? "🤝 The vote was tied. The tied players now defend themselves, then the town votes again between them only."
                : "🤝 The re-vote was tied too. Nobody was eliminated.";

        if (!result.Eliminated.HasValue)
            return "🗳️ No votes were cast. Nobody was eliminated.";

        var eliminated = view.Players.FirstOrDefault(p => p.PlayerId == result.Eliminated.Value);
        string name = eliminated?.TelegramUsername ?? "Someone";
        // Their role is shown in the Mini App once their last words are over.
        return $"⚖️ The town has voted out {name}. They now have their last words.";
    }

    private async Task HandleStartNightAsync(long chatId, TelegramIdentity actor)
    {
        var gameId = await GetActiveGameOrReplyAsync(chatId);
        if (gameId is null)
            return;

        await _api.StartNightAsync(gameId.Value, actor);
        await _messenger.SendTextAsync(chatId, "🌙 Night falls. Check your DMs / the Mini App for your night action.");
    }

    private async Task AnnounceIfGameEndedAsync(long chatId, GameViewDto view)
    {
        if (view.WinCondition == WinCondition.None)
            return;

        string winner = view.WinCondition switch
        {
            WinCondition.VillagersWin => "The Villagers",
            WinCondition.JokerWins => "The Joker",
            _ => "The Mafia"
        };
        await _messenger.SendTextAsync(chatId, $"🏆 Game over! {winner} {(view.WinCondition == WinCondition.JokerWins ? "wins" : "win")}!");
    }

    private async Task HandleMyRoleAsync(long chatId, TelegramIdentity actor)
    {
        var gameId = await GetActiveGameOrReplyAsync(chatId);
        if (gameId is null)
            return;

        var view = await _api.GetGameAsync(gameId.Value, actor);
        try
        {
            string? miniAppUrl = BuildMiniAppUrl(gameId.Value);
            await _messenger.SendWithMiniAppButtonAsync(actor.Id, FormatRoleReveal(view), miniAppUrl);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not DM /myrole to {TelegramUserId}", actor.Id);
            await _messenger.SendTextAsync(chatId, $"{DisplayName(actor)}: please message me privately first so I can DM you.");
        }
    }

    private async Task HandleSoloTestAsync(long chatId, TelegramIdentity actor)
    {
        if (!await EnsureSoloTestEnabledAsync(chatId))
            return;

        var gameId = await GetActiveGameOrReplyAsync(chatId);
        if (gameId is null)
            return;

        var view = await _api.GetGameAsync(gameId.Value, actor);
        if (view.Phase != GamePhase.Lobby)
        {
            await _messenger.SendTextAsync(chatId, "Solo test can only fill a lobby before roles are assigned.");
            return;
        }

        int needed = Math.Max(0, 5 - view.Players.Count);
        for (int i = 1; i <= needed; i++)
            await _api.JoinGameAsync(gameId.Value, SoloIdentity(i));

        await _api.StartGameAsync(gameId.Value, actor);
        var playerView = await _api.GetGameAsync(gameId.Value, actor);
        string? miniAppUrl = BuildMiniAppUrl(gameId.Value);

        await _messenger.SendWithUrlButtonAsync(chatId,
            "Solo test started with automated players. Open Nightfall to play; use /solonext to advance one phase at a time.",
            miniAppUrl);
        await _messenger.SendWithMiniAppButtonAsync(actor.Id, FormatRoleReveal(playerView), miniAppUrl);
    }

    private async Task HandleSoloNextAsync(long chatId, TelegramIdentity actor)
    {
        if (!await EnsureSoloTestEnabledAsync(chatId))
            return;

        var gameId = await GetActiveGameOrReplyAsync(chatId);
        if (gameId is null)
            return;

        var view = await _api.GetGameAsync(gameId.Value, actor);
        switch (view.Phase)
        {
            case GamePhase.NightZero:
            case GamePhase.Night:
                await SubmitSoloNightActionsAsync(gameId.Value);
                var nightResult = await _api.ResolveNightAsync(gameId.Value, actor);
                var afterNight = await _api.GetGameAsync(gameId.Value, actor);
                await _messenger.SendTextAsync(chatId, FormatNightResult(nightResult, afterNight));
                await AnnounceIfGameEndedAsync(chatId, afterNight);
                break;

            case GamePhase.Day:
                await _api.StartVotingAsync(gameId.Value, actor);
                await _messenger.SendTextAsync(chatId,
                    "Voting is open. Cast your vote in the Mini App, then use /solonext again.");
                break;

            case GamePhase.Voting:
                await SubmitSoloVotesAsync(gameId.Value, view);
                var votingResult = await _api.ResolveVotingAsync(gameId.Value, actor);
                var afterVoting = await _api.GetGameAsync(gameId.Value, actor);
                await _messenger.SendTextAsync(chatId, FormatVotingResult(votingResult, afterVoting));
                await AnnounceIfGameEndedAsync(chatId, afterVoting);
                break;

            case GamePhase.Defence:
            case GamePhase.LastWords:
                await _messenger.SendTextAsync(chatId,
                    "This turn moves on by itself when its timer runs out (or the speaker finishes early). Use /solonext after that.");
                break;

            case GamePhase.Results:
                await _api.StartNightAsync(gameId.Value, actor);
                await _messenger.SendTextAsync(chatId,
                    "The next night started. Choose your action in the Mini App, then use /solonext.");
                break;

            case GamePhase.Ended:
                await _messenger.SendTextAsync(chatId, "The solo test ended. Use /newgame for another run.");
                break;

            default:
                await _messenger.SendTextAsync(chatId, "Use /solotest from an active lobby first.");
                break;
        }
    }

    private async Task SubmitSoloNightActionsAsync(Guid gameId)
    {
        var fakeEntries = (await _rosterStore.GetAsync(gameId))
            .Where(entry => entry.Username.StartsWith("solo_bot_", StringComparison.Ordinal));

        foreach (var entry in fakeEntries)
        {
            var fake = SoloIdentityFromRoster(entry);
            var view = await _api.GetGameAsync(gameId, fake);
            if (!view.YouAreAlive || view.YourRole is not { } role)
                continue;

            NightActionType? action = role switch
            {
                Role.Godfather or Role.Mafia => NightActionType.Kill,
                Role.Detective => NightActionType.Investigate,
                Role.Doctor => NightActionType.Heal,
                _ => null
            };
            if (action is null)
                continue;

            var targets = view.Players
                .Where(player => player.IsAlive && player.PlayerId != view.YourPlayerId)
                .OrderByDescending(player => player.TelegramUsername.StartsWith("solo_bot_", StringComparison.Ordinal));

            foreach (var target in targets)
            {
                try
                {
                    await _api.SubmitNightActionAsync(gameId, fake, target.PlayerId, action.Value);
                    break;
                }
                catch (NightfallApiException)
                {
                    // Try another target when a role-specific rule rejects this one.
                }
            }
        }
    }

    private async Task SubmitSoloVotesAsync(Guid gameId, GameViewDto humanView)
    {
        // In a re-vote only the tied players can be voted for.
        var victim = humanView.Players.FirstOrDefault(player =>
            player.IsAlive && (humanView.VotingRound == 2
                ? humanView.RunoffCandidateIds?.Contains(player.PlayerId) == true
                : player.TelegramUsername.StartsWith("solo_bot_", StringComparison.Ordinal)));
        var fakeEntries = (await _rosterStore.GetAsync(gameId))
            .Where(entry => entry.Username.StartsWith("solo_bot_", StringComparison.Ordinal));

        foreach (var entry in fakeEntries)
        {
            var fake = SoloIdentityFromRoster(entry);
            var view = await _api.GetGameAsync(gameId, fake);
            if (view.YouAreAlive)
                await _api.SubmitVoteAsync(gameId, fake, victim?.PlayerId);
        }
    }

    private async Task<bool> EnsureSoloTestEnabledAsync(long chatId)
    {
        // The deployment flag is an explicit operational override. Database-backed dashboard
        // settings must not mask it merely because a settings row (whose default is false) exists.
        if (_botOptions.SoloTestEnabled || _currentSettings?.SoloTestEnabled == true)
            return true;

        await _messenger.SendTextAsync(chatId,
            "Solo test mode is disabled. Enable it in Admin Settings or set SOLO_TEST_ENABLED=true and redeploy.");
        return false;
    }

    private static TelegramIdentity SoloIdentity(int index) =>
        new(-9_000_000_000L - index, $"Solo {index}", null, $"solo_bot_{index}", null);

    private static TelegramIdentity SoloIdentityFromRoster(GameRosterEntry entry) =>
        new(entry.TelegramUserId, entry.Username, null, entry.Username, null);

    private string? BuildMiniAppUrl(Guid gameId) =>
        ((_currentSettings?.MiniAppBaseUrl is { Length: > 0 } dynamicUrl ? dynamicUrl : _botOptions.MiniAppBaseUrl) is { Length: > 0 } baseUrl)
            ? $"{baseUrl}?startapp={gameId}"
            : null;

    private Task HandleHelpAsync(long chatId) => _messenger.SendTextAsync(chatId, _currentSettings is { } help ? BotMessages.Pick(help.HelpMessage, help.HelpMessageFa, _currentLanguage) : BotSettingsDefaults.HelpMessage);

    private async Task<bool> RejectMaintenanceAsync(long chatId)
    {
        if (_currentSettings?.MaintenanceMode != true) return false;
        await _messenger.SendTextAsync(chatId, BotMessages.Pick(_currentSettings.MaintenanceMessage, _currentSettings.MaintenanceMessageFa, _currentLanguage));
        return true;
    }
}
