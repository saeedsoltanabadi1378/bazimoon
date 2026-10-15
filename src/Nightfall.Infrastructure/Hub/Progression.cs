namespace Nightfall.Infrastructure.Hub;

/// <summary>Pure rules for levels, divisions, seasons, puzzle days and XP. No I/O — unit-testable.</summary>
public static class Progression
{
    public const int StartingRating = 1500;
    public const int RatingK = 32;
    public const int MafiaQualifyingGames = 15;
    public const int PuzzleQualifyingSolves = 3;
    public const int SeasonLengthDays = 28;
    public const int MaxStreakFreezes = 2;

    /// <summary>Daily puzzles roll over at midnight Tehran time (UTC+03:30, no DST), the same for everyone.</summary>
    public static readonly TimeSpan PuzzleUtcOffset = TimeSpan.FromMinutes(210);

    private static readonly DateOnly DayEpoch = new(2026, 1, 1);
    private static readonly DateOnly SeasonEpoch = new(2026, 6, 22); // Season 1 started Monday 22 June 2026.

    /// <summary>First day of each game's daily series, so the design's numbering holds (Zip #142 on 13 Oct 2026).</summary>
    private static readonly Dictionary<string, DateOnly> DailyEpochs = new()
    {
        ["zip"] = new DateOnly(2026, 5, 25),
        ["queens"] = new DateOnly(2026, 7, 18),
        ["word"] = new DateOnly(2026, 6, 1),
        ["ladder"] = new DateOnly(2026, 8, 1),
        ["mines"] = new DateOnly(2026, 9, 1),
        ["stack"] = new DateOnly(2026, 9, 1),
        ["blocks"] = new DateOnly(2026, 9, 1),
    };

    public static readonly IReadOnlySet<string> Games = new HashSet<string> { "zip", "queens", "merge", "mines", "memory", "nard", "word", "ladder", "stack", "blocks" };
    /// <summary>Daily puzzles that count toward the shared puzzle streak.</summary>
    public static readonly IReadOnlySet<string> StreakGames = new HashSet<string> { "zip", "queens", "word", "ladder" };

    public static DateOnly PuzzleDate(DateTimeOffset now) => DateOnly.FromDateTime(now.ToOffset(PuzzleUtcOffset).DateTime);

    /// <summary>Days since 1 Jan 2026 in puzzle time — a compact integer day key.</summary>
    public static int PuzzleDay(DateTimeOffset now) => PuzzleDate(now).DayNumber - DayEpoch.DayNumber;

    public static DateOnly DateOfDay(int day) => DateOnly.FromDayNumber(DayEpoch.DayNumber + day);

    public static int? DailyNumber(string game, int day)
    {
        if (!DailyEpochs.TryGetValue(game, out var epoch)) return null;
        return DateOfDay(day).DayNumber - epoch.DayNumber + 1;
    }

    public static int? DayOfDailyNumber(string game, int number)
    {
        if (!DailyEpochs.TryGetValue(game, out var epoch)) return null;
        return epoch.DayNumber + number - 1 - DayEpoch.DayNumber;
    }

    // ---- seasons ----

    public static int Season(int day) => (DateOfDay(day).DayNumber - SeasonEpoch.DayNumber) / SeasonLengthDays + 1;

    public static int SeasonStartDay(int season) => SeasonEpoch.DayNumber + (season - 1) * SeasonLengthDays - DayEpoch.DayNumber;

    public static int DaysLeftInSeason(int day) => SeasonStartDay(Season(day) + 1) - day;

    /// <summary>Monday-based week start (puzzle days), for "this week" points.</summary>
    public static int WeekStartDay(int day)
    {
        var date = DateOfDay(day);
        int sinceMonday = ((int)date.DayOfWeek + 6) % 7;
        return day - sinceMonday;
    }

    // ---- levels ----

    /// <summary>XP needed to go from <paramref name="level"/> to the next one.</summary>
    public static int XpForLevel(int level) => 1000 + 150 * (level - 1);

    public static (int Level, int IntoLevel, int ForNext) Level(int xp)
    {
        int level = 1;
        int remaining = Math.Max(0, xp);
        while (remaining >= XpForLevel(level))
        {
            remaining -= XpForLevel(level);
            level++;
        }
        return (level, remaining, XpForLevel(level));
    }

    // ---- divisions ----

    private static readonly (string Name, int Floor)[] DivisionFloors =
    [
        ("Diamond", 1850), ("Platinum", 1700), ("Gold", 1550), ("Silver", 1400), ("Bronze", 0)
    ];

