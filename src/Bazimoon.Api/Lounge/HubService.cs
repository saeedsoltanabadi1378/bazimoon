using Microsoft.EntityFrameworkCore;
using Bazimoon.Domain;
using Bazimoon.Infrastructure;
using Bazimoon.Infrastructure.Activity;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Hub;
using Bazimoon.Infrastructure.Sessions;

namespace Bazimoon.Api.Lounge;

/// <summary>Read models and writes behind the app hub: profile, home, league, puzzles and tables.</summary>
public sealed class HubService
{
    private readonly BazimoonDbContext _db;
    private readonly IGameSessionStore _sessions;
    private readonly TimeProvider _clock;
    private readonly TableService _tables;
    private readonly IActivityTracker _activity;

    public HubService(BazimoonDbContext db, IGameSessionStore sessions, TimeProvider clock, TableService tables, IActivityTracker activity)
    {
        _tables = tables;
        _db = db;
        _sessions = sessions;
        _clock = clock;
        _activity = activity;
    }

    private int Today => Progression.PuzzleDay(_clock.GetUtcNow());

    // ------------------------------------------------------------------ profile

    public async Task<ProfileDto> GetProfileAsync(Guid userId, string username)
    {
        var stats = await _db.GetOrCreateStatsAsync(userId, username);
        await _db.SaveChangesAsync();
        var today = Today;
        var (level, into, forNext) = Progression.Level(stats.Xp);
        var (division, tier) = Progression.Division(stats.Rating);

        var mafiaGames = await RatedGamesAsync(userId).ToListAsync();
        var seasonStart = Progression.DateOfDay(Progression.SeasonStartDay(Progression.Season(today))).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var townGames = mafiaGames.Where(g => g.Role is not (Role.Mafia or Role.Godfather)).ToList();
        var mafiaSideGames = mafiaGames.Where(g => g.Role is Role.Mafia or Role.Godfather).ToList();
        var bestRole = mafiaGames.Where(g => g.Won == true && g.Role.HasValue)
            .GroupBy(g => g.Role!.Value).OrderByDescending(g => g.Count()).Select(g => (Role?)g.Key).FirstOrDefault();

        var puzzles = await _db.PuzzleResults.Where(r => r.UserId == userId).ToListAsync();
        int? bestZip = puzzles.Where(r => r.Game == "zip" && r.Solved && r.TimeMs.HasValue).Select(r => r.TimeMs).Min();
        int streak = Progression.CurrentStreak(stats.PuzzleStreak, stats.LastPuzzleDay, stats.StreakFreezes, today);

        var achievements = MafiaStats.Achievements(await MafiaRowsAsync(userId));
        var badges = new List<BadgeDto>
        {
            new("firstWin", mafiaGames.Any(g => g.Won == true)),
            new("lifeSaver", mafiaGames.Any(g => g.Won == true && g.Role == Role.Doctor)),
        };
        badges.AddRange(achievements.Select(a => new BadgeDto(a.Key, a.EarnedAt.HasValue)));
        badges.AddRange(new List<BadgeDto>
        {
            new("streak7", stats.BestPuzzleStreak >= 7),
            new("streak30", stats.BestPuzzleStreak >= 30),
            new("solved100", puzzles.Count(p => p.Solved) >= 100),
            new("gold", stats.Rating >= 1550),
        });

        return new ProfileDto(
            stats.Username,
            level, into, forNext, stats.Xp,
            division, tier,
            new MafiaProfileDto(
                stats.Rating,
                mafiaGames.Count(g => g.EndedAt >= seasonStart),
                mafiaGames.Count,
                Percent(mafiaGames.Count(g => g.Won == true), mafiaGames.Count),
                bestRole,
                new SideStatsDto(townGames.Count, Percent(townGames.Count(g => g.Won == true), townGames.Count)),
                new SideStatsDto(mafiaSideGames.Count, Percent(mafiaSideGames.Count(g => g.Won == true), mafiaSideGames.Count))),
            new PuzzleProfileDto(streak, stats.BestPuzzleStreak, puzzles.Count(p => p.Solved), bestZip, stats.StreakFreezes),
            badges,
            ToSettings(stats));
    }

