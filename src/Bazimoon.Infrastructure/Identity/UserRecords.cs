namespace Bazimoon.Infrastructure.Identity;

/// <summary>A Bazimoon player. Every player starts as a guest; signing in with a provider such as
/// Google attaches a <see cref="UserIdentityRecord"/> to the same user, so their progress stays.</summary>
public sealed class UserRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public bool IsGuest { get; set; } = true;
    public string DisplayName { get; set; } = string.Empty;
    public string Language { get; set; } = "en";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
}

/// <summary>A sign-in method linked to a user: one row per (provider, the provider's user id).</summary>
public sealed class UserIdentityRecord
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    /// <summary>See <see cref="IdentityProviders"/>.</summary>
    public string Provider { get; set; } = string.Empty;
    public string ProviderUserId { get; set; } = string.Empty;
    public string? Email { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>A long-lived token the installed app trades for a new access token. Only a SHA-256
/// hash of the token is stored.</summary>
public sealed class RefreshTokenRecord
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}

public static class IdentityProviders
{
    public const string Google = "google";
}