    /// <summary>Division from Mafia rating, e.g. 1560 → ("Gold", 3) = Gold III. Each division spans
    /// 150 points split into three 50-point tiers (III is the lowest); Diamond has a single tier.</summary>
    public static (string Division, int Tier) Division(int rating)
    {
        foreach (var (name, floor) in DivisionFloors)
        {
            if (rating < floor) continue;
            if (name == "Diamond") return (name, 1);
            int bandFloor = name == "Bronze" ? 1250 : floor;
            int tier = 3 - Math.Clamp((rating - bandFloor) / 50, 0, 2);
            return (name, tier);
        }
        return ("Bronze", 3);
    }

    // ---- Mafia rating ----

    /// <summary>Team Elo: each side is rated by its average; everyone on a side moves by the same amount.</summary>
    public static int RatingDelta(double ownAverage, double opponentAverage, bool won)
    {
        double expected = 1.0 / (1.0 + Math.Pow(10, (opponentAverage - ownAverage) / 400.0));
        return (int)Math.Round(RatingK * ((won ? 1.0 : 0.0) - expected));
    }

    public static int MafiaXp(bool won) => won ? 40 : 20;

    // ---- solo games ----

    public sealed record PuzzleOutcome(string Game, string Mode, bool Solved, int? TimeMs, int? Score, int? Moves, int? Detail, int Hints);

    /// <summary>XP for a finished solo game, following the rewards each game's intro/result screen states.</summary>
    public static int SoloXp(PuzzleOutcome o, int puzzleStreak, bool newBest)
    {
        bool daily = o.Mode == "daily";
        switch (o.Game)
        {
            case "zip":
                if (!o.Solved) return 5;
                return daily ? Math.Max(5, Math.Min(100, 20 + 5 * Math.Max(0, puzzleStreak - 1)) - 5 * o.Hints) : Math.Max(5, 15 - 5 * o.Hints);
            case "queens":
                if (!o.Solved) return 5;
                return o.Hints > 0 ? 15 : 30;
            case "word":
                return o.Solved ? 20 + Math.Max(0, 6 - (o.Moves ?? 6)) * 5 : 5;
            case "ladder":
                if (!o.Solved) return 5;
                int overPar = o.Detail ?? 0;
                return Math.Max(5, (overPar < 0 ? 40 : overPar == 0 ? 25 : 15) - 5 * o.Hints);
            case "mines":
                return o.Solved ? (o.Mode switch { "hard" => 40, "medium" => 30, _ => 20 }) : 5;
            case "memory":
                return (o.Detail ?? 0) switch { 3 => 30, 2 => 20, 1 => 10, _ => 5 };
            case "nard":
                return o.Solved ? ((o.Detail ?? 1) >= 2 ? 70 : 50) : 10;
            case "merge":
                return Math.Min(150, (o.Score ?? 0) / 50);
            case "stack":
                // A floor is worth 1 XP and a perfect drop counts double (Moves = perfect drops).
                return Math.Min(150, (o.Score ?? 0) + (o.Moves ?? 0) + (newBest ? 14 : 3));
            case "blocks":
                return Math.Min(150, (o.Score ?? 0) / 50 + (newBest ? 10 : 0));
            default:
                return 0;
        }
    }

    /// <summary>Puzzle-league points: daily solves score by speed; everything else earns its XP as points.</summary>
    public static int LeaguePoints(PuzzleOutcome o, int xp)
    {
        if (o.Mode == "daily" && o.Solved && o.TimeMs is { } ms)
            return Math.Max(50, 300 - ms / 1000) - 10 * o.Hints;
        return xp;
    }

    /// <summary>Advances the shared daily-puzzle streak for a solve on <paramref name="day"/>.</summary>
    public static (int Streak, int? LastDay, int Freezes, bool Extended) AdvanceStreak(int streak, int? lastDay, int freezes, int day)
    {
        if (lastDay == day) return (streak, lastDay, freezes, false);
        int next;
        if (lastDay == day - 1) next = streak + 1;
        else if (lastDay == day - 2 && freezes > 0) { next = streak + 1; freezes--; }
        else next = 1;
        if (next % 7 == 0) freezes = Math.Min(MaxStreakFreezes, freezes + 1);
        return (next, day, freezes, true);
    }

    /// <summary>The streak as it stands today: it lapses once a whole day (beyond a freeze) has been missed.</summary>
    public static int CurrentStreak(int streak, int? lastDay, int freezes, int today)
    {
        if (lastDay is null) return 0;
        int gap = today - lastDay.Value;
        if (gap <= 1) return streak;
        if (gap == 2 && freezes > 0) return streak;
        return 0;
    }
}
