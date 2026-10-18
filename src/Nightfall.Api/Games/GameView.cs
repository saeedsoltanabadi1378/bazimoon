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
    IReadOnlyList<MvpView>? Mvps = null)
{
    public static GameView For(GameState game, Guid viewerId)
    {
        var viewer = game.GetPlayer(viewerId);
        bool revealAll = game.CurrentPhase == GamePhase.Ended;
        bool viewerIsMafia = viewer?.IsMafiaAligned == true;
        var controller = game.Controller;
        bool isController = controller?.Id == viewerId;
        // A player's role is shown after their last words, not while they are still speaking.
        Guid? speakingLastWords = game.CurrentPhase == GamePhase.LastWords ? game.LastWordsPlayerId : null;

        var players = game.Players
            .Select(p => new PlayerView(
                p.Id,
                p.TelegramUsername,
                p.IsAlive,
                RevealedRole: (revealAll || (!p.IsAlive && p.Id != speakingLastWords) || p.Id == viewerId) ? p.Role : null,
                EliminatedBy: p.EliminatedBy,
                EliminatedRound: p.EliminatedRound,
                // Who took over as Godfather is Mafia-only knowledge until the game ends.
                WasPromoted: p.WasPromoted && (revealAll || viewerIsMafia)))
            .ToList();

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
                .Select(p => new DetectiveResultView(p!.Id, p.IsMafiaAligned))
                .ToList()
            : null;

        EliminationView? nightElimination = game.LastNightResult is null
            ? null
            : new EliminationView(game.LastNightResult.Eliminated, game.LastNightResult.TargetWasSaved,
                GodfatherPromoted: game.LastNightResult.PromotedGodfatherId.HasValue);

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
            viewer?.Role,
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
            game.CurrentPhase == GamePhase.Ended ? MvpView.For(game) : null);
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
    bool WasPromoted = false);

public sealed record DetectiveResultView(Guid TargetPlayerId, bool IsMafiaAligned);

public sealed record EliminationView(
    Guid? EliminatedPlayerId,
    bool WasSaved,
    bool WasTie = false,
    IReadOnlyList<Guid>? TiedPlayers = null,
    bool GodfatherPromoted = false,
    IReadOnlyList<VoteView>? Ballots = null,
    int Round = 1,
    IReadOnlyList<VoteView>? PreviousBallots = null);

/// <summary>The player saying their last words, why they are out, and when their time is up.</summary>
public sealed record LastWordsView(Guid PlayerId, EliminationCause Cause, DateTimeOffset Deadline, bool YouAreSpeaking);

/// <summary>The table's timers (seconds; null night or voting = the creator moves it on) and rule switches.</summary>
public sealed record RulesView(
    int SpeakerSeconds, int ChallengeSeconds, int DefenceSeconds, int LastWordsSeconds,
    int? NightSeconds, int? VotingSeconds, bool LastWordsForNightKills)
{
    public static RulesView From(GameConfig c) => new(
        c.SpeakerSeconds, c.ChallengeSeconds, c.DefenceSeconds, c.LastWordsSeconds,
        c.NightSeconds, c.VotingSeconds, c.LastWordsForNightKills);
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
