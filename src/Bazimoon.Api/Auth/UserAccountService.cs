using Microsoft.EntityFrameworkCore;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Identity;

namespace Bazimoon.Api.Auth;

/// <summary>Finds or creates the Bazimoon user behind a sign-in identity (provider + the provider's user id).</summary>
public sealed class UserAccountService
{
    public const int MaxDisplayNameLength = 64;

    private readonly BazimoonDbContext _db;
    private readonly TimeProvider _clock;

    public UserAccountService(BazimoonDbContext db, TimeProvider clock)
    {
        _db = db;
        _clock = clock;
    }

    /// <summary>Returns the user linked to this identity, creating a non-guest user on first sign-in.
    /// The display name and language are only set when the user is created; later the player owns them.</summary>
    public async Task<UserRecord> FindOrCreateAsync(string provider, string providerUserId, string displayName, string? language, string? email = null)
    {
        var now = _clock.GetUtcNow().UtcDateTime;
        var userId = await _db.UserIdentities
            .Where(i => i.Provider == provider && i.ProviderUserId == providerUserId)
            .Select(i => (Guid?)i.UserId)
            .FirstOrDefaultAsync();

        if (userId is { } id && await _db.Users.FindAsync(id) is { } existing)
        {
            existing.LastSeenAt = now;
            await _db.SaveChangesAsync();
            return existing;
        }

        var user = new UserRecord
        {
            IsGuest = false,
            DisplayName = CleanName(displayName),
            Language = language is { } code && code.StartsWith("fa", StringComparison.OrdinalIgnoreCase) ? "fa" : "en",
            CreatedAt = now,
            LastSeenAt = now,
        };
        _db.Users.Add(user);
        _db.UserIdentities.Add(new UserIdentityRecord { UserId = user.Id, Provider = provider, ProviderUserId = providerUserId, Email = email, CreatedAt = now });
        await _db.SaveChangesAsync();
        return user;
    }

    public static string CleanName(string? name)
    {
        var trimmed = (name ?? string.Empty).Trim();
        if (trimmed.Length == 0) return "Player";
        return trimmed.Length <= MaxDisplayNameLength ? trimmed : trimmed[..MaxDisplayNameLength];
    }
}
