using Bazimoon.Api.Shelem;
using Bazimoon.Infrastructure.Admin;

namespace Bazimoon.Tests;

public sealed class ShelemRoomServiceTests
{
    private sealed class FakeClock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2026, 10, 29, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed class Settings : IAppSettingsService
    {
        public Task<AppSettingsSnapshot> GetAsync(CancellationToken ct = default) => Task.FromResult(new AppSettingsSnapshot(1, 4, 4, false, ""));
    }

    private sealed class RecordingNotifier : IShelemNotifier
    {
        public List<(string Code, long Version)> Pings { get; } = [];
        public Task RoomChangedAsync(string code, long version) { Pings.Add((code, version)); return Task.CompletedTask; }
    }

    [Fact]
    public async Task TickDue_MovesBotsOnByTheClockWithoutAnyonePolling()
    {
        var clock = new FakeClock();
        var service = new ShelemRoomService(clock, new Settings(), new RecordingNotifier());
        var me = Guid.NewGuid();
        var room = await service.CreateAsync(me, "Saeed", withBots: true);
        if (room.TurnSeat == room.YourSeat) room = await service.BidAsync(room.Code, me, null, false); // hand the turn to a bot

        Assert.Empty(service.TickDue());
        clock.Now = clock.Now.AddSeconds(1);
        var changed = Assert.Single(service.TickDue());
        Assert.Equal(room.Code, changed.Code);
        Assert.True(changed.Version > room.Version);
    }

    [Fact]
    public async Task TurnTimer_MovesForAPersonWhoRunsOutOfTime()
    {
        var clock = new FakeClock();
        var service = new ShelemRoomService(clock, new Settings(), new RecordingNotifier());
        var me = Guid.NewGuid();
        var room = await service.CreateAsync(me, "Saeed", withBots: true);
        for (int i = 0; i < 20 && room.TurnSeat != room.YourSeat; i++)
        {
            clock.Now = clock.Now.AddSeconds(1);
            service.TickDue();
            room = await service.GetAsync(room.Code, me);
        }
        Assert.Equal(room.YourSeat, room.TurnSeat);
        Assert.Equal(30_000, room.TurnRemainingMs);

        clock.Now = clock.Now.AddSeconds(29);
        Assert.Empty(service.TickDue());
        clock.Now = clock.Now.AddSeconds(1);
        Assert.Single(service.TickDue());

        var after = await service.GetAsync(room.Code, me);
        Assert.True(after.Version > room.Version);
        // A timed-out bid is a pass: either the auction went on without us, or every seat passed and the cards were redealt.
        if (after.Phase == "bidding" && after.DealerSeat == room.DealerSeat) Assert.True(after.Players.Single(p => p.IsYou).Passed);
    }

    [Fact]
    public async Task Moves_PingTheRoomWithTheNewVersion()
    {
        var notifier = new RecordingNotifier();
        var service = new ShelemRoomService(new FakeClock(), new Settings(), notifier);
        var host = Guid.NewGuid();
        var room = await service.CreateAsync(host, "Saeed", withBots: false);

        var joined = await service.JoinAsync(room.Code, Guid.NewGuid(), "Sara");

        Assert.Equal((room.Code, joined.Version), Assert.Single(notifier.Pings));
    }
}
