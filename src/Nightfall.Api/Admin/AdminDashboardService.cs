using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Nightfall.Api.Lounge;
using Nightfall.Domain;
using Nightfall.Infrastructure.Agora;
using Nightfall.Infrastructure.History;
using Nightfall.Infrastructure.Hub;
using Nightfall.Infrastructure.Sessions;
using StackExchange.Redis;

namespace Nightfall.Api.Admin;

/// <summary>Read models behind the admin console pages (overview, games, players, chats, puzzles,
/// health and events). Text that people read is left to the console so it can show English or
/// Persian; this returns data and stable keys.</summary>
public sealed class AdminDashboardService
{
    private readonly NightfallDbContext _db;
    private readonly IChatGameIndex _chatGames;
    private readonly IGameSessionStore _sessions;
    private readonly IServiceProvider _services;
    private readonly ReminderStatus _reminders;
    private readonly IOptions<AgoraOptions> _agora;
    private readonly TimeProvider _clock;

    public AdminDashboardService(NightfallDbContext db, IChatGameIndex chatGames, IGameSessionStore sessions, IServiceProvider services,
        ReminderStatus reminders, IOptions<AgoraOptions> agora, TimeProvider clock)
    {
        _db = db;
        _chatGames = chatGames;
        _sessions = sessions;
        _services = services;
        _reminders = reminders;
        _agora = agora;
        _clock = clock;
    }