    public async Task<SettingsDto> UpdateSettingsAsync(Guid userId, string username, SettingsDto settings)
    {
        var stats = await _db.GetOrCreateStatsAsync(userId, username);
        stats.Language = settings.Language is "fa" ? "fa" : "en";
        stats.ReminderEnabled = settings.ReminderEnabled;
        stats.ReminderTime = TimeOnly.TryParse(settings.ReminderTime, out var time) ? time.ToString("HH:mm") : "09:00";
        stats.HighContrast = settings.HighContrast;
        stats.Haptics = settings.Haptics;
        stats.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return ToSettings(stats);
    }

    private static SettingsDto ToSettings(PlayerStatsRecord s) => new(s.Language, s.ReminderEnabled, s.ReminderTime, s.HighContrast, s.Haptics);

    public async Task<MyGameResultDto?> GetMyGameResultAsync(Guid userId, Guid gameId)
    {
        var row = await _db.GamePlayers.Include(p => p.GameRecord)
            .FirstOrDefaultAsync(p => p.GameRecordId == gameId && p.UserId == userId);
        if (row is null || row.Won is null) return null;
        int rating = (row.RatingBefore ?? Progression.StartingRating) + (row.RatingDelta ?? 0);
        var earnedHere = MafiaStats.Achievements(await MafiaRowsAsync(userId))
            .Where(a => a.GameId == gameId).Select(a => a.Key).ToList();
        return new MyGameResultDto(row.Won.Value, rating, row.RatingDelta ?? 0, row.IsMvp, earnedHere);
    }

    /// <summary>Your finished, rated Mafia games with their game record, oldest first.</summary>
    private async Task<List<GamePlayerRecord>> MafiaRowsAsync(Guid userId) =>
        await _db.GamePlayers.AsNoTracking().Include(p => p.GameRecord)
            .Where(p => p.UserId == userId && p.Won != null && p.GameRecord.Status == "Completed")
            .OrderBy(p => p.GameRecord.EndedAt)
            .ToListAsync();

    public async Task<MafiaStatsDto> GetMafiaStatsAsync(Guid userId)
    {
        var rows = await MafiaRowsAsync(userId);
        var recentIds = rows.OrderByDescending(r => r.GameRecord.EndedAt).Take(20).Select(r => r.GameRecordId).ToList();
        var counts = await _db.GamePlayers.Where(p => recentIds.Contains(p.GameRecordId))
            .GroupBy(p => p.GameRecordId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count);
        var names = await _db.MafiaTables.Where(t => recentIds.Contains(t.GameId)).ToDictionaryAsync(t => t.GameId, t => t.Name);
        var recent = rows.OrderByDescending(r => r.GameRecord.EndedAt).Take(20).Select(r => new MafiaRecentGameDto(
            r.GameRecordId, r.Role, r.Won == true, r.IsMvp, r.GameRecord.EndedAt, counts.GetValueOrDefault(r.GameRecordId),
            names.GetValueOrDefault(r.GameRecordId), r.RatingDelta, r.GameRecord.EventsJson is not null)).ToList();
        return new MafiaStatsDto(rows.Count, MafiaStats.ByRole(rows), MafiaStats.Skills(rows), MafiaStats.Achievements(rows), recent);
    }

    /// <summary>The timeline of a finished game, with every role shown. Null when the game is unknown or has no log.</summary>
    public async Task<GameRecapDto?> GetRecapAsync(Guid gameId)
    {
        var game = await _db.Games.AsNoTracking().Include(g => g.Players).FirstOrDefaultAsync(g => g.Id == gameId);
        if (game?.EventsJson is null) return null;
        var events = System.Text.Json.JsonSerializer.Deserialize<List<GameEvent>>(game.EventsJson) ?? [];
        string? name = await _db.MafiaTables.Where(t => t.GameId == gameId).Select(t => t.Name).FirstOrDefaultAsync();
        return new GameRecapDto(game.Id, name, game.EndedAt, game.Result,
            game.Players.Select(p => new RecapPlayerDto(p.PlayerId, p.DisplayName, p.Role, p.EliminatedBy, p.EliminatedRound, p.WasPromoted, p.IsMvp, p.MvpPoints)).ToList(),
            events);
    }

