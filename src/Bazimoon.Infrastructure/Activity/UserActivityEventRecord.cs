namespace Bazimoon.Infrastructure.Activity;

/// <summary>One step a user took in a tracked flow (sign-up, Mafia, a solo puzzle, Couple Quiz).
/// High-volume and separate from <see cref="Admin.OperationalEventRecord"/>, which is for admin
/// audit and system health, not per-user funnel data.</summary>
public sealed class UserActivityEventRecord
{
    public long Id { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    /// <summary>Null for an event from someone not yet signed in (there is none today, but the ingest
    /// endpoint allows it so a future pre-auth step isn't blocked).</summary>
    public Guid? UserId { get; set; }
    /// <summary>Which funnel this belongs to: "signup", "mafia", "puzzle" or "couple".</summary>
    public string Flow { get; set; } = string.Empty;
    /// <summary>The step, e.g. "mafia_game_started". See <see cref="ActivityEvents"/> for the full set.</summary>
    public string Name { get; set; } = string.Empty;
    public string? PropertiesJson { get; set; }
}
