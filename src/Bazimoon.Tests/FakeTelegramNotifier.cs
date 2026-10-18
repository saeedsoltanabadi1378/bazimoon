extern alias ApiAssembly;

using System.Collections.Concurrent;
using ApiAssembly::Bazimoon.Api.Lounge;

namespace Bazimoon.Tests;

/// <summary>Records player notifications instead of calling the Telegram Bot API.</summary>
public sealed class FakeTelegramNotifier : ITelegramNotifier
{
    public ConcurrentQueue<(Guid UserId, string Text, string? StartParam)> Sent { get; } = new();

    public Task<bool> NotifyAsync(Guid userId, string text, string? startParam = null)
    {
        Sent.Enqueue((userId, text, startParam));
        return Task.FromResult(true);
    }
}
