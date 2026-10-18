namespace Bazimoon.Infrastructure.Hub;

/// <summary>Per-player progression and settings for the Mini App hub (XP, Mafia rating, puzzle
/// streak). One row per Telegram user, created lazily the first time they appear.</summary>
public sealed class PlayerStatsRecord
{
    public long TelegramUserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public int Xp { get; set; }
    public int Rating { get; set; } = Progression.StartingRating;

    public int PuzzleStreak { get; set; }
    public int BestPuzzleStreak { get; set; }
    /// <summary>Last puzzle day (see Progression.PuzzleDay) on which a daily puzzle was solved.</summary>
    public int? LastPuzzleDay { get; set; }
    public int StreakFreezes { get; set; } = 1;

    public string Language { get; set; } = "en";
    public bool ReminderEnabled { get; set; } = true;
    public string ReminderTime { get; set; } = "09:00";
    public bool HighContrast { get; set; }
    public bool Haptics { get; set; } = true;
    /// <summary>Last puzzle day a daily reminder was sent, so the bot nudges at most once a day.</summary>
    public int? LastReminderDay { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>One finished solo game or daily puzzle attempt.</summary>
public sealed class PuzzleResultRecord
{
    public long Id { get; set; }
    public long TelegramUserId { get; set; }
    /// <summary>Game key: zip, queens, merge, mines, memory, nard, word, ladder, stack, blocks.</summary>
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

/// <summary>Which Telegram users have played in which group chats ("your group" boards, tables).</summary>
public sealed class ChatMemberRecord
{
    public long TelegramChatId { get; set; }
    public long TelegramUserId { get; set; }
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
}
