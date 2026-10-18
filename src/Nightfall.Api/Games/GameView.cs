using Nightfall.Domain;

namespace Nightfall.Api.Games;

/// <summary>Per-viewer projection of a GameState: only reveals a player's own role plus roles of
/// dead players / everyone once the game has ended. Never reveals other living players' roles or
/// another player's investigation results.</summary>
public sealed record GameView(
    Guid GameId,
    GamePhase Phase,
    int NightNumber,
    int MinPlayers,
    IReadOnlyList<PlayerView> Players,
    Guid YourPlayerId,
    Role? YourRole,
    bool YouAreAlive,
    DetectiveResultView? YourLastInvestigationResult,
    EliminationView? LastNightElimination,
    EliminationView? LastVotingElimination,
    WinCondition WinCondition,
    bool YouAreController,
    bool RequiredNightActionsComplete,
    IReadOnlyList<VoteView> Votes,
    DiscussionView? Discussion,
    int MaxPlayers = 12,
    IReadOnlyList<MafiaMemberView>? MafiaTeam = null,
    IReadOnlyList<NightSuggestionView>? MafiaSuggestions = null,
    Guid? YourNightActionTargetId = null,
    IReadOnlyList<DetectiveResultView>? YourInvestigations = null,
    bool YouCannotHealSelf = false,
    NightProgressView? NightProgress = null,
    Guid? RematchGameId = null,
    DateTimeOffset? PhaseDeadline = null,
    int VotingRound = 1,
    IReadOnlyList<Guid>? RunoffCandidateIds = null,
    LastWordsView? LastWords = null,
    RulesView? Rules = null,
    IReadOnlyList<Guid>? ReadyPlayerIds = null,
    DateTimeOffset? AutoStartAt = null,
    Guid? ControllerPlayerId = null,
    int YourStrikes = 0,
    IReadOnlyList<Guid>? RemovedForInactivity = null,
    IReadOnlyList<MvpView>? Mvps = null,
    Guid? SilencedPlayerId = null,
    bool YourAbilityUsed = false,
    bool YourInquiryUsed = false,
    bool YouSurvivedTheNight = false,
    SniperShotView? YourShot = null,
    Guid? MafiaSilenceTargetId = null,
    Guid? JokerWinnerId = null,
    SetupView? Setup = null,
    bool YouAreSpectator = false,
    int SpectatorCount = 0,
    IReadOnlyList<SpectatorView>? Spectators = null,
    bool YouCanUseGraveyard = false,
    bool YouAreMutedInGraveyard = false)
{
    public static GameView For(GameState game, Guid viewerId)
    {
        var viewer = game.GetPlayer(viewerId);
        // A spectator has no seat: with no viewer they get only what's public.
        var spectator = viewer is null ? game.GetSpectator(viewerId) : null;
        bool revealAll = game.CurrentPhase == GamePhase.Ended;
        bool hideDead = !game.Config.RevealRolesOnDeath && !revealAll;
        // At tables that hide roles, a player who is out sees no roles at all, their own included, so they can't leak them.
        bool viewerBlind = hideDead && viewer is { IsAlive: false };
        bool viewerIsMafia = viewer?.IsMafiaAligned == true && !viewerBlind;
        var controller = game.Controller;
        bool isController = controller?.Id == viewerId;
        // A player's role is shown after their last words, not while they are still speaking.
        Guid? speakingLastWords = game.CurrentPhase == GamePhase.LastWords ? game.LastWordsPlayerId : null;

        var players = game.Players
            .Select(p => new PlayerView(
                p.Id,
                p.TelegramUsername,
                p.IsAlive,
                RevealedRole: RoleShown(p) ? p.Role : null,
                EliminatedBy: p.EliminatedBy,
                EliminatedRound: p.EliminatedRound,
                // Who took over as Godfather is Mafia-only knowledge until the game ends.
                WasPromoted: p.WasPromoted && (revealAll || viewerIsMafia),
                Revealed: p.Revealed))
            .ToList();

        bool RoleShown(Player p)
        {
            if (revealAll) return true;
            if (viewerBlind) return false;
            if (p.Id == viewerId || p.Revealed || game.InquiryRevealed.Contains(p.Id)) return true;
            return !p.IsAlive && p.Id != speakingLastWords && !hideDead;
        }

        DetectiveResultView? investigation = null;
        if (viewer?.Role == Role.Detective &&
            game.LastNightResult is { DetectiveTarget: { } targetId, DetectiveResultIsMafiaAligned: { } isMafia })
        {
            investigation = new DetectiveResultView(targetId, isMafia);
        }

        // Alignment never changes during a game (a promoted Mafia stays Mafia-aligned), so the full
        // history can be derived from the investigated set rather than stored separately.
        IReadOnlyList<DetectiveResultView>? investigations = viewer?.Role == Role.Detective
            ? game.InvestigatedTargets
                .Select(id => game.GetPlayer(id))
                .Where(p => p is not null)
                .Select(p => new DetectiveResultView(p!.Id, game.LooksMafia(p)))
                .ToList()
            : null;

        EliminationView? nightElimination = game.LastNightResult is null
            ? null
            : new EliminationView(game.LastNightResult.Eliminated, game.LastNightResult.TargetWasSaved,
                GodfatherPromoted: game.LastNightResult.PromotedGodfatherId.HasValue,
                ShotPlayerId: game.LastNightResult.SniperOutcome switch
                {
                    SniperOutcome.Hit => game.LastNightResult.SniperTarget,
                    SniperOutcome.Backfired => game.Players.FirstOrDefault(p => p.Role == Role.Sniper && p.EliminatedBy == EliminationCause.Night && p.EliminatedRound == game.LastNightResult.NightNumber)?.Id,
                    _ => null
                });

        EliminationView? votingElimination = game.LastVotingResult is null
            ? null
            : new EliminationView(game.LastVotingResult.Eliminated, WasSaved: false, game.LastVotingResult.WasTie, game.LastVotingResult.TiedPlayers,
                GodfatherPromoted: game.LastVotingResult.PromotedGodfatherId.HasValue,
                Ballots: game.LastVotingResult.Votes?.Select(v => new VoteView(v.Key, v.Value)).ToList(),
                Round: game.LastVotingResult.Round,
                PreviousBallots: game.LastVotingResult.PreviousRound?.Votes?.Select(v => new VoteView(v.Key, v.Value)).ToList());

        var votes = game.CurrentPhase == GamePhase.Voting
            ? game.ToSnapshot().PendingVotes.Select(vote => new VoteView(vote.Key, vote.Value)).ToList()
            : [];

        IReadOnlyList<MafiaMemberView>? mafiaTeam = viewerIsMafia
            ? game.Players
                .Where(p => p.IsMafiaAligned)
                .OrderBy(p => p.GodfatherRank ?? int.MaxValue)
                .Select(p => new MafiaMemberView(p.Id, p.Role!.Value, p.GodfatherRank, p.IsAlive))
                .ToList()
            : null;

        IReadOnlyList<NightSuggestionView>? suggestions = viewerIsMafia && game.CurrentPhase == GamePhase.Night
            ? game.PendingNightActions
                .Where(a => a.ActionType == NightActionType.Kill)
                .Select(a => new NightSuggestionView(a.ActorId, a.TargetId))
                .ToList()
            : null;

        Guid? yourTarget = game.CurrentPhase == GamePhase.Night
            ? game.PendingNightActions.FirstOrDefault(a => a.ActorId == viewerId)?.TargetId
            : null;

        NightProgressView? progress = isController && game.CurrentPhase == GamePhase.Night
            ? new NightProgressView(game.SubmittedRequiredNightActionCount, game.RequiredNightActionCount)
            : null;

        return new GameView(
            game.GameId,
            game.CurrentPhase,
            game.NightNumber,
            game.Config.MinPlayers,
            players,
            viewerId,
            viewerBlind ? null : viewer?.Role,
            viewer?.IsAlive ?? false,
            investigation,
            nightElimination,
            votingElimination,
            // The win is announced once the last words are over.
            game.CurrentPhase == GamePhase.LastWords ? WinCondition.None : game.CheckWinCondition(),
            isController,
            game.AreRequiredNightActionsComplete(),
            votes,
            DiscussionView.For(game, viewerId),
            game.Config.MaxPlayers,
            mafiaTeam,
            suggestions,
            yourTarget,
            investigations,
            viewer?.Role == Role.Doctor && game.DoctorSelfHealBlocked,
            progress,
            game.RematchGameId,
            game.PhaseDeadline,
            game.VotingRound,
            game.RunoffCandidates.Count > 0 ? game.RunoffCandidates.ToList() : null,
            game.CurrentPhase == GamePhase.LastWords && game.LastWordsPlayerId is { } lastWords && game.PhaseDeadline is { } lastWordsDeadline
                ? new LastWordsView(lastWords, game.GetPlayer(lastWords)?.EliminatedBy ?? EliminationCause.Vote, lastWordsDeadline, lastWords == viewerId)
                : null,
            RulesView.From(game.Config),
            game.CurrentPhase == GamePhase.Lobby ? game.ReadyPlayers.ToList() : null,
            game.AutoStartAt,
            controller?.Id,
            game.Strikes.GetValueOrDefault(viewerId),
            game.LastRemovedForInactivity.Count > 0 ? game.LastRemovedForInactivity.ToList() : null,
            game.CurrentPhase == GamePhase.Ended ? MvpView.For(game) : null,
            game.SilencedPlayerId,
            viewer?.AbilityUsed ?? false,
            viewer?.InquiryUsed ?? false,
            game.LastNightResult?.DieHardSurvived == viewerId && game.CurrentPhase is not (GamePhase.Night or GamePhase.Ended),
            viewer?.Role == Role.Sniper && game.LastNightResult is { SniperTarget: { } shotAt, SniperOutcome: { } outcome } ? new SniperShotView(shotAt, outcome) : null,
            viewerIsMafia && game.CurrentPhase == GamePhase.Night
                ? game.PendingNightActions.FirstOrDefault(a => a.ActionType == NightActionType.Silence)?.TargetId : null,
            game.JokerWinnerId,
            SetupView.For(game),
            spectator is not null,
            game.Spectators.Count,
            // The creator manages who is watching, even while still alive and unable to read the graveyard.
            isController ? game.Spectators.Select(x => new SpectatorView(x.Id, x.Username, x.Muted)).ToList() : null,
            game.CanUseGraveyard(viewerId),
            spectator?.Muted ?? false);
    }
}

