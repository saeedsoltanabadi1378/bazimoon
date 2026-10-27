using Microsoft.EntityFrameworkCore;
using Bazimoon.Infrastructure.History;

namespace Bazimoon.Infrastructure.Hub;

public static class PlayerStatsExtensions
{
    /// <summary>Loads a player's stats row, creating it (tracked, unsaved) on first sight.</summary>
    public static async Task<PlayerStatsRecord> GetOrCreateStatsAsync(this BazimoonDbContext db, Guid userId, string? username, CancellationToken ct = default)
    {
        var stats = db.PlayerStats.Local.FirstOrDefault(s => s.UserId == userId)
            ?? await db.PlayerStats.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (stats is null)
        {
            var language = await db.Users.Where(u => u.Id == userId).Select(u => u.Language).FirstOrDefaultAsync(ct) ?? "fa";
            stats = new PlayerStatsRecord { UserId = userId, Username = username ?? string.Empty, Language = language };
            db.PlayerStats.Add(stats);
        }
        else if (!string.IsNullOrWhiteSpace(username))
        {
            stats.Username = username;
        }
        return stats;
    }
}
