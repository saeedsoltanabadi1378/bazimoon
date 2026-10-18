using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.ReplyMarkups;

namespace Bazimoon.Bot;

public sealed class TelegramBotMessenger : IBotMessenger
{
    private readonly ITelegramBotClient _client;

    public TelegramBotMessenger(ITelegramBotClient client)
    {
        _client = client;
    }

    public async Task SendTextAsync(long chatId, string text) =>
        await _client.SendMessage(chatId, text);

    public async Task SendWithMiniAppButtonAsync(long chatId, string text, string? miniAppUrl)
    {
        InlineKeyboardMarkup? markup = miniAppUrl is null
            ? null
            : new InlineKeyboardMarkup(InlineKeyboardButton.WithWebApp("Open Bazimoon", new WebAppInfo(miniAppUrl)));

        await _client.SendMessage(chatId, text, replyMarkup: markup);
    }

    public async Task SendWithUrlButtonAsync(long chatId, string text, string? url)
    {
        InlineKeyboardMarkup? markup = url is null
            ? null
            : new InlineKeyboardMarkup(InlineKeyboardButton.WithUrl("Open Bazimoon", url));

        await _client.SendMessage(chatId, text, replyMarkup: markup);
    }
}
