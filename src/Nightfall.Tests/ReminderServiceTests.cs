using Microsoft.Extensions.DependencyInjection;
using Nightfall.Api.Lounge;
using Nightfall.Infrastructure.History;
using Nightfall.Infrastructure.Hub;

namespace Nightfall.Tests;

public class ReminderServiceTests : IClassFixture<NightfallApiFactory>, IAsyncLifetime
{
    private readonly NightfallApiFactory _factory;

    public ReminderServiceTests(NightfallApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Reminders_GoOutOnceADay_AfterTheirTime_AndSkipPlayersWhoAlreadyPlayed()
    {
        // 09:30 in Tehran is 06:00 UTC.
        var now = new DateTimeOffset(2026, 10, 15, 6, 0, 0, TimeSpan.Zero);
        int today = Progression.PuzzleDay(now);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NightfallDbContext>();
        db.PlayerStats.AddRange(
            new PlayerStatsRecord { TelegramUserId = 990001, Username = "due", ReminderTime = "09:00" },
            new PlayerStatsRecord { TelegramUserId = 990002, Username = "later", ReminderTime = "21:00" },
            new PlayerStatsRecord { TelegramUserId = 990003, Username = "solved", ReminderTime = "08:00", LastPuzzleDay = today },
            new PlayerStatsRecord { TelegramUserId = 990004, Username = "off", ReminderTime = "08:00", ReminderEnabled = false });
        var couple = new CoupleRecord { InviterId = 990011, PartnerId = 990012, InviteToken = "REMINDTEST", StartDay = today, ReminderTime = "09:15" };
        db.Couples.Add(couple);
        db.CoupleAnswers.Add(new CoupleAnswerRecord { CoupleId = couple.Id, Day = today, TelegramUserId = 990011, Answers = "0,0,0,0,0,0" });
        await db.SaveChangesAsync();

        var notifier = new FakeTelegramNotifier();
        await ReminderService.SendDueAsync(db, notifier, now);
        var sent = notifier.Sent.Select(m => m.UserId).ToList();
        Assert.Contains(990001, sent);
        Assert.Contains(990012, sent);
        Assert.DoesNotContain(990011, sent);
        Assert.DoesNotContain(990002, sent);
        Assert.DoesNotContain(990003, sent);
        Assert.DoesNotContain(990004, sent);

        var again = new FakeTelegramNotifier();
        await ReminderService.SendDueAsync(db, again, now.AddMinutes(5));
        Assert.DoesNotContain(again.Sent, m => m.UserId is 990001 or 990012);
    }

    [Fact]
    public void TehranClock_IsThreeAndAHalfHoursAhead() =>
        Assert.Equal("03:30", ReminderService.TehranClock(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)));
}
