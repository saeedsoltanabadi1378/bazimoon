using Microsoft.EntityFrameworkCore;
using Nightfall.Api.Games;
using Nightfall.Domain;
using Nightfall.Infrastructure;
using Nightfall.Infrastructure.History;
using Nightfall.Infrastructure.Hub;
using Nightfall.Infrastructure.Sessions;

namespace Nightfall.Api.Lounge;

/// <summary>Mafia tables in the app: the public list everyone sees, the tables you host or sit at,
/// creating a table, invite codes and the host's public/private switch. A table needs no Telegram
/// group: the host shares its invite link. Tables a bot <c>/newgame</c> started in a group work the same way.</summary>
public sealed class TableService
{
    /// <summary>Tables older than this are no longer listed even if their game never ended.</summary>
    private static readonly TimeSpan ListWindow = TimeSpan.FromDays(1);

    private readonly NightfallDbContext _db;
    private readonly IGameSessionStore _sessions;
    private readonly GameService _games;
    private readonly TimeProvider _clock;

    public TableService(NightfallDbContext db, IGameSessionStore sessions, GameService games, TimeProvider clock)
    {
        _db = db;
        _sessions = sessions;
        _games = games;
        _clock = clock;
    }

    // ------------------------------------------------------------------ lists

    /// <summary>Tables you host or have a seat at, private ones included.</summary>
    public async Task<IReadOnlyList<TableDto>> GetYourTablesAsync(long userId)
    {
        var since = _clock.GetUtcNow().UtcDateTime - ListWindow;
        var hosted = await _db.MafiaTables.Where(t => t.CreatorTelegramUserId == userId && t.CreatedAt >= since)
            .Select(t => t.GameId).ToListAsync();
        var recent = await _db.MafiaTables.Where(t => t.CreatedAt >= since)
            .OrderByDescending(t => t.CreatedAt).Select(t => t.GameId).Take(100).ToListAsync();
        var games = new List<GameState>();
        foreach (var id in hosted.Concat(recent).Distinct())
        {
            var game = await _sessions.GetAsync(id);
            if (game is null || game.CurrentPhase == GamePhase.Ended) continue;
            if (hosted.Contains(id) || game.GetPlayer(PlayerIdentity.DeriveId(id, userId)) is not null) games.Add(game);
        }
        return Sort(await BuildAsync(games, userId));
    }

    /// <summary>Public tables, for anyone in the app.</summary>
    public async Task<IReadOnlyList<TableDto>> GetOpenTablesAsync(long userId)
    {
        var since = _clock.GetUtcNow().UtcDateTime - ListWindow;
        var ids = await _db.MafiaTables.Where(t => t.IsOpen && t.CreatedAt >= since)
            .OrderByDescending(t => t.CreatedAt).Select(t => t.GameId).Take(40).ToListAsync();
        var games = new List<GameState>();
        foreach (var id in ids)
        {
            var game = await _sessions.GetAsync(id);
            if (game is not null && game.CurrentPhase != GamePhase.Ended) games.Add(game);
        }
        return Sort(await BuildAsync(games, userId));
    }

    /// <summary>Picks the fullest public lobby that still has a seat for you.</summary>
    public async Task<Guid?> FindQuickMatchAsync(long userId)
    {
        var tables = await GetOpenTablesAsync(userId);
        return tables.FirstOrDefault(t => t.Phase == GamePhase.Lobby && t.Seated < t.MaxPlayers && !t.YouAreSeated)?.GameId;
    }

    // Lobbies with a free seat first (fullest first), then full lobbies, then games under way.
    private static IReadOnlyList<TableDto> Sort(IEnumerable<TableDto> tables) => tables
        .OrderBy(t => t.Phase != GamePhase.Lobby ? 2 : t.Seated >= t.MaxPlayers ? 1 : 0)
        .ThenByDescending(t => t.Seated)
        .ToList();

    private async Task<List<TableDto>> BuildAsync(IReadOnlyList<GameState> games, long userId)
    {
        var ids = games.Select(g => g.GameId).ToList();
        var records = await _db.MafiaTables.AsNoTracking().Where(t => ids.Contains(t.GameId)).ToDictionaryAsync(t => t.GameId);
        var chatIds = games.Select(g => g.TelegramChatId ?? 0).Distinct().ToList();
        var titles = await _db.ChatProfiles.AsNoTracking().Where(c => chatIds.Contains(c.TelegramChatId)).ToDictionaryAsync(c => c.TelegramChatId, c => c.Title);
        var hostIds = records.Values.Select(r => r.CreatorTelegramUserId).Distinct().ToList();
        var hosts = await _db.UserProfiles.AsNoTracking().Where(u => hostIds.Contains(u.TelegramUserId)).ToDictionaryAsync(u => u.TelegramUserId, u => u.Username);

        return games.Select(game =>
        {
            records.TryGetValue(game.GameId, out var record);
            string? host = record is not null && hosts.TryGetValue(record.CreatorTelegramUserId, out var h) ? h : game.Players.FirstOrDefault()?.TelegramUsername;
            var you = PlayerIdentity.DeriveId(game.GameId, userId);
            return new TableDto(
                game.GameId, record?.Name, titles.GetValueOrDefault(game.TelegramChatId ?? 0), host, record?.IsOpen ?? false,
                game.CurrentPhase, game.NightNumber, game.Players.Count, game.Config.MaxPlayers, game.Config.MinPlayers, game.CreatedAt,
                game.Players.Select(p => p.TelegramUsername).Take(6).ToList(), game.GetPlayer(you) is not null,
                game.Config.AllowSpectators, game.Spectators.Count, game.GetSpectator(you) is not null);
        }).ToList();
    }