    private record RatedGame(Role? Role, bool? Won, DateTime EndedAt, int? RatingDelta);

    private IQueryable<RatedGame> RatedGamesAsync(Guid userId) =>
        _db.GamePlayers
            .Where(p => p.UserId == userId && p.Won != null && p.GameRecord.Status == "Completed")
            .Select(p => new RatedGame(p.Role, p.Won, p.GameRecord.EndedAt, p.RatingDelta));

    private static bool IsDaily(string mode) => Progression.IsDaily(mode);

    /// <summary>A daily or a first go at a level: the attempts that count toward the streak and league.</summary>
    private static bool Counts(string mode) => Progression.IsDaily(mode) || Progression.IsLevel(mode);

    private static int Percent(int part, int whole) => whole == 0 ? 0 : (int)Math.Round(100.0 * part / whole);

    // ------------------------------------------------------------------ home

    public async Task<HomeDto> GetHomeAsync(Guid userId, string username)
    {
        var stats = await _db.GetOrCreateStatsAsync(userId, username);
        await _db.SaveChangesAsync();
        var today = Today;
        var solvedToday = await _db.PuzzleResults
            .Where(r => r.UserId == userId && r.Day == today && r.Solved && (r.Mode == "level" || r.Mode == "level-fa"))
            .Select(r => new { r.Game, r.Mode }).ToListAsync();
        var levels = new List<LevelStatusDto>();
        foreach (var game in new[] { "zip", "queens", "sudoku", "word", "ladder" })
        {
            // Word and Ladder follow the player's language.
            string track = stats.Language == "fa" && game is "word" or "ladder" ? "level-fa" : "level";
            var progress = await GetOrCreateProgressAsync(userId, game, track);
            levels.Add(new LevelStatusDto(game, track, progress.Level, solvedToday.Count(r => r.Game == game && r.Mode == track), progress.SavedLevel == progress.Level));
        }
        await _db.SaveChangesAsync();

        int? mergeBest = await _db.PuzzleResults.Where(r => r.UserId == userId && r.Game == "merge").MaxAsync(r => r.Score);
        var league = await GetLeagueAsync(userId, username, "mafia");
        var tables = await _tables.GetYourTablesAsync(userId);
        return new HomeDto(
            Progression.CurrentStreak(stats.PuzzleStreak, stats.LastPuzzleDay, stats.StreakFreezes, today),
            Progression.DateOfDay(today).ToString("yyyy-MM-dd"),
            levels,
            mergeBest,
            new LeagueSummaryDto(league.Season, league.DaysLeft, league.Division, league.Tier, league.You.Rank, league.PlayerCount, league.You.Zone),
            tables.FirstOrDefault(),
            (await _tables.GetOpenTablesAsync(userId)).Count(t => t.Phase == GamePhase.Lobby && t.Seated < t.MaxPlayers));
    }

    // ------------------------------------------------------------------ league

