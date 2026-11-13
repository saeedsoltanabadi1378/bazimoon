using System.Text.Json;

namespace Bazimoon.Infrastructure.Sessions;

/// <summary>One table chat message, written by a living player while the town is awake.</summary>
public sealed record TableChatMessage(Guid Id, Guid SenderId, string SenderName, string Text, DateTimeOffset SentAt);

/// <summary>The table chat of a live game, kept next to the game session and dropped when the game ends.</summary>
public interface ITableChatStore
{
    Task<IReadOnlyList<TableChatMessage>> GetAsync(Guid gameId);
    Task AppendAsync(Guid gameId, TableChatMessage message);
    Task RemoveAsync(Guid gameId);
}

public sealed class TableChatStore : ITableChatStore
{
    /// <summary>How many recent messages a reconnect gets back.</summary>
    public const int Keep = 200;

    private static readonly TimeSpan Ttl = TimeSpan.FromHours(6);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly IKeyValueCache _cache;
    private readonly SemaphoreSlim _write = new(1, 1);

    public TableChatStore(IKeyValueCache cache)
    {
        _cache = cache;
    }

    private static string KeyFor(Guid gameId) => $"bazimoon:tablechat:{gameId}";

    public async Task<IReadOnlyList<TableChatMessage>> GetAsync(Guid gameId)
    {
        var json = await _cache.GetStringAsync(KeyFor(gameId));
        return json is null ? [] : JsonSerializer.Deserialize<List<TableChatMessage>>(json, JsonOptions) ?? [];
    }

    public async Task AppendAsync(Guid gameId, TableChatMessage message)
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