/// <summary>One point source for the MVP: what it was, how many times, and the points it gave.</summary>
public sealed record MvpPointsView(string Kind, int Count, int Points);

/// <summary>A player the game picked as MVP, with where their points came from.</summary>
public sealed record MvpView(Guid PlayerId, int Points, IReadOnlyList<MvpPointsView> Breakdown)
{
    public static IReadOnlyList<MvpView> For(GameState game) =>
        MafiaScoring.Score(game).Where(s => s.IsMvp).Select(s => new MvpView(s.PlayerId, s.Points, new List<MvpPointsView>
        {
            new("teamWon", 1, MafiaScoring.PointsTeamWon),
            new("mafiaFound", s.MafiaFound, s.MafiaFound * MafiaScoring.PointsMafiaFound),
            new("killBlocked", s.KillsBlocked, s.KillsBlocked * MafiaScoring.PointsKillBlocked),
            new("killMade", s.KillsMade, s.KillsMade * MafiaScoring.PointsKillMade),
            new("voteOnMafiaOut", s.VotesOnMafiaOut, s.VotesOnMafiaOut * MafiaScoring.PointsVoteOnMafiaOut),
            new("nightSurvived", s.NightsSurvived, s.NightsSurvived * MafiaScoring.PointsNightSurvived),
        }.Where(l => l.Count > 0).ToList())).ToList();
}

