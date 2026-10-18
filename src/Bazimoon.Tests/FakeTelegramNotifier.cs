extern alias ApiAssembly;

using System.Collections.Concurrent;
using ApiAssembly::Bazimoon.Api.Lounge;

namespace Bazimoon.Tests;

/// <summary>Records bot notifications instead of calling the Telegram Bot API.</summary>
public sealed class FakeTelegramNotifier : ITelegramNotifier
{
    public ConcurrentQueue<(long UserId, string Text, string? StartParam)> Sent { get; } = new();

    public Task<bool> NotifyAsync(long telegramUserId, string text, string? startParam = null)
    {
        Sent.Enqueue((telegramUserId, text, startParam));
        return Task.FromResult(true);
    }
}
