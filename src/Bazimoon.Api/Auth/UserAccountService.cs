using Microsoft.EntityFrameworkCore;
using Bazimoon.Infrastructure.Activity;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Identity;

namespace Bazimoon.Api.Auth;

/// <summary>Finds or creates the Bazimoon user behind a sign-in identity (provider + the provider's user id).</summary>
public sealed class UserAccountService
{
    public const int MaxDisplayNameLength = 64;

    private readonly BazimoonDbContext _db;
    private readonly TimeProvider _clock;
    private readonly IActivityTracker _activity;

    public UserAccountService(BazimoonDbContext db, TimeProvider clock, IActivityTracker activity)
    {
        _db = db;
        _clock = clock;
        _activity = activity;
    }

    /// <summary>Returns the user linked to this identity, creating a non-guest user on first sign-in.
    /// The display name and language are only set when the user is created; later the player owns them.</summary>
    public async Task<UserRecord> FindOrCreateAsync(string provider, string providerUserId, string displayName, string? language,
        string? email = null, AcquisitionData? acquisition = null)
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
            Language = language is { } code && code.StartsWith("en", StringComparison.OrdinalIgnoreCase) ? "en" : "fa",
            CreatedAt = now,
            LastSeenAt = now,
        };
        _db.Users.Add(user);
        _db.UserIdentities.Add(new UserIdentityRecord { UserId = user.Id, Provider = provider, ProviderUserId = providerUserId, Email = email, CreatedAt = now });
        _db.UserAcquisitions.Add(ToRecord(user.Id, acquisition, now));
        _activity.Track(user.Id, ActivityEvents.SignUp, ActivityEvents.SignupGoogle);
        await _db.SaveChangesAsync();
        return user;
    }

    /// <summary>Creates a guest who can play straight away. Without a name they get "Player 1234".
    /// A guest created by a crawler or script is marked as a bot straight away.</summary>
    public async Task<UserRecord> CreateGuestAsync(string? displayName, string? language, string? userAgent = null,
        AcquisitionData? acquisition = null)
    {
        bool crawler = BotDetector.IsCrawler(userAgent);
        var now = _clock.GetUtcNow().UtcDateTime;
        var user = new UserRecord
        {
            IsGuest = true,
            DisplayName = string.IsNullOrWhiteSpace(displayName)
                ? $"Player {System.Security.Cryptography.RandomNumberGenerator.GetInt32(1000, 10000)}"
                : CleanName(displayName),
            Language = language is { } code && code.StartsWith("en", StringComparison.OrdinalIgnoreCase) ? "en" : "fa",
            CreatedAt = now,
            LastSeenAt = now,
            IsBot = crawler,
            BotReason = crawler ? "crawler" : null,
            BotMarkedAt = crawler ? now : null,
        };
        _db.Users.Add(user);
        _db.UserAcquisitions.Add(ToRecord(user.Id, acquisition, now));
        _activity.Track(user.Id, ActivityEvents.SignUp, ActivityEvents.SignupGuest, new { crawler });
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
        _activity.Track(user.Id, ActivityEvents.SignUp, ActivityEvents.LinkGoogle);
        await _db.SaveChangesAsync();
        return new LinkResult(LinkOutcome.Linked, user);
    }

    public static string CleanName(string? name)
    {
        var trimmed = (name ?? string.Empty).Trim();
        if (trimmed.Length == 0) return "Player";
        return trimmed.Length <= MaxDisplayNameLength ? trimmed : trimmed[..MaxDisplayNameLength];
    }

    private static UserAcquisitionRecord ToRecord(Guid userId, AcquisitionData? input, DateTime now)
    {
        var referrer = CleanReferrer(input?.Referrer);
        var source = CleanToken(input?.Source, 100);
        var medium = CleanToken(input?.Medium, 100);
        var gclid = Clean(input?.Gclid, 256);

        if (gclid is not null)
        {
            source ??= "google";
            medium ??= "cpc";
        }

        if (source is null && referrer is not null && Uri.TryCreate(referrer, UriKind.Absolute, out var uri))
        {
            source = CleanToken(ClassifyReferrer(uri.Host), 100);
            medium ??= "referral";
        }

        source ??= "direct";
        medium ??= source == "direct" ? "none" : "referral";

        return new UserAcquisitionRecord
        {
            UserId = userId,
            Source = source,
            Medium = medium,
            Campaign = Clean(input?.Campaign, 200),
            Term = Clean(input?.Term, 200),
            Content = Clean(input?.Content, 200),
            Referrer = referrer,
            LandingPath = CleanLandingPath(input?.LandingPath),
            Gclid = gclid,
            FirstSeenAt = now,
        };
    }

    private static string ClassifyReferrer(string host)
    {
        host = host.ToLowerInvariant();
        if (host.StartsWith("www.")) host = host[4..];
        if (host is "chatgpt.com" or "chat.openai.com" || host.EndsWith(".chatgpt.com")) return "chatgpt";
        if (host == "gemini.google.com" || host.EndsWith(".gemini.google.com")) return "gemini";
        if (host == "google.com" || host.StartsWith("google.") || host.Contains(".google.")) return "google";
        return host;
    }

    private static string? CleanReferrer(string? value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https")) return null;
        return Clean(uri.GetLeftPart(UriPartial.Authority) + uri.AbsolutePath, 2048);
    }

    private static string? CleanLandingPath(string? value)
    {
        var cleaned = Clean(value, 2048);
        return cleaned is not null && cleaned.StartsWith('/') ? cleaned : null;
    }

    private static string? CleanToken(string? value, int maxLength) => Clean(value, maxLength)?.ToLowerInvariant();

    private static string? Clean(string? value, int maxLength)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }
}

public sealed record AcquisitionData(string? Source = null, string? Medium = null, string? Campaign = null,
    string? Term = null, string? Content = null, string? Referrer = null, string? LandingPath = null, string? Gclid = null);

public enum LinkOutcome { Linked, AlreadyLinkedElsewhere, NotAGuest, UserNotFound }

public sealed record LinkResult(LinkOutcome Outcome, UserRecord? User);