    public async Task<LeagueDto> GetLeagueAsync(Guid userId, string username, string board)
    {
        var me = await _db.GetOrCreateStatsAsync(userId, username);
        await _db.SaveChangesAsync();
        var today = Today;
        int season = Progression.Season(today);
        var seasonStartDay = Progression.SeasonStartDay(season);
        var seasonStart = Progression.DateOfDay(seasonStartDay).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var (division, tier) = Progression.Division(me.Rating);
        var bots = await BotIdsExceptAsync(userId);
        var everyone = await _db.PlayerStats.AsNoTracking().ToListAsync();
        var sameDivision = everyone.Where(s => !bots.Contains(s.UserId) && Progression.Division(s.Rating).Division == division).ToDictionary(s => s.UserId);

        List<LeagueEntry> entries;
        QualificationDto qualification;
        if (board == "puzzles")
        {
            int weekStart = Progression.WeekStartDay(today);
            var results = await _db.PuzzleResults.Where(r => r.Day >= seasonStartDay).Select(r => new { r.UserId, r.Points, r.Day, r.Mode, r.Solved }).ToListAsync();
            entries = results.GroupBy(r => r.UserId)
                .Where(g => sameDivision.ContainsKey(g.Key))
                .Select(g =>
                {
                    var s = sameDivision[g.Key];
                    return new LeagueEntry(g.Key, s.Username, g.Sum(r => r.Points), g.Where(r => r.Day >= weekStart).Sum(r => r.Points),
                        Progression.CurrentStreak(s.PuzzleStreak, s.LastPuzzleDay, s.StreakFreezes, today), 0,
                        g.Count(r => Counts(r.Mode) && r.Solved && r.Day >= weekStart) >= Progression.PuzzleQualifyingSolves);
                })
                .ToList();
            int mySolves = results.Count(r => r.UserId == userId && Counts(r.Mode) && r.Solved && r.Day >= weekStart);
            qualification = new QualificationDto(mySolves, Progression.PuzzleQualifyingSolves);
        }
        else
        {
            var games = await _db.GamePlayers
                .Where(p => p.UserId != null && p.Won != null && p.GameRecord.Status == "Completed" && p.GameRecord.EndedAt >= seasonStart)
                .Select(p => new { UserId = p.UserId!.Value, p.Won, p.RatingDelta })
                .ToListAsync();
            entries = games.GroupBy(g => g.UserId)
                .Where(g => sameDivision.ContainsKey(g.Key))
                .Select(g =>
                {
                    var s = sameDivision[g.Key];
                    int count = g.Count();
                    return new LeagueEntry(g.Key, s.Username, s.Rating, g.Sum(x => x.RatingDelta ?? 0), count,
                        Percent(g.Count(x => x.Won == true), count), count >= Progression.MafiaQualifyingGames);
                })
                .ToList();
            int myGames = games.Count(g => g.UserId == userId);
            qualification = new QualificationDto(myGames, Progression.MafiaQualifyingGames);
        }

        var ranked = entries.Where(e => e.Qualified).OrderByDescending(e => e.Score).ThenBy(e => e.Name).ToList();
        int n = ranked.Count;
        string ZoneFor(int rank) => n >= 10 && rank <= 5 ? "promotion" : n >= 10 && rank > n - 5 ? "relegation" : "safe";

        var rows = new List<LeagueRowDto>();
        for (int i = 0; i < n; i++)
        {
            var e = ranked[i];
            int rank = i + 1;
            bool show = rank <= 7 || rank > n - 3 || e.UserId == userId;
            if (!show) continue;
            rows.Add(new LeagueRowDto(rank, e.Name, e.UserId == userId, e.Score, e.Delta, e.Games, e.WinRateOrStreak, ZoneFor(rank)));
        }

        int myIndex = ranked.FindIndex(e => e.UserId == userId);
        var mine = entries.FirstOrDefault(e => e.UserId == userId);
        int? myRank = myIndex >= 0 ? myIndex + 1 : null;
        var you = board == "puzzles"
            ? new LeagueYouDto(myRank, mine?.Score ?? 0, Progression.CurrentStreak(me.PuzzleStreak, me.LastPuzzleDay, me.StreakFreezes, today), myRank is { } r1 ? ZoneFor(r1) : null)
            : new LeagueYouDto(myRank, me.Rating, mine?.WinRateOrStreak ?? 0, myRank is { } r2 ? ZoneFor(r2) : null);

        return new LeagueDto(board, season, Progression.DaysLeftInSeason(today), division, tier, n, you, qualification, rows);
    }

    private sealed record LeagueEntry(Guid UserId, string Name, int Score, int Delta, int Games, int WinRateOrStreak, bool Qualified);

    // ------------------------------------------------------------------ puzzles

