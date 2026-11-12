using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Bazimoon.Api.EsmFamil;
using Bazimoon.Api.Shelem;
using Bazimoon.Infrastructure.Activity;
using Bazimoon.Infrastructure.Admin;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Hub;

namespace Bazimoon.Api.Admin;

/// <summary>The deeper read models behind the admin console: one game's full picture, how players move
/// through the app (interactions), and the registered (signed-in) accounts. Bots are always left out.
/// Like <see cref="AdminDashboardService"/>, this returns data and stable keys; the console words them.</summary>
public sealed class AdminInsightsService
{
    private static readonly string[] LevelGames = ["zip", "queens", "sudoku", "word", "ladder"];
    private static readonly TimeSpan SessionGap = TimeSpan.FromMinutes(30);

    private readonly BazimoonDbContext _db;
    private readonly IAppSettingsService _settings;
    private readonly ShelemRoomService _shelem;
    private readonly EsmFamilRoomService _esmFamil;
    private readonly TimeProvider _clock;

    public AdminInsightsService(BazimoonDbContext db, IAppSettingsService settings, ShelemRoomService shelem, EsmFamilRoomService esmFamil, TimeProvider clock)
    {
        _db = db;
        _settings = settings;
        _shelem = shelem;
        _esmFamil = esmFamil;
        _clock = clock;
    }

