namespace Bazimoon.Infrastructure.Admin;

/// <summary>App-wide settings an admin edits in the console (one row): Mafia table limits,
/// maintenance mode, game switches and the notification texts.</summary>
public sealed class AppSettingsRecord
{
    public int Id { get; set; } = 1;
    public int Version { get; set; } = 1;
    public int MinPlayers { get; set; } = 3;
    public int MaxPlayers { get; set; } = 12;
    public bool MaintenanceMode { get; set; }
    public string MaintenanceMessage { get; set; } = "Bazimoon is temporarily unavailable for maintenance.";
    // Persian versions, shown to players whose language is Persian (empty = use English).
    public string MaintenanceMessageFa { get; set; } = AppSettingsDefaults.MaintenanceMessageFa;
    /// <summary>Daily puzzle reminder; {streak} is replaced with the player's current streak.</summary>
    public string ReminderMessage { get; set; } = AppSettingsDefaults.ReminderMessage;
    public string ReminderMessageFa { get; set; } = AppSettingsDefaults.ReminderMessageFa;
    /// <summary>Sent to the players at a table when its game starts; {creator} and {table} are filled in.</summary>
    public string TableStartMessage { get; set; } = AppSettingsDefaults.TableStartMessage;
    public string TableStartMessageFa { get; set; } = AppSettingsDefaults.TableStartMessageFa;
    /// <summary>Sent when a partner has answered today's Couple Quiz; {partner} is filled in.</summary>
    public string CoupleTurnMessage { get; set; } = AppSettingsDefaults.CoupleTurnMessage;
    public string CoupleTurnMessageFa { get; set; } = AppSettingsDefaults.CoupleTurnMessageFa;
    /// <summary>Games an admin switched off (keys from AppSettingsDefaults.Games). Hidden from the app; new Mafia tables and couple invites are refused.</summary>
    public string DisabledGamesJson { get; set; } = "[]";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public static class AppSettingsDefaults
{
    /// <summary>Every game an admin can switch on or off.</summary>
    public static readonly string[] Games = ["mafia", "couple", "zip", "queens", "sudoku", "word", "ladder", "mines", "merge", "blocks", "stack", "memory", "snake", "dooz", "spy", "esmfamil"];
    public const string MafiaOff = "Mafia is switched off for now. Try again later.";
    public const string MafiaOffFa = "مافیا فعلاً خاموش است. بعداً دوباره امتحان کنید.";
    public const string MaintenanceMessageFa = "نایت‌فال موقتاً برای به‌روزرسانی در دسترس نیست.";
    public const string ReminderMessage = "Today's puzzles are ready. Keep your {streak}-day streak going!";
    public const string TableStartMessage = "{creator} started {table}. Your role is waiting.";
    public const string TableStartMessageFa = "{creator} بازی {table} را شروع کرد. نقشت منتظر توست.";
    public const string CoupleTurnMessage = "{partner} answered today's questions. Your turn!";
    public const string CoupleTurnMessageFa = "{partner} به سؤال‌های امروز جواب داد. نوبت توست!";
    public const string ReminderMessageFa = "پازل‌های امروز آماده‌اند. رکورد {streak} روزه‌ات را حفظ کن!";
}

public static class PlayerMessages
{
    /// <summary>Picks the Persian text for Persian speakers when one is set, otherwise the English one.</summary>
    public static string Pick(string english, string persian, string? languageCode) =>
        languageCode is { } code && code.StartsWith("fa", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(persian) ? persian : english;
}

public sealed class OperationalEventRecord { public long Id { get; set; } public DateTime CreatedAt { get; set; } = DateTime.UtcNow; public string Category { get; set; } = string.Empty; public string Severity { get; set; } = "Information"; public string Message { get; set; } = string.Empty; public string? TargetType { get; set; } public string? TargetId { get; set; } public string? MetadataJson { get; set; } public bool IsAdminAudit { get; set; } }
