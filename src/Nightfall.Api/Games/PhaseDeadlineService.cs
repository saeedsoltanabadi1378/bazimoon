using Nightfall.Infrastructure.Sessions;

namespace Nightfall.Api.Games;

/// <summary>Every second, moves on each live game whose timer has run out: day and defence turns,
/// last words, and timed nights and votes (see <see cref="Nightfall.Domain.GameState.AdvanceExpiredPhase"/>).</summary>
public sealed class PhaseDeadlineService(
    IGameSessionStore sessions,
    IServiceScopeFactory scopes,
    ILogger<PhaseDeadlineService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            IReadOnlyCollection<Guid> ids;
            try { ids = (await sessions.ListActiveIdsAsync()).ToList(); }
            catch (Exception ex) { logger.LogError(ex, "Failed to list live games."); continue; }

            foreach (var gameId in ids)
            {
                // One broken game must not stop the clock for the others.
                try
                {
                    using var scope = scopes.CreateScope();
                    await scope.ServiceProvider.GetRequiredService<GameService>()
                        .AdvanceExpiredAsync(gameId, DateTimeOffset.UtcNow, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
                catch (Exception ex) { logger.LogError(ex, "Failed to advance the deadline of game {GameId}.", gameId); }
            }
        }
    }
}