    public async Task<PuzzleResultDto> SubmitPuzzleAsync(Guid userId, string username, PuzzleSubmitRequest request)
    {
        if (!Progression.Games.Contains(request.Game))
            throw new GameException("Unknown game.");
        // Online Esm-Famil results are recorded by the room service, never by the client.
        if (request.Game == "esmfamil" && request.Mode?.Trim().ToLowerInvariant() == "online")
            throw new GameException("Unknown mode.");
        var mode = string.IsNullOrWhiteSpace(request.Mode) ? "classic" : request.Mode.Trim().ToLowerInvariant();
        if (mode.Length > 16) throw new GameException("Unknown mode.");

        var stats = await _db.GetOrCreateStatsAsync(userId, username);
        var today = Today;
        int? number = null;
        int? nextLevel = null;
        bool countsAsDaily = false;
        bool countsAsLevel = false;
        // Level games have no daily or archive any more; an older app's daily is kept as practice.
        if (Progression.LevelGames.Contains(request.Game) && (IsDaily(mode) || mode == "archive"))
            mode = "practice";

        if (Progression.LevelTrack(request.Game, mode) is { } track)
        {
            if (request.PuzzleNumber is not { } playedLevel || playedLevel < 1) throw new GameException("Pick a level.");
            var progress = await GetOrCreateProgressAsync(userId, request.Game, track);
            if (playedLevel > progress.Level) throw new GameException("That level is still locked.");
            number = playedLevel;
            if (playedLevel == progress.Level)
            {
                // Finishing the current level, solved or not, opens the next one. Earlier levels are replays.
                countsAsLevel = true;
                mode = track;
                progress.Level++;
                progress.SavedLevel = null;
                progress.SavedState = null;
                progress.UpdatedAt = DateTime.UtcNow;
            }
            else mode = "practice";
            nextLevel = progress.Level;
        }
        // "daily" or a language/variant daily such as "daily-fa" (Esm-Famil has one per language).
        else if (IsDaily(mode))
        {
            number = Progression.DailyNumber(request.Game, today);
            var dailyMode = mode;
            // Only the first daily attempt counts; replays are recorded as practice.
            countsAsDaily = !await _db.PuzzleResults.AnyAsync(r => r.UserId == userId && r.Game == request.Game && r.Mode == dailyMode && r.PuzzleNumber == number);
            if (!countsAsDaily) mode = "practice";
        }

        var history = await _db.PuzzleResults.Where(r => r.UserId == userId && r.Game == request.Game).ToListAsync();
        bool higherIsBetter = request.Score.HasValue && !request.TimeMs.HasValue;
        bool newBest = request.Solved && (higherIsBetter
            ? history.All(h => (h.Score ?? 0) < request.Score)
            : request.TimeMs.HasValue && history.Where(h => h.Solved && h.TimeMs.HasValue && h.Mode == mode).All(h => h.TimeMs > request.TimeMs));
        if (higherIsBetter && history.Count == 0 && (request.Score ?? 0) > 0) newBest = true;

        bool streakExtended = false;
        if (countsAsLevel && request.Solved && Progression.StreakGames.Contains(request.Game))
        {
            var advanced = Progression.AdvanceStreak(stats.PuzzleStreak, stats.LastPuzzleDay, stats.StreakFreezes, today);
            stats.PuzzleStreak = advanced.Streak;
            stats.LastPuzzleDay = advanced.LastDay;
            stats.StreakFreezes = advanced.Freezes;
            stats.BestPuzzleStreak = Math.Max(stats.BestPuzzleStreak, stats.PuzzleStreak);
            streakExtended = advanced.Extended;
        }
        int streak = Progression.CurrentStreak(stats.PuzzleStreak, stats.LastPuzzleDay, stats.StreakFreezes, today);

        var outcome = new Progression.PuzzleOutcome(request.Game, countsAsDaily ? "daily" : mode, request.Solved, request.TimeMs, request.Score, request.Moves, request.Detail, Math.Max(0, request.Hints));
        int xp = Progression.SoloXp(outcome, streak, newBest);
        int points = Progression.LeaguePoints(outcome, xp);
        if (mode == "practice" && request.Game is "zip" or "queens" or "word" or "ladder" or "sudoku") points = 0;

        int xpBefore = stats.Xp;
        stats.Xp += xp;
        stats.UpdatedAt = DateTime.UtcNow;

        _db.PuzzleResults.Add(new PuzzleResultRecord
        {
            UserId = userId, Game = request.Game, Mode = mode, PuzzleNumber = number, Day = today,
            Solved = request.Solved, TimeMs = request.TimeMs, Score = request.Score, Moves = request.Moves, Detail = request.Detail,
            Hints = Math.Max(0, request.Hints), XpGained = xp, Points = points
        });
        _activity.Track(userId, ActivityEvents.Puzzle, ActivityEvents.PuzzleCompleted, new
        {
            game = request.Game, mode, number, solved = request.Solved, timeMs = request.TimeMs, moves = request.Moves,
            hints = Math.Max(0, request.Hints), newBest, streakExtended, xp, countsAsDaily, countsAsLevel,
        });
        await _db.SaveChangesAsync();

        int? percentile = null;
        if ((countsAsDaily || countsAsLevel) && request.Solved)
        {
            var others = await _db.PuzzleResults.Where(r => r.Game == request.Game && r.Mode == mode && r.PuzzleNumber == number && r.UserId != userId)
                .Select(r => new { r.Solved, r.TimeMs, r.Moves }).ToListAsync();
            if (others.Count > 0)
            {
                int beaten = request.TimeMs.HasValue
                    ? others.Count(o => !o.Solved || (o.TimeMs ?? int.MaxValue) > request.TimeMs)
                    : others.Count(o => !o.Solved || (o.Moves ?? int.MaxValue) > request.Moves);
                percentile = Percent(beaten, others.Count);
            }
        }

        var (level, into, forNext) = Progression.Level(stats.Xp);
        var (levelBefore, intoBefore, _) = Progression.Level(xpBefore);
        return new PuzzleResultDto(xp, points, stats.Xp, level, into, forNext, levelBefore, intoBefore, streak, streakExtended, newBest, countsAsDaily || countsAsLevel, number, percentile, nextLevel);
    }

