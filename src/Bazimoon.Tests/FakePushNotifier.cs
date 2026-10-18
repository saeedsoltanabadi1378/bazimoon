extern alias ApiAssembly;

using System.Collections.Concurrent;
using ApiAssembly::Bazimoon.Api.Lounge;

namespace Bazimoon.Tests;

/// <summary>Records player notifications instead of sending them.</summary>
public sealed class FakePushNotifier : IPushNotifier
{
    public ConcurrentQueue<(Guid UserId, string Text, string? Target)> Sent { get; } = new();

    public Task<bool> NotifyAsync(Guid userId, string text, string? target = null)
    {
        Sent.Enqueue((userId, text, target));
        return Task.FromResult(true);
    }
}
