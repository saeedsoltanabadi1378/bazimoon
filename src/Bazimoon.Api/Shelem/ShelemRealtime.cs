using Microsoft.AspNetCore.SignalR;
using Bazimoon.Api.Hubs;

namespace Bazimoon.Api.Shelem;

/// <summary>Pings a Shelem room's connected players that its state moved on. Like <see cref="Games.IGameNotifier"/>,
/// it never pushes the room itself: every player's view hides the other hands, so clients re-fetch their own.</summary>
public interface IShelemNotifier
{
    Task RoomChangedAsync(string code, long version);
}

public sealed class SignalRShelemNotifier(IHubContext<GameHub> hub) : IShelemNotifier
{
    public Task RoomChangedAsync(string code, long version) =>
        hub.Clients.Group(GameHub.ShelemGroupName(code)).SendAsync("ShelemUpdated", new { code, version });
}

/// <summary>Moves bots and finished tricks on by the clock, so rooms advance without anyone polling.</summary>
public sealed class ShelemTicker(ShelemRoomService rooms, IShelemNotifier notifier, ILogger<ShelemTicker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(200));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                foreach (var (code, version) in rooms.TickDue())
                    await notifier.RoomChangedAsync(code, version);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex) { logger.LogError(ex, "Failed to advance Shelem rooms."); }
        }
    }
}
