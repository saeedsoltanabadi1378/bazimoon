namespace Nightfall.Domain;

/// <param name="Votes">Every ballot cast in the vote (voter → target, null target = abstained),
/// kept so the Results screen can show the final tally after the live votes are cleared.</param>
/// <param name="Round">1 for the day's vote, 2 for the re-vote between the players tied in round 1.</param>
/// <param name="PreviousRound">When this is round 2, the tied round 1 it followed.</param>
public sealed record VotingResult(
    Guid? Eliminated,
    bool WasTie,
    IReadOnlyList<Guid> TiedPlayers,
    Guid? PromotedGodfatherId,
    IReadOnlyDictionary<Guid, Guid?>? Votes = null,
    int Round = 1,
    VotingResult? PreviousRound = null);
