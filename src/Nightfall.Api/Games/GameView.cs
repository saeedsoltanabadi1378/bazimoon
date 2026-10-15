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
    Guid? RematchGameId = null)
{
    public static GameView For(GameState game, Guid viewerId)
    {
        var viewer = game.GetPlayer(viewerId);
        bool revealAll = game.CurrentPhase == GamePhase.Ended;
        bool viewerIsMafia = viewer?.IsMafiaAligned == true;
        bool isController = game.Players.FirstOrDefault()?.Id == viewerId;

        var players = game.Players
            .Select(p => new PlayerView(
                p.Id,
                p.TelegramUsername,
                p.IsAlive,
                RevealedRole: (revealAll || !p.IsAlive || p.Id == viewerId) ? p.Role : null,
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
                Ballots: game.LastVotingResult.Votes?.Select(v => new VoteView(v.Key, v.Value)).ToList());

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
            game.CheckWinCondition(),
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
            game.RematchGameId);
    }
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
    IReadOnlyList<VoteView>? Ballots = null);

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
