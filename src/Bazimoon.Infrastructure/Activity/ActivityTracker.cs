using System.Text.Json;

namespace Bazimoon.Infrastructure.Activity;

/// <summary>Flow names and step names for <see cref="IActivityTracker"/>, kept in one place so the
/// admin funnel queries and the call sites that record them never drift apart.</summary>
public static class ActivityEvents
{
    public const string SignUp = "signup";
    public const string Mafia = "mafia";
    public const string Puzzle = "puzzle";
    public const string Couple = "couple";

    public const string SignupGuest = "signup_guest";
    public const string SignupGoogle = "signup_google";
    public const string LinkGoogle = "link_google";

    public const string MafiaLobbyJoined = "mafia_lobby_joined";
    public const string MafiaGameStarted = "mafia_game_started";
    public const string MafiaGameEnded = "mafia_game_ended";
    public const string MafiaLeftEarly = "mafia_left_early";

    public const string PuzzleIntroViewed = "puzzle_intro_viewed";
    public const string PuzzleStarted = "puzzle_started";
    public const string PuzzleCompleted = "puzzle_completed";

    public const string CoupleInviteSent = "couple_invite_sent";
    public const string CoupleInviteAccepted = "couple_invite_accepted";
    public const string CoupleQuestionAnswered = "couple_question_answered";

    /// <summary>Steps a client is allowed to report itself through <c>POST /api/events</c> — the ones
    /// the server has no other way to learn about (a screen was seen, a button was tapped) before any
    /// outcome exists to record server-side. Everything else is tracked from inside the service that
    /// already owns that step, which is more reliable than trusting the client to call home.</summary>
    public static readonly IReadOnlySet<string> ClientReportable = new HashSet<string> { PuzzleIntroViewed, PuzzleStarted };
}

public interface IActivityTracker
{
    /// <summary>Queues one funnel-step event onto the current DbContext change tracker; it is
    /// persisted whenever the caller's own <c>SaveChangesAsync</c> runs, same as <c>OperationalEvents</c>.</summary>
    void Track(Guid? userId, string flow, string name, object? properties = null);
}

public sealed class ActivityTracker : IActivityTracker
{
    private readonly Bazimoon.Infrastructure.History.BazimoonDbContext _db;
    private readonly TimeProvider _clock;

    public ActivityTracker(Bazimoon.Infrastructure.History.BazimoonDbContext db, TimeProvider clock)
    {
        _db = db;
        _clock = clock;
    }

    public void Track(Guid? userId, string flow, string name, object? properties = null) =>
        _db.UserActivityEvents.Add(new UserActivityEventRecord
        {
            CreatedAt = _clock.GetUtcNow().UtcDateTime,
            UserId = userId,
            Flow = flow,
            Name = name,
            PropertiesJson = properties is null ? null : JsonSerializer.Serialize(properties),
        });
}