    private DateTimeOffset Now => _clock.GetUtcNow();
    private int Today => Progression.PuzzleDay(Now);
    private static int DayOf(DateTime utc) => Progression.PuzzleDay(new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)));
    private static int ClampDays(int days) => Math.Clamp(days, 1, 90);

    private async Task<HashSet<Guid>> BotIdsAsync() =>
        (await _db.Users.AsNoTracking().Where(u => u.IsBot).Select(u => u.Id).ToListAsync()).ToHashSet();

    private async Task<Dictionary<Guid, string>> NamesAsync(IEnumerable<Guid> ids)
    {
        var list = ids.Distinct().ToList();
        if (list.Count == 0) return [];
        var names = await _db.PlayerStats.AsNoTracking().Where(s => list.Contains(s.UserId)).ToDictionaryAsync(s => s.UserId, s => s.Username);
        var missing = list.Where(id => !names.ContainsKey(id)).ToList();
        if (missing.Count > 0)
            foreach (var u in await _db.Users.AsNoTracking().Where(u => missing.Contains(u.Id)).Select(u => new { u.Id, u.DisplayName }).ToListAsync())
                names[u.Id] = u.DisplayName;
        return names;
    }

    // ------------------------------------------------------------------ one game

    /// <summary>Everything recorded about one game over the last <paramref name="days"/> days (and all-time totals).
    /// Null for an unknown game key.</summary>
    public async Task<AdminGameStatsDto?> GetGameStatsAsync(string game, int days)
    {
        if (!AppSettingsDefaults.Games.Contains(game)) return null;
        days = ClampDays(days);
        bool enabled = (await _settings.GetAsync()).IsGameOn(game);
        var bots = await BotIdsAsync();
        var events = await ActivityRowsAsync(days, bots);
        var screens = ScreenStats(events, screen => ScreenBelongsTo(screen, game));

        return game switch
        {
            "mafia" => await MafiaStatsAsync(enabled, days, bots, events, screens),
            "couple" => await CoupleStatsAsync(enabled, days, bots, events, screens),
            _ => await SoloStatsAsync(game, enabled, days, bots, events, screens),
        };
    }

    private static bool ScreenBelongsTo(string screen, string game) =>
        screen == game || screen.StartsWith($"game_{game}_", StringComparison.Ordinal) || screen.StartsWith($"{game}_", StringComparison.Ordinal);

    private async Task<AdminGameStatsDto> SoloStatsAsync(string game, bool enabled, int days, HashSet<Guid> bots, List<EventRow> events, List<AdminScreenStatDto> screens)
    {
        int today = Today, from = today - days + 1;
        var all = (await _db.PuzzleResults.AsNoTracking().Where(r => r.Game == game).ToListAsync()).Where(r => !bots.Contains(r.UserId)).ToList();
        var range = all.Where(r => r.Day >= from).ToList();
        var todays = all.Where(r => r.Day == today).ToList();

        var totals = new AdminGameTotalsDto(
            all.Count, all.Select(r => r.UserId).Distinct().Count(),
            range.Count, range.Select(r => r.UserId).Distinct().Count(),
            todays.Count, todays.Select(r => r.UserId).Distinct().Count(),
            range.Count == 0 ? null : Pct(range.Count(r => r.Solved), range.Count),
            Median(range.Where(r => r.Solved).Select(r => r.TimeMs)), Median(range.Select(r => r.Score)),
            all.Select(r => r.Score).Max(), all.Where(r => r.Solved).Select(r => r.TimeMs).Min(),
            range.Sum(r => r.XpGained), range.Sum(r => r.Points),
            range.Count == 0 ? null : Math.Round(range.Average(r => r.Hints), 1),
            all.Count == 0 ? null : all.Min(r => r.CreatedAt), all.Count == 0 ? null : all.Max(r => r.CreatedAt));

        var daily = Enumerable.Range(from, days).Select(d =>
        {
            var rows = range.Where(r => r.Day == d).ToList();
            return new AdminGameDayDto(Progression.DateOfDay(d), rows.Count, rows.Select(r => r.UserId).Distinct().Count(), rows.Count(r => r.Solved));
        }).ToList();

        var modes = range.GroupBy(r => r.Mode).Select(g => new AdminGameModeDto(g.Key, g.Count(), g.Select(r => r.UserId).Distinct().Count(),
                g.Count(r => r.Solved), Median(g.Where(r => r.Solved).Select(r => r.TimeMs)), Median(g.Select(r => r.Score)), Median(g.Select(r => r.Moves))))
            .OrderByDescending(m => m.Plays).ToList();

        var levels = new List<AdminLevelTrackDto>();
        if (LevelGames.Contains(game))
        {
            var progress = (await _db.PuzzleProgress.AsNoTracking().Where(p => p.Game == game).ToListAsync()).Where(p => !bots.Contains(p.UserId)).ToList();
            foreach (var track in progress.Select(p => p.Track).Append("level").Distinct().OrderBy(t => t))
            {
                // Level is the next one to play, so a player who has finished nothing is on 1.
                var finished = progress.Where(p => p.Track == track && p.Level > 1).Select(p => p.Level - 1).ToList();
                int top = finished.Count == 0 ? 0 : finished.Max();
                int width = Math.Max(1, (int)Math.Ceiling(top / 10.0));
                var buckets = top == 0 ? [] : Enumerable.Range(0, (top + width - 1) / width).Select(i =>
                    new AdminLevelBucketDto(i * width + 1, Math.Min(top, (i + 1) * width), finished.Count(l => l > i * width && l <= (i + 1) * width))).ToList();
                levels.Add(new AdminLevelTrackDto(track, finished.Count, Median(finished.Select(l => (int?)l)), top,
                    progress.Count(p => p.Track == track && p.SavedState != null), buckets));
            }
        }

        var funnel = Funnel(events, [ActivityEvents.PuzzleIntroViewed, ActivityEvents.PuzzleStarted, ActivityEvents.PuzzleCompleted], game);

        var top10 = range.GroupBy(r => r.UserId).Select(g => new { UserId = g.Key, Plays = g.Count(), Wins = g.Count(r => r.Solved),
                Best = g.Select(r => r.Score).Max(), BestTime = g.Where(r => r.Solved).Select(r => r.TimeMs).Min(), Last = g.Max(r => r.CreatedAt) })
            .OrderByDescending(x => x.Plays).ThenByDescending(x => x.Wins).Take(10).ToList();
        var recent = all.OrderByDescending(r => r.CreatedAt).Take(30).ToList();
        var names = await NamesAsync(top10.Select(x => x.UserId).Concat(recent.Select(r => r.UserId)));

        var rooms = game switch { "shelem" => _shelem.AdminRooms(), "esmfamil" => _esmFamil.AdminRooms(), _ => [] };

        return new AdminGameStatsDto(game, enabled, days, totals, daily, modes, levels, funnel, screens,
            top10.Select(x => new AdminGamePlayerStatDto(x.UserId, names.GetValueOrDefault(x.UserId, "?"), x.Plays, x.Wins, x.Best, x.BestTime, x.Last)).ToList(),
            recent.Select(r => new AdminGameResultDto(r.CreatedAt, r.UserId, names.GetValueOrDefault(r.UserId, "?"), r.Mode, r.PuzzleNumber, r.Solved,
                r.TimeMs, r.Score, r.Moves, r.Detail, r.Hints, r.XpGained, r.Points)).ToList(),
            rooms, null, null);
    }

    private async Task<AdminGameStatsDto> MafiaStatsAsync(bool enabled, int days, HashSet<Guid> bots, List<EventRow> events, List<AdminScreenStatDto> screens)
    {
        int today = Today, from = today - days + 1;
        var games = await _db.Games.AsNoTracking().Include(g => g.Players).ToListAsync();
        var range = games.Where(g => DayOf(g.EndedAt) >= from).ToList();
        var completed = range.Where(g => g.Status == "Completed").ToList();
        static IEnumerable<Guid> People(GameRecord g, HashSet<Guid> bots) => g.Players.Where(p => p.UserId is { } id && !bots.Contains(id)).Select(p => p.UserId!.Value);
        var todays = games.Where(g => DayOf(g.EndedAt) == today).ToList();

        var totals = new AdminGameTotalsDto(
            games.Count, games.SelectMany(g => People(g, bots)).Distinct().Count(),
            range.Count, range.SelectMany(g => People(g, bots)).Distinct().Count(),
            todays.Count, todays.SelectMany(g => People(g, bots)).Distinct().Count(),
            completed.Count == 0 ? null : Pct(completed.Count(g => g.Result == Bazimoon.Domain.WinCondition.VillagersWin), completed.Count),
            Median(completed.Select(g => (int?)(int)Math.Min(int.MaxValue, (g.EndedAt - g.CreatedAt).TotalMilliseconds))), null, null, null,
            0, 0, null,
            games.Count == 0 ? null : games.Min(g => g.CreatedAt), games.Count == 0 ? null : games.Max(g => g.EndedAt));

        var daily = Enumerable.Range(from, days).Select(d =>
        {
            var rows = range.Where(g => DayOf(g.EndedAt) == d).ToList();
            return new AdminGameDayDto(Progression.DateOfDay(d), rows.Count, rows.SelectMany(g => People(g, bots)).Distinct().Count(),
                rows.Count(g => g.Status == "Completed" && g.Result == Bazimoon.Domain.WinCondition.VillagersWin));
        }).ToList();

        var seats = completed.SelectMany(g => g.Players).Where(p => p.UserId is not { } id || !bots.Contains(id)).ToList();
        var roles = seats.Where(p => p.Role != null).GroupBy(p => p.Role!.Value)
            .Select(g => new AdminRoleStatDto(g.Key.ToString(), g.Count(), g.Count(p => p.Won != null) == 0 ? 0 : Pct(g.Count(p => p.Won == true), g.Count(p => p.Won != null))))
            .OrderByDescending(r => r.Games).ToList();
        var outcomes = range.GroupBy(g => g.Status == "Cancelled" ? "Cancelled" : g.Result.ToString())
            .Select(g => new AdminCountDto(g.Key, g.Count())).OrderByDescending(o => o.Count).ToList();
        var lengths = completed.Select(g => g.Players.Select(p => p.EliminatedRound ?? 0).DefaultIfEmpty(0).Max()).ToList();

        var tables = (await _db.MafiaTables.AsNoTracking().Select(t => new { t.CreatedAt, t.IsOpen }).ToListAsync()).Where(t => DayOf(t.CreatedAt) >= from).ToList();
        var mafia = new AdminMafiaStatsDto(
            completed.Count, range.Count(g => g.Status == "Cancelled"),
            completed.Count == 0 ? 0 : Math.Round(completed.Average(g => g.Players.Count), 1),
            lengths.Count == 0 ? 0 : Math.Round(lengths.Average(), 1),
            events.Count(e => e.Name == ActivityEvents.MafiaLeftEarly),
            seats.Count(p => p.IsMvp), seats.Count(p => p.ShotGodfather == true), seats.Count(p => p.VotedOutGodfather == true),
            outcomes, roles,
            tables.Count, tables.Count(t => t.IsOpen));

        var endedAt = completed.ToDictionary(g => g.Id, g => g.EndedAt);
        var top10 = seats.Where(p => p.UserId != null).GroupBy(p => p.UserId!.Value)
            .Select(g => new { UserId = g.Key, Plays = g.Count(), Wins = g.Count(p => p.Won == true), Net = g.Sum(p => p.RatingDelta ?? 0),
                Last = g.Max(p => endedAt[p.GameRecordId]) })
            .OrderByDescending(x => x.Plays).ThenByDescending(x => x.Wins).Take(10).ToList();
        var names = await NamesAsync(top10.Select(x => x.UserId));

        return new AdminGameStatsDto("mafia", enabled, days, totals, daily, [], [],
            Funnel(events, [ActivityEvents.MafiaLobbyJoined, ActivityEvents.MafiaGameStarted, ActivityEvents.MafiaGameEnded], null), screens,
            top10.Select(x => new AdminGamePlayerStatDto(x.UserId, names.GetValueOrDefault(x.UserId, "?"), x.Plays, x.Wins, x.Net, null, x.Last)).ToList(),
            [], [], mafia, null);
    }

    private async Task<AdminGameStatsDto> CoupleStatsAsync(bool enabled, int days, HashSet<Guid> bots, List<EventRow> events, List<AdminScreenStatDto> screens)
    {
        int today = Today, from = today - days + 1;
        var now = Now.UtcDateTime;
        var answers = (await _db.CoupleAnswers.AsNoTracking().ToListAsync()).Where(a => !bots.Contains(a.UserId)).ToList();
        var range = answers.Where(a => a.Day >= from).ToList();
        var todays = answers.Where(a => a.Day == today).ToList();
        var couples = await _db.Couples.AsNoTracking().ToListAsync();
        var active = couples.Where(c => c.PartnerId != null).ToList();
        int totalQuestions = active.Sum(c => c.TotalQuestions);

        var totals = new AdminGameTotalsDto(
            answers.Count, answers.Select(a => a.UserId).Distinct().Count(),
            range.Count, range.Select(a => a.UserId).Distinct().Count(),
            todays.Count, todays.Select(a => a.UserId).Distinct().Count(),
            totalQuestions == 0 ? null : Pct(active.Sum(c => c.TotalMatches), totalQuestions),
            null, null, null, null, range.Count * CoupleRules.XpEach, 0, null,
            answers.Count == 0 ? null : answers.Min(a => a.CreatedAt), answers.Count == 0 ? null : answers.Max(a => a.CreatedAt));

        var daily = Enumerable.Range(from, days).Select(d =>
        {
            var rows = range.Where(a => a.Day == d).ToList();
            return new AdminGameDayDto(Progression.DateOfDay(d), rows.Count, rows.Select(a => a.UserId).Distinct().Count(),
                rows.GroupBy(a => a.CoupleId).Count(g => g.Count() == 2));
        }).ToList();

        var people = await NamesAsync(active.SelectMany(c => new[] { c.InviterId, c.PartnerId!.Value }));
        var topCouples = active.OrderByDescending(c => CoupleRules.Points(c)).ThenByDescending(c => c.BestStreak).Take(10)
            .Select(c => new AdminCoupleRowDto(c.Id, people.GetValueOrDefault(c.InviterId, "?"), people.GetValueOrDefault(c.PartnerId!.Value, "?"),
                CoupleRules.Level(CoupleRules.Points(c)), CoupleRules.CurrentStreak(c.Streak, c.LastBothDay, today), c.BestStreak,
                c.TotalMatches, c.TotalQuestions, c.Language, c.AcceptedAt,
                answers.Where(a => a.CoupleId == c.Id).Select(a => (DateTime?)a.CreatedAt).Max())).ToList();

        var couple = new AdminCoupleGameDto(
            active.Count, couples.Count(c => c.PartnerId == null && c.InviteExpiresAt > now), couples.Count(c => c.PartnerId == null && c.InviteExpiresAt <= now),
            active.Count(c => c.AcceptedAt is { } at && DayOf(at) >= from),
            todays.GroupBy(a => a.CoupleId).Count(g => g.Count() == 2),
            range.Count(a => CoupleRules.Parse(a.Answers).Any(x => x < 0)),
            active.GroupBy(c => c.Language).Select(g => new AdminCountDto(g.Key, g.Count())).ToList(),
            topCouples);

        return new AdminGameStatsDto("couple", enabled, days, totals, daily, [], [],
            Funnel(events, [ActivityEvents.CoupleInviteSent, ActivityEvents.CoupleInviteAccepted, ActivityEvents.CoupleQuestionAnswered], null), screens,
            [], [], [], null, couple);
    }

    // ------------------------------------------------------------------ interactions

    private sealed record EventRow(long Id, DateTime At, Guid? UserId, string Flow, string Name, string? Json);

    private async Task<List<EventRow>> ActivityRowsAsync(int days, HashSet<Guid> bots)
    {
        var since = Now.UtcDateTime.AddDays(-days);
        var rows = await _db.UserActivityEvents.AsNoTracking().Where(e => e.CreatedAt >= since)
            .Select(e => new EventRow(e.Id, e.CreatedAt, e.UserId, e.Flow, e.Name, e.PropertiesJson)).ToListAsync();
        rows.RemoveAll(e => e.UserId is { } id && bots.Contains(id));
        return rows;
    }

    private static string? Prop(string? json, string name)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object || !doc.RootElement.TryGetProperty(name, out var v)) return null;
            return v.ValueKind switch { JsonValueKind.String => v.GetString(), JsonValueKind.Number => v.GetRawText(), _ => null };
        }
        catch (JsonException) { return null; }
    }

    private static int? PropInt(string? json, string name) => int.TryParse(Prop(json, name), out var v) ? v : null;

    private static List<AdminFunnelStepDto> Funnel(List<EventRow> events, string[] steps, string? game)
    {
        var result = new List<AdminFunnelStepDto>();
        int? first = null, previous = null;
        foreach (var step in steps)
        {
            int count = events.Where(e => e.Name == step && e.UserId != null && (game is null || Prop(e.Json, "game") == game))
                .Select(e => e.UserId!.Value).Distinct().Count();
            first ??= count;
            result.Add(new AdminFunnelStepDto(step, count, first is 0 or null ? 0 : Pct(count, first.Value), previous is null ? 100 : previous == 0 ? 0 : Pct(count, previous.Value)));
            previous = count;
        }
        return result;
    }

    /// <summary>Views, distinct viewers, median time spent and tab closes for each screen. The time spent on a
    /// screen comes from the next screen view (timeOnPreviousMs) or from the tab being hidden (timeOnScreenMs).</summary>
    private static List<AdminScreenStatDto> ScreenStats(List<EventRow> events, Func<string, bool> include, int take = 30)
    {
        var views = new Dictionary<string, (int Views, HashSet<Guid> Users, List<int?> Dwell, int Exits)>();
        (int, HashSet<Guid>, List<int?>, int) Get(string s) => views.TryGetValue(s, out var v) ? v : (0, new HashSet<Guid>(), new List<int?>(), 0);
        foreach (var e in events)
        {
            if (e.Name == ActivityEvents.ScreenViewed)
            {
                if (Prop(e.Json, "screen") is { } screen && include(screen))
                {
                    var (n, users, dwell, exits) = Get(screen);
                    if (e.UserId is { } id) users.Add(id);
                    views[screen] = (n + 1, users, dwell, exits);
                }
                if (Prop(e.Json, "previousScreen") is { } prev && include(prev) && PropInt(e.Json, "timeOnPreviousMs") is { } ms)
                {
                    var (n, users, dwell, exits) = Get(prev);
                    dwell.Add(ms);
                    views[prev] = (n, users, dwell, exits);
                }
            }
            else if (e.Name == ActivityEvents.ScreenLeft && Prop(e.Json, "screen") is { } left && include(left))
            {
                var (n, users, dwell, exits) = Get(left);
                if (PropInt(e.Json, "timeOnScreenMs") is { } ms) dwell.Add(ms);
                views[left] = (n, users, dwell, exits + 1);
            }
        }
        return views.Select(kv => new AdminScreenStatDto(kv.Key, kv.Value.Views, kv.Value.Users.Count, Median(kv.Value.Dwell), kv.Value.Exits))
            .OrderByDescending(s => s.Views).ThenBy(s => s.Screen).Take(take).ToList();
    }

    /// <summary>How players used the app over the last <paramref name="days"/> days: per flow and per day, when
    /// (weekday × hour, Tehran time), which screens and steps, sessions, the social side and the most active players.</summary>
    public async Task<AdminInteractionsDto> GetInteractionsAsync(int days)
    {
        days = ClampDays(days);
        int today = Today, from = today - days + 1;
        var since = Now.UtcDateTime.AddDays(-days);
        var bots = await BotIdsAsync();
        var events = await ActivityRowsAsync(days, bots);
        var withUser = events.Where(e => e.UserId != null).ToList();

        // Sessions: a player's events with no gap longer than SessionGap.
        var sessions = new List<(Guid User, DateTime Start, DateTime End, int Events)>();
        foreach (var g in withUser.GroupBy(e => e.UserId!.Value))
        {
            DateTime? start = null, last = null;
            int count = 0;
            foreach (var e in g.OrderBy(e => e.At))
            {
                if (last is { } l && e.At - l > SessionGap)
                {
                    sessions.Add((g.Key, start!.Value, l, count));
                    start = null;
                    count = 0;
                }
                start ??= e.At;
                last = e.At;
                count++;
            }
            if (start is { } s) sessions.Add((g.Key, s, last!.Value, count));
        }

        var byFlow = events.GroupBy(e => e.Flow).Select(g => new AdminFlowCountDto(g.Key, g.Count(), g.Where(e => e.UserId != null).Select(e => e.UserId!.Value).Distinct().Count()))
            .OrderByDescending(f => f.Events).ToList();
        var daily = Enumerable.Range(from, days).Select(d =>
        {
            var rows = events.Where(e => DayOf(e.At) == d).ToList();
            return new AdminInteractionDayDto(Progression.DateOfDay(d), rows.Count, rows.Where(e => e.UserId != null).Select(e => e.UserId!.Value).Distinct().Count(),
                rows.GroupBy(e => e.Flow).Select(f => new AdminCountDto(f.Key, f.Count())).ToList());
        }).ToList();

        // Weekday x hour in Tehran time, Saturday first (the Iranian week).
        var heat = new int[7 * 24];
        foreach (var e in events)
        {
            var local = new DateTimeOffset(DateTime.SpecifyKind(e.At, DateTimeKind.Utc)).ToOffset(Progression.PuzzleUtcOffset);
            int weekday = ((int)local.DayOfWeek + 1) % 7;
            heat[weekday * 24 + local.Hour]++;
        }

        var steps = events.Where(e => e.Flow != ActivityEvents.Navigation).GroupBy(e => (e.Flow, e.Name))
            .Select(g => new AdminStepCountDto(g.Key.Flow, g.Key.Name, g.Count(), g.Where(e => e.UserId != null).Select(e => e.UserId!.Value).Distinct().Count()))
            .OrderByDescending(s => s.Events).ToList();

        var registered = (await _db.Users.AsNoTracking().Where(u => !u.IsGuest).Select(u => u.Id).ToListAsync()).ToHashSet();
        var topUsers = withUser.GroupBy(e => e.UserId!.Value)
            .Select(g => new { UserId = g.Key, Events = g.Count(), Last = g.Max(e => e.At), Screens = g.Count(e => e.Name == ActivityEvents.ScreenViewed) })
            .OrderByDescending(x => x.Events).Take(15).ToList();
        var names = await NamesAsync(topUsers.Select(x => x.UserId));

        var social = new AdminSocialDto(
            await _db.Friendships.AsNoTracking().CountAsync(f => f.CreatedAt >= since && !f.Accepted),
            await _db.Friendships.AsNoTracking().CountAsync(f => f.Accepted && (f.AcceptedAt ?? f.CreatedAt) >= since),
            await _db.GameInvites.AsNoTracking().CountAsync(i => i.CreatedAt >= since),
            await _db.GameInvites.AsNoTracking().CountAsync(i => i.CreatedAt >= since && i.Status == GameInviteStatus.Accepted),
            await _db.Couples.AsNoTracking().CountAsync(c => c.AcceptedAt != null && c.AcceptedAt >= since),
            await _db.PlayerReports.AsNoTracking().CountAsync(r => r.CreatedAt >= since),
            await _db.PlayerBlocks.AsNoTracking().CountAsync(b => b.CreatedAt >= since));

        var lengths = sessions.Select(s => (int?)(int)Math.Min(int.MaxValue, (s.End - s.Start).TotalMilliseconds)).ToList();
        return new AdminInteractionsDto(days, events.Count, withUser.Select(e => e.UserId!.Value).Distinct().Count(), sessions.Count,
            Median(lengths), Median(sessions.Select(s => (int?)s.Events)),
            events.Count(e => e.Name == ActivityEvents.SignupGuest), events.Count(e => e.Name == ActivityEvents.SignupGoogle), events.Count(e => e.Name == ActivityEvents.LinkGoogle),
            byFlow, daily, heat, ScreenStats(events, _ => true), steps.Take(30).ToList(), social,
            topUsers.Select(x => new AdminActiveUserDto(x.UserId, names.GetValueOrDefault(x.UserId, "?"), x.Events,
                sessions.Count(s => s.User == x.UserId), x.Screens, x.Last, registered.Contains(x.UserId))).ToList());
    }

    // ------------------------------------------------------------------ registered accounts

    /// <summary>Accounts signed in with a provider (Google), against guests, and when they registered.</summary>
    public async Task<AdminRegisteredSummaryDto> GetRegisteredSummaryAsync(int days)
    {
        days = ClampDays(days);
        int today = Today, from = today - days + 1;
        var users = await _db.Users.AsNoTracking().Where(u => !u.IsBot).Select(u => new { u.Id, u.IsGuest, u.LastSeenAt }).ToListAsync();
        var registered = users.Where(u => !u.IsGuest).Select(u => u.Id).ToHashSet();
        var identities = (await _db.UserIdentities.AsNoTracking().ToListAsync()).Where(i => registered.Contains(i.UserId)).ToList();
        var firstIdentity = identities.GroupBy(i => i.UserId).ToDictionary(g => g.Key, g => g.Min(i => i.CreatedAt));
        var linked = (await _db.UserActivityEvents.AsNoTracking().Where(e => e.Name == ActivityEvents.LinkGoogle && e.UserId != null)
            .Select(e => e.UserId!.Value).ToListAsync()).ToHashSet();
        var push = (await _db.PushSubscriptions.AsNoTracking().Select(p => p.UserId).ToListAsync()).ToHashSet();
        var weekAgo = Now.UtcDateTime.AddDays(-7);

        var daily = Enumerable.Range(from, days).Select(d => new AdminCountByDateDto(Progression.DateOfDay(d), firstIdentity.Values.Count(at => DayOf(at) == d))).ToList();
        return new AdminRegisteredSummaryDto(days, registered.Count, users.Count - registered.Count,
            firstIdentity.Values.Count(at => DayOf(at) >= from), firstIdentity.Values.Count(at => at >= weekAgo),
            users.Count == 0 ? 0 : Pct(registered.Count, users.Count),
            registered.Count(linked.Contains), registered.Count(id => !linked.Contains(id)),
            registered.Count(push.Contains), users.Count(u => !u.IsGuest && u.LastSeenAt >= weekAgo),
            identities.GroupBy(i => i.Provider).Select(g => new AdminCountDto(g.Key, g.Select(i => i.UserId).Distinct().Count())).ToList(),
            daily);
    }

    // ------------------------------------------------------------------ helpers

    private static int Pct(int part, int whole) => whole == 0 ? 0 : (int)Math.Round(100.0 * part / whole);

    private static int? Median(IEnumerable<int?> values)
    {
        var sorted = values.Where(v => v.HasValue).Select(v => v!.Value).OrderBy(v => v).ToList();
        return sorted.Count == 0 ? null : sorted[sorted.Count / 2];
    }
}

