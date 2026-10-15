using Microsoft.EntityFrameworkCore;
using Nightfall.Api.Games;
using Nightfall.Domain;
using Nightfall.Infrastructure;
using Nightfall.Infrastructure.History;
using Nightfall.Infrastructure.Hub;
using Nightfall.Infrastructure.Sessions;

namespace Nightfall.Api.Lounge;

/// <summary>Mafia tables in the app: the open list everyone sees, the tables in your own groups,
/// creating a table for a group, invite codes and the host's open/group-only switch.</summary>
public sealed class TableService
{
    /// <summary>Open tables older than this are no longer listed even if their game never ended.</summary>
    private static readonly TimeSpan OpenListWindow = TimeSpan.FromDays(1);

    private readonly NightfallDbContext _db;
    private readonly IChatGameIndex _chatGameIndex;
    private readonly IGameSessionStore _sessions;
    private readonly GameService _games;
    private readonly ITelegramNotifier _notifier;
    private readonly TimeProvider _clock;

    public TableService(NightfallDbContext db, IChatGameIndex chatGameIndex, IGameSessionStore sessions, GameService games, ITelegramNotifier notifier, TimeProvider clock)
    {
        _db = db;
        _chatGameIndex = chatGameIndex;
        _sessions = sessions;
        _games = games;
        _notifier = notifier;
        _clock = clock;
    }

    // ------------------------------------------------------------------ lists

    /// <summary>Tables in the groups you have played in, group-only ones included.</summary>
    public async Task<IReadOnlyList<TableDto>> GetGroupTablesAsync(long userId)
    {
        var chats = await _db.ChatMembers.Where(m => m.TelegramUserId == userId)
            .OrderByDescending(m => m.LastSeenAt).Select(m => m.TelegramChatId).Take(20).ToListAsync();
        var games = new List<GameState>();
        foreach (var chat in chats)
        {
            var gameId = await _chatGameIndex.GetActiveGameAsync(chat);
            if (gameId is null) continue;
            var game = await _sessions.GetAsync(gameId.Value);
            if (game is not null && game.CurrentPhase != GamePhase.Ended) games.Add(game);
        }
        return Sort(await BuildAsync(games, userId));
    }

    /// <summary>Open tables from every group, for anyone in the app.</summary>
    public async Task<IReadOnlyList<TableDto>> GetOpenTablesAsync(long userId)
    {
        var since = _clock.GetUtcNow().UtcDateTime - OpenListWindow;
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

    /// <summary>Picks the fullest open lobby in any of your groups that still has a seat.</summary>
    public async Task<Guid?> FindQuickMatchAsync(long userId)
    {
        var tables = await GetGroupTablesAsync(userId);
        return tables.FirstOrDefault(t => t.Phase == GamePhase.Lobby && t.Seated < t.MaxPlayers)?.GameId;
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
                game.Players.Select(p => p.TelegramUsername).Take(6).ToList(), game.GetPlayer(you) is not null);
        }).ToList();
    }

    // ------------------------------------------------------------------ create

    /// <summary>Groups you can start a table in: ones where you have played with the bot.</summary>
    public async Task<IReadOnlyList<TableGroupDto>> GetGroupsAsync(long userId)
    {
        var chats = await _db.ChatMembers.Where(m => m.TelegramUserId == userId)
            .OrderByDescending(m => m.LastSeenAt).Select(m => m.TelegramChatId).Take(20).ToListAsync();
        var profiles = await _db.ChatProfiles.AsNoTracking().Where(c => chats.Contains(c.TelegramChatId)).ToDictionaryAsync(c => c.TelegramChatId);
        var counts = await _db.ChatMembers.Where(m => chats.Contains(m.TelegramChatId))
            .GroupBy(m => m.TelegramChatId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count);

        var groups = new List<TableGroupDto>();
        foreach (var chat in chats)
        {
            var active = await _chatGameIndex.GetActiveGameAsync(chat);
            var game = active is null ? null : await _sessions.GetAsync(active.Value);
            profiles.TryGetValue(chat, out var profile);
            groups.Add(new TableGroupDto(chat, profile?.Title, counts.GetValueOrDefault(chat), profile?.FirstSeenAt,
                game is not null && game.CurrentPhase != GamePhase.Ended ? game.GameId : null));
        }
        return groups;
    }

    public async Task<IResult> CreateAsync(long userId, string username, CreateTableRequest request)
    {
        bool member = await _db.ChatMembers.AnyAsync(m => m.TelegramChatId == request.TelegramChatId && m.TelegramUserId == userId);
        if (!member)
            return Results.Problem(statusCode: 403, title: "Forbidden", detail: "You can only start a table in a group where you have played with the bot.");

        if (await _chatGameIndex.GetActiveGameAsync(request.TelegramChatId) is { } existing
            && await _sessions.GetAsync(existing) is { CurrentPhase: not GamePhase.Ended })
            return Results.Problem(statusCode: 409, title: "Conflict", detail: "That group already has a table.", extensions: new Dictionary<string, object?> { ["gameId"] = existing });

        var gameId = await _games.CreateGameAsync(request.TelegramChatId, userId, username, null,
            new TableOptions(request.Name, request.IsOpen, request.Seats));

        // The bot posts the table in the group with a button that opens it.
        var record = await _db.MafiaTables.AsNoTracking().FirstAsync(t => t.GameId == gameId);
        var game = await _games.LoadOrThrowAsync(gameId);
        string name = record.Name ?? "Mafia";
        string text =
            $"{username} opened a Mafia table: {name} · {game.Config.MaxPlayers} seats. Tap below to join.\n" +
            $"{username} یک میز مافیا باز کرد: {name} · {game.Config.MaxPlayers} صندلی. برای پیوستن دکمه زیر را بزنید.";
        await _notifier.NotifyAsync(request.TelegramChatId, text, gameId.ToString());
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
    IReadOnlyList<string> Players, bool YouAreSeated);

public sealed record TableGroupDto(long TelegramChatId, string? Title, int Players, DateTime? Since, Guid? ActiveGameId);
public sealed record CreateTableRequest(long TelegramChatId, string? Name, bool IsOpen, int? Seats);
public sealed record TableInfoDto(Guid GameId, string? Name, string? ChatTitle, bool IsOpen, bool IsHost, string? InviteCode);
public sealed record SetTableOpenRequest(bool IsOpen);