    // ------------------------------------------------------------------ create

    /// <summary>Opens a table in the app. The host lands in its lobby and shares the invite link from there.</summary>
    public async Task<IResult> CreateAsync(long userId, string username, CreateTableRequest request)
    {
        var gameId = await _games.CreateGameAsync(null, userId, username, null,
            new TableOptions(request.Name, request.IsOpen, request.Seats, request.Rules));
        return Results.Ok(new CreateGameResponse(gameId));
    }

    // ------------------------------------------------------------------ invites

    /// <summary>Finds the live table behind a code or an invite link (<c>…?startapp=t_CODE</c>).</summary>
    public async Task<Guid?> ResolveAsync(string input)
    {
        string code = NormalizeCode(input);
        if (code.Length == 0) return null;
        var record = await _db.MafiaTables.AsNoTracking().FirstOrDefaultAsync(t => t.InviteCode == code);
        if (record is null) return null;
        var game = await _sessions.GetAsync(record.GameId);
        return game is null || game.CurrentPhase == GamePhase.Ended ? null : game.GameId;
    }

    public static string NormalizeCode(string input)
    {
        string s = (input ?? string.Empty).Trim();
        int at = s.IndexOf("startapp=", StringComparison.OrdinalIgnoreCase);
        if (at >= 0) s = s[(at + "startapp=".Length)..].Split('&', '#')[0];
        if (s.StartsWith("t_", StringComparison.OrdinalIgnoreCase)) s = s[2..];
        s = s.ToUpperInvariant();
        return s.Length is >= 4 and <= 8 && s.All(char.IsLetterOrDigit) ? s : string.Empty;
    }

    /// <summary>Table details for a game screen. Only the host gets the invite code.</summary>
    public async Task<TableInfoDto?> GetInfoAsync(Guid gameId, long userId)
    {
        var record = await _db.MafiaTables.AsNoTracking().FirstOrDefaultAsync(t => t.GameId == gameId);
        if (record is null) return null;
        var title = await _db.ChatProfiles.AsNoTracking().Where(c => c.TelegramChatId == record.TelegramChatId).Select(c => c.Title).FirstOrDefaultAsync();
        bool isHost = record.CreatorTelegramUserId == userId;
        return new TableInfoDto(gameId, record.Name, title, record.IsOpen, isHost, isHost ? record.InviteCode : null);
    }

    public async Task<IResult> SetOpenAsync(Guid gameId, long userId, bool isOpen)
    {
        var record = await _db.MafiaTables.FirstOrDefaultAsync(t => t.GameId == gameId);
        if (record is null) return Results.Problem(statusCode: 404, title: "Game not found", detail: "That table no longer exists.");
        if (record.CreatorTelegramUserId != userId) return Results.Problem(statusCode: 403, title: "Forbidden", detail: "Only the host can change who can join.");
        record.IsOpen = isOpen;
        await _db.SaveChangesAsync();
        return Results.Ok(await GetInfoAsync(gameId, userId));
    }
}

public sealed record TableDto(
    Guid GameId, string? Name, string? ChatTitle, string? Host, bool IsOpen,
    GamePhase Phase, int Round, int Seated, int MaxPlayers, int MinPlayers, DateTimeOffset CreatedAt,
    IReadOnlyList<string> Players, bool YouAreSeated,
    bool AllowSpectators = false, int Spectators = 0, bool YouAreWatching = false);

/// <summary><paramref name="IsOpen"/>: public (listed in Open tables) or private (invite link or code only).
/// <paramref name="Rules"/>: timers and rule switches; missing ones keep the defaults.</summary>
public sealed record CreateTableRequest(string? Name, bool IsOpen, int? Seats, TableRules? Rules = null);
public sealed record TableInfoDto(Guid GameId, string? Name, string? ChatTitle, bool IsOpen, bool IsHost, string? InviteCode);
public sealed record SetTableOpenRequest(bool IsOpen);
