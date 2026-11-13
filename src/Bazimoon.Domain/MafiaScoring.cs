namespace Bazimoon.Domain;

/// <summary>What one player did in a finished game, worked out from its event log.</summary>
public sealed record PlayerGameStats(
    Guid PlayerId,
    int ChecksMade,
    int MafiaFound,
    int SavesMade,
    int KillsBlocked,
    int KillsMade,
    int VotesCast,
    int VotesOnMafia,
    int VotesOnMafiaOut,
    int NightsSurvived,
    bool SurvivedRevote,
    bool VotedOutGodfather,
    int Points,
    bool IsMvp,
    bool Won = false,
    bool ShotGodfather = false,
    int VotesSurvivedAsMafia = 0,
    int PowerRolesSilenced = 0,
    int DecidingMayorVotes = 0,
    bool JokerWon = false,
    int AttacksSurvived = 0,
    int GuardSaves = 0,
    int Recruits = 0,
    int SuspicionsRight = 0);

/// <summary>Turns a finished game's log into per-player stats and picks the MVP. No voting: the MVP
/// is the player on the winning team with the most points; everyone tied on points is MVP.</summary>
public static class MafiaScoring
{
    public const int PointsTeamWon = 3;
    public const int PointsMafiaFound = 3;
    public const int PointsKillBlocked = 3;
    public const int PointsKillMade = 2;
    public const int PointsVoteOnMafiaOut = 2;
    public const int PointsNightSurvived = 1;

    // Points for the roles and play styles the list above misses, so the MVP is not always a Detective, Doctor or killer.
    /// <summary>A Mafia member got votes in a round and was still standing after it: the bluff held.</summary>
    public const int PointsVoteSurvivedAsMafia = 2;
    /// <summary>The Silencer silenced a player with a power role.</summary>
    public const int PointsPowerRoleSilenced = 2;
    /// <summary>The revealed Mayor's second vote was what sent a Mafia member out.</summary>
    public const int PointsDecidingMayorVote = 3;
    /// <summary>The Joker got themselves voted out.</summary>
    public const int PointsJokerWon = 5;
    /// <summary>The Die Hard took the Mafia's kill and lived.</summary>
    public const int PointsAttackSurvived = 2;
    /// <summary>The Bodyguard died in place of the Mafia's target.</summary>
    public const int PointsGuardSave = 3;
    /// <summary>The Negotiator recruited a Villager.</summary>
    public const int PointsRecruit = 3;
    /// <summary>A Town player's private night suspicion was on a Mafia member.</summary>
    public const int PointsSuspicionRight = 1;

    private static readonly Role[] PowerRoles = [Role.Detective, Role.Doctor, Role.Sniper, Role.Mayor, Role.DieHard, Role.Bodyguard];

