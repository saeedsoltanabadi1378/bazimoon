using Microsoft.EntityFrameworkCore;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Hub;

namespace Bazimoon.Api.Lounge;

/// <summary>Once a minute, looks after clan game nights: reminds the members who are coming an
/// hour before and again when the table opens, and schedules next week's night for weekly ones.</summary>
public sealed class ClanEventService : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly TimeProvider _clock;
    private readonly ILogger<ClanEventService> _logger;

    public ClanEventService(IServiceScopeFactory scopes, TimeProvider clock, ILogger<ClanEventService> logger)
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
                await RunDueAsync(scope.ServiceProvider.GetRequiredService<BazimoonDbContext>(),
                    scope.ServiceProvider.GetRequiredService<IPushNotifier>(), _clock.GetUtcNow().UtcDateTime, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Clan game-night job failed; will retry next minute");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    public static async Task RunDueAsync(BazimoonDbContext db, IPushNotifier notifier, DateTime now, CancellationToken ct = default)
    {
        var soon = now.AddHours(1);
        var opens = now + ClanService.EventOpensBefore;
        var due = await db.ClanEvents
            .Where(e => !e.Cancelled && ((!e.HourReminderSent && e.StartsAt <= soon) || (!e.StartReminderSent && e.StartsAt <= opens)))
            .ToListAsync(ct);
        foreach (var ev in due)
        {
            bool atStart = !ev.StartReminderSent && ev.StartsAt <= opens;
            ev.HourReminderSent = true;
            ev.StartReminderSent = ev.StartReminderSent || atStart;
            await db.SaveChangesAsync(ct);
            // Too late to be useful: the night is already over.
            if (ev.StartsAt + ClanService.EventLasts < now) continue;

            var clan = await db.Clans.AsNoTracking().FirstOrDefaultAsync(c => c.Id == ev.ClanId, ct);
            if (clan is null) continue;
            var members = db.ClanMembers.Where(m => m.ClanId == ev.ClanId).Select(m => m.UserId);
            var coming = await db.ClanRsvps
                .Where(r => r.EventId == ev.Id && r.Answer != ClanRsvpAnswers.No && members.Contains(r.UserId))
                .Select(r => r.UserId).ToListAsync(ct);
            var text = atStart
                ? new PushText($"{clan.Name}: “{ev.Title}” is starting. Tap to take your seat.", $"{clan.Name}: «{ev.Title}» شروع شد. برای نشستن سر میز بزنید.")
                : new PushText($"{clan.Name}: “{ev.Title}” starts in an hour.", $"{clan.Name}: «{ev.Title}» یک ساعت دیگر شروع می‌شود.");
            foreach (var id in coming) await notifier.NotifyAsync(id, text, "/clan");
        }

        // Weekly nights: once one is over, the next one goes on the calendar a week later.
        // Cancelling a weekly night ends the series.
        var over = now - ClanService.EventLasts;
        var weekly = await db.ClanEvents.Where(e => e.RepeatWeekly && !e.Cancelled && !e.NextScheduled && e.StartsAt <= over).ToListAsync(ct);
        foreach (var ev in weekly)
        {
            ev.NextScheduled = true;
            if (!await db.Clans.AnyAsync(c => c.Id == ev.ClanId, ct)) continue;
            var next = ev.StartsAt.AddDays(7);
            while (next + ClanService.EventLasts <= now) next = next.AddDays(7);
            db.ClanEvents.Add(new ClanEventRecord
            {
                ClanId = ev.ClanId, CreatedBy = ev.CreatedBy, Title = ev.Title, Note = ev.Note, StartsAt = next,
                Seats = ev.Seats, RepeatWeekly = true, CreatedAt = now, HourReminderSent = next - now <= TimeSpan.FromHours(1),
            });
        }
        await db.SaveChangesAsync(ct);
    }
}