    private DateTimeOffset Now => _clock.GetUtcNow();
    private int Today => Progression.PuzzleDay(Now);
    private static int DayOf(DateTime utc) => Progression.PuzzleDay(new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)));

    // ------------------------------------------------------------------ live games

    /// <summary>Live games: the ones in chats seen in the last two days (each chat has at most one),
    /// plus tables opened in the app, which belong to no chat.</summary>
    public async Task<List<AdminLiveGameDto>> GetLiveGamesAsync()
    {
        var since = Now.UtcDateTime.AddDays(-2);
        var chats = await _db.ChatProfiles.AsNoTracking().Where(c => c.LastSeenAt >= since).Select(c => new { c.TelegramChatId, c.Title }).ToListAsync();
        var live = new List<AdminLiveGameDto>();
        foreach (var chat in chats)
        {
            if (await _chatGames.GetActiveGameAsync(chat.TelegramChatId) is not { } gameId) continue;
            if (await _sessions.GetAsync(gameId) is not { } game || game.CurrentPhase == GamePhase.Ended) continue;
            live.Add(ToLive(game, chat.Title));
        }
        var appTables = await _db.MafiaTables.AsNoTracking().Where(t => t.TelegramChatId == 0 && t.CreatedAt >= since)
            .Select(t => new { t.GameId, t.Name }).ToListAsync();
        foreach (var table in appTables)
        {
            if (await _sessions.GetAsync(table.GameId) is not { } game || game.CurrentPhase == GamePhase.Ended) continue;
            live.Add(ToLive(game, table.Name));
        }
        return live.OrderBy(g => g.StartedAt).ToList();
    }

    private static AdminLiveGameDto ToLive(GameState game, string? title)
    {
        var snapshot = game.ToSnapshot();
        string? speaker = snapshot.Discussion is { } d ? game.GetPlayer(d.ActivePlayerId)?.TelegramUsername : null;
        return new AdminLiveGameDto(
            game.GameId, game.TelegramChatId ?? 0, title, game.CurrentPhase.ToString(), game.NightNumber,
            game.Players.Count(p => p.IsAlive), game.Players.Count, game.Config.MaxPlayers, game.CreatedAt,
            game.SubmittedRequiredNightActionCount, game.RequiredNightActionCount,
            snapshot.PendingVotes.Count, game.Players.Count(p => p.IsAlive), speaker,
            game.Players.Select(p => new AdminPlayerInGameDto(p.TelegramUsername, p.Role?.ToString(), p.IsAlive,
                p.EliminatedBy?.ToString(), p.EliminatedRound, null, null)).ToList());
    }

    public async Task<AdminPageDto<AdminPastGameDto>> GetPastGamesAsync(int page, int size, string? search)
    {
        var titles = await ChatTitlesAsync();
        var query = _db.Games.AsNoTracking().Include(g => g.Players).OrderByDescending(g => g.EndedAt).AsQueryable();
        var all = await query.ToListAsync();
        var filtered = all.Where(g => Matches(search, g.Id.ToString(), titles.GetValueOrDefault(g.TelegramChatId), g.Players.Select(p => p.TelegramUsername))).ToList();
        var items = filtered.Skip((page - 1) * size).Take(size).Select(g => new AdminPastGameDto(
            g.Id, g.TelegramChatId, titles.GetValueOrDefault(g.TelegramChatId), g.Status, g.Result.ToString(), g.CreatedAt, g.EndedAt, g.CancellationReason,
            g.Players.Select(p => p.EliminatedRound ?? 0).DefaultIfEmpty(0).Max(),
            g.Players.Select(p => new AdminPlayerInGameDto(p.TelegramUsername, p.Role?.ToString(), p.SurvivedToEnd,
                p.EliminatedBy?.ToString(), p.EliminatedRound, p.RatingDelta, p.Won)).ToList())).ToList();
        return new AdminPageDto<AdminPastGameDto>(items, filtered.Count, page, size);
    }

    private static bool Matches(string? search, string id, string? title, IEnumerable<string> names)
    {
        if (string.IsNullOrWhiteSpace(search)) return true;
        string s = search.Trim();
        return id.Contains(s, StringComparison.OrdinalIgnoreCase)
            || (title?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false)
            || names.Any(n => n.Contains(s, StringComparison.OrdinalIgnoreCase));
    }

    private async Task<Dictionary<long, string?>> ChatTitlesAsync() =>
        await _db.ChatProfiles.AsNoTracking().ToDictionaryAsync(c => c.TelegramChatId, c => c.Title);

    // ------------------------------------------------------------------ overview

    public async Task<AdminOverviewDto> GetOverviewAsync(int rangeDays)
    {
        int today = Today;
        int range = rangeDays is 7 or 30 ? rangeDays : 1;
        int chartDays = range == 1 ? 14 : range;
        int from = today - Math.Max(chartDays, range * 2) + 1;
        var fromDate = Progression.DateOfDay(from).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddDays(-1);

        var puzzleRows = await _db.PuzzleResults.AsNoTracking().Where(r => r.Day >= from).Select(r => new { r.TelegramUserId, r.Day, r.Game, r.Mode, r.Solved }).ToListAsync();
        var mafiaRows = (await _db.GamePlayers.AsNoTracking().Where(p => p.TelegramUserId != null && p.GameRecord.EndedAt >= fromDate)
            .Select(p => new { p.TelegramUserId, p.GameRecord.EndedAt }).ToListAsync())
            .Select(p => new { UserId = p.TelegramUserId!.Value, Day = DayOf(p.EndedAt) }).Where(p => p.Day >= from).ToList();
        var coupleRows = await _db.CoupleAnswers.AsNoTracking().Where(a => a.Day >= from).Select(a => new { a.TelegramUserId, a.Day, a.CoupleId }).ToListAsync();

        HashSet<long> ActiveBetween(int first, int last) =>
            puzzleRows.Where(r => r.Day >= first && r.Day <= last).Select(r => r.TelegramUserId)
                .Concat(mafiaRows.Where(r => r.Day >= first && r.Day <= last).Select(r => r.UserId))
                .Concat(coupleRows.Where(r => r.Day >= first && r.Day <= last).Select(r => r.TelegramUserId))
                .ToHashSet();

        var activity = Enumerable.Range(today - chartDays + 1, chartDays).Select(d => new AdminActivityDayDto(
            Progression.DateOfDay(d),
            mafiaRows.Where(r => r.Day == d).Select(r => r.UserId).Distinct().Count(),
            puzzleRows.Where(r => r.Day == d).Select(r => r.TelegramUserId).Distinct().Count())).ToList();

        var dailySolves = puzzleRows.Where(r => r.Day > today - range && r.Solved && IsDaily(r.Mode)).ToList();
        var live = await GetLiveGamesAsync();
        var now = Now.UtcDateTime;

        return new AdminOverviewDto(
            range,
            live.Count,
            live.Count(g => g.Phase is nameof(GamePhase.Night) or nameof(GamePhase.NightZero)),
            ActiveBetween(today - range + 1, today).Count,
            ActiveBetween(today - 2 * range + 1, today - range).Count,
            dailySolves.Count,
            dailySolves.GroupBy(r => r.Game).OrderByDescending(g => g.Count()).Select(g => g.Key).FirstOrDefault(),
            await _db.Couples.CountAsync(c => c.PartnerId != null),
            coupleRows.Where(r => r.Day == today).GroupBy(r => r.CoupleId).Count(g => g.Count() == 2),
            activity,
            await GetHealthAsync(),
            live.Take(4).ToList(),
            (await GetEventsAsync(null, null, 5)).Items);
    }

    private static bool IsDaily(string mode) => mode == "daily" || mode.StartsWith("daily-", StringComparison.Ordinal);

    // ------------------------------------------------------------------ players and chats

    public async Task<AdminPageDto<AdminPlayerRowDto>> GetPlayersAsync(int page, int size, string? search)
    {
        var stats = await _db.PlayerStats.AsNoTracking().ToListAsync();
        var seen = await _db.UserProfiles.AsNoTracking().ToDictionaryAsync(u => u.TelegramUserId, u => u.LastSeenAt);
        int today = Today;
        var rows = stats
            .Where(s => Matches(search, s.TelegramUserId.ToString(), null, new[] { s.Username }))
            .Select(s =>
            {
                var (division, tier) = Progression.Division(s.Rating);
                var last = seen.TryGetValue(s.TelegramUserId, out var l) && l > s.UpdatedAt ? l : s.UpdatedAt;
                return new AdminPlayerRowDto(s.TelegramUserId, s.Username, Progression.Level(s.Xp).Level, s.Rating, division, tier,
                    Progression.CurrentStreak(s.PuzzleStreak, s.LastPuzzleDay, s.StreakFreezes, today), s.Language, last);
            })
            .OrderByDescending(r => r.LastSeen)
            .ToList();
        return new AdminPageDto<AdminPlayerRowDto>(rows.Skip((page - 1) * size).Take(size).ToList(), rows.Count, page, size);
    }

    public async Task<AdminPlayerDetailDto?> GetPlayerAsync(long userId)
    {
        var s = await _db.PlayerStats.AsNoTracking().FirstOrDefaultAsync(x => x.TelegramUserId == userId);
        if (s is null) return null;
        var profile = await _db.UserProfiles.AsNoTracking().FirstOrDefaultAsync(u => u.TelegramUserId == userId);
        var games = await _db.GamePlayers.AsNoTracking().Where(p => p.TelegramUserId == userId && p.GameRecord.Status == "Completed")
            .Select(p => new { p.Role, p.Won, p.RatingDelta, p.GameRecord.EndedAt, p.GameRecordId }).ToListAsync();
        var rows = await _db.GamePlayers.AsNoTracking().Where(p => p.TelegramUserId == userId && p.Won != null && p.GameRecord.Status == "Completed").ToListAsync();
        var puzzles = await _db.PuzzleResults.AsNoTracking().Where(r => r.TelegramUserId == userId)
            .OrderByDescending(r => r.CreatedAt).Select(r => new { r.Game, r.Mode, r.PuzzleNumber, r.Solved, r.TimeMs, r.Score, r.Moves, r.CreatedAt }).ToListAsync();

        var recent = games.Select(g => new AdminActivityItemDto("mafia", g.EndedAt, null, null, g.Won, g.Role?.ToString(), g.RatingDelta, null, null))
            .Concat(puzzles.Take(10).Select(p => new AdminActivityItemDto("puzzle", p.CreatedAt, p.Game, p.PuzzleNumber, p.Solved, null, null, p.TimeMs, p.Score)))
            .OrderByDescending(a => a.At).Take(6).ToList();

        var couple = await _db.Couples.AsNoTracking().FirstOrDefaultAsync(c => c.PartnerId != null && (c.InviterId == userId || c.PartnerId == userId));
        AdminCoupleStatusDto coupleStatus;
        if (couple is not null)
        {
            long partnerId = couple.InviterId == userId ? couple.PartnerId!.Value : couple.InviterId;
            string partner = await _db.PlayerStats.Where(x => x.TelegramUserId == partnerId).Select(x => x.Username).FirstOrDefaultAsync() ?? "?";
            coupleStatus = new AdminCoupleStatusDto("active", partner, couple.AcceptedAt);
        }
        else
        {
            var now = Now.UtcDateTime;
            bool pending = await _db.Couples.AnyAsync(c => c.PartnerId == null && c.InviterId == userId && c.InviteExpiresAt > now);
            coupleStatus = new AdminCoupleStatusDto(pending ? "pending" : "none", null, null);
        }

        var (division, tier) = Progression.Division(s.Rating);
        int wins = games.Count(g => g.Won == true);
        return new AdminPlayerDetailDto(
            s.TelegramUserId, s.Username, profile?.FirstSeenAt ?? s.CreatedAt, Progression.Level(s.Xp).Level, s.Xp, s.Rating, division, tier,
            games.Count, games.Count == 0 ? 0 : (int)Math.Round(100.0 * wins / games.Count),
            puzzles.Count(p => p.Solved),
            Progression.CurrentStreak(s.PuzzleStreak, s.LastPuzzleDay, s.StreakFreezes, Today), s.BestPuzzleStreak, s.StreakFreezes,
            s.Language, recent, coupleStatus,
            MafiaStats.ByRole(rows), MafiaStats.Skills(rows));
    }

    public async Task<AdminPageDto<AdminChatRowDto>> GetChatsAsync(int page, int size, string? search)
    {
        var chats = await _db.ChatProfiles.AsNoTracking().ToListAsync();
        var members = await _db.ChatMembers.AsNoTracking().GroupBy(m => m.TelegramChatId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count);
        var games = await _db.Games.AsNoTracking().Where(g => g.Status == "Completed").GroupBy(g => g.TelegramChatId)
            .Select(g => new { g.Key, Count = g.Count(), Last = g.Max(x => x.EndedAt) }).ToDictionaryAsync(x => x.Key, x => new { x.Count, x.Last });
        var filtered = chats.Where(c => Matches(search, c.TelegramChatId.ToString(), c.Title, Array.Empty<string>()))
            .OrderByDescending(c => c.LastSeenAt).ToList();
        var rows = new List<AdminChatRowDto>();
        foreach (var c in filtered.Skip((page - 1) * size).Take(size))
        {
            string? phase = null;
            if (await _chatGames.GetActiveGameAsync(c.TelegramChatId) is { } id && await _sessions.GetAsync(id) is { } game && game.CurrentPhase != GamePhase.Ended)
                phase = game.CurrentPhase.ToString();
            var g = games.GetValueOrDefault(c.TelegramChatId);
            rows.Add(new AdminChatRowDto(c.TelegramChatId, c.Title, members.GetValueOrDefault(c.TelegramChatId), g?.Count ?? 0, phase, g?.Last));
        }
        return new AdminPageDto<AdminChatRowDto>(rows, filtered.Count, page, size);
    }

    // ------------------------------------------------------------------ puzzles, leagues and couples

    public async Task<AdminPuzzlesDto> GetPuzzlesAsync()
    {
        int today = Today;
        var rows = await _db.PuzzleResults.AsNoTracking().Where(r => r.Day == today).ToListAsync();
        var dailies = new List<AdminDailyDto>();
        foreach (var game in new[] { "zip", "queens", "sudoku", "word", "ladder", "mines", "stack", "blocks", "snake" })
        {
            if (Progression.DailyNumber(game, today) is not { } number) continue;
            foreach (var mode in game == "word" ? new[] { "daily", "daily-fa" } : new[] { "daily" })
            {
                // A daily counts once per player: their first attempt of the day.
                var firsts = rows.Where(r => r.Game == game && r.Mode == mode).GroupBy(r => r.TelegramUserId).Select(g => g.OrderBy(r => r.CreatedAt).First()).ToList();
                var solved = firsts.Where(r => r.Solved).ToList();
                dailies.Add(new AdminDailyDto(game, mode, number, firsts.Count, solved.Count,
                    Median(solved.Select(r => r.TimeMs)), Median(solved.Select(r => r.Moves)), Median(firsts.Select(r => r.Score))));
            }
        }

        int season = Progression.Season(today);
        int seasonStart = Progression.SeasonStartDay(season);
        var rated = await _db.GamePlayers.AsNoTracking().Where(p => p.TelegramUserId != null && p.RatingDelta != null).Select(p => p.TelegramUserId!.Value).Distinct().ToListAsync();
        var ratings = await _db.PlayerStats.AsNoTracking().Where(s => rated.Contains(s.TelegramUserId)).Select(s => s.Rating).ToListAsync();
        var divisions = new[] { "Bronze", "Silver", "Gold", "Platinum", "Diamond" }
            .Select(name => new AdminDivisionDto(name, ratings.Count(r => Progression.Division(r).Division == name))).ToList();

        int weekStart = Progression.WeekStartDay(today);
        var weekly = await _db.PuzzleResults.AsNoTracking().Where(r => r.Day >= weekStart).GroupBy(r => r.TelegramUserId)
            .Select(g => new { UserId = g.Key, Points = g.Sum(r => r.Points) }).OrderByDescending(x => x.Points).Take(5).ToListAsync();
        var names = await _db.PlayerStats.AsNoTracking().Where(s => weekly.Select(w => w.UserId).Contains(s.TelegramUserId)).ToDictionaryAsync(s => s.TelegramUserId, s => s.Username);
        var leaders = weekly.Select((w, i) => new AdminLeaderDto(i + 1, names.GetValueOrDefault(w.UserId, "?"), w.Points)).ToList();

        var now = Now.UtcDateTime;
        var couples = await _db.Couples.AsNoTracking().Where(c => c.PartnerId != null).ToListAsync();
        var starts = couples.ToDictionary(c => c.Id, c => c.StartDay ?? today);
        var answers = await _db.CoupleAnswers.AsNoTracking().Where(a => a.Day > today - 30).ToListAsync();
        int both = answers.Where(a => a.Day == today).GroupBy(a => a.CoupleId).Count(g => g.Count() == 2);
        var asked = new Dictionary<(int Set, int Question), (int Asked, int Skipped)>();
        foreach (var a in answers)
        {
            if (!starts.TryGetValue(a.CoupleId, out int start)) continue;
            int set = CoupleRules.SetForDay(CoupleRules.DayNumber(start, a.Day));
            var parsed = CoupleRules.Parse(a.Answers);
            for (int q = 0; q < CoupleRules.QuestionsPerDay; q++)
            {
                var key = (set, q);
                var (n, s) = asked.GetValueOrDefault(key);
                asked[key] = (n + 1, s + (parsed[q] < 0 ? 1 : 0));
            }
        }
        var skipped = asked.Where(kv => kv.Value.Skipped > 0)
            .Select(kv => new AdminSkippedQuestionDto(kv.Key.Set, kv.Key.Question, (int)Math.Round(100.0 * kv.Value.Skipped / kv.Value.Asked)))
            .OrderByDescending(x => x.Rate).Take(3).ToList();
        int totalQuestions = couples.Sum(c => c.TotalQuestions);

        return new AdminPuzzlesDto(
            Progression.DateOfDay(today), dailies,
            new AdminSeasonDto(season, today - seasonStart + 1, Progression.SeasonLengthDays, Progression.DateOfDay(seasonStart + Progression.SeasonLengthDays - 1)),
            divisions, leaders,
            new AdminCoupleStatsDto(couples.Count, both, totalQuestions == 0 ? 0 : (int)Math.Round(100.0 * couples.Sum(c => c.TotalMatches) / totalQuestions),
                await _db.Couples.CountAsync(c => c.PartnerId == null && c.InviteExpiresAt > now), skipped));
    }

    private static int? Median(IEnumerable<int?> values)
    {
        var sorted = values.Where(v => v.HasValue).Select(v => v!.Value).OrderBy(v => v).ToList();
        return sorted.Count == 0 ? null : sorted[sorted.Count / 2];
    }

    // ------------------------------------------------------------------ health and events

    public async Task<List<AdminServiceDto>> GetHealthAsync()
    {
        var list = new List<AdminServiceDto> { new("api", "healthy", null, null, null, null, null) };

        var sw = Stopwatch.StartNew();
        bool db;
        try { db = await _db.Database.CanConnectAsync(); } catch { db = false; }
        list.Add(new("database", db ? "healthy" : "down", db ? (int)sw.ElapsedMilliseconds : null, null, null, null, null));

        int? redisMs = null;
        string? heartbeat = null;
        try
        {
            var redis = _services.GetService<IConnectionMultiplexer>();
            if (redis is { IsConnected: true })
            {
                var rdb = redis.GetDatabase();
                redisMs = (int)(await rdb.PingAsync()).TotalMilliseconds;
                heartbeat = await rdb.StringGetAsync("nightfall:bot-heartbeat");
            }
        }
        catch (RedisException) { redisMs = null; }
        list.Add(new("redis", redisMs is null ? "down" : redisMs > 50 ? "degraded" : "healthy", redisMs, null, null, null, null));

        int? beatAgo = DateTime.TryParse(heartbeat, null, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var beat)
            ? (int)(Now.UtcDateTime - beat).TotalSeconds : null;
        list.Add(new("bot", beatAgo is null ? "down" : beatAgo > 120 ? "degraded" : "healthy", null, beatAgo, null, null, null));

        bool voice = !string.IsNullOrWhiteSpace(_agora.Value.AppId) && !string.IsNullOrWhiteSpace(_agora.Value.AppCertificate);
        list.Add(new("voice", voice ? "healthy" : "down", null, null, null, null, null));

        var r = _reminders;
        bool ranRecently = r.LastRunAt is { } last && Now - last < TimeSpan.FromMinutes(5);
        bool today = r.Day == Today;
        list.Add(new("reminders", !ranRecently ? "degraded" : today && r.FailedToday > 0 ? "degraded" : "healthy", null,
            r.LastRunAt is { } at ? (int)(Now - at).TotalSeconds : null, today ? r.SentToday : 0, today ? r.FailedToday : 0, r.LastRunAt));
        return list;
    }

    /// <summary>level: warning, audit or info (null = all). Paged by id: pass the last id you have as before.</summary>
    public async Task<AdminEventsDto> GetEventsAsync(string? level, long? before, int size)
    {
        var q = _db.OperationalEvents.AsNoTracking().AsQueryable();
        q = level switch
        {
            "audit" => q.Where(e => e.IsAdminAudit),
            "warning" => q.Where(e => !e.IsAdminAudit && (e.Severity == "Warning" || e.Severity == "Error" || e.Severity == "Critical")),
            "info" => q.Where(e => !e.IsAdminAudit && e.Severity != "Warning" && e.Severity != "Error" && e.Severity != "Critical"),
            _ => q,
        };
        int total = await q.CountAsync();
        if (before is { } b) q = q.Where(e => e.Id < b);
        var rows = await q.OrderByDescending(e => e.Id).Take(size).ToListAsync();
        var items = rows.Select(e => new AdminEventDto(e.Id, e.CreatedAt,
            e.IsAdminAudit ? "audit" : e.Severity is "Warning" or "Error" or "Critical" ? "warning" : "info",
            e.Category, e.Message, e.TargetType, e.TargetId, ActorOf(e.MetadataJson), ReasonOf(e.MetadataJson))).ToList();
        return new AdminEventsDto(items, total);
    }

    private static string? ActorOf(string? json) => Field(json, "actor");
    private static string? ReasonOf(string? json) => Field(json, "reason");

    private static string? Field(string? json, string name)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
        }
        catch (JsonException) { return null; }
    }
}

