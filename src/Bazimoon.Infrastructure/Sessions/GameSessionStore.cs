using System.Text.Json;
using Bazimoon.Domain;

namespace Bazimoon.Infrastructure.Sessions;

public sealed class GameSessionStore : IGameSessionStore
{
    private static readonly TimeSpan SessionTtl = TimeSpan.FromHours(6);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly IKeyValueCache _cache;

    public GameSessionStore(IKeyValueCache cache)
    {
        _cache = cache;
    }

    private static string KeyFor(Guid gameId) => $"bazimoon:game:{gameId}";

    public async Task<GameState?> GetAsync(Guid gameId)
    {
        var json = await _cache.GetStringAsync(KeyFor(gameId));
        if (json is null)
            return null;

        var snapshot = JsonSerializer.Deserialize<GameStateSnapshot>(json, JsonOptions);
        return snapshot is null ? null : GameState.FromSnapshot(snapshot);
    }

    public Task SaveAsync(GameState game)
    {
        var json = JsonSerializer.Serialize(game.ToSnapshot(), JsonOptions);
        return _cache.SetStringAsync(KeyFor(game.GameId), json, SessionTtl);
    }

    public Task RemoveAsync(Guid gameId) => _cache.DeleteAsync(KeyFor(gameId));

    public async Task<IReadOnlyList<Guid>> ListActiveIdsAsync() =>
        (await _cache.GetKeysAsync("bazimoon:game:*")).Select(k => k.Split(':').Last()).Where(x => Guid.TryParse(x, out _)).Select(Guid.Parse).ToList();
}
