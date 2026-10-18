namespace Bazimoon.Infrastructure.Hub;

/// <summary>The table behind a Mafia game: its name, who may find it and the invite code that lets
/// anyone with the link sit down. Every Mafia game has one.</summary>
public sealed class MafiaTableRecord
{
    public Guid GameId { get; set; }
    public Guid CreatorUserId { get; set; }
    /// <summary>Optional name the host gave it.</summary>
    public string? Name { get; set; }
    /// <summary>Public tables are listed for everyone in the app; private ones are not listed.
    /// Anyone holding the invite link or code can join either kind.</summary>
    public bool IsOpen { get; set; }
    /// <summary>Short code used in the <c>/t/&lt;code&gt;</c> invite link and typed into "Got a code?".</summary>
    public string InviteCode { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
