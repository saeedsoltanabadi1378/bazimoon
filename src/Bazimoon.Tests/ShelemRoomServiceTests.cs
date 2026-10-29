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
