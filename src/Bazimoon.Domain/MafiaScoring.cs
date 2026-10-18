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
    bool ShotGodfather = false);

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
            int points = (won ? PointsTeamWon : 0) + found * PointsMafiaFound + blocked * PointsKillBlocked
                + kills * PointsKillMade + onMafiaOut * PointsVoteOnMafiaOut + survived * PointsNightSurvived;
            return (Stats: new PlayerGameStats(id, checks, found, saves, blocked, kills, ballots.Count, onMafia, onMafiaOut, survived, revote, kingslayer, points, false, won, shotGodfather), Won: won);
        }).ToList();

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
