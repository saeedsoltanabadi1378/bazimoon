using System.Text.Json;

namespace Nightfall.Infrastructure.Sessions;

/// <summary>One graveyard chat message: sent by a player who is out or a spectator.</summary>
public sealed record GraveyardMessage(Guid Id, Guid SenderId, string SenderName, bool FromSpectator, string Text, DateTimeOffset SentAt);

/// <summary>The graveyard chat of a live game, kept next to the game session and dropped when the game ends.</summary>
public interface IGraveyardStore
{
    Task<IReadOnlyList<GraveyardMessage>> GetAsync(Guid gameId);
    Task AppendAsync(Guid gameId, GraveyardMessage message);
    Task RemoveAsync(Guid gameId);
}

public sealed class GraveyardStore : IGraveyardStore
{
    /// <summary>How many recent messages a reconnect gets back.</summary>
    public const int Keep = 200;

    private static readonly TimeSpan Ttl = TimeSpan.FromHours(6);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly IKeyValueCache _cache;
    private readonly SemaphoreSlim _write = new(1, 1);

    public GraveyardStore(IKeyValueCache cache)
    {
        _cache = cache;
    }

    private static string KeyFor(Guid gameId) => $"nightfall:graveyard:{gameId}";

    public async Task<IReadOnlyList<GraveyardMessage>> GetAsync(Guid gameId)
    {
        var json = await _cache.GetStringAsync(KeyFor(gameId));
        return json is null ? [] : JsonSerializer.Deserialize<List<GraveyardMessage>>(json, JsonOptions) ?? [];
    }

    public async Task AppendAsync(Guid gameId, GraveyardMessage message)
    {
        await _write.WaitAsync();
        try
        {
            var messages = (await GetAsync(gameId)).Append(message).TakeLast(Keep).ToList();
            await _cache.SetStringAsync(KeyFor(gameId), JsonSerializer.Serialize(messages, JsonOptions), Ttl);
        }
        finally
        {
            _write.Release();
        }
    }

    public Task RemoveAsync(Guid gameId) => _cache.DeleteAsync(KeyFor(gameId));
}