public sealed record AdminPageDto<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
public sealed record AdminPlayerInGameDto(string Name, string? Role, bool Alive, string? EliminatedBy, int? EliminatedRound, int? RatingDelta, bool? Won);
public sealed record AdminLiveGameDto(
    Guid Id, long ChatId, string? ChatTitle, string Phase, int Round, int Alive, int Seated, int MaxPlayers, DateTimeOffset StartedAt,
    int NightActionsDone, int NightActionsRequired, int VotesCast, int Voters, string? Speaker, IReadOnlyList<AdminPlayerInGameDto> Players);
public sealed record AdminPastGameDto(
    Guid Id, long ChatId, string? ChatTitle, string Status, string Result, DateTime StartedAt, DateTime EndedAt, string? CancellationReason,
    int Rounds, IReadOnlyList<AdminPlayerInGameDto> Players);
public sealed record AdminActivityDayDto(DateOnly Date, int Mafia, int Puzzles);
public sealed record AdminServiceDto(string Key, string Status, int? LatencyMs, int? SecondsAgo, int? Sent, int? Failed, DateTimeOffset? LastRunAt);
public sealed record AdminEventDto(long Id, DateTime At, string Level, string Category, string Message, string? TargetType, string? TargetId, string? Actor, string? Reason);
public sealed record AdminEventsDto(IReadOnlyList<AdminEventDto> Items, int Total);
public sealed record AdminOverviewDto(
    int RangeDays, int LiveGames, int NightGames, int ActivePlayers, int ActivePlayersBefore, int DailySolves, string? TopDailyGame,
    int ActiveCouples, int CouplesBothToday, IReadOnlyList<AdminActivityDayDto> Activity, IReadOnlyList<AdminServiceDto> Services,
    IReadOnlyList<AdminLiveGameDto> Live, IReadOnlyList<AdminEventDto> Events);
