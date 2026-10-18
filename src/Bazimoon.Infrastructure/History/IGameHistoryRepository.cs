using Bazimoon.Domain;

namespace Bazimoon.Infrastructure.History;

public interface IGameHistoryRepository
{
    Task SaveCompletedGameAsync(GameState game, CancellationToken ct = default);
    Task<GameRecord?> GetAsync(Guid gameId, CancellationToken ct = default);
}
