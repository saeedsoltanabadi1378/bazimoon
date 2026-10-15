using Microsoft.EntityFrameworkCore;
using Nightfall.Infrastructure.History;
using Nightfall.Infrastructure.Hub;

namespace Nightfall.Api.Lounge;

/// <summary>Once a minute, sends the reminders players asked for: the daily-puzzle reminder at the
/// time set in their profile, and the Couple Quiz reminder at the couple's time. Times are Tehran
/// time, like the puzzle day, and each reminder goes out at most once per puzzle day.</summary>
public sealed class ReminderService : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly TimeProvider _clock;
    private readonly ILogger<ReminderService> _logger;

    public ReminderService(IServiceScopeFactory scopes, TimeProvider clock, ILogger<ReminderService> logger)
    {
        _scopes = scopes;
        _clock = clock;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1), _clock);
        do
        {
            try
            {
                using var scope = _scopes.CreateScope();
                await SendDueAsync(scope.ServiceProvider.GetRequiredService<NightfallDbContext>(),
                    scope.ServiceProvider.GetRequiredService<ITelegramNotifier>(), _clock.GetUtcNow(), stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Sending reminders failed; will retry next minute");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    /// <summary>Sends every reminder whose time has come today and has not gone out yet.</summary>
    public static async Task SendDueAsync(NightfallDbContext db, ITelegramNotifier notifier, DateTimeOffset now, CancellationToken ct = default)
    {
        int today = Progression.PuzzleDay(now);
        string clock = TehranClock(now);

        // ReminderTime is "HH:mm", so an ordinal string comparison is a time comparison.
        var players = await db.PlayerStats
            .Where(s => s.ReminderEnabled && (s.LastReminderDay == null || s.LastReminderDay < today) && string.Compare(s.ReminderTime, clock) <= 0)
            .ToListAsync(ct);
        foreach (var player in players)
        {
            player.LastReminderDay = today;
            // Nobody needs a nudge once they've already solved today's daily.
            if (player.LastPuzzleDay == today) continue;
            int streak = Progression.CurrentStreak(player.PuzzleStreak, player.LastPuzzleDay, player.StreakFreezes, today);
            string text = player.Language == "fa"
                ? streak > 0 ? $"پازل‌های امروز آماده‌اند. رکورد {streak} روزه‌ات را حفظ کن!" : "پازل‌های امروز آماده‌اند."
                : streak > 0 ? $"Today's puzzles are ready. Keep your {streak}-day streak going!" : "Today's puzzles are ready.";
            await notifier.NotifyAsync(player.TelegramUserId, text);
        }

        var couples = await db.Couples
            .Where(c => c.PartnerId != null && (c.LastReminderDay == null || c.LastReminderDay < today) && string.Compare(c.ReminderTime, clock) <= 0)
            .ToListAsync(ct);
        foreach (var couple in couples)
        {
            couple.LastReminderDay = today;
            var played = await db.CoupleAnswers.Where(a => a.CoupleId == couple.Id && a.Day == today).Select(a => a.TelegramUserId).ToListAsync(ct);
            foreach (long id in new[] { couple.InviterId, couple.PartnerId!.Value }.Except(played))
            {
                string text = couple.Language == "fa" ? "سؤال‌های امروز کوییز زوج‌ها منتظر شماست." : "Today's Couple Quiz questions are waiting for you.";
                await notifier.NotifyAsync(id, text, "couple");
            }
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>"HH:mm" in Tehran time (UTC+3:30, no daylight saving), matching the puzzle day.</summary>
    public static string TehranClock(DateTimeOffset now) => now.ToOffset(TimeSpan.FromMinutes(210)).ToString("HH:mm");
}