public sealed record AdminPlayerRowDto(long Id, string Name, int Level, int Rating, string Division, int Tier, int Streak, string Language, DateTime LastSeen);
public sealed record AdminActivityItemDto(string Kind, DateTime At, string? Game, int? Number, bool? Won, string? Role, int? RatingDelta, int? TimeMs, int? Score);
public sealed record AdminCoupleStatusDto(string Status, string? PartnerName, DateTime? Since);
public sealed record AdminPlayerDetailDto(
    long Id, string Name, DateTime Joined, int Level, int Xp, int Rating, string Division, int Tier, int MafiaGames, int MafiaWinRate,
    int PuzzlesSolved, int Streak, int BestStreak, int Freezes, string Language, IReadOnlyList<AdminActivityItemDto> Recent, AdminCoupleStatusDto Couple,
    IReadOnlyList<RoleStats>? MafiaByRole = null, MafiaSkillStats? MafiaSkills = null);
public sealed record AdminChatRowDto(long Id, string? Title, int Members, int Games, string? LivePhase, DateTime? LastGame);
public sealed record AdminDailyDto(string Game, string Mode, int Number, int Players, int Solved, int? MedianTimeMs, int? MedianMoves, int? MedianScore);
public sealed record AdminSeasonDto(int Number, int Day, int Length, DateOnly EndsOn);
public sealed record AdminDivisionDto(string Name, int Count);
public sealed record AdminLeaderDto(int Rank, string Name, int Points);
public sealed record AdminSkippedQuestionDto(int SetId, int Question, int Rate);
public sealed record AdminCoupleStatsDto(int Active, int BothToday, int AverageMatch, int InvitesWaiting, IReadOnlyList<AdminSkippedQuestionDto> Skipped);
public sealed record AdminPuzzlesDto(DateOnly Date, IReadOnlyList<AdminDailyDto> Dailies, AdminSeasonDto Season, IReadOnlyList<AdminDivisionDto> Divisions,
    IReadOnlyList<AdminLeaderDto> Leaders, AdminCoupleStatsDto Couples);
