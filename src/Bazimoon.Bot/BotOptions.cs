namespace Bazimoon.Bot;

public sealed class BotOptions
{
    public const string SectionName = "Bot";

    public string BazimoonApiBaseUrl { get; set; } = string.Empty;

    /// <summary>Public URL for the @BazimoonGamesBot Mini App, normally https://bazimoon.com.
    /// DM role-reveal falls back to plain text when this isn't configured.</summary>
    public string? MiniAppBaseUrl { get; set; }

    /// <summary>Enables development-only commands that fill and advance a game with synthetic players.</summary>
    public bool SoloTestEnabled { get; set; }
}
