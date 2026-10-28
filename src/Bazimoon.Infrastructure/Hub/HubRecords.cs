namespace Bazimoon.Infrastructure.Hub;

/// <summary>Per-player progression and settings for the app hub (XP, Mafia rating, puzzle
/// streak). One row per user, created lazily the first time they appear.</summary>
public sealed class PlayerStatsRecord
{
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public int Xp { get; set; }
    public int Rating { get; set; } = Progression.StartingRating;

    public int PuzzleStreak { get; set; }
    public int BestPuzzleStreak { get; set; }
    /// <summary>Last puzzle day (see Progression.PuzzleDay) on which a daily puzzle was solved.</summary>
    public int? LastPuzzleDay { get; set; }
    public int StreakFreezes { get; set; } = 1;

    public string Language { get; set; } = "fa";
    public bool ReminderEnabled { get; set; } = true;
    public string ReminderTime { get; set; } = "09:00";
    public bool HighContrast { get; set; }
    public bool Haptics { get; set; } = true;
    /// <summary>Last puzzle day a daily reminder was sent, so a player is nudged at most once a day.</summary>
    public int? LastReminderDay { get; set; }
    /// <summary>The code friends add this player with, made the first time they open Friends.</summary>
    public string? FriendCode { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>One finished solo game or daily puzzle attempt.</summary>
public sealed class PuzzleResultRecord
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    /// <summary>Game key such as zip, queens, merge, mines, memory, word, ladder, stack or blocks.</summary>
    public string Game { get; set; } = string.Empty;
    /// <summary>daily, practice, archive, classic, endless, timed, easy/medium/hard, ...</summary>
    public string Mode { get; set; } = string.Empty;
    /// <summary>Daily puzzle number (#142) when the attempt was a daily or archive puzzle.</summary>
    public int? PuzzleNumber { get; set; }
    /// <summary>Puzzle day the attempt was made on (Progression.PuzzleDay).</summary>
    public int Day { get; set; }
    public bool Solved { get; set; }
    public int? TimeMs { get; set; }
    public int? Score { get; set; }
    public int? Moves { get; set; }
    /// <summary>Game-specific number: top tile, stars, floors, best combo, par difference…</summary>
    public int? Detail { get; set; }
    public int Hints { get; set; }
    public int XpGained { get; set; }
    public int Points { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>How far a player has got through a level-based puzzle (Zip, Queens, Sudoku, Word, Ladder),
/// and the board they left half-finished. One row per player, game and track.</summary>
public sealed class PuzzleProgressRecord
{
    public Guid UserId { get; set; }
    public string Game { get; set; } = string.Empty;
    /// <summary>"level", or "level-fa" for the Persian Word and Ladder levels.</summary>
    public string Track { get; set; } = "level";
    /// <summary>The highest unlocked level: the next one to play. Every level below it is finished.</summary>
    public int Level { get; set; } = 1;
    /// <summary>The level the saved board belongs to.</summary>
    public int? SavedLevel { get; set; }
    /// <summary>The half-finished board as the app's own JSON; null when there is none.</summary>
    public string? SavedState { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
