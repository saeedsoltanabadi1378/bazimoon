using static Bazimoon.Tests.TestIds;
using Microsoft.Extensions.DependencyInjection;
using Bazimoon.Api.Lounge;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Hub;

namespace Bazimoon.Tests;

public class ReminderServiceTests : IClassFixture<BazimoonApiFactory>, IAsyncLifetime
{
    private readonly BazimoonApiFactory _factory;

    public ReminderServiceTests(BazimoonApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Reminders_GoOutOnceADay_AfterTheirTime_AndSkipPlayersWhoAlreadyPlayed()
    {
        // 09:30 in Tehran is 06:00 UTC.
        var now = new DateTimeOffset(2026, 10, 15, 6, 0, 0, TimeSpan.Zero);
        int today = Progression.PuzzleDay(now);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BazimoonDbContext>();
        db.PlayerStats.AddRange(
            new PlayerStatsRecord { UserId = U(990001), Username = "due", ReminderTime = "09:00" },
            new PlayerStatsRecord { UserId = U(990002), Username = "later", ReminderTime = "21:00" },
            new PlayerStatsRecord { UserId = U(990003), Username = "solved", ReminderTime = "08:00", LastPuzzleDay = today },
            new PlayerStatsRecord { UserId = U(990004), Username = "off", ReminderTime = "08:00", ReminderEnabled = false });
        var couple = new CoupleRecord { InviterId = U(990011), PartnerId = U(990012), InviteToken = "REMINDTEST", StartDay = today, ReminderTime = "09:15" };
        db.Couples.Add(couple);
        db.CoupleAnswers.Add(new CoupleAnswerRecord { CoupleId = couple.Id, Day = today, UserId = U(990011), Answers = "0,0,0,0,0,0" });
        await db.SaveChangesAsync();

        var notifier = new FakePushNotifier();
        await ReminderService.SendDueAsync(db, notifier, now);
        var sent = notifier.Sent.Select(m => m.UserId).ToList();
        Assert.Contains(U(990001), sent);
        Assert.Contains(U(990012), sent);
        Assert.DoesNotContain(U(990011), sent);
        Assert.DoesNotContain(U(990002), sent);
        Assert.DoesNotContain(U(990003), sent);
        Assert.DoesNotContain(U(990004), sent);

        var again = new FakePushNotifier();
        await ReminderService.SendDueAsync(db, again, now.AddMinutes(5));
        Assert.DoesNotContain(again.Sent, m => m.UserId == U(990001) || m.UserId == U(990012));
    }

    [Fact]
    public void TehranClock_IsThreeAndAHalfHoursAhead() =>
        Assert.Equal("03:30", ReminderService.TehranClock(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)));
}
