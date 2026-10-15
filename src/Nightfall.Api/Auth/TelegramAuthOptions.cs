namespace Nightfall.Api.Auth;

public sealed class TelegramAuthOptions
{
    public const string SectionName = "Telegram";

    public string BotToken { get; set; } = string.Empty;
    public TimeSpan MaxInitDataAge { get; set; } = TimeSpan.FromHours(24);
    /// <summary>Mini App link (t.me/&lt;bot&gt;/&lt;app&gt;) used for "Open Nightfall" buttons in bot messages.</summary>
    public string? MiniAppUrl { get; set; }
}
