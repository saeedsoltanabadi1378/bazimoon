using Microsoft.EntityFrameworkCore;
using Bazimoon.Infrastructure.History;

namespace Bazimoon.Api.Auth;

/// <summary>Once an hour, deletes guests nobody has used for 30 days, with their progress.
/// Signed-in players are never deleted.</summary>
public sealed class GuestCleanupService : BackgroundService
{
    public static readonly TimeSpan InactiveFor = TimeSpan.FromDays(30);
    private const int BatchSize = 500;

    private readonly IServiceScopeFactory _scopes;
    private readonly TimeProvider _clock;
    private readonly ILogger<GuestCleanupService> _logger;

    public GuestCleanupService(IServiceScopeFactory scopes, TimeProvider clock, ILogger<GuestCleanupService> logger)
    {
        _scopes = scopes;
        _clock = clock;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        do
        {
            try
            {
                using var scope = _scopes.CreateScope();
                int deleted = await DeleteInactiveGuestsAsync(scope.ServiceProvider.GetRequiredService<BazimoonDbContext>(), _clock.GetUtcNow(), stoppingToken);
                if (deleted > 0) _logger.LogInformation("Deleted {Count} inactive guests", deleted);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Guest cleanup failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    /// <summary>Deletes up to one batch of inactive guests and returns how many went.</summary>
    public static async Task<int> DeleteInactiveGuestsAsync(BazimoonDbContext db, DateTimeOffset now, CancellationToken ct = default)
    {
        var cutoff = now.UtcDateTime - InactiveFor;
        var guests = await db.Users.Where(u => u.IsGuest && u.LastSeenAt < cutoff).Take(BatchSize).ToListAsync(ct);
        if (guests.Count == 0) return 0;
        var ids = guests.Select(u => u.Id).ToList();

        db.PlayerStats.RemoveRange(await db.PlayerStats.Where(s => ids.Contains(s.UserId)).ToListAsync(ct));
        db.PuzzleResults.RemoveRange(await db.PuzzleResults.Where(r => ids.Contains(r.UserId)).ToListAsync(ct));
        db.PuzzleProgress.RemoveRange(await db.PuzzleProgress.Where(p => ids.Contains(p.UserId)).ToListAsync(ct));
        db.CoupleAnswers.RemoveRange(await db.CoupleAnswers.Where(a => ids.Contains(a.UserId)).ToListAsync(ct));
        db.Couples.RemoveRange(await db.Couples.Where(c => ids.Contains(c.InviterId) || (c.PartnerId != null && ids.Contains(c.PartnerId.Value))).ToListAsync(ct));
        db.RefreshTokens.RemoveRange(await db.RefreshTokens.Where(t => ids.Contains(t.UserId)).ToListAsync(ct));
        db.UserIdentities.RemoveRange(await db.UserIdentities.Where(i => ids.Contains(i.UserId)).ToListAsync(ct));
        // Finished Mafia games stay in history for the other players; the guest's seat just loses its link.
        foreach (var seat in await db.GamePlayers.Where(p => p.UserId != null && ids.Contains(p.UserId.Value)).ToListAsync(ct))
            seat.UserId = null;
        db.Users.RemoveRange(guests);
        await db.SaveChangesAsync(ct);
        return guests.Count;
    }
}
