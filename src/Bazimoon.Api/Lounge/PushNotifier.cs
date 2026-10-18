namespace Bazimoon.Api.Lounge;

/// <summary>Sends a notification to a player's devices (couple nudges, reminders).
/// Best-effort: a failed delivery is logged and never fails the request that caused it.</summary>
public interface IPushNotifier
{
    /// <summary>Returns whether the notification was delivered. <paramref name="target"/> is the
    /// part of the app it opens (e.g. "couple"); null opens Home.</summary>
    Task<bool> NotifyAsync(Guid userId, string text, string? target = null);
}

/// <summary>Stands in until Web Push is set up: delivers nothing.</summary>
public sealed class NoPushNotifier : IPushNotifier
{
    public Task<bool> NotifyAsync(Guid userId, string text, string? target = null) => Task.FromResult(false);
}
