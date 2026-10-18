extern alias ApiAssembly;

using System.Collections.Concurrent;
using ApiAssembly::Bazimoon.Api.Lounge;

namespace Bazimoon.Tests;

/// <summary>Records player notifications instead of sending them.</summary>
public sealed class FakePushNotifier : IPushNotifier
{
    public ConcurrentQueue<(Guid UserId, string Text, string? Target, string TextFa)> Sent { get; } = new();

    public Task<bool> NotifyAsync(Guid userId, PushText text, string? target = null)
    {
        Sent.Enqueue((userId, text.En, target, text.Fa));
        return Task.FromResult(true);
    }
}
