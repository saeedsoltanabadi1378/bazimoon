using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Bazimoon.Api.Games;
using Bazimoon.Infrastructure.Admin;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Sessions;
using StackExchange.Redis;

namespace Bazimoon.Api.Admin;

public static class AdminEndpoints
{
    private const string CsrfCookie = "bazimoon-admin-csrf";
    private static bool ValidCsrf(HttpContext c) => c.Request.Cookies.TryGetValue(CsrfCookie, out var cookie) && c.Request.Headers.TryGetValue("X-CSRF-Token", out var header) && CryptographicOperations.FixedTimeEquals(System.Text.Encoding.UTF8.GetBytes(cookie), System.Text.Encoding.UTF8.GetBytes(header.ToString()));

    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/api/admin/auth");
        auth.MapPost("/login", async (LoginRequest request, HttpContext http, IOptions<AdminOptions> options) =>
        {
            var configured = options.Value;
            if (string.IsNullOrWhiteSpace(configured.Username) || string.IsNullOrEmpty(configured.Password) || !string.Equals(request.Username, configured.Username, StringComparison.Ordinal) || !string.Equals(request.Password, configured.Password, StringComparison.Ordinal)) return Results.Unauthorized();
            var identity = new ClaimsIdentity([new Claim(ClaimTypes.Name, configured.Username), new Claim(ClaimTypes.Role, "Admin")], CookieAuthenticationDefaults.AuthenticationScheme);
            await http.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity), new AuthenticationProperties { IsPersistent = false, ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8) });
            return Results.Ok(new { username = configured.Username });
        }).RequireRateLimiting("admin-login").AllowAnonymous();
        auth.MapGet("/session", (HttpContext http) => Results.Ok(new { authenticated = http.User.Identity?.IsAuthenticated == true, username = http.User.Identity?.Name })).RequireAuthorization("AdminOnly");
        auth.MapGet("/csrf", (HttpContext http) => { var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)); http.Response.Cookies.Append(CsrfCookie, token, new CookieOptions { HttpOnly = false, Secure = !http.Request.Host.Host.StartsWith("localhost"), SameSite = SameSiteMode.Strict, MaxAge = TimeSpan.FromHours(8) }); return Results.Ok(new { token }); }).RequireAuthorization("AdminOnly");
        auth.MapPost("/logout", async (HttpContext http) => { if (!ValidCsrf(http)) return Results.BadRequest(new { detail = "Invalid CSRF token." }); await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme); http.Response.Cookies.Delete(CsrfCookie); return Results.Ok(); }).RequireAuthorization("AdminOnly");

        var group = app.MapGroup("/api/admin").RequireAuthorization("AdminOnly");
        group.MapGet("/overview", async (int? days, AdminDashboardService dash) => Results.Ok(await dash.GetOverviewAsync(days ?? 1)));
        group.MapGet("/games", async (string? status, int? page, int? pageSize, string? search, AdminDashboardService dash) =>
        {
            int p = Math.Max(1, page ?? 1), size = Math.Clamp(pageSize ?? 25, 1, 100);
            if (string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
            {
                var live = await dash.GetLiveGamesAsync();
                return Results.Ok(new AdminPageDto<AdminLiveGameDto>(live, live.Count, 1, live.Count));
            }
            return Results.Ok(await dash.GetPastGamesAsync(p, size, search));
        });
        group.MapGet("/games/{id:guid}", async (Guid id, IGameSessionStore sessions, BazimoonDbContext db) =>
        {
            var live = await sessions.GetAsync(id);
            if (live is not null) return Results.Ok(live.ToSnapshot());
            var past = await db.Games.AsNoTracking().Where(game => game.Id == id).Select(game => new AdminGameView(
                game.Id, game.CreatedAt, game.EndedAt, game.Result, game.Status,
                game.CancellationReason,
                game.Players.Select(player => new AdminGamePlayerView(
                    player.PlayerId, player.UserId, player.DisplayName, player.Role,
                    player.SurvivedToEnd, player.GodfatherRank)).ToList())).SingleOrDefaultAsync();
            return past is not null ? Results.Ok(past) : Results.NotFound();
        });
        group.MapPost("/games/{id:guid}/cancel", async (Guid id, CancelRequest request, HttpContext http, GameService games) => { if (!ValidCsrf(http)) return Results.BadRequest(new { detail = "Invalid CSRF token." }); if (string.IsNullOrWhiteSpace(request.Reason)) return Results.BadRequest(new { detail = "A cancellation reason is required." }); return await games.CancelByAdminAsync(id, request.Reason, http.User.Identity?.Name ?? "admin") ? Results.Ok() : Results.NotFound(); });
        group.MapGet("/players", async (int? page, int? pageSize, string? search, bool? bots, AdminDashboardService dash) =>
            Results.Ok(await dash.GetPlayersAsync(Math.Max(1, page ?? 1), Math.Clamp(pageSize ?? 25, 1, 100), search, bots ?? false)));
        group.MapPut("/players/{id:guid}/bot", async (Guid id, BotRequest request, HttpContext http, AdminDashboardService dash) =>
        {
            if (!ValidCsrf(http)) return Results.BadRequest(new { detail = "Invalid CSRF token." });
            return await dash.SetBotAsync(id, request.IsBot, http.User.Identity?.Name ?? "admin") ? Results.Ok() : Results.NotFound();
        });
        group.MapGet("/players/{id:guid}", async (Guid id, AdminDashboardService dash) =>
            await dash.GetPlayerAsync(id) is { } player ? Results.Ok(player) : Results.NotFound());
        group.MapGet("/players/{id:guid}/activity", async (Guid id, string? kind, int? page, int? pageSize, AdminDashboardService dash) =>
            Results.Ok(await dash.GetPlayerActivityAsync(id, kind, Math.Max(1, page ?? 1), Math.Clamp(pageSize ?? 10, 1, 50))));
        group.MapGet("/puzzles", async (AdminDashboardService dash) => Results.Ok(await dash.GetPuzzlesAsync()));
        group.MapGet("/events", async (string? level, long? before, int? pageSize, AdminDashboardService dash) =>
            Results.Ok(await dash.GetEventsAsync(level, before, Math.Clamp(pageSize ?? 25, 1, 100))));
        group.MapGet("/health", async (AdminDashboardService dash) => Results.Ok(await dash.GetHealthAsync()));
        group.MapGet("/settings", async (IAppSettingsService settings) => Results.Ok(await settings.GetAsync()));
        group.MapPut("/settings", UpdateSettingsAsync);
    }

    private static async Task<IResult> UpdateSettingsAsync(SettingsRequest request, HttpContext http, BazimoonDbContext db, IAppSettingsService settings)
    {
        if (!ValidCsrf(http)) return Results.BadRequest(new { detail = "Invalid CSRF token." });
        if (request.MinPlayers < 3 || request.MaxPlayers > 12 || request.MinPlayers > request.MaxPlayers) return Results.BadRequest(new { detail = "Player limits must be between 3 and 12 (the voice room limit) and minimum cannot exceed maximum." });
        if (new[] { request.MaintenanceMessage, request.MaintenanceMessageFa, request.ReminderMessage, request.ReminderMessageFa, request.TableStartMessage, request.TableStartMessageFa, request.CoupleTurnMessage, request.CoupleTurnMessageFa }.Any(m => m is { Length: > 4096 })) return Results.BadRequest(new { detail = "Messages cannot exceed 4096 characters." });
        if (request.DisabledGames is { } disabled && disabled.Except(AppSettingsDefaults.Games).Any()) return Results.BadRequest(new { detail = "Unknown game." });
        var row=await db.AppSettings.SingleOrDefaultAsync(x=>x.Id==1) ?? new AppSettingsRecord();
        if (row.Version != request.Version) return Results.Conflict(new { detail="Settings were changed by another session. Reload and try again." });
        var before=JsonSerializer.Serialize(AppSettingsService.ToSnapshot(row));
        row.MinPlayers=request.MinPlayers; row.MaxPlayers=request.MaxPlayers; row.MaintenanceMode=request.MaintenanceMode; row.MaintenanceMessage=request.MaintenanceMessage;
        if (request.MaintenanceMessageFa is not null) row.MaintenanceMessageFa=request.MaintenanceMessageFa;
        if (request.ReminderMessage is { Length: > 0 }) row.ReminderMessage=request.ReminderMessage;
        if (request.ReminderMessageFa is { Length: > 0 }) row.ReminderMessageFa=request.ReminderMessageFa;
        if (request.TableStartMessage is { Length: > 0 }) row.TableStartMessage=request.TableStartMessage;
        if (request.TableStartMessageFa is { Length: > 0 }) row.TableStartMessageFa=request.TableStartMessageFa;
        if (request.CoupleTurnMessage is { Length: > 0 }) row.CoupleTurnMessage=request.CoupleTurnMessage;
        if (request.CoupleTurnMessageFa is { Length: > 0 }) row.CoupleTurnMessageFa=request.CoupleTurnMessageFa;
        if (request.DisabledGames is not null) row.DisabledGamesJson=JsonSerializer.Serialize(request.DisabledGames.Distinct());
        row.Version++; row.UpdatedAt=DateTime.UtcNow;
        if (db.Entry(row).State == EntityState.Detached) db.AppSettings.Add(row);
        db.OperationalEvents.Add(new() { Category="AdminAudit", Message="App settings updated", IsAdminAudit=true, TargetType="Settings", TargetId="1", MetadataJson=JsonSerializer.Serialize(new { before, after=AppSettingsService.ToSnapshot(row), actor=http.User.Identity?.Name }) });
        await db.SaveChangesAsync();
        (settings as AppSettingsService)?.Invalidate();
        return Results.Ok(AppSettingsService.ToSnapshot(row));
    }

}

public sealed record LoginRequest(string Username, string Password);
public sealed record CancelRequest(string Reason);
public sealed record BotRequest(bool IsBot);
public sealed record SettingsRequest(int Version, int MinPlayers, int MaxPlayers, bool MaintenanceMode, string MaintenanceMessage,
    string? MaintenanceMessageFa = null, string? ReminderMessage = null, string? ReminderMessageFa = null, string[]? DisabledGames = null,
    string? TableStartMessage = null, string? TableStartMessageFa = null, string? CoupleTurnMessage = null, string? CoupleTurnMessageFa = null);
public sealed record AdminGameView(Guid Id, DateTime CreatedAt, DateTime EndedAt, Bazimoon.Domain.WinCondition Result, string Status, string? CancellationReason, IReadOnlyList<AdminGamePlayerView> Players);
public sealed record AdminGamePlayerView(Guid PlayerId, Guid? UserId, string DisplayName, Bazimoon.Domain.Role? Role, bool SurvivedToEnd, int? GodfatherRank);