public sealed record AdminCountDto(string Key, int Count);
public sealed record AdminCountByDateDto(DateOnly Date, int Count);
public sealed record AdminRoomSeatDto(string Name, bool IsBot, bool IsHost);
public sealed record AdminLiveRoomDto(string Code, string Phase, int Round, int Seated, int Humans, IReadOnlyList<AdminRoomSeatDto> Seats, string Score,
    DateTimeOffset CreatedAt, DateTimeOffset LastActivity);
/// <summary>Plays/players: all time, in the range and today. WinRate: solved share (Mafia: town wins; Couple: matched guesses).
/// MedianTimeMs: solved runs (Mafia: game length).</summary>
public sealed record AdminGameTotalsDto(int Plays, int Players, int PlaysInRange, int PlayersInRange, int PlaysToday, int PlayersToday,
    int? WinRate, int? MedianTimeMs, int? MedianScore, int? BestScore, int? BestTimeMs, int XpAwarded, int PointsAwarded, double? AverageHints,
    DateTime? FirstPlayedAt, DateTime? LastPlayedAt);
public sealed record AdminGameDayDto(DateOnly Date, int Plays, int Players, int Wins);
public sealed record AdminGameModeDto(string Mode, int Plays, int Players, int Solved, int? MedianTimeMs, int? MedianScore, int? MedianMoves);
public sealed record AdminLevelBucketDto(int From, int To, int Players);
public sealed record AdminLevelTrackDto(string Track, int Players, int? MedianLevel, int TopLevel, int SavedBoards, IReadOnlyList<AdminLevelBucketDto> Buckets);
public sealed record AdminScreenStatDto(string Screen, int Views, int Users, int? MedianDwellMs, int Exits);
/// <summary>BestScore: best score (Mafia: net rating change over the range).</summary>
public sealed record AdminGamePlayerStatDto(Guid UserId, string Name, int Plays, int Wins, int? BestScore, int? BestTimeMs, DateTime LastAt);
public sealed record AdminGameResultDto(DateTime At, Guid UserId, string Name, string Mode, int? Number, bool Solved, int? TimeMs, int? Score, int? Moves,
    int? Detail, int Hints, int Xp, int Points);