    public async Task<GameStatsDto> GetGameStatsAsync(Guid userId, string game)
    {
        if (!Progression.Games.Contains(game)) throw new GameException("Unknown game.");
        var today = Today;
        var rows = await _db.PuzzleResults.Where(r => r.UserId == userId && r.Game == game).OrderBy(r => r.CreatedAt).ToListAsync();
        var solved = rows.Where(r => r.Solved).ToList();
        var timed = solved.Where(r => r.TimeMs.HasValue).ToList();
        var scored = rows.Where(r => r.Score.HasValue).ToList();

        // Streak for this game alone: consecutive days with a solved daily or level up to today/yesterday.
        var solvedDays = rows.Where(r => Counts(r.Mode) && r.Solved).Select(r => r.Day).ToHashSet();
        int gameStreak = 0;
        for (int d = solvedDays.Contains(today) ? today : today - 1; solvedDays.Contains(d); d--) gameStreak++;

        int winStreak = 0;
        for (int i = rows.Count - 1; i >= 0 && rows[i].Solved; i--) winStreak++;

        var todays = rows.LastOrDefault(r => r.Mode == "daily" && r.Day == today);
        return new GameStatsDto(
            game,
            rows.Count,
            solved.Count,
            Percent(solved.Count, rows.Count),
            timed.Count > 0 ? timed.Min(r => r.TimeMs) : null,
            timed.Count > 0 ? (int)timed.Average(r => r.TimeMs!.Value) : null,
            scored.Count > 0 ? scored.Max(r => r.Score) : null,
            scored.Count > 0 ? (int)scored.Average(r => r.Score!.Value) : null,
            solved.Where(r => r.Moves.HasValue).Select(r => r.Moves).DefaultIfEmpty().Min(),
            solved.Where(r => r.Moves.HasValue).Select(r => (double)r.Moves!.Value).DefaultIfEmpty().Average(),
            rows.Where(r => r.Detail.HasValue).Select(r => r.Detail).DefaultIfEmpty().Max(),
            rows.Sum(r => r.Detail ?? 0),
            gameStreak,
            winStreak,
            Progression.DailyNumber(game, today),
            todays is null ? null : new DailyStatusDto(game, todays.PuzzleNumber ?? 0, true, todays.Solved, todays.TimeMs, todays.Moves),
            rows.GroupBy(r => r.Mode).ToDictionary(g => g.Key, g => g.Count(x => x.Solved)),
            timed.GroupBy(r => r.Mode).ToDictionary(g => g.Key, g => g.Min(x => x.TimeMs!.Value)),
            solved.Where(r => r.Moves.HasValue).GroupBy(r => r.Moves!.Value).ToDictionary(g => g.Key, g => g.Count()),
            solved.Where(r => r.Detail.HasValue).GroupBy(r => r.Detail!.Value).ToDictionary(g => g.Key, g => g.Count()));
    }

