namespace Nightfall.Domain;

/// <param name="Votes">Every ballot cast in the vote (voter → target, null target = abstained),
/// kept so the Results screen can show the final tally after the live votes are cleared.</param>
public sealed record VotingResult(
    Guid? Eliminated,
    bool WasTie,
    IReadOnlyList<Guid> TiedPlayers,
    Guid? PromotedGodfatherId,
    IReadOnlyDictionary<Guid, Guid?>? Votes = null);
