using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Bazimoon.Infrastructure.Auth;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Identity;

namespace Bazimoon.Api.Auth;

/// <summary>Issues, rotates and revokes refresh tokens. Each refresh replaces the token it used;
/// presenting an already-used token signs that user out everywhere, since it may have been stolen.</summary>
public sealed class RefreshTokenService
{
    private readonly BazimoonDbContext _db;
    private readonly IOptions<JwtOptions> _jwt;
    private readonly TimeProvider _clock;

    public RefreshTokenService(BazimoonDbContext db, IOptions<JwtOptions> jwt, TimeProvider clock)
    {
        _db = db;
        _jwt = jwt;
        _clock = clock;
    }

    private DateTime Now => _clock.GetUtcNow().UtcDateTime;

    /// <summary>Creates a refresh token for the user and returns it; only its hash is stored.</summary>
    public async Task<string> IssueAsync(Guid userId)
    {
        string token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        _db.RefreshTokens.Add(new RefreshTokenRecord { UserId = userId, TokenHash = Hash(token), CreatedAt = Now, ExpiresAt = Now + _jwt.Value.RefreshTokenLifetime });
        await _db.SaveChangesAsync();
        return token;
    }

    /// <summary>Uses up a refresh token and returns its user, or null when the token is unknown,
    /// expired or already used (in which case all of that user's tokens are revoked).</summary>
    public async Task<UserRecord?> RedeemAsync(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        string hash = Hash(token);
        var record = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);
        if (record is null) return null;
        if (record.RevokedAt is not null)
        {
            await RevokeAllAsync(record.UserId);
            return null;
        }
        if (record.ExpiresAt <= Now) return null;

        record.RevokedAt = Now;
        var user = await _db.Users.FindAsync(record.UserId);
        if (user is not null) user.LastSeenAt = Now;
        await _db.SaveChangesAsync();
        return user;
    }

    public async Task RevokeAsync(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return;
        string hash = Hash(token);
        var record = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);
        if (record is null || record.RevokedAt is not null) return;
        record.RevokedAt = Now;
        await _db.SaveChangesAsync();
    }

    public async Task RevokeAllAsync(Guid userId)
    {
        var live = await _db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null).ToListAsync();
        foreach (var t in live) t.RevokedAt = Now;
        await _db.SaveChangesAsync();
    }

    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
