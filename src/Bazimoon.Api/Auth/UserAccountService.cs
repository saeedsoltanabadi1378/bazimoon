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

    /// <summary>Creates a guest who can play straight away. Without a name they get "Player 1234".
    /// A guest created by a crawler or script is marked as a bot straight away.</summary>
    public async Task<UserRecord> CreateGuestAsync(string? displayName, string? language, string? userAgent = null)
    {
        bool crawler = BotDetector.IsCrawler(userAgent);
        var now = _clock.GetUtcNow().UtcDateTime;
        var user = new UserRecord
        {
            IsGuest = true,
            DisplayName = string.IsNullOrWhiteSpace(displayName)
                ? $"Player {System.Security.Cryptography.RandomNumberGenerator.GetInt32(1000, 10000)}"
                : CleanName(displayName),
            Language = language is { } code && code.StartsWith("fa", StringComparison.OrdinalIgnoreCase) ? "fa" : "en",
            CreatedAt = now,
            LastSeenAt = now,
            IsBot = crawler,
            BotReason = crawler ? "crawler" : null,
            BotMarkedAt = crawler ? now : null,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    /// <summary>Attaches a sign-in identity to a guest, who keeps all their progress and stops being
    /// a guest. Fails when that identity already belongs to another user, or the user is no guest.</summary>
    public async Task<LinkResult> LinkAsync(Guid guestId, string provider, string providerUserId, string? displayName, string? email)
    {
        var user = await _db.Users.FindAsync(guestId);
        if (user is null) return new LinkResult(LinkOutcome.UserNotFound, null);
        if (!user.IsGuest) return new LinkResult(LinkOutcome.NotAGuest, user);
        if (await _db.UserIdentities.AnyAsync(i => i.Provider == provider && i.ProviderUserId == providerUserId))
            return new LinkResult(LinkOutcome.AlreadyLinkedElsewhere, user);

        var now = _clock.GetUtcNow().UtcDateTime;
        _db.UserIdentities.Add(new UserIdentityRecord { UserId = user.Id, Provider = provider, ProviderUserId = providerUserId, Email = email, CreatedAt = now });
        user.IsGuest = false;
        user.LastSeenAt = now;
        if (!string.IsNullOrWhiteSpace(displayName)) user.DisplayName = CleanName(displayName);
        await _db.SaveChangesAsync();
        return new LinkResult(LinkOutcome.Linked, user);
    }

    public static string CleanName(string? name)
    {
        var trimmed = (name ?? string.Empty).Trim();
        if (trimmed.Length == 0) return "Player";
        return trimmed.Length <= MaxDisplayNameLength ? trimmed : trimmed[..MaxDisplayNameLength];
    }
}

public enum LinkOutcome { Linked, AlreadyLinkedElsewhere, NotAGuest, UserNotFound }

public sealed record LinkResult(LinkOutcome Outcome, UserRecord? User);