public sealed record AdminRoleStatDto(string Role, int Games, int WinRate);
public sealed record AdminMafiaStatsDto(int Completed, int Cancelled, double AveragePlayers, double AverageRounds, int LeftEarly, int Mvps,
    int SniperGodfatherShots, int GodfatherVotedOut, IReadOnlyList<AdminCountDto> Outcomes, IReadOnlyList<AdminRoleStatDto> Roles, int TablesOpened, int PublicTables);
public sealed record AdminCoupleRowDto(Guid Id, string Inviter, string Partner, int Level, int Streak, int BestStreak, int Matches, int Questions,
    string Language, DateTime? Since, DateTime? LastPlayedAt);
public sealed record AdminCoupleGameDto(int Active, int PendingInvites, int ExpiredInvites, int NewInRange, int BothToday, int AnswersWithSkips,
    IReadOnlyList<AdminCountDto> Languages, IReadOnlyList<AdminCoupleRowDto> TopCouples);
public sealed record AdminGameStatsDto(string Game, bool Enabled, int Days, AdminGameTotalsDto Totals, IReadOnlyList<AdminGameDayDto> Daily,
    IReadOnlyList<AdminGameModeDto> Modes, IReadOnlyList<AdminLevelTrackDto> Levels, IReadOnlyList<AdminFunnelStepDto> Funnel,
    IReadOnlyList<AdminScreenStatDto> Screens, IReadOnlyList<AdminGamePlayerStatDto> TopPlayers, IReadOnlyList<AdminGameResultDto> Recent,
    IReadOnlyList<AdminLiveRoomDto> Rooms, AdminMafiaStatsDto? Mafia, AdminCoupleGameDto? Couple);