    public static IReadOnlyList<PlayerGameStats> Score(GameState game)
    {
        var players = game.Players;
        var events = game.Events;
        bool IsMafia(Guid id) => players.FirstOrDefault(p => p.Id == id)?.IsMafiaAligned == true;
        bool WasGodfather(Guid id, int round) =>
            players.FirstOrDefault(p => p.Id == id) is { Role: Role.Godfather } p &&
            (!p.WasPromoted || events.Any(e => e.Kind == GameEventKind.Promoted && e.PlayerId == id && e.Round <= round));
        var nights = events.Where(e => e.Kind == GameEventKind.Night).ToList();
        var votes = events.Where(e => e.Kind == GameEventKind.Vote).ToList();

        var raw = players.Select(p =>
        {
            var id = p.Id;
            int checks = nights.Count(n => n.DetectiveId == id && n.Checked.HasValue);
            int found = nights.Count(n => n.DetectiveId == id && n.CheckedIsMafia == true);
            int saves = nights.Count(n => n.DoctorId == id && n.Saved.HasValue);
            int blocked = nights.Count(n => n.DoctorId == id && n.Saved.HasValue && n.Saved == n.KillTarget && n.Killed is null);
            int kills = nights.Count(n => n.KillerId == id && n.Killed.HasValue)
                + nights.Count(n => n.SniperId == id && n.ShotOutcome == SniperOutcome.Hit);
            bool shotGodfather = nights.Any(n => n.SniperId == id && n.ShotOutcome == SniperOutcome.Hit && n.ShotTarget is { } t && WasGodfather(t, n.Round));
            var ballots = votes.Where(v => v.Ballots?.TryGetValue(id, out var t) == true && t.HasValue)
                .Select(v => (Vote: v, Target: v.Ballots![id]!.Value)).ToList();
            int onMafia = ballots.Count(b => IsMafia(b.Target));
            int onMafiaOut = ballots.Count(b => b.Vote.VotedOut == b.Target && IsMafia(b.Target));
            bool kingslayer = ballots.Any(b => b.Vote.VotedOut == b.Target && WasGodfather(b.Target, b.Vote.Round));
            bool revote = votes.Any(v => v.VoteRound == 2 && WasRunoffCandidate(votes, v, id) && v.VotedOut != id);
            int survived = nights.Count(n => SurvivedNight(p, n.Round));
            bool won = game.DidWin(p) == true;

            // A recruited Villager only counts as Mafia from the night they joined.
            int votesSurvived = p.IsMafiaAligned
                ? votes.Count(v => v.VotedOut != id && v.Ballots?.Values.Contains(id) == true && StillIn(p, v.Round) && WasMafiaBy(id, v.Round))
                : 0;
            int powerSilenced = nights.Count(n => n.SilencerId == id && n.Silenced is { } quiet && players.FirstOrDefault(x => x.Id == quiet)?.Role is { } r && PowerRoles.Contains(r));
            int deciding = votes.Count(v => MayorDecided(v, id));
            bool jokerWon = game.JokerWinnerId == id;
            int attacksSurvived = nights.Count(n => n.DieHardSurvived == id);
            int guardSaves = nights.Count(n => n.BodyguardId == id && n.BodyguardDied == true);
            int recruits = nights.Count(n => n.NegotiatorId == id && n.Negotiated == true);
            int suspicionsRight = p.Team == Team.Town
                ? nights.Count(n => n.Suspicions?.TryGetValue(id, out var suspect) == true && IsMafia(suspect) && WasMafiaBy(suspect, n.Round))
                : 0;

            int points = (won ? PointsTeamWon : 0) + found * PointsMafiaFound + blocked * PointsKillBlocked
                + kills * PointsKillMade + onMafiaOut * PointsVoteOnMafiaOut + survived * PointsNightSurvived
                + votesSurvived * PointsVoteSurvivedAsMafia + powerSilenced * PointsPowerRoleSilenced + deciding * PointsDecidingMayorVote
                + (jokerWon ? PointsJokerWon : 0) + attacksSurvived * PointsAttackSurvived + guardSaves * PointsGuardSave
                + recruits * PointsRecruit + suspicionsRight * PointsSuspicionRight;
            return (Stats: new PlayerGameStats(id, checks, found, saves, blocked, kills, ballots.Count, onMafia, onMafiaOut, survived, revote, kingslayer, points, false, won, shotGodfather,
                votesSurvived, powerSilenced, deciding, jokerWon, attacksSurvived, guardSaves, recruits, suspicionsRight), Won: won);
        }).ToList();

        bool WasMafiaBy(Guid id, int round) =>
            !nights.Any(n => n.NegotiationTarget == id && n.Negotiated == true && n.Round > round);
        bool StillIn(Player p, int round) => p.EliminatedRound is not { } outRound || outRound > round;

        // The Mayor's vote counted twice once they revealed. It decided the vote when, counted once,
        // the Mafia member who went out would only have tied or lost.
        bool MayorDecided(GameEvent vote, Guid mayorId)
        {
            if (vote.VotedOut is not { } outId || !IsMafia(outId) || vote.Ballots is null) return false;
            if (!vote.Ballots.TryGetValue(mayorId, out var pick) || pick != outId) return false;
            if (!events.Any(e => e.Kind == GameEventKind.MayorRevealed && e.PlayerId == mayorId && e.Round <= vote.Round)) return false;
            var counts = vote.Ballots.Where(b => b.Value.HasValue).GroupBy(b => b.Value!.Value)
                .ToDictionary(g => g.Key, g => g.Sum(b => b.Key == mayorId ? 2 : 1));
            int rest = counts.Where(c => c.Key != outId).Select(c => c.Value).DefaultIfEmpty(0).Max();
            return counts[outId] - 1 <= rest;
        }

        var winners = raw.Where(r => r.Won).ToList();
        int best = winners.Count == 0 ? -1 : winners.Max(r => r.Stats.Points);
        return raw.Select(r => r.Won && r.Stats.Points == best ? r.Stats with { IsMvp = true } : r.Stats).ToList();
    }

    /// <summary>Round 2 is only between the players tied in the round 1 just before it.</summary>
    private static bool WasRunoffCandidate(List<GameEvent> votes, GameEvent round2, Guid id)
    {
        int i = votes.IndexOf(round2);
        return i > 0 && votes[i - 1].VoteRound == 1 && votes[i - 1].Tied?.Contains(id) == true;
    }

    /// <summary>Night N comes before day N, so a player voted out on day N still lived through night N.</summary>
    private static bool SurvivedNight(Player p, int night) =>
        p.EliminatedRound is not { } round || round > night || (round == night && p.EliminatedBy == EliminationCause.Vote);
}
