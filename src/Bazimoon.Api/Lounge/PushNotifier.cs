using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WebPush;
using Bazimoon.Infrastructure.History;

namespace Bazimoon.Api.Lounge;

/// <summary>A notification text in both languages; each player gets the one their profile is set to.</summary>
public sealed record PushText(string En, string Fa)
{
    public string For(string? language) => language == "fa" && !string.IsNullOrWhiteSpace(Fa) ? Fa : En;
}

/// <summary>Sends a notification to a player's devices (couple nudges, reminders, game starts).
/// Best-effort: a failed delivery is logged and never fails the request that caused it.</summary>
public interface IPushNotifier
{
    /// <summary>Returns whether at least one device accepted it. <paramref name="target"/> is the
    /// app path it opens (e.g. "/couple" or "/g/{gameId}"); null opens Home.</summary>
    Task<bool> NotifyAsync(Guid userId, PushText text, string? target = null);
}

public sealed class PushOptions
{
    public const string SectionName = "Push";

    /// <summary>VAPID key pair (base64url). Without them no notification is sent.</summary>
    public string PublicKey { get; set; } = string.Empty;
    public string PrivateKey { get; set; } = string.Empty;
    /// <summary>Contact for push services, a mailto: or https: URL.</summary>
    public string Subject { get; set; } = "https://bazimoon.com";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(PublicKey) && !string.IsNullOrWhiteSpace(PrivateKey);
}

/// <summary>Delivers notifications with Web Push to every device the player subscribed, in the
/// player's language. Devices that the push service says are gone are forgotten.</summary>
public sealed class WebPushNotifier : IPushNotifier
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly BazimoonDbContext _db;
    private readonly IOptions<PushOptions> _options;
    private readonly WebPushClient _client;
    private readonly ILogger<WebPushNotifier> _logger;

    public WebPushNotifier(BazimoonDbContext db, IOptions<PushOptions> options, HttpClient http, ILogger<WebPushNotifier> logger)
    {
        _db = db;
        _options = options;
        _client = new WebPushClient(http);
        _logger = logger;
    }

    public async Task<bool> NotifyAsync(Guid userId, PushText text, string? target = null)
    {
        var options = _options.Value;
        if (!options.IsConfigured) return false;

        var devices = await _db.PushSubscriptions.Where(s => s.UserId == userId).ToListAsync();
        if (devices.Count == 0) return false;

        string language = await _db.PlayerStats.Where(s => s.UserId == userId).Select(s => s.Language).FirstOrDefaultAsync()
            ?? await _db.Users.Where(u => u.Id == userId).Select(u => u.Language).FirstOrDefaultAsync()
            ?? "en";
        string payload = JsonSerializer.Serialize(new
        {
            title = language == "fa" ? "نایت‌فال" : "Bazimoon",
            body = text.For(language),
            url = target ?? "/",
            lang = language,
            dir = language == "fa" ? "rtl" : "ltr",
        }, Json);

        var vapid = new VapidDetails(options.Subject, options.PublicKey, options.PrivateKey);
        bool delivered = false;
        foreach (var device in devices)
        {
            try
            {
                await _client.SendNotificationAsync(new PushSubscription(device.Endpoint, device.P256dh, device.Auth), payload, vapid);
                delivered = true;
            }
            catch (WebPushException ex) when (ex.StatusCode is System.Net.HttpStatusCode.Gone or System.Net.HttpStatusCode.NotFound)
            {
                _db.PushSubscriptions.Remove(device);
            }
            catch (Exception ex) when (ex is WebPushException or HttpRequestException or TaskCanceledException)
            {
                _logger.LogWarning(ex, "Web Push to a device of {UserId} failed", userId);
            }
        }
        await _db.SaveChangesAsync();
        return delivered;
    }
}
