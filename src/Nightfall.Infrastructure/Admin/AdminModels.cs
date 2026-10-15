using System.Text.Json;

namespace Nightfall.Infrastructure.Admin;

public sealed class BotSettingsRecord
{
    public int Id { get; set; } = 1;
    public int Version { get; set; } = 1;
    public int MinPlayers { get; set; } = 3;
    public int MaxPlayers { get; set; } = 12;
    public bool MaintenanceMode { get; set; }
    public string MaintenanceMessage { get; set; } = "Nightfall is temporarily unavailable for maintenance.";
    public string EnabledCommandsJson { get; set; } = JsonSerializer.Serialize(BotSettingsDefaults.Commands);
    public bool SoloTestEnabled { get; set; }
    public string MiniAppBaseUrl { get; set; } = string.Empty;
    public string HelpMessage { get; set; } = BotSettingsDefaults.HelpMessage;
    public string WelcomeMessage { get; set; } = "🌙 New Nightfall game created by {creator}! Open the lobby to join, or use /join. Once everyone's in, /startgame.";
    // Persian versions, sent to players whose Telegram language is Persian (empty = use English).
    public string MaintenanceMessageFa { get; set; } = BotSettingsDefaults.MaintenanceMessageFa;
    public string HelpMessageFa { get; set; } = BotSettingsDefaults.HelpMessageFa;
    public string WelcomeMessageFa { get; set; } = BotSettingsDefaults.WelcomeMessageFa;
    /// <summary>Daily puzzle reminder; {streak} is replaced with the player's current streak.</summary>
    public string ReminderMessage { get; set; } = BotSettingsDefaults.ReminderMessage;
    public string ReminderMessageFa { get; set; } = BotSettingsDefaults.ReminderMessageFa;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public static class BotSettingsDefaults
{
    public static readonly string[] Commands = ["newgame", "join", "startgame", "resolvenight", "startvoting", "resolvevoting", "startnight", "myrole", "solotest", "solonext", "help", "start"];
    public const string MaintenanceMessageFa = "نایت‌فال موقتاً برای به‌روزرسانی در دسترس نیست.";
    public const string HelpMessageFa = "دستورهای نایت‌فال:\n/newgame — باز کردن لابی در این گروه\n/join — پیوستن به لابی\n/startgame — پخش نقش‌ها و شروع\n/resolvenight — پایان شب\n/startvoting — شروع رأی‌گیری\n/resolvevoting — شمارش آرا\n/startnight — شروع شب بعد\n/myrole — دریافت نقش به‌صورت خصوصی";
    public const string WelcomeMessageFa = "🌙 بازی تازه نایت‌فال توسط {creator}! لابی را باز کنید یا /join بفرستید. وقتی همه آمدند، /startgame.";
    public const string ReminderMessage = "Today's puzzles are ready. Keep your {streak}-day streak going!";
    public const string ReminderMessageFa = "پازل‌های امروز آماده‌اند. رکورد {streak} روزه‌ات را حفظ کن!";
    public const string HelpMessage = "Nightfall commands:\n/newgame — start a new lobby in this chat\n/join — join the current lobby\n/startgame — assign roles and begin\n/resolvenight — resolve the current night\n/startvoting — open voting\n/resolvevoting — tally votes\n/startnight — begin the next night\n/myrole — DM yourself your current role";
}

public static class BotMessages
{
    /// <summary>Picks the Persian text for Persian speakers when one is set, otherwise the English one.</summary>
    public static string Pick(string english, string persian, string? languageCode) =>
        languageCode is { } code && code.StartsWith("fa", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(persian) ? persian : english;
}

public sealed class UserProfileRecord { public long TelegramUserId { get; set; } public string Username { get; set; } = string.Empty; public DateTime FirstSeenAt { get; set; } = DateTime.UtcNow; public DateTime LastSeenAt { get; set; } = DateTime.UtcNow; }
public sealed class ChatProfileRecord { public long TelegramChatId { get; set; } public string? Title { get; set; } public DateTime FirstSeenAt { get; set; } = DateTime.UtcNow; public DateTime LastSeenAt { get; set; } = DateTime.UtcNow; }
public sealed class OperationalEventRecord { public long Id { get; set; } public DateTime CreatedAt { get; set; } = DateTime.UtcNow; public string Category { get; set; } = string.Empty; public string Severity { get; set; } = "Information"; public string Message { get; set; } = string.Empty; public string? TargetType { get; set; } public string? TargetId { get; set; } public string? MetadataJson { get; set; } public bool IsAdminAudit { get; set; } }