    public async Task<BoardDto> GetBoardAsync(Guid userId, string game, int? number, string? mode = null)
    {
        if (!Progression.Games.Contains(game)) throw new GameException("Unknown game.");
        // A language variant of a daily (Daily Word and Esm-Famil have a Persian one).
        var dailyMode = mode == "daily-fa" ? "daily-fa" : "daily";
        number ??= Progression.DailyNumber(game, Today);
        var group = await GroupMembersAsync(userId);
        group.ExceptWith(await BotIdsExceptAsync(userId));
        var results = await _db.PuzzleResults
            .Where(r => r.Game == game && r.Mode == dailyMode && r.PuzzleNumber == number && group.Contains(r.UserId))
            .ToListAsync();
        var names = await _db.PlayerStats.Where(s => group.Contains(s.UserId)).ToDictionaryAsync(s => s.UserId, s => s.Username);
        var ordered = game == "esmfamil"
            ? results.OrderByDescending(r => r.Score ?? 0).ToList() // solo Esm-Famil is scored, not timed
            : results
            .OrderByDescending(r => r.Solved)
            .ThenBy(r => r.TimeMs ?? int.MaxValue)
            .ThenBy(r => r.Moves ?? int.MaxValue)
            .ThenByDescending(r => r.Score ?? 0)
            .ToList();
        var rows = ordered.Select((r, i) => new BoardRowDto(r.Solved ? i + 1 : null, names.GetValueOrDefault(r.UserId, "?"), r.UserId == userId, r.Solved, r.TimeMs, r.Score, r.Moves)).ToList();
        return new BoardDto(game, number, results.Count(r => r.Solved), rows);
    }

    // ------------------------------------------------------------------ levels

    /// <summary>The player's place in a level game, created the first time it is asked for.</summary>
    public async Task<LevelProgressDto> GetProgressAsync(Guid userId, string game, string? track)
    {
        var progress = await GetOrCreateProgressAsync(userId, game, LevelTrackOf(game, track));
        await _db.SaveChangesAsync();
        return ToDto(progress);
    }

    /// <summary>Keeps the half-finished board of the current level (null state clears it).</summary>
    public async Task<LevelProgressDto> SaveProgressStateAsync(Guid userId, string game, SaveLevelStateRequest request)
    {
        var progress = await GetOrCreateProgressAsync(userId, game, LevelTrackOf(game, request.Track));
        // Only the current level has a server save; replays of earlier levels stay on the device.
        if (request.Level != progress.Level) throw new GameException("Only the current level can be saved.");
        if (request.State is { Length: > Progression.MaxSavedStateLength }) throw new GameException("That board is too big to save.");
        progress.SavedLevel = request.State is null ? null : request.Level;
        progress.SavedState = request.State;
        progress.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return ToDto(progress);
    }

    private static string LevelTrackOf(string game, string? track)
    {
        if (!Progression.LevelGames.Contains(game)) throw new GameException("Unknown game.");
        return Progression.LevelTrack(game, track ?? "level") ?? "level";
    }