public sealed record PlayerView(
    Guid PlayerId,
    string TelegramUsername,
    bool IsAlive,
    Role? RevealedRole,
    EliminationCause? EliminatedBy = null,
    int? EliminatedRound = null,
    bool WasPromoted = false,
    bool Revealed = false);

/// <summary>Someone watching the table, as the creator sees them.</summary>
public sealed record SpectatorView(Guid Id, string Username, bool Muted);

/// <summary>The Sniper's own shot last night and what it did.</summary>
public sealed record SniperShotView(Guid TargetPlayerId, SniperOutcome Outcome);

/// <summary>The roles the table's setup deals for the players now in the lobby, or why it can't start.</summary>
public sealed record SetupView(RolePreset Preset, IReadOnlyList<Role>? Roles, int MinimumPlayers, SetupProblem? Problem)
{
    public static SetupView For(GameState game)
    {
        var roles = game.Config.Roles.RolesFor(game.Players.Count, out var problem);
        return new SetupView(game.Config.Roles.Preset, roles, game.Config.Roles.MinimumPlayers(game.Config.MinPlayers), problem);
    }
}

public sealed record DetectiveResultView(Guid TargetPlayerId, bool IsMafiaAligned);

public sealed record EliminationView(
    Guid? EliminatedPlayerId,
    bool WasSaved,
    bool WasTie = false,
    IReadOnlyList<Guid>? TiedPlayers = null,
    bool GodfatherPromoted = false,
    IReadOnlyList<VoteView>? Ballots = null,
    int Round = 1,
    IReadOnlyList<VoteView>? PreviousBallots = null,
    Guid? ShotPlayerId = null);

