using Nightfall.Api.Auth;
using Nightfall.Domain;

namespace Nightfall.Api.Lounge;

public static class HubEndpoints
{
    public static void MapHubEndpoints(this IEndpointRouteBuilder app)
    {
        var me = app.MapGroup("/api/me").RequireAuthorization();

        me.MapGet("/profile", (HubService hub, HttpContext http) =>
            hub.GetProfileAsync(http.User.GetTelegramUserId(), http.User.GetTelegramUsername())).WithName("GetProfile");

        me.MapPut("/settings", (SettingsDto settings, HubService hub, HttpContext http) =>
            hub.UpdateSettingsAsync(http.User.GetTelegramUserId(), http.User.GetTelegramUsername(), settings)).WithName("UpdateSettings");

        me.MapGet("/games/{gameId:guid}", async (Guid gameId, HubService hub, HttpContext http) =>
            await hub.GetMyGameResultAsync(http.User.GetTelegramUserId(), gameId) is { } result ? Results.Ok(result) : Results.NotFound())
            .WithName("GetMyGameResult");

        var hubGroup = app.MapGroup("/api/hub").RequireAuthorization();

        hubGroup.MapGet("/home", (HubService hub, HttpContext http) =>
            hub.GetHomeAsync(http.User.GetTelegramUserId(), http.User.GetTelegramUsername())).WithName("GetHome");

        hubGroup.MapGet("/tables", (TableService tables, HttpContext http) =>
            tables.GetGroupTablesAsync(http.User.GetTelegramUserId())).WithName("GetTables");

        hubGroup.MapPost("/quick-match", async (TableService tables, Games.GameService games, HttpContext http) =>
        {
            long userId = http.User.GetTelegramUserId();
            var gameId = await tables.FindQuickMatchAsync(userId);
            if (gameId is null) return Results.NotFound(new { detail = "No open table in your groups right now." });
            await games.JoinGameAsync(gameId.Value, userId, http.User.GetTelegramUsername());
            return Results.Ok(new Games.CreateGameResponse(gameId.Value));
        }).WithName("QuickMatch");

        hubGroup.MapGet("/league", (string? board, HubService hub, HttpContext http) =>
            hub.GetLeagueAsync(http.User.GetTelegramUserId(), http.User.GetTelegramUsername(), board == "puzzles" ? "puzzles" : "mafia"))
            .WithName("GetLeague");

        var puzzles = app.MapGroup("/api/puzzles").RequireAuthorization();

        puzzles.MapPost("/results", (PuzzleSubmitRequest request, HubService hub, HttpContext http) =>
            hub.SubmitPuzzleAsync(http.User.GetTelegramUserId(), http.User.GetTelegramUsername(), request)).WithName("SubmitPuzzleResult");

        puzzles.MapGet("/{game}/stats", (string game, HubService hub, HttpContext http) =>
            hub.GetGameStatsAsync(http.User.GetTelegramUserId(), game)).WithName("GetPuzzleStats");

        puzzles.MapGet("/{game}/weekly", (string game, HubService hub, HttpContext http) =>
            hub.GetWeeklyAsync(http.User.GetTelegramUserId(), http.User.GetTelegramUsername(), game)).WithName("GetWeeklyScores");

        puzzles.MapGet("/{game}/board", (string game, int? number, HubService hub, HttpContext http) =>
            hub.GetBoardAsync(http.User.GetTelegramUserId(), game, number)).WithName("GetPuzzleBoard");

        puzzles.MapGet("/{game}/archive", async (string game, int year, int month, HubService hub, HttpContext http) =>
        {
            if (month is < 1 or > 12 || year is < 2026 or > 2100) return Results.BadRequest();
            return Results.Ok(await hub.GetArchiveAsync(http.User.GetTelegramUserId(), game, year, month));
        }).WithName("GetPuzzleArchive");
    }
}

public sealed record SettingsDto(string Language, bool ReminderEnabled, string ReminderTime, bool HighContrast, bool Haptics);
public sealed record BadgeDto(string Key, bool Earned);
public sealed record SideStatsDto(int Games, int WinRate);
public sealed record MafiaProfileDto(int Rating, int GamesThisSeason, int Games, int WinRate, Role? BestRole, SideStatsDto AsTown, SideStatsDto AsMafia);
public sealed record PuzzleProfileDto(int Streak, int BestStreak, int Solved, int? BestZipMs, int StreakFreezes);
public sealed record ProfileDto(
    string Name, int Level, int XpIntoLevel, int XpForNext, int Xp, string Division, int Tier,
    MafiaProfileDto Mafia, PuzzleProfileDto Puzzles, IReadOnlyList<BadgeDto> Badges, SettingsDto Settings);
public sealed record MyGameResultDto(bool Won, int Rating, int RatingDelta);

public sealed record DailyStatusDto(string Game, int Number, bool Played, bool Solved, int? TimeMs, int? Moves);
public sealed record LeagueSummaryDto(int Season, int DaysLeft, string Division, int Tier, int? Rank, int PlayerCount, string? Zone);
public sealed record HomeDto(int Streak, string Date, IReadOnlyList<DailyStatusDto> Daily, int? MergeBest, LeagueSummaryDto League, TableDto? Table);

public sealed record QualificationDto(int Played, int Needed);
public sealed record LeagueYouDto(int? Rank, int Score, int Third, string? Zone);
public sealed record LeagueRowDto(int Rank, string Name, bool IsYou, int Score, int Delta, int Games, int WinRateOrStreak, string Zone);
public sealed record LeagueDto(string Board, int Season, int DaysLeft, string Division, int Tier, int PlayerCount, LeagueYouDto You, QualificationDto Qualification, IReadOnlyList<LeagueRowDto> Rows);

public sealed record PuzzleSubmitRequest(string Game, string Mode, int? PuzzleNumber, bool Solved, int? TimeMs, int? Score, int? Moves, int? Detail, int Hints);
public sealed record PuzzleResultDto(
    int XpGained, int Points, int Xp, int Level, int XpIntoLevel, int XpForNext, int LevelBefore, int XpIntoLevelBefore,
    int Streak, bool StreakExtended, bool NewBest, bool CountedAsDaily, int? PuzzleNumber, int? Percentile);
public sealed record GameStatsDto(
    string Game, int Played, int Solved, int WinRate, int? BestTimeMs, int? AverageTimeMs, int? BestScore, int? AverageScore,
    int? BestMoves, double AverageMoves, int? MaxDetail, int SumDetail, int DailyStreak, int WinStreak, int? TodayNumber,
    DailyStatusDto? Today, IReadOnlyDictionary<string, int> WinsByMode, IReadOnlyDictionary<string, int> BestTimeByMode,
    IReadOnlyDictionary<int, int> SolvedByMoves, IReadOnlyDictionary<int, int> SolvedByDetail);
public sealed record BoardRowDto(int? Rank, string Name, bool IsYou, bool Solved, int? TimeMs, int? Score, int? Moves);
public sealed record BoardDto(string Game, int? Number, int SolvedCount, IReadOnlyList<BoardRowDto> Rows);
public sealed record WeeklyRowDto(int Rank, string Name, bool IsYou, int Score);
public sealed record WeeklyDto(string Game, string Division, int Tier, int DaysLeft, int? YourRank, IReadOnlyList<WeeklyRowDto> Rows);
public sealed record ArchiveDayDto(int Day, int? Number, string Status, int? TimeMs);
public sealed record ArchiveDto(string Game, int Year, int Month, int FirstWeekday, IReadOnlyList<ArchiveDayDto> Days);