    private static LevelProgressDto ToDto(PuzzleProgressRecord p) =>
        new(p.Game, p.Track, p.Level, p.SavedLevel == p.Level ? p.SavedState : null);

    /// <summary>Loads (or starts) a player's progress row. A new row begins one past the dailies they had
    /// already solved under the old one-a-day rules, so nobody starts over.</summary>
    private async Task<PuzzleProgressRecord> GetOrCreateProgressAsync(Guid userId, string game, string track)
    {
        var row = _db.PuzzleProgress.Local.FirstOrDefault(p => p.UserId == userId && p.Game == game && p.Track == track)
            ?? await _db.PuzzleProgress.FirstOrDefaultAsync(p => p.UserId == userId && p.Game == game && p.Track == track);
        if (row is not null) return row;
        string dailyMode = track == "level-fa" ? "daily-fa" : "daily";
        int solved = await _db.PuzzleResults
            .Where(r => r.UserId == userId && r.Game == game && r.Mode == dailyMode && r.Solved && r.PuzzleNumber != null)
            .Select(r => r.PuzzleNumber).Distinct().CountAsync();
        row = new PuzzleProgressRecord { UserId = userId, Game = game, Track = track, Level = Progression.StartingLevel(solved) };
        _db.PuzzleProgress.Add(row);
        return row;
    }

    /// <summary>This week's best score per player in your division for an endless game (Merge, Stack, Blocks…).</summary>
    public async Task<WeeklyDto> GetWeeklyAsync(Guid userId, string username, string game)
    {
        if (!Progression.Games.Contains(game)) throw new GameException("Unknown game.");
        var me = await _db.GetOrCreateStatsAsync(userId, username);
        await _db.SaveChangesAsync();
        var today = Today;
        int weekStart = Progression.WeekStartDay(today);
        var (division, tier) = Progression.Division(me.Rating);
        var bots = await BotIdsExceptAsync(userId);
        var everyone = await _db.PlayerStats.AsNoTracking().ToListAsync();
        var sameDivision = everyone.Where(s => !bots.Contains(s.UserId) && Progression.Division(s.Rating).Division == division).ToDictionary(s => s.UserId, s => s.Username);
        var scores = await _db.PuzzleResults
            .Where(r => r.Game == game && r.Day >= weekStart && r.Score != null)
            .GroupBy(r => r.UserId)
            .Select(g => new { UserId = g.Key, Best = g.Max(r => r.Score!.Value) })
            .ToListAsync();
        var ranked = scores.Where(x => sameDivision.ContainsKey(x.UserId)).OrderByDescending(x => x.Best).ToList();
        int myIndex = ranked.FindIndex(x => x.UserId == userId);
        var rows = ranked.Select((x, i) => new WeeklyRowDto(i + 1, sameDivision[x.UserId], x.UserId == userId, x.Best))
            .Where(r => r.Rank <= 5 || r.IsYou).ToList();
        return new WeeklyDto(game, division, tier, 7 - (today - weekStart), myIndex >= 0 ? myIndex + 1 : null, rows);
    }

    /// <summary>Accounts an admin marked as bots, other than you (a bot still sees itself).</summary>
    private async Task<HashSet<Guid>> BotIdsExceptAsync(Guid userId) =>
        (await _db.Users.Where(u => u.IsBot && u.Id != userId).Select(u => u.Id).ToListAsync()).ToHashSet();

    /// <summary>You and everyone you have shared a finished Mafia table with.</summary>
    private async Task<HashSet<Guid>> GroupMembersAsync(Guid userId)
    {
        var games = _db.GamePlayers.Where(p => p.UserId == userId).Select(p => p.GameRecordId);
        var members = await _db.GamePlayers.Where(p => games.Contains(p.GameRecordId) && p.UserId != null)
            .Select(p => p.UserId!.Value).Distinct().ToListAsync();
        var set = members.ToHashSet();
        set.Add(userId);
        return set;
    }
}
