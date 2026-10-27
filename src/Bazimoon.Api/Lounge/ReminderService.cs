using Microsoft.EntityFrameworkCore;
using Bazimoon.Infrastructure.Admin;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Hub;

namespace Bazimoon.Api.Lounge;

/// <summary>What the reminder job did today, for the admin health page.</summary>
public sealed class ReminderStatus
{
    private readonly object _gate = new();
    public DateTimeOffset? LastRunAt { get; private set; }
    public int Day { get; private set; }
    public int SentToday { get; private set; }
    public int FailedToday { get; private set; }

    public void Record(DateTimeOffset now, int day, int sent, int failed)
    {
        lock (_gate)
        {
            if (day != Day) { Day = day; SentToday = 0; FailedToday = 0; }
            LastRunAt = now;
            SentToday += sent;
            FailedToday += failed;
        }
    }
}

/// <summary>Once a minute, sends the reminders players asked for: the daily-puzzle reminder at the
/// time set in their profile, and the Couple Quiz reminder at the couple's time. Times are Tehran
/// time, like the puzzle day, and each reminder goes out at most once per puzzle day.</summary>
public sealed class ReminderService : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly TimeProvider _clock;
    private readonly ReminderStatus _status;
    private readonly ILogger<ReminderService> _logger;

    public ReminderService(IServiceScopeFactory scopes, TimeProvider clock, ReminderStatus status, ILogger<ReminderService> logger)
    {
        _scopes = scopes;
        _clock = clock;
        _status = status;
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
                var settings = await scope.ServiceProvider.GetRequiredService<IAppSettingsService>().GetAsync(stoppingToken);
                await SendDueAsync(scope.ServiceProvider.GetRequiredService<BazimoonDbContext>(),
                    scope.ServiceProvider.GetRequiredService<IPushNotifier>(), _clock.GetUtcNow(), settings, _status, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Sending reminders failed; will retry next minute");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    /// <summary>Sends every reminder whose time has come today and has not gone out yet.</summary>
    public static async Task SendDueAsync(BazimoonDbContext db, IPushNotifier notifier, DateTimeOffset now,
        AppSettingsSnapshot? settings = null, ReminderStatus? status = null, CancellationToken ct = default)
    {
        int today = Progression.PuzzleDay(now);
        string clock = TehranClock(now);
        string english = settings?.ReminderMessage is { Length: > 0 } en ? en : AppSettingsDefaults.ReminderMessage;
        string persian = settings?.ReminderMessageFa is { Length: > 0 } fa ? fa : AppSettingsDefaults.ReminderMessageFa;
        int sent = 0, failed = 0;

        // ReminderTime is "HH:mm", so an ordinal string comparison is a time comparison.
        var players = await db.PlayerStats
            .Where(s => s.ReminderEnabled && (s.LastReminderDay == null || s.LastReminderDay < today) && string.Compare(s.ReminderTime, clock) <= 0)
            .ToListAsync(ct);
        foreach (var player in players)
        {
            player.LastReminderDay = today;
            // Nobody needs a nudge once they've already solved a puzzle level today.
            if (player.LastPuzzleDay == today) continue;
            int streak = Progression.CurrentStreak(player.PuzzleStreak, player.LastPuzzleDay, player.StreakFreezes, today);
            // The editable message talks about the streak; with no streak to keep, a plain line is sent.
            var text = streak > 0
                ? new PushText(english.Replace("{streak}", streak.ToString()), persian.Replace("{streak}", streak.ToString()))
                : new PushText("Your next puzzle level is waiting.", "مرحله‌ی بعدی پازل منتظرت است.");
            if (await notifier.NotifyAsync(player.UserId, text)) sent++; else failed++;
        }

        var couples = await db.Couples
            .Where(c => settings == null || settings.IsGameOn("couple"))
            .Where(c => c.PartnerId != null && (c.LastReminderDay == null || c.LastReminderDay < today) && string.Compare(c.ReminderTime, clock) <= 0)
            .ToListAsync(ct);
        foreach (var couple in couples)
        {
            couple.LastReminderDay = today;
            var played = await db.CoupleAnswers.Where(a => a.CoupleId == couple.Id && a.Day == today).Select(a => a.UserId).ToListAsync(ct);
            foreach (Guid id in new[] { couple.InviterId, couple.PartnerId!.Value }.Except(played))
            {
                var text = new PushText("Today's Couple Quiz questions are waiting for you.", "سؤال‌های امروز کوییز زوج‌ها منتظر شماست.");
                if (await notifier.NotifyAsync(id, text, "/couple")) sent++; else failed++;
            }
        }

        if (sent > 0 || failed > 0)
        {
            db.OperationalEvents.Add(new OperationalEventRecord
            {
                Category = "Reminders",
                Severity = failed > 0 ? "Warning" : "Information",
                Message = failed > 0 ? $"Sent {sent} reminders; {failed} could not be delivered" : $"Sent {sent} reminders",
                TargetType = "Reminders",
            });
        }
        await db.SaveChangesAsync(ct);
        status?.Record(now, today, sent, failed);
    }

    /// <summary>"HH:mm" in Tehran time (UTC+3:30, no daylight saving), matching the puzzle day.</summary>
    public static string TehranClock(DateTimeOffset now) => now.ToOffset(TimeSpan.FromMinutes(210)).ToString("HH:mm");
}
