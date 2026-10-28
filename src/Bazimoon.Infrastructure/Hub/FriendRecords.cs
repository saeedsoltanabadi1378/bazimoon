namespace Bazimoon.Infrastructure.Hub;

/// <summary>A friendship between two players, or a request one sent the other. Adding someone by
/// their friend code or link is accepted at once (they shared it); a request from the people you
/// played with waits until the other player accepts.</summary>
public sealed class FriendshipRecord
{
    public long Id { get; set; }
    public Guid RequesterId { get; set; }
    public Guid AddresseeId { get; set; }
    public bool Accepted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AcceptedAt { get; set; }
}

/// <summary>An invite from one friend to another into a game lobby: a Mafia table or an online
/// Esm-Famil room. It ends when it is answered, the lobby starts or fills, or it expires.</summary>
public sealed class GameInviteRecord
{
    public long Id { get; set; }
    public Guid FromUserId { get; set; }
    public Guid ToUserId { get; set; }
    /// <summary>See <see cref="GameInviteKinds"/>.</summary>
    public string Kind { get; set; } = string.Empty;
    /// <summary>The Mafia game id, or the Esm-Famil room code.</summary>
    public string Target { get; set; } = string.Empty;
    /// <summary>pending, accepted or declined.</summary>
    public string Status { get; set; } = GameInviteStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
}

public static class GameInviteKinds
{
    public const string Mafia = "mafia";
    public const string EsmFamil = "esmfamil";
}

public static class GameInviteStatus
{
    public const string Pending = "pending";
    public const string Accepted = "accepted";
    public const string Declined = "declined";
}
