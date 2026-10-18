using Microsoft.EntityFrameworkCore;
using Bazimoon.Infrastructure.History;

namespace Bazimoon.Infrastructure.Hub;

public static class PlayerStatsExtensions
{
    /// <summary>Loads a player's stats row, creating it (tracked, unsaved) on first sight.</summary>
    public static async Task<PlayerStatsRecord> GetOrCreateStatsAsync(this BazimoonDbContext db, long telegramUserId, string? username, CancellationToken ct = default)
    {
        var stats = db.PlayerStats.Local.FirstOrDefault(s => s.TelegramUserId == telegramUserId)
            ?? await db.PlayerStats.FirstOrDefaultAsync(s => s.TelegramUserId == telegramUserId, ct);
        if (stats is null)
        {
            stats = new PlayerStatsRecord { TelegramUserId = telegramUserId, Username = username ?? string.Empty };
            db.PlayerStats.Add(stats);
        }
        else if (!string.IsNullOrWhiteSpace(username))
        {
            stats.Username = username;
        }
        return stats;
    }
}
