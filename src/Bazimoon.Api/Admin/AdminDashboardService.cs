using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Bazimoon.Api.Lounge;
using Bazimoon.Domain;
using Bazimoon.Infrastructure.Activity;
using Bazimoon.Infrastructure.Agora;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Hub;
using Bazimoon.Infrastructure.Sessions;
using StackExchange.Redis;

namespace Bazimoon.Api.Admin;

/// <summary>Read models behind the admin console pages (overview, games, players, puzzles,
/// health and events). Text that people read is left to the console so it can show English or
/// Persian; this returns data and stable keys.</summary>
public sealed class AdminDashboardService
{
    private readonly BazimoonDbContext _db;
    private readonly IGameSessionStore _sessions;
    private readonly IServiceProvider _services;
    private readonly ReminderStatus _reminders;
    private readonly IOptions<AgoraOptions> _agora;
    private readonly TimeProvider _clock;

    public AdminDashboardService(BazimoonDbContext db, IGameSessionStore sessions, IServiceProvider services,
        ReminderStatus reminders, IOptions<AgoraOptions> agora, TimeProvider clock)
    {
        _db = db;
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

    /// <summary>Live games: the tables opened in the last two days that are still playing.</summary>
    public async Task<List<AdminLiveGameDto>> GetLiveGamesAsync()
    {
        var since = Now.UtcDateTime.AddDays(-2);
        var live = new List<AdminLiveGameDto>();
        var appTables = await _db.MafiaTables.AsNoTracking().Where(t => t.CreatedAt >= since)
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
        string? speaker = snapshot.Discussion is { } d ? game.GetPlayer(d.ActivePlayerId)?.DisplayName : null;
        return new AdminLiveGameDto(
            game.GameId, title, game.CurrentPhase.ToString(), game.NightNumber,
            game.Players.Count(p => p.IsAlive), game.Players.Count, game.Config.MaxPlayers, game.CreatedAt,
            game.SubmittedRequiredNightActionCount, game.RequiredNightActionCount,
            snapshot.PendingVotes.Count, game.Players.Count(p => p.IsAlive), speaker,
            game.Players.Select(p => new AdminPlayerInGameDto(p.DisplayName, p.Role?.ToString(), p.IsAlive,
                p.EliminatedBy?.ToString(), p.EliminatedRound, null, null)).ToList());
    }

    public async Task<AdminPageDto<AdminPastGameDto>> GetPastGamesAsync(int page, int size, string? search)
    {
        var titles = await TableNamesAsync();
        var query = _db.Games.AsNoTracking().Include(g => g.Players).OrderByDescending(g => g.EndedAt).AsQueryable();
        var all = await query.ToListAsync();
        var filtered = all.Where(g => Matches(search, g.Id.ToString(), titles.GetValueOrDefault(g.Id), g.Players.Select(p => p.DisplayName))).ToList();
        var items = filtered.Skip((page - 1) * size).Take(size).Select(g => new AdminPastGameDto(
            g.Id, titles.GetValueOrDefault(g.Id), g.Status, g.Result.ToString(), g.CreatedAt, g.EndedAt, g.CancellationReason,
            g.Players.Select(p => p.EliminatedRound ?? 0).DefaultIfEmpty(0).Max(),
            g.Players.Select(p => new AdminPlayerInGameDto(p.DisplayName, p.Role?.ToString(), p.SurvivedToEnd,
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

    private async Task<Dictionary<Guid, string?>> TableNamesAsync() =>
        await _db.MafiaTables.AsNoTracking().ToDictionaryAsync(t => t.GameId, t => t.Name);

    // ------------------------------------------------------------------ overview

    public async Task<AdminOverviewDto> GetOverviewAsync(int rangeDays)
    {
        int today = Today;
        int range = rangeDays is 7 or 30 ? rangeDays : 1;
        int chartDays = range == 1 ? 14 : range;
        int from = today - Math.Max(chartDays, range * 2) + 1;
        var fromDate = Progression.DateOfDay(from).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddDays(-1);

        var puzzleRows = await _db.PuzzleResults.AsNoTracking().Where(r => r.Day >= from).Select(r => new { r.UserId, r.Day, r.Game, r.Mode, r.Solved }).ToListAsync();
        var mafiaRows = (await _db.GamePlayers.AsNoTracking().Where(p => p.UserId != null && p.GameRecord.EndedAt >= fromDate)
            .Select(p => new { p.UserId, p.GameRecord.EndedAt }).ToListAsync())
            .Select(p => new { UserId = p.UserId!.Value, Day = DayOf(p.EndedAt) }).Where(p => p.Day >= from).ToList();
        var coupleRows = await _db.CoupleAnswers.AsNoTracking().Where(a => a.Day >= from).Select(a => new { a.UserId, a.Day, a.CoupleId }).ToListAsync();
        var bots = await BotIdsAsync();
        puzzleRows.RemoveAll(r => bots.Contains(r.UserId));
        mafiaRows.RemoveAll(r => bots.Contains(r.UserId));
        coupleRows.RemoveAll(r => bots.Contains(r.UserId));

        HashSet<Guid> ActiveBetween(int first, int last) =>
            puzzleRows.Where(r => r.Day >= first && r.Day <= last).Select(r => r.UserId)
                .Concat(mafiaRows.Where(r => r.Day >= first && r.Day <= last).Select(r => r.UserId))
                .Concat(coupleRows.Where(r => r.Day >= first && r.Day <= last).Select(r => r.UserId))
                .ToHashSet();

        var activity = Enumerable.Range(today - chartDays + 1, chartDays).Select(d => new AdminActivityDayDto(
            Progression.DateOfDay(d),
            mafiaRows.Where(r => r.Day == d).Select(r => r.UserId).Distinct().Count(),
            puzzleRows.Where(r => r.Day == d).Select(r => r.UserId).Distinct().Count())).ToList();

        var dailySolves = puzzleRows.Where(r => r.Day > today - range && r.Solved && (IsDaily(r.Mode) || Progression.IsLevel(r.Mode))).ToList();
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

    private async Task<HashSet<Guid>> BotIdsAsync() =>
        (await _db.Users.AsNoTracking().Where(u => u.IsBot).Select(u => u.Id).ToListAsync()).ToHashSet();

    private static bool IsDaily(string mode) => Progression.IsDaily(mode);

    // ------------------------------------------------------------------ players

    public async Task<AdminPageDto<AdminPlayerRowDto>> GetPlayersAsync(int page, int size, string? search, bool bots = false,
        string? source = null, string? campaign = null)
    {
        var stats = await _db.PlayerStats.AsNoTracking().ToListAsync();
        var seen = await _db.Users.AsNoTracking().ToDictionaryAsync(u => u.Id, u => u.LastSeenAt);
        var acquisitions = await _db.UserAcquisitions.AsNoTracking().ToDictionaryAsync(a => a.UserId);
        var botIds = await BotIdsAsync();
        source = string.IsNullOrWhiteSpace(source) ? null : source.Trim();
        campaign = string.IsNullOrWhiteSpace(campaign) ? null : campaign.Trim();
        int today = Today;
        var rows = stats
            .Where(s => botIds.Contains(s.UserId) == bots && Matches(search, s.UserId.ToString(), null, new[] { s.Username }))
            .Where(s => source is null || string.Equals(acquisitions.GetValueOrDefault(s.UserId)?.Source ?? "unknown", source, StringComparison.OrdinalIgnoreCase))
            .Where(s => campaign is null || string.Equals(acquisitions.GetValueOrDefault(s.UserId)?.Campaign, campaign, StringComparison.OrdinalIgnoreCase))
            .Select(s =>
            {
                var (division, tier) = Progression.Division(s.Rating);
                var last = seen.TryGetValue(s.UserId, out var l) && l > s.UpdatedAt ? l : s.UpdatedAt;
                var acquisition = acquisitions.GetValueOrDefault(s.UserId);
                return new AdminPlayerRowDto(s.UserId, s.Username, Progression.Level(s.Xp).Level, s.Rating, division, tier,
                    Progression.CurrentStreak(s.PuzzleStreak, s.LastPuzzleDay, s.StreakFreezes, today), s.Language, last, bots,
                    acquisition?.Source ?? "unknown", acquisition?.Medium ?? "none", acquisition?.Campaign);
            })
            .OrderByDescending(r => r.LastSeen)
            .ToList();
        int botCount = stats.Count(s => botIds.Contains(s.UserId));
        int realCount = stats.Count - botCount;
        return new AdminPageDto<AdminPlayerRowDto>(rows.Skip((page - 1) * size).Take(size).ToList(), rows.Count, page, size,
            bots ? realCount : botCount);
    }

    public async Task<AdminAcquisitionSummaryDto> GetAcquisitionSummaryAsync(bool bots = false)
    {
        var playerIds = await _db.PlayerStats.AsNoTracking().Select(s => s.UserId).ToListAsync();
        var botIds = await BotIdsAsync();
        var included = playerIds.Where(id => botIds.Contains(id) == bots).ToHashSet();
        var acquisitions = await _db.UserAcquisitions.AsNoTracking().Where(a => included.Contains(a.UserId)).ToListAsync();
        int missing = included.Count - acquisitions.Count;

        var sources = acquisitions.GroupBy(a => a.Source)
            .Select(g => new AdminAcquisitionBucketDto(g.Key, g.Count()))
            .Append(new AdminAcquisitionBucketDto("unknown", missing))
            .Where(x => x.Players > 0)
            .GroupBy(x => x.Value, StringComparer.OrdinalIgnoreCase)
            .Select(g => new AdminAcquisitionBucketDto(g.Key, g.Sum(x => x.Players)))
            .OrderByDescending(x => x.Players).ThenBy(x => x.Value).ToList();
        var campaigns = acquisitions.Where(a => a.Campaign != null).GroupBy(a => a.Campaign!, StringComparer.OrdinalIgnoreCase)
            .Select(g => new AdminAcquisitionBucketDto(g.First().Campaign!, g.Count()))
            .OrderByDescending(x => x.Players).ThenBy(x => x.Value).ToList();

        return new AdminAcquisitionSummaryDto(included.Count, sources, campaigns);
    }

    public async Task<AdminPlayerDetailDto?> GetPlayerAsync(Guid userId)
    {
        var s = await _db.PlayerStats.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId);
        if (s is null) return null;
        var profile = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        var acquisition = await _db.UserAcquisitions.AsNoTracking().FirstOrDefaultAsync(a => a.UserId == userId);
        var games = await _db.GamePlayers.AsNoTracking().Where(p => p.UserId == userId && p.GameRecord.Status == "Completed")
            .Select(p => new { p.Role, p.Won, p.RatingDelta, p.GameRecord.EndedAt, p.GameRecordId }).ToListAsync();
        var rows = await _db.GamePlayers.AsNoTracking().Where(p => p.UserId == userId && p.Won != null && p.GameRecord.Status == "Completed").ToListAsync();
        var puzzles = await _db.PuzzleResults.AsNoTracking().Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CreatedAt).Select(r => new { r.Game, r.Mode, r.PuzzleNumber, r.Solved, r.TimeMs, r.Score, r.Moves, r.CreatedAt }).ToListAsync();

        var couple = await _db.Couples.AsNoTracking().FirstOrDefaultAsync(c => c.PartnerId != null && (c.InviterId == userId || c.PartnerId == userId));
        AdminCoupleStatusDto coupleStatus;
        if (couple is not null)
        {
            Guid partnerId = couple.InviterId == userId ? couple.PartnerId!.Value : couple.InviterId;
            string partner = await _db.PlayerStats.Where(x => x.UserId == partnerId).Select(x => x.Username).FirstOrDefaultAsync() ?? "?";
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
            s.UserId, s.Username, profile?.CreatedAt ?? s.CreatedAt, Progression.Level(s.Xp).Level, s.Xp, s.Rating, division, tier,
            games.Count, games.Count == 0 ? 0 : (int)Math.Round(100.0 * wins / games.Count),
            puzzles.Count(p => p.Solved),
            Progression.CurrentStreak(s.PuzzleStreak, s.LastPuzzleDay, s.StreakFreezes, Today), s.BestPuzzleStreak, s.StreakFreezes,
            s.Language, coupleStatus,
            MafiaStats.ByRole(rows), MafiaStats.Skills(rows), profile?.IsBot ?? false, profile?.BotReason, profile?.BotMarkedAt, profile?.BotMarkedBy,
            acquisition is null ? null : new AdminPlayerAcquisitionDto(acquisition.Source, acquisition.Medium, acquisition.Campaign,
                acquisition.Term, acquisition.Content, acquisition.Referrer, acquisition.LandingPath, acquisition.Gclid, acquisition.FirstSeenAt));
    }

    /// <summary>A player's activity log: completed Mafia games, puzzle results and admin audit entries made against
    /// their account, newest first. kind: mafia, puzzle or admin (null = all).</summary>
    public async Task<AdminPageDto<AdminActivityItemDto>> GetPlayerActivityAsync(Guid userId, string? kind, int page, int size)
    {
        var items = new List<AdminActivityItemDto>();
        if (kind is null or "mafia")
        {
            var games = await _db.GamePlayers.AsNoTracking().Where(p => p.UserId == userId && p.GameRecord.Status == "Completed")
                .Select(p => new { p.Role, p.Won, p.RatingDelta, p.GameRecord.EndedAt }).ToListAsync();
            items.AddRange(games.Select(g => new AdminActivityItemDto("mafia", g.EndedAt, null, null, g.Won, g.Role?.ToString(), g.RatingDelta, null, null)));
        }
        if (kind is null or "puzzle")
        {
            var puzzles = await _db.PuzzleResults.AsNoTracking().Where(r => r.UserId == userId)
                .Select(r => new { r.Game, r.PuzzleNumber, r.Solved, r.TimeMs, r.Score, r.CreatedAt }).ToListAsync();
            items.AddRange(puzzles.Select(p => new AdminActivityItemDto("puzzle", p.CreatedAt, p.Game, p.PuzzleNumber, p.Solved, null, null, p.TimeMs, p.Score)));
        }
        if (kind is null or "admin")
        {
            string id = userId.ToString();
            var events = await _db.OperationalEvents.AsNoTracking().Where(e => e.IsAdminAudit && e.TargetType == "Player" && e.TargetId == id)
                .Select(e => new { e.CreatedAt, e.Message, e.MetadataJson }).ToListAsync();
            items.AddRange(events.Select(e => new AdminActivityItemDto("admin", e.CreatedAt, null, null, null, null, null, null, null, e.Message, ActorOf(e.MetadataJson))));
        }
        var sorted = items.OrderByDescending(a => a.At).ToList();
        return new AdminPageDto<AdminActivityItemDto>(sorted.Skip((page - 1) * size).Take(size).ToList(), sorted.Count, page, size);
    }

    /// <summary>Marks a player as a bot or a real player. False when there is no such player.</summary>
    public async Task<bool> SetBotAsync(Guid userId, bool isBot, string actor)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return false;
        if (user.IsBot == isBot) return true;
        user.IsBot = isBot;
        user.BotReason = isBot ? "admin" : null;
        user.BotMarkedAt = isBot ? Now.UtcDateTime : null;
        user.BotMarkedBy = isBot ? actor : null;
        _db.OperationalEvents.Add(new() { Category = "AdminAudit", Message = isBot ? "Player marked as a bot" : "Player marked as not a bot", IsAdminAudit = true,
            TargetType = "Player", TargetId = userId.ToString(), MetadataJson = JsonSerializer.Serialize(new { actor }) });
        await _db.SaveChangesAsync();
        return true;
    }

    // ------------------------------------------------------------------ user activity and funnels

    /// <summary>Flow -> the ordered steps that make up its funnel. "signup" is special-cased in
    /// <see cref="GetFunnelAsync"/> since a player can sign up two different ways.</summary>
    private static readonly Dictionary<string, string[]> FunnelSteps = new()
    {
        [ActivityEvents.Mafia] = [ActivityEvents.MafiaLobbyJoined, ActivityEvents.MafiaGameStarted, ActivityEvents.MafiaGameEnded],
        [ActivityEvents.Puzzle] = [ActivityEvents.PuzzleIntroViewed, ActivityEvents.PuzzleStarted, ActivityEvents.PuzzleCompleted],
        [ActivityEvents.Couple] = [ActivityEvents.CoupleInviteSent, ActivityEvents.CoupleInviteAccepted, ActivityEvents.CoupleQuestionAnswered],
    };

    /// <summary>Distinct players reaching each step of a flow's funnel in the last <paramref name="days"/>
    /// days, and what share of step one and of the step before it that is. Not a strict per-user cohort
    /// (a player counts at a step if they ever reached it in the window, not only if they also reached
    /// the step before it in order) — simple, but enough to see where a flow is losing people.</summary>
    public async Task<AdminFunnelDto> GetFunnelAsync(string flow, int days)
    {
        var since = Now.UtcDateTime.AddDays(-Math.Clamp(days, 1, 180));
        var rows = await _db.UserActivityEvents.AsNoTracking().Where(e => e.CreatedAt >= since && e.UserId != null)
            .Select(e => new { e.UserId, e.Name }).ToListAsync();
        var bots = await BotIdsAsync();
        var byUser = rows.Where(r => !bots.Contains(r.UserId!.Value)).ToList();

        var steps = new List<(string Name, HashSet<Guid> Users)>();
        if (flow == ActivityEvents.SignUp)
        {
            steps.Add((ActivityEvents.SignUp, byUser.Where(r => r.Name is ActivityEvents.SignupGuest or ActivityEvents.SignupGoogle).Select(r => r.UserId!.Value).ToHashSet()));
            var activated = byUser.Where(r => r.Name is ActivityEvents.MafiaLobbyJoined or ActivityEvents.PuzzleIntroViewed or ActivityEvents.CoupleInviteSent)
                .Select(r => r.UserId!.Value).ToHashSet();
            steps.Add(("activated", activated));
        }
        else if (FunnelSteps.TryGetValue(flow, out var names))
        {
            foreach (var name in names) steps.Add((name, byUser.Where(r => r.Name == name).Select(r => r.UserId!.Value).ToHashSet()));
        }

        int? first = null, previous = null;
        var result = new List<AdminFunnelStepDto>();
        foreach (var (name, users) in steps)
        {
            int count = users.Count;
            first ??= count;
            result.Add(new AdminFunnelStepDto(name, count,
                first is 0 or null ? 0 : (int)Math.Round(100.0 * count / first.Value),
                previous is 0 or null ? 100 : (int)Math.Round(100.0 * count / previous.Value)));
            previous = count;
        }
        return new AdminFunnelDto(flow, days, result);
    }

    /// <summary>Every tracked step any player took, newest first — sign-ups, Mafia games, puzzles and
    /// Couple Quiz together. Paged by id: pass the last id you have as <paramref name="before"/>.</summary>
    public async Task<AdminPageDto<AdminActivityFeedItemDto>> GetActivityFeedAsync(string? flow, long? before, int size)
    {
        var q = _db.UserActivityEvents.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(flow)) q = q.Where(e => e.Flow == flow);
        int total = await q.CountAsync();
        if (before is { } b) q = q.Where(e => e.Id < b);
        var rows = await q.OrderByDescending(e => e.Id).Take(size).ToListAsync();
        var userIds = rows.Where(r => r.UserId != null).Select(r => r.UserId!.Value).Distinct().ToList();
        var names = await _db.PlayerStats.AsNoTracking().Where(s => userIds.Contains(s.UserId)).ToDictionaryAsync(s => s.UserId, s => s.Username);
        var items = rows.Select(e => new AdminActivityFeedItemDto(e.Id, e.CreatedAt, e.Flow, e.Name, e.UserId,
            e.UserId is { } id ? names.GetValueOrDefault(id) : null, e.PropertiesJson)).ToList();
        return new AdminPageDto<AdminActivityFeedItemDto>(items, total, 1, size);
    }

    // ------------------------------------------------------------------ puzzles, leagues and couples

    public async Task<AdminPuzzlesDto> GetPuzzlesAsync()
    {
        int today = Today;
        var bots = await BotIdsAsync();
        var rows = (await _db.PuzzleResults.AsNoTracking().Where(r => r.Day == today).ToListAsync()).Where(r => !bots.Contains(r.UserId)).ToList();
        var dailies = new List<AdminDailyDto>();
        foreach (var game in new[] { "mines", "stack", "blocks", "snake" })
        {
            if (Progression.DailyNumber(game, today) is not { } number) continue;
            foreach (var mode in new[] { "daily" })
            {
                // A daily counts once per player: their first attempt of the day.
                var firsts = rows.Where(r => r.Game == game && r.Mode == mode).GroupBy(r => r.UserId).Select(g => g.OrderBy(r => r.CreatedAt).First()).ToList();
                var solved = firsts.Where(r => r.Solved).ToList();
                dailies.Add(new AdminDailyDto(game, mode, number, firsts.Count, solved.Count,
                    Median(solved.Select(r => r.TimeMs)), Median(solved.Select(r => r.Moves)), Median(firsts.Select(r => r.Score))));
            }
        }

        // Level games: how far players have got and how many levels were finished today.
        var progress = (await _db.PuzzleProgress.AsNoTracking().ToListAsync()).Where(p => !bots.Contains(p.UserId)).ToList();
        var levels = new List<AdminLevelDto>();
        foreach (var game in new[] { "zip", "queens", "sudoku", "word", "ladder" })
        {
            foreach (var track in game is "word" or "ladder" ? new[] { "level", "level-fa" } : new[] { "level" })
            {
                // Level is the next one to play, so a player who has finished nothing is on 1.
                var started = progress.Where(p => p.Game == game && p.Track == track && p.Level > 1).Select(p => p.Level - 1).ToList();
                var todays = rows.Where(r => r.Game == game && r.Mode == track).ToList();
                levels.Add(new AdminLevelDto(game, track, started.Count, Median(started.Select(l => (int?)l)), started.Count == 0 ? 0 : started.Max(),
                    todays.Count(r => r.Solved), todays.Select(r => r.UserId).Distinct().Count()));
            }
        }

        int season = Progression.Season(today);
        int seasonStart = Progression.SeasonStartDay(season);
        var rated = await _db.GamePlayers.AsNoTracking().Where(p => p.UserId != null && p.RatingDelta != null).Select(p => p.UserId!.Value).Distinct().ToListAsync();
        rated.RemoveAll(bots.Contains);
        var ratings = await _db.PlayerStats.AsNoTracking().Where(s => rated.Contains(s.UserId)).Select(s => s.Rating).ToListAsync();
        var divisions = new[] { "Bronze", "Silver", "Gold", "Platinum", "Diamond" }
            .Select(name => new AdminDivisionDto(name, ratings.Count(r => Progression.Division(r).Division == name))).ToList();

        int weekStart = Progression.WeekStartDay(today);
        var weekly = await _db.PuzzleResults.AsNoTracking().Where(r => r.Day >= weekStart && !bots.Contains(r.UserId)).GroupBy(r => r.UserId)
            .Select(g => new { UserId = g.Key, Points = g.Sum(r => r.Points) }).OrderByDescending(x => x.Points).Take(5).ToListAsync();
        var names = await _db.PlayerStats.AsNoTracking().Where(s => weekly.Select(w => w.UserId).Contains(s.UserId)).ToDictionaryAsync(s => s.UserId, s => s.Username);
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
            Progression.DateOfDay(today), dailies, levels,
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
        try
        {
            var redis = _services.GetService<IConnectionMultiplexer>();
            if (redis is { IsConnected: true })
            {
                var rdb = redis.GetDatabase();
                redisMs = (int)(await rdb.PingAsync()).TotalMilliseconds;
            }
        }
        catch (RedisException) { redisMs = null; }
        list.Add(new("redis", redisMs is null ? "down" : redisMs > 50 ? "degraded" : "healthy", redisMs, null, null, null, null));


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

/// <summary>OtherTotal: on the players list, how many are in the other tab (bots, or real players).</summary>
public sealed record AdminPageDto<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize, int? OtherTotal = null);
public sealed record AdminPlayerInGameDto(string Name, string? Role, bool Alive, string? EliminatedBy, int? EliminatedRound, int? RatingDelta, bool? Won);
public sealed record AdminLiveGameDto(
    Guid Id, string? Title, string Phase, int Round, int Alive, int Seated, int MaxPlayers, DateTimeOffset StartedAt,
    int NightActionsDone, int NightActionsRequired, int VotesCast, int Voters, string? Speaker, IReadOnlyList<AdminPlayerInGameDto> Players);
public sealed record AdminPastGameDto(
    Guid Id, string? Title, string Status, string Result, DateTime StartedAt, DateTime EndedAt, string? CancellationReason,
    int Rounds, IReadOnlyList<AdminPlayerInGameDto> Players);
public sealed record AdminActivityDayDto(DateOnly Date, int Mafia, int Puzzles);
public sealed record AdminServiceDto(string Key, string Status, int? LatencyMs, int? SecondsAgo, int? Sent, int? Failed, DateTimeOffset? LastRunAt);
public sealed record AdminEventDto(long Id, DateTime At, string Level, string Category, string Message, string? TargetType, string? TargetId, string? Actor, string? Reason);
public sealed record AdminEventsDto(IReadOnlyList<AdminEventDto> Items, int Total);
public sealed record AdminOverviewDto(
    int RangeDays, int LiveGames, int NightGames, int ActivePlayers, int ActivePlayersBefore, int DailySolves, string? TopDailyGame,
    int ActiveCouples, int CouplesBothToday, IReadOnlyList<AdminActivityDayDto> Activity, IReadOnlyList<AdminServiceDto> Services,
    IReadOnlyList<AdminLiveGameDto> Live, IReadOnlyList<AdminEventDto> Events);
public sealed record AdminPlayerRowDto(Guid Id, string Name, int Level, int Rating, string Division, int Tier, int Streak, string Language,
    DateTime LastSeen, bool IsBot = false, string Source = "unknown", string Medium = "none", string? Campaign = null);
public sealed record AdminAcquisitionBucketDto(string Value, int Players);
public sealed record AdminAcquisitionSummaryDto(int Total, IReadOnlyList<AdminAcquisitionBucketDto> Sources, IReadOnlyList<AdminAcquisitionBucketDto> Campaigns);
public sealed record AdminPlayerAcquisitionDto(string Source, string Medium, string? Campaign, string? Term, string? Content,
    string? Referrer, string? LandingPath, string? Gclid, DateTime FirstSeenAt);
public sealed record AdminActivityItemDto(string Kind, DateTime At, string? Game, int? Number, bool? Won, string? Role, int? RatingDelta, int? TimeMs, int? Score, string? Message = null, string? Actor = null);
public sealed record AdminCoupleStatusDto(string Status, string? PartnerName, DateTime? Since);
public sealed record AdminPlayerDetailDto(
    Guid Id, string Name, DateTime Joined, int Level, int Xp, int Rating, string Division, int Tier, int MafiaGames, int MafiaWinRate,
    int PuzzlesSolved, int Streak, int BestStreak, int Freezes, string Language, AdminCoupleStatusDto Couple,
    IReadOnlyList<RoleStats>? MafiaByRole = null, MafiaSkillStats? MafiaSkills = null, bool IsBot = false,
    string? BotReason = null, DateTime? BotMarkedAt = null, string? BotMarkedBy = null, AdminPlayerAcquisitionDto? Acquisition = null);
public sealed record AdminDailyDto(string Game, string Mode, int Number, int Players, int Solved, int? MedianTimeMs, int? MedianMoves, int? MedianScore);
public sealed record AdminSeasonDto(int Number, int Day, int Length, DateOnly EndsOn);
public sealed record AdminDivisionDto(string Name, int Count);
public sealed record AdminLeaderDto(int Rank, string Name, int Points);
public sealed record AdminSkippedQuestionDto(int SetId, int Question, int Rate);
public sealed record AdminCoupleStatsDto(int Active, int BothToday, int AverageMatch, int InvitesWaiting, IReadOnlyList<AdminSkippedQuestionDto> Skipped);
public sealed record AdminFunnelStepDto(string Name, int Users, int PctOfFirst, int PctOfPrevious);
public sealed record AdminFunnelDto(string Flow, int Days, IReadOnlyList<AdminFunnelStepDto> Steps);
public sealed record AdminActivityFeedItemDto(long Id, DateTime At, string Flow, string Name, Guid? UserId, string? UserName, string? PropertiesJson = null);
/// <summary>A level game's spread: players past level 1, their median and top finished level, and today's solves.</summary>
public sealed record AdminLevelDto(string Game, string Track, int Players, int? MedianLevel, int TopLevel, int SolvedToday, int PlayersToday);
public sealed record AdminPuzzlesDto(DateOnly Date, IReadOnlyList<AdminDailyDto> Dailies, IReadOnlyList<AdminLevelDto> Levels, AdminSeasonDto Season, IReadOnlyList<AdminDivisionDto> Divisions,
    IReadOnlyList<AdminLeaderDto> Leaders, AdminCoupleStatsDto Couples);