public sealed record AdminFlowCountDto(string Flow, int Events, int Users);
public sealed record AdminInteractionDayDto(DateOnly Date, int Events, int Users, IReadOnlyList<AdminCountDto> Flows);
public sealed record AdminStepCountDto(string Flow, string Name, int Events, int Users);
public sealed record AdminSocialDto(int FriendRequestsWaiting, int FriendshipsMade, int GameInvitesSent, int GameInvitesAccepted, int CouplesFormed, int Reports, int Blocks);
public sealed record AdminActiveUserDto(Guid UserId, string Name, int Events, int Sessions, int Screens, DateTime LastAt, bool Registered);
/// <summary>Heatmap: 7 × 24 event counts, row-major, Saturday first, hours in Tehran time.</summary>
public sealed record AdminInteractionsDto(int Days, int Events, int Users, int Sessions, int? MedianSessionMs, int? MedianEventsPerSession,
    int GuestSignUps, int GoogleSignUps, int GoogleLinks, IReadOnlyList<AdminFlowCountDto> Flows, IReadOnlyList<AdminInteractionDayDto> Daily,
    IReadOnlyList<int> Heatmap, IReadOnlyList<AdminScreenStatDto> Screens, IReadOnlyList<AdminStepCountDto> Steps, AdminSocialDto Social,
    IReadOnlyList<AdminActiveUserDto> TopUsers);

public sealed record AdminRegisteredSummaryDto(int Days, int Registered, int Guests, int RegisteredInRange, int RegisteredLast7, int RegisteredShare,
    int LinkedFromGuest, int SignedUpWithGoogle, int WithNotifications, int ActiveLast7, IReadOnlyList<AdminCountDto> Providers,
    IReadOnlyList<AdminCountByDateDto> Daily);
