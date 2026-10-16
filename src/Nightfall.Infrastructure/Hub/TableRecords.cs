namespace Nightfall.Infrastructure.Hub;

/// <summary>The table behind a Mafia game: its name, who may find it and the invite code that lets
/// anyone with the link sit down. Every Mafia game has one, whether it was opened in the app or by the bot in a group.</summary>
public sealed class MafiaTableRecord
{
    public Guid GameId { get; set; }
    /// <summary>The group a bot <c>/newgame</c> started it in; 0 for tables opened in the app.</summary>
    public long TelegramChatId { get; set; }
    public long CreatorTelegramUserId { get; set; }
    /// <summary>Optional name the host gave it; the group's title (if any) is shown when empty.</summary>
    public string? Name { get; set; }
    /// <summary>Public tables are listed for everyone in the app; private ones are not listed.
    /// Anyone holding the invite link or code can join either kind.</summary>
    public bool IsOpen { get; set; }
    /// <summary>Short code used in the <c>t_&lt;code&gt;</c> start link and typed into "Got a code?".</summary>
    public string InviteCode { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
