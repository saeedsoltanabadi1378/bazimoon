namespace Bazimoon.Infrastructure.Identity;

/// <summary>A private player block. Either direction keeps the two accounts out of the same future
/// Mafia lobby. It does not reveal to the blocked player who blocked them.</summary>
public sealed class PlayerBlockRecord
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public Guid BlockedUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>A moderation report tied to the exact game where the behaviour happened.</summary>
public sealed class PlayerReportRecord
{
    public long Id { get; set; }
    public Guid ReporterUserId { get; set; }
    public Guid ReportedUserId { get; set; }
    public Guid GameId { get; set; }
    public string Category { get; set; } = string.Empty;
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewedAt { get; set; }
}
