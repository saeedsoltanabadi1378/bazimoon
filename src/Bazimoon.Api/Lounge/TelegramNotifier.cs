using Microsoft.Extensions.Options;
using Bazimoon.Api.Auth;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Bazimoon.Api.Lounge;

/// <summary>Sends a private message from the bot to a player (couple nudges, reminders).
/// Best-effort: a failed delivery is logged and never fails the request that caused it.</summary>
public interface ITelegramNotifier
{
    /// <summary>Returns whether Telegram accepted the message.</summary>
    Task<bool> NotifyAsync(Guid userId, string text, string? startParam = null);
}

/// <summary>Talks to the Telegram Bot API directly with the same bot token the API validates
/// Mini App sessions with, so the API can reach players without going through the bot process.</summary>
public sealed class TelegramNotifier : ITelegramNotifier
{
    private readonly HttpClient _http;
    private readonly IOptions<TelegramAuthOptions> _options;
    private readonly BazimoonDbContext _db;
    private readonly ILogger<TelegramNotifier> _logger;

    public TelegramNotifier(HttpClient http, IOptions<TelegramAuthOptions> options, BazimoonDbContext db, ILogger<TelegramNotifier> logger)
    {
        _http = http;
        _db = db;
        _options = options;
        _logger = logger;
    }

    public async Task<bool> NotifyAsync(Guid userId, string text, string? startParam = null)
    {
        var options = _options.Value;
        // Only players who signed in through Telegram can be messaged there.
        var chatId = await _db.UserIdentities.AsNoTracking()
            .Where(i => i.UserId == userId && i.Provider == IdentityProviders.Telegram)
            .Select(i => i.ProviderUserId).FirstOrDefaultAsync();
        if (chatId is null) return false;
        object? markup = null;
        if (options.MiniAppUrl is { Length: > 0 } url)
        {
            string link = startParam is null ? url : $"{url}?startapp={Uri.EscapeDataString(startParam)}";
            markup = new { inline_keyboard = new[] { new[] { new { text = "Open Bazimoon", url = link } } } };
        }
        try
        {
            using var response = await _http.PostAsJsonAsync(
                $"https://api.telegram.org/bot{options.BotToken}/sendMessage",
                new { chat_id = long.Parse(chatId), text, reply_markup = markup });
            if (!response.IsSuccessStatusCode)
                _logger.LogWarning("Telegram sendMessage to {UserId} failed with {Status}", userId, (int)response.StatusCode);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning(ex, "Telegram sendMessage to {UserId} failed", userId);
            return false;
        }
    }
}
