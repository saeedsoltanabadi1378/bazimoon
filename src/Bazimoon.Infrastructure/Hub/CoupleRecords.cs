namespace Bazimoon.Infrastructure.Hub;

/// <summary>A Couple Quiz space for two people. It starts as a pending invite (no partner yet) and
/// becomes active when the partner opens the one-time link before it expires.</summary>
public sealed class CoupleRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InviterId { get; set; }
    public Guid? PartnerId { get; set; }
    /// <summary>One-time invite token used in the <c>couple_&lt;token&gt;</c> start link.</summary>
    public string InviteToken { get; set; } = string.Empty;
    public DateTime InviteExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AcceptedAt { get; set; }
    /// <summary>Puzzle day (Progression.PuzzleDay) the couple became active; day #1 of their quiz.</summary>
    public int? StartDay { get; set; }

    public string ReminderTime { get; set; } = "21:00";
    public string Language { get; set; } = "fa";

    public int Streak { get; set; }
    public int BestStreak { get; set; }
    /// <summary>Last puzzle day on which both partners finished.</summary>
    public int? LastBothDay { get; set; }
    public int TotalMatches { get; set; }
    public int TotalQuestions { get; set; }

    /// <summary>Puzzle day each side last sent a nudge, so a reminder goes out at most once a day.</summary>
    public int? InviterNudgedDay { get; set; }
    public int? PartnerNudgedDay { get; set; }
    /// <summary>Puzzle day the couple's evening reminder last went out.</summary>
    public int? LastReminderDay { get; set; }
}

/// <summary>One partner's six answers for one day: three about themselves, then three guesses
/// about their partner. Stored as a comma list of option indexes, with -1 for a skipped question.</summary>
public sealed class CoupleAnswerRecord
{
    public long Id { get; set; }
    public Guid CoupleId { get; set; }
    public int Day { get; set; }
    public Guid UserId { get; set; }
    public string Answers { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Pure Couple Quiz rules shared by the service and the tests.</summary>
public static class CoupleRules
{
    public const int QuestionsPerDay = 3;
    public const int OptionsPerQuestion = 4;
    /// <summary>Number of themed question sets; the app holds the text for each set id.</summary>
    public const int QuestionSetCount = 15;
    public const int XpEach = 30;
    public static readonly TimeSpan InviteLifetime = TimeSpan.FromHours(24);

    /// <summary>The couple's day number (#1 on the day they paired up).</summary>
    public static int DayNumber(int startDay, int day) => day - startDay + 1;

    /// <summary>Which themed set of questions a couple plays on their day #<paramref name="number"/>.</summary>
    public static int SetForDay(int number) => ((number - 1) % QuestionSetCount + QuestionSetCount) % QuestionSetCount;

    public const int MaxLevel = 100;

    /// <summary>Couple points: one per matched guess plus two for every day both partners finished.</summary>
    public static int Points(CoupleRecord couple) => couple.TotalMatches + 2 * (couple.TotalQuestions / (QuestionsPerDay * 2));

    /// <summary>Points it takes to go from <paramref name="level"/> to the next: 5 at level 1, one more every two levels.</summary>
    public static int LevelCost(int level) => 5 + level / 2;

    /// <summary>Couple level from 1 to <see cref="MaxLevel"/>, with the points earned towards the next level
    /// and what that level costs (both 0 once the top level is reached).</summary>
    public static (int Level, int Into, int Cost) LevelProgress(int points)
    {
        int level = 1;
        while (level < MaxLevel && points >= LevelCost(level))
        {
            points -= LevelCost(level);
            level++;
        }
        return level == MaxLevel ? (level, 0, 0) : (level, points, LevelCost(level));
    }

    public static int Level(int points) => LevelProgress(points).Level;

    /// <summary>Whether one day's six guesses were all right.</summary>
    public static bool IsPerfect(bool[] matches) => matches.All(m => m);

    public static int[] Parse(string answers) => answers.Split(',').Select(int.Parse).ToArray();

    public static string Format(IReadOnlyList<int> answers) => string.Join(',', answers);

    /// <summary>Six booleans: whether my three guesses matched their answers, then whether their
    /// three guesses matched mine. A skipped answer or guess never matches.</summary>
    public static bool[] Matches(int[] mine, int[] theirs)
    {
        var result = new bool[QuestionsPerDay * 2];
        for (int i = 0; i < QuestionsPerDay; i++)
        {
            result[i] = mine[QuestionsPerDay + i] >= 0 && mine[QuestionsPerDay + i] == theirs[i];
            result[QuestionsPerDay + i] = theirs[QuestionsPerDay + i] >= 0 && theirs[QuestionsPerDay + i] == mine[i];
        }
        return result;
    }

    public static bool IsValid(IReadOnlyList<int>? answers) =>
        answers is { Count: QuestionsPerDay * 2 } && answers.All(a => a is >= -1 and < OptionsPerQuestion);

    /// <summary>The streak as it stands today: it lapses once a whole day has been missed.</summary>
    public static int CurrentStreak(int streak, int? lastBothDay, int today) =>
        lastBothDay is { } last && today - last <= 1 ? streak : 0;
}
