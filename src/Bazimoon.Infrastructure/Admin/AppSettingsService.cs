using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Bazimoon.Infrastructure.History;

namespace Bazimoon.Infrastructure.Admin;

public sealed record AppSettingsSnapshot(int Version, int MinPlayers, int MaxPlayers, bool MaintenanceMode, string MaintenanceMessage,
    string MaintenanceMessageFa = "",
    string ReminderMessage = AppSettingsDefaults.ReminderMessage, string ReminderMessageFa = AppSettingsDefaults.ReminderMessageFa,
    IReadOnlySet<string>? DisabledGames = null,
    string TableStartMessage = AppSettingsDefaults.TableStartMessage, string TableStartMessageFa = AppSettingsDefaults.TableStartMessageFa,
    string CoupleTurnMessage = AppSettingsDefaults.CoupleTurnMessage, string CoupleTurnMessageFa = AppSettingsDefaults.CoupleTurnMessageFa)
{
    public bool IsGameOn(string game) => DisabledGames is null || !DisabledGames.Contains(game);
}

public interface IAppSettingsService { Task<AppSettingsSnapshot> GetAsync(CancellationToken ct = default); }

public sealed class AppSettingsService : IAppSettingsService
{
    private readonly IServiceScopeFactory _scopes;
    private AppSettingsSnapshot? _cached;
    private DateTime _expires;
    private readonly SemaphoreSlim _gate = new(1, 1);
    public AppSettingsService(IServiceScopeFactory scopes) => _scopes = scopes;

    /// <summary>Drops the cached copy so a save in this process takes effect at once.</summary>
    public void Invalidate() => _expires = DateTime.MinValue;

    public async Task<AppSettingsSnapshot> GetAsync(CancellationToken ct = default)
    {
        if (_cached is not null && _expires > DateTime.UtcNow) return _cached;
        await _gate.WaitAsync(ct);
        try
        {
            if (_cached is not null && _expires > DateTime.UtcNow) return _cached;
            await using var scope = _scopes.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<BazimoonDbContext>();
            var row = await db.AppSettings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == 1, ct);
            if (row is null) { row = new(); db.AppSettings.Add(row); await db.SaveChangesAsync(ct); }
            _cached = ToSnapshot(row); _expires = DateTime.UtcNow.AddSeconds(3); return _cached;
        }
        finally { _gate.Release(); }
    }

    public static AppSettingsSnapshot ToSnapshot(AppSettingsRecord row) => new(row.Version, row.MinPlayers, row.MaxPlayers, row.MaintenanceMode, row.MaintenanceMessage,
        row.MaintenanceMessageFa, row.ReminderMessage, row.ReminderMessageFa, ParseSet(row.DisabledGamesJson),
        row.TableStartMessage, row.TableStartMessageFa, row.CoupleTurnMessage, row.CoupleTurnMessageFa);

    /// <summary>Reads a JSON string list; an empty or damaged value counts as none, so one bad
    /// column can never take the app and the admin console down with it.</summary>
    private static HashSet<string> ParseSet(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try { return JsonSerializer.Deserialize<HashSet<string>>(json) ?? []; }
        catch (JsonException) { return []; }
    }
}
