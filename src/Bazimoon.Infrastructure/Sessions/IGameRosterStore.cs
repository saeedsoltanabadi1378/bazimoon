namespace Bazimoon.Infrastructure.Sessions;

public interface IGameRosterStore
{
    Task AddAsync(Guid gameId, Guid userId, string username);
    Task<IReadOnlyList<GameRosterEntry>> GetAsync(Guid gameId);
    Task RemoveAsync(Guid gameId);
}
