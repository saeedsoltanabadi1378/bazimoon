using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Bazimoon.Infrastructure.History;

namespace Bazimoon.Infrastructure.Admin;

public sealed record BotSettingsSnapshot(int Version, int MinPlayers, int MaxPlayers, bool MaintenanceMode, string MaintenanceMessage, IReadOnlySet<string> EnabledCommands, bool SoloTestEnabled, string MiniAppBaseUrl, string HelpMessage, string WelcomeMessage, DateTime UpdatedAt,
    string MaintenanceMessageFa = "", string HelpMessageFa = "", string WelcomeMessageFa = "",
    string ReminderMessage = BotSettingsDefaults.ReminderMessage, string ReminderMessageFa = BotSettingsDefaults.ReminderMessageFa,
    IReadOnlySet<string>? DisabledGames = null)
{
    public bool IsGameOn(string game) => DisabledGames is null || !DisabledGames.Contains(game);
}
public interface IBotSettingsService { Task<BotSettingsSnapshot> GetAsync(CancellationToken ct = default); }

public sealed class BotSettingsService : IBotSettingsService
{
    private readonly IServiceScopeFactory _scopes;
    private BotSettingsSnapshot? _cached;
    private DateTime _expires;
    private readonly SemaphoreSlim _gate = new(1, 1);
    public BotSettingsService(IServiceScopeFactory scopes) => _scopes = scopes;

    /// <summary>Drops the cached copy so a save in this process takes effect at once.</summary>
    public void Invalidate() => _expires = DateTime.MinValue;

    public async Task<BotSettingsSnapshot> GetAsync(CancellationToken ct = default)
    {
        if (_cached is not null && _expires > DateTime.UtcNow) return _cached;
        await _gate.WaitAsync(ct);
        try
        {
            if (_cached is not null && _expires > DateTime.UtcNow) return _cached;
            await using var scope = _scopes.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<BazimoonDbContext>();
            var row = await db.BotSettings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == 1, ct);
            if (row is null) { row = new(); db.BotSettings.Add(row); await db.SaveChangesAsync(ct); }
            _cached = ToSnapshot(row); _expires = DateTime.UtcNow.AddSeconds(3); return _cached;
        }
        finally { _gate.Release(); }
    }

    public static BotSettingsSnapshot ToSnapshot(BotSettingsRecord row) => new(row.Version, row.MinPlayers, row.MaxPlayers, row.MaintenanceMode, row.MaintenanceMessage, ParseSet(row.EnabledCommandsJson, BotSettingsDefaults.Commands), row.SoloTestEnabled, row.MiniAppBaseUrl, row.HelpMessage, row.WelcomeMessage, row.UpdatedAt,
        row.MaintenanceMessageFa, row.HelpMessageFa, row.WelcomeMessageFa, row.ReminderMessage, row.ReminderMessageFa,
        ParseSet(row.DisabledGamesJson));

    /// <summary>Reads a JSON string list; an empty or damaged value counts as the fallback (none, or the default commands), so one bad
    /// column can never take the bot, the app and the admin console down with it.</summary>
    private static HashSet<string> ParseSet(string? json, IEnumerable<string>? fallback = null)
    {
        if (string.IsNullOrWhiteSpace(json)) return [.. fallback ?? []];
        try { return JsonSerializer.Deserialize<HashSet<string>>(json) ?? [.. fallback ?? []]; }
        catch (JsonException) { return [.. fallback ?? []]; }
    }
}
