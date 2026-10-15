namespace Nightfall.Infrastructure.Hub;

/// <summary>The table behind a Mafia game: its name, who may find it and the invite code that lets
/// anyone with the link sit down. Every game started in a group, by the bot or from the app, has one.</summary>
public sealed class MafiaTableRecord
{
    public Guid GameId { get; set; }
    public long TelegramChatId { get; set; }
    public long CreatorTelegramUserId { get; set; }
    /// <summary>Optional name the host gave it; the group's title is shown when empty.</summary>
    public string? Name { get; set; }
    /// <summary>Open tables are listed for everyone in the app. Group-only tables are listed only to
    /// the group's players; anyone holding the invite link or code can still join either kind.</summary>
    public bool IsOpen { get; set; }
    /// <summary>Short code used in the <c>t_&lt;code&gt;</c> start link and typed into "Got a code?".</summary>
    public string InviteCode { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
