using Nightfall.Domain;
using Nightfall.Infrastructure.History;

namespace Nightfall.Infrastructure.Hub;

public sealed record RoleStats(Role Role, int Games, int WinRate);

/// <summary>Totals over the games that have a log (TrackedGames). Older games are left out.</summary>
public sealed record MafiaSkillStats(
    int TrackedGames, int ChecksMade, int MafiaFound, int DoctorNights, int KillsBlocked,
    int VotesCast, int VotesOnMafia, int NightsSurvived, int MvpCount);

/// <param name="Progress">For counted achievements (Survivor), how far along the player is.</param>
public sealed record AchievementStatus(string Key, DateTime? EarnedAt, Guid? GameId, int? Progress = null, int? Target = null);

/// <summary>Per-role numbers and achievements, worked out from a player's finished, rated games.</summary>
public static class MafiaStats
{
    public const int SurvivorTarget = 10;

    /// <summary>The Mafia achievements, in the order they are shown.</summary>
    public static readonly string[] AchievementKeys = ["sharpEye", "guardianAngel", "theDon", "kingslayer", "silverTongue", "survivor", "clutchShot", "jester"];

    public static IReadOnlyList<RoleStats> ByRole(IEnumerable<GamePlayerRecord> games) =>
        games.Where(g => g.Role.HasValue).GroupBy(g => g.Role!.Value).OrderBy(g => g.Key)
            .Select(g => new RoleStats(g.Key, g.Count(), Percent(g.Count(x => x.Won == true), g.Count()))).ToList();

    public static MafiaSkillStats Skills(IEnumerable<GamePlayerRecord> games)
    {
        var tracked = games.Where(g => g.MvpPoints.HasValue).ToList();
        return new MafiaSkillStats(
            tracked.Count,
            tracked.Sum(g => g.ChecksMade ?? 0),
            tracked.Sum(g => g.MafiaFound ?? 0),
            tracked.Sum(g => g.SavesMade ?? 0),
            tracked.Sum(g => g.KillsBlocked ?? 0),
            tracked.Sum(g => g.VotesCast ?? 0),
            tracked.Sum(g => g.VotesOnMafia ?? 0),
            tracked.Sum(g => g.NightsSurvived ?? 0),
            tracked.Count(g => g.IsMvp));
    }

    /// <summary>Each achievement with the game that first earned it. <paramref name="games"/> must carry GameRecord.</summary>
    public static IReadOnlyList<AchievementStatus> Achievements(IEnumerable<GamePlayerRecord> games)
    {
        var ordered = games.OrderBy(g => g.GameRecord.EndedAt).ToList();
        AchievementStatus First(string key, Func<GamePlayerRecord, bool> earned)
        {
            var g = ordered.FirstOrDefault(earned);
            return new AchievementStatus(key, g?.GameRecord.EndedAt, g?.GameRecordId);
        }
        var survived = ordered.Where(g => g.SurvivedToEnd).ToList();
        var tenth = survived.Count >= SurvivorTarget ? survived[SurvivorTarget - 1] : null;
        return
        [
            // Games from before the log count when they were won as the Detective, as the old badge did.
            First("sharpEye", g => g.MafiaFound >= 2 || (g.MafiaFound is null && g.Won == true && g.Role == Role.Detective)),
            First("guardianAngel", g => g.KillsBlocked >= 1),
            First("theDon", g => g.Won == true && g.Role == Role.Godfather),
            First("kingslayer", g => g.VotedOutGodfather == true),
            First("silverTongue", g => g.SurvivedRevote == true),
            new AchievementStatus("survivor", tenth?.GameRecord.EndedAt, tenth?.GameRecordId, Math.Min(survived.Count, SurvivorTarget), SurvivorTarget),
            First("clutchShot", g => g.ShotGodfather == true),
            First("jester", g => g.Won == true && g.Role == Role.Joker),
        ];
    }

    private static int Percent(int part, int whole) => whole == 0 ? 0 : (int)Math.Round(100.0 * part / whole);
}