/// <summary>The player saying their last words, why they are out, and when their time is up.</summary>
public sealed record LastWordsView(Guid PlayerId, EliminationCause Cause, DateTimeOffset Deadline, bool YouAreSpeaking);

/// <summary>The table's timers (seconds; null night or voting = the creator moves it on) and rule switches.</summary>
public sealed record RulesView(
    int SpeakerSeconds, int ChallengeSeconds, int DefenceSeconds, int LastWordsSeconds,
    int? NightSeconds, int? VotingSeconds, bool LastWordsForNightKills,
    RolePreset Preset = RolePreset.Classic, bool GodfatherAppearsInnocent = false, bool JokerWinEndsGame = true, bool RevealRolesOnDeath = true, bool AllowSpectators = false)
{
    public static RulesView From(GameConfig c) => new(
        c.SpeakerSeconds, c.ChallengeSeconds, c.DefenceSeconds, c.LastWordsSeconds,
        c.NightSeconds, c.VotingSeconds, c.LastWordsForNightKills,
        c.Roles.Preset, c.GodfatherAppearsInnocent, c.JokerWinEndsGame, c.RevealRolesOnDeath, c.AllowSpectators);
}

public sealed record VoteView(Guid VoterPlayerId, Guid? TargetPlayerId);

/// <summary>One member of the Mafia team as seen by another Mafia member. Rank is the succession order.</summary>
public sealed record MafiaMemberView(Guid PlayerId, Role Role, int? Rank, bool IsAlive);

/// <summary>A kill target picked by a Mafia member tonight. Only the Godfather's pick is final.</summary>
public sealed record NightSuggestionView(Guid ActorPlayerId, Guid TargetPlayerId);

public sealed record NightProgressView(int Submitted, int Required);

public sealed record DiscussionView(
    DiscussionSegmentType SegmentType,
    Guid ActivePlayerId,
    Guid OriginalSpeakerId,
    DateTimeOffset Deadline,
    IReadOnlyList<Guid> PendingChallengerIds,
    bool YourChallengeIsPending,
    bool YouCanRequestChallenge,
    bool YouCanFinish,
    IReadOnlyList<Guid>? SpeakerOrder = null,
    IReadOnlyList<Guid>? CompletedSpeakerIds = null)
{
    public static DiscussionView? For(GameState game, Guid viewerId)
    {
        if (game.Discussion is not { } discussion) return null;
        bool isSpeaker = discussion.SegmentType == DiscussionSegmentType.Speaker && discussion.ActivePlayerId == viewerId;
        bool pending = discussion.PendingChallengeRequests.Contains(viewerId);
        var viewer = game.GetPlayer(viewerId);
        return new DiscussionView(
            discussion.SegmentType, discussion.ActivePlayerId, discussion.OriginalSpeakerId, discussion.Deadline,
            isSpeaker ? discussion.PendingChallengeRequests.ToList() : [], pending,
            discussion.SegmentType == DiscussionSegmentType.Speaker && viewer?.IsAlive == true && viewerId != discussion.ActivePlayerId && !pending,
            viewerId == discussion.ActivePlayerId,
            discussion.SpeakerOrder.Where(id => game.GetPlayer(id)?.IsAlive == true).ToList(),
            discussion.CompletedSpeakers.ToList());
    }
}
