namespace Bazimoon.Infrastructure.Hub;

/// <summary>A clan (اکیپ): a crew of players who play Mafia together. It has one owner, any number
/// of admins, and members. A player belongs to at most one clan.</summary>
public sealed class ClanRecord
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>The name in lower case, so two clans can't share a name that differs only in case.</summary>
    public string NameKey { get; set; } = string.Empty;
    public string? Bio { get; set; }
    /// <summary>Icon key from <see cref="ClanEmblems"/>.</summary>
    public string Emblem { get; set; } = ClanEmblems.Default;
    /// <summary>Colour from <see cref="ClanColors"/>.</summary>
    public string Color { get; set; } = ClanColors.Default;
    /// <summary>Listed clans show in Find a clan and take join requests; unlisted ones are invite only.</summary>
    public bool IsListed { get; set; }
    /// <summary>Short code behind the <c>/c/&lt;code&gt;</c> invite link; joining with it needs no approval.</summary>
    public string InviteCode { get; set; } = string.Empty;
    public Guid OwnerId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    /// <summary>When members were last told someone opened a clan table, so quick tables can't spam them.</summary>
    public DateTime? LastTableNoticeAt { get; set; }
}

public sealed class ClanMemberRecord
{
    public Guid ClanId { get; set; }
    public Guid UserId { get; set; }
    /// <summary>See <see cref="ClanRoles"/>.</summary>
    public string Role { get; set; } = ClanRoles.Member;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    /// <summary>The newest chat message this member has seen, for the unread count.</summary>
    public long LastReadMessageId { get; set; }
}

/// <summary>A player asking to join a listed clan, waiting for an owner or admin to answer.</summary>
public sealed class ClanJoinRequestRecord
{
    public long Id { get; set; }
    public Guid ClanId { get; set; }
    public Guid UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>A player removed from a clan. They can't come back through the invite link; only an
/// admin accepting a new join request lets them back in.</summary>
public sealed class ClanBanRecord
{
    public long Id { get; set; }
    public Guid ClanId { get; set; }
    public Guid UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>A line in the clan chat. Announcements are posted by an owner or admin, notify every
/// member, and the newest one is pinned on the clan page.</summary>
public sealed class ClanMessageRecord
{
    public long Id { get; set; }
    public Guid ClanId { get; set; }
    public Guid UserId { get; set; }
    public string Text { get; set; } = string.Empty;
    public bool IsAnnouncement { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>A scheduled Mafia game night. Members say whether they're coming; from shortly before
/// the start, the first member to tap "Take your seat" opens the clan table and the rest join it.</summary>
public sealed class ClanEventRecord
{
    public long Id { get; set; }
    public Guid ClanId { get; set; }
    public Guid CreatedBy { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Note { get; set; }
    public DateTime StartsAt { get; set; }
    public int Seats { get; set; }
    /// <summary>Repeats every week: once a night is over, the next one is scheduled a week later.</summary>
    public bool RepeatWeekly { get; set; }
    public bool Cancelled { get; set; }
    /// <summary>The table this game night opened, once a member opened it.</summary>
    public Guid? GameId { get; set; }
    public bool HourReminderSent { get; set; }
    public bool StartReminderSent { get; set; }
    public bool NextScheduled { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class ClanRsvpRecord
{
    public long EventId { get; set; }
    public Guid UserId { get; set; }
    /// <summary>See <see cref="ClanRsvpAnswers"/>.</summary>
    public string Answer { get; set; } = ClanRsvpAnswers.Yes;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public static class ClanRoles
{
    public const string Owner = "owner";
    public const string Admin = "admin";
    public const string Member = "member";

    public static bool CanManage(string role) => role is Owner or Admin;
}

public static class ClanRsvpAnswers
{
    public const string Yes = "yes";
    public const string Maybe = "maybe";
    public const string No = "no";

    public static bool IsValid(string? answer) => answer is Yes or Maybe or No;
}

public static class ClanEmblems
{
    public const string Default = "moon";
    public static readonly IReadOnlyList<string> All = ["moon", "mafia", "godfather", "crown", "flame", "star", "bolt", "shield", "heart", "target", "detective", "dice"];
}

public static class ClanColors
{
    public const string Default = "#B79CF2";
    public static readonly IReadOnlyList<string> All = ["#B79CF2", "#F0A83A", "#5FD0BE", "#8FA8FF", "#F08A7A", "#9ED98C", "#F2B8D0", "#E9D8A6"];
}
