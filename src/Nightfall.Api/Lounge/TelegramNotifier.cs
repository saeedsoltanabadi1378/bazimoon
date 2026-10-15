using Microsoft.Extensions.Options;
using Nightfall.Api.Auth;

namespace Nightfall.Api.Lounge;

/// <summary>Sends a private message from the bot to a player (couple nudges, reminders).
/// Best-effort: a failed delivery is logged and never fails the request that caused it.</summary>
public interface ITelegramNotifier
{
    Task NotifyAsync(long telegramUserId, string text, string? startParam = null);
}

/// <summary>Talks to the Telegram Bot API directly with the same bot token the API validates
/// Mini App sessions with, so the API can reach players without going through the bot process.</summary>
public sealed class TelegramNotifier : ITelegramNotifier
{
    private readonly HttpClient _http;
    private readonly IOptions<TelegramAuthOptions> _options;
    private readonly ILogger<TelegramNotifier> _logger;

    public TelegramNotifier(HttpClient http, IOptions<TelegramAuthOptions> options, ILogger<TelegramNotifier> logger)
    {
        _http = http;
        _options = options;
        _logger = logger;
    }

    public async Task NotifyAsync(long telegramUserId, string text, string? startParam = null)
    {
        var options = _options.Value;
        object? markup = null;
        if (options.MiniAppUrl is { Length: > 0 } url)
        {
            string link = startParam is null ? url : $"{url}?startapp={Uri.EscapeDataString(startParam)}";
            markup = new { inline_keyboard = new[] { new[] { new { text = "Open Nightfall", url = link } } } };
        }
        try
        {
            using var response = await _http.PostAsJsonAsync(
                $"https://api.telegram.org/bot{options.BotToken}/sendMessage",
                new { chat_id = telegramUserId, text, reply_markup = markup });
            if (!response.IsSuccessStatusCode)
                _logger.LogWarning("Telegram sendMessage to {UserId} failed with {Status}", telegramUserId, (int)response.StatusCode);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning(ex, "Telegram sendMessage to {UserId} failed", telegramUserId);
        }
    }
}
