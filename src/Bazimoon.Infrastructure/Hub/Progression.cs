namespace Bazimoon.Infrastructure.Hub;

/// <summary>Pure rules for levels, divisions, seasons, puzzle days and XP. No I/O — unit-testable.</summary>
public static class Progression
{
    public const int StartingRating = 1500;
    public const int RatingK = 32;
    public const int MafiaQualifyingGames = 15;
    public const int PuzzleQualifyingSolves = 3;
    public const int SeasonLengthDays = 28;
    public const int MaxStreakFreezes = 2;
    /// <summary>Longest half-finished board the server keeps for a level (characters of JSON).</summary>
    public const int MaxSavedStateLength = 8000;

    /// <summary>Daily puzzles roll over at midnight Tehran time (UTC+03:30, no DST), the same for everyone.</summary>
    public static readonly TimeSpan PuzzleUtcOffset = TimeSpan.FromMinutes(210);

    private static readonly DateOnly DayEpoch = new(2026, 1, 1);
    private static readonly DateOnly SeasonEpoch = new(2026, 6, 22); // Season 1 started Monday 22 June 2026.

    /// <summary>First day of each game's daily series. Zip, Queens, Sudoku, Word and Ladder have no daily:
    /// they are played level by level (see LevelGames).</summary>
    private static readonly Dictionary<string, DateOnly> DailyEpochs = new()
    {
        ["mines"] = new DateOnly(2026, 9, 1),
        ["stack"] = new DateOnly(2026, 9, 1),
        ["blocks"] = new DateOnly(2026, 9, 1),
        ["snake"] = new DateOnly(2026, 10, 15),
        ["esmfamil"] = new DateOnly(2026, 10, 15),
    };

    public static readonly IReadOnlySet<string> Games = new HashSet<string> { "zip", "queens", "merge", "mines", "memory", "word", "ladder", "stack", "blocks", "sudoku", "snake", "dooz", "esmfamil" };
    /// <summary>Puzzles played level by level, from level 1 up, as many a day as the player likes.</summary>
    public static readonly IReadOnlySet<string> LevelGames = new HashSet<string> { "zip", "queens", "sudoku", "word", "ladder" };
    /// <summary>Level puzzles that count toward the shared puzzle streak.</summary>
    public static readonly IReadOnlySet<string> StreakGames = LevelGames;

    public static bool IsDaily(string mode) => mode == "daily" || mode.StartsWith("daily-", StringComparison.Ordinal);

    /// <summary>"level", or a language track such as "level-fa" (Word and Ladder have Persian levels).</summary>
    public static bool IsLevel(string mode) => mode == "level" || mode.StartsWith("level-", StringComparison.Ordinal);

    /// <summary>The level track a submitted mode belongs to, or null when the mode is not a level.</summary>
    public static string? LevelTrack(string game, string mode)
    {
        if (!LevelGames.Contains(game) || !IsLevel(mode)) return null;
        return mode == "level-fa" && game is "word" or "ladder" ? "level-fa" : "level";
    }

    public static DateOnly PuzzleDate(DateTimeOffset now) => DateOnly.FromDateTime(now.ToOffset(PuzzleUtcOffset).DateTime);

    /// <summary>Days since 1 Jan 2026 in puzzle time — a compact integer day key.</summary>
    public static int PuzzleDay(DateTimeOffset now) => PuzzleDate(now).DayNumber - DayEpoch.DayNumber;

    public static DateOnly DateOfDay(int day) => DateOnly.FromDayNumber(DayEpoch.DayNumber + day);

    public static int? DailyNumber(string game, int day)
    {
        if (!DailyEpochs.TryGetValue(game, out var epoch)) return null;
        return DateOfDay(day).DayNumber - epoch.DayNumber + 1;
    }

    /// <summary>A player's starting level when level play arrived: one past the dailies they had already solved.</summary>
    public static int StartingLevel(int solvedDailies) => Math.Max(0, solvedDailies) + 1;

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

    public const int MvpBonusXp = 50;

    public static int MafiaXp(bool won, bool isMvp = false) => (won ? 40 : 20) + (isMvp ? MvpBonusXp : 0);

    // ---- solo games ----

    public sealed record PuzzleOutcome(string Game, string Mode, bool Solved, int? TimeMs, int? Score, int? Moves, int? Detail, int Hints);

    /// <summary>XP for a finished solo game, following the rewards each game's intro/result screen states.</summary>
    public static int SoloXp(PuzzleOutcome o, int puzzleStreak, bool newBest)
    {
        // A level's first solve earns what a daily did; replays come in as practice.
        bool daily = IsDaily(o.Mode) || IsLevel(o.Mode);
        switch (o.Game)
        {
            case "zip":
                if (!o.Solved) return 5;
                return daily ? Math.Max(5, 20 - 5 * o.Hints) : Math.Max(5, 15 - 5 * o.Hints);
            case "queens":
                if (!o.Solved) return 5;
                return o.Hints > 0 ? 15 : 30;
            case "sudoku":
                // Daily: 30 with no hints; Classic by level. Each hint costs 5.
                if (!o.Solved) return 5;
                int sudokuBase = daily ? 30 : o.Mode switch { "easy" => 15, "hard" => 30, "expert" => 40, _ => 20 };
                return Math.Max(5, sudokuBase - 5 * o.Hints);
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
            case "merge":
                return Math.Min(150, (o.Score ?? 0) / 50);
            case "stack":
                // A floor is worth 1 XP and a perfect drop counts double (Moves = perfect drops).
                return Math.Min(150, (o.Score ?? 0) + (o.Moves ?? 0) + (newBest ? 14 : 3));
            case "snake":
                // A point is worth 1 XP (golden fruit counts 3), plus a bonus for a new best.
                return Math.Min(150, (o.Score ?? 0) + (newBest ? 10 : 3));
            case "dooz":
                // A won match, by opponent; a lost or drawn one earns 5.
                if (!o.Solved) return 5;
                return o.Mode switch { "easy" => 20, "big" => 50, _ => 40 };
            case "esmfamil":
                // Online: 30 for a win, 10 for playing. Solo daily: 2 per correct answer (Moves). Practice earns none.
                if (o.Mode == "online") return o.Solved ? 30 : 10;
                return daily ? 2 * Math.Max(0, o.Moves ?? 0) : 0;
            case "blocks":
                return Math.Min(150, (o.Score ?? 0) / 50 + (newBest ? 10 : 0));
            default:
                return 0;
        }
    }

    /// <summary>Puzzle-league points: daily solves score by speed; everything else, levels included, earns its XP as points.</summary>
    public static int LeaguePoints(PuzzleOutcome o, int xp)
    {
        if (IsDaily(o.Mode) && o.Solved && o.TimeMs is { } ms)
            return Math.Max(50, 300 - ms / 1000) - 10 * o.Hints;
        return xp;
    }

    /// <summary>Advances the shared puzzle streak for a level solved on <paramref name="day"/>.</summary>
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
