using System.Net;
using System.Net.Http.Json;
using Bazimoon.Api.Games;
using Bazimoon.Api.Lounge;
using Bazimoon.Domain;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Hub;
using Microsoft.Extensions.DependencyInjection;

namespace Bazimoon.Tests;

public class HubEndpointsTests : IClassFixture<BazimoonApiFactory>, IAsyncLifetime
{
    private readonly BazimoonApiFactory _factory;

    public HubEndpointsTests(BazimoonApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Levels_UnlockOneByOne_AwardXp_AndStartTheStreak()
    {
        var client = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 880001, "solver");
        var progress = await client.GetFromJsonAsync<LevelProgressDto>("/api/puzzles/zip/progress");
        Assert.Equal(1, progress!.Level);
        Assert.Null(progress.SavedState);

        var first = await (await client.PostAsJsonAsync("/api/puzzles/results",
            new PuzzleSubmitRequest("zip", "level", 1, true, 42_000, null, null, null, 0))).Content.ReadFromJsonAsync<PuzzleResultDto>();
        Assert.True(first!.CountedAsDaily);
        Assert.Equal(2, first.NextLevel);
        Assert.Equal(1, first.Streak);
        Assert.Equal(20, first.XpGained);

        // Level 2 the same day: no daily limit, and the streak stays at one day.
        var second = await (await client.PostAsJsonAsync("/api/puzzles/results",
            new PuzzleSubmitRequest("zip", "level", 2, true, 50_000, null, null, null, 0))).Content.ReadFromJsonAsync<PuzzleResultDto>();
        Assert.True(second!.CountedAsDaily);
        Assert.Equal(3, second.NextLevel);
        Assert.Equal(1, second.Streak);

        // A replay of level 1 is practice: less XP, no points, nothing unlocked.
        var replay = await (await client.PostAsJsonAsync("/api/puzzles/results",
            new PuzzleSubmitRequest("zip", "level", 1, true, 30_000, null, null, null, 0))).Content.ReadFromJsonAsync<PuzzleResultDto>();
        Assert.False(replay!.CountedAsDaily);
        Assert.Equal(3, replay.NextLevel);
        Assert.Equal(0, replay.Points);

        // Level 5 is still locked.
        var locked = await client.PostAsJsonAsync("/api/puzzles/results",
            new PuzzleSubmitRequest("zip", "level", 5, true, 30_000, null, null, null, 0));
        Assert.Equal(HttpStatusCode.BadRequest, locked.StatusCode);

        var stats = await client.GetFromJsonAsync<GameStatsDto>("/api/puzzles/zip/stats");
        Assert.Equal(3, stats!.Played);
        Assert.Equal(30_000, stats.BestTimeMs);
        Assert.Equal(1, stats.DailyStreak);

        var profile = await client.GetFromJsonAsync<ProfileDto>("/api/me/profile");
        Assert.Equal(1, profile!.Puzzles.Streak);
        Assert.Equal(first.XpGained + second.XpGained + replay.XpGained, profile.Xp);

        var home = await client.GetFromJsonAsync<HomeDto>("/api/hub/home");
        var zip = Assert.Single(home!.Levels, l => l.Game == "zip");
        Assert.Equal(3, zip.Level);
        Assert.Equal(2, zip.SolvedToday);
    }

    [Fact]
    public async Task LevelBoard_IsSavedOnTheServer_AndClearedOnFinish()
    {
        var client = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 880005, "saver");
        const string board = "{\"marks\":[0,1,2],\"ms\":12000}";
        var saved = await (await client.PutAsJsonAsync("/api/puzzles/queens/progress/state", new SaveLevelStateRequest(null, 1, board)))
            .Content.ReadFromJsonAsync<LevelProgressDto>();
        Assert.Equal(board, saved!.SavedState);

        // Another device picks it up.
        var progress = await client.GetFromJsonAsync<LevelProgressDto>("/api/puzzles/queens/progress");
        Assert.Equal(board, progress!.SavedState);
        var home = await client.GetFromJsonAsync<HomeDto>("/api/hub/home");
        Assert.True(Assert.Single(home!.Levels, l => l.Game == "queens").HasSave);

        // Only the current level has a server save, and boards are capped.
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/puzzles/queens/progress/state", new SaveLevelStateRequest(null, 2, board))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/puzzles/queens/progress/state", new SaveLevelStateRequest(null, 1, new string('x', 9000)))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/puzzles/mines/progress")).StatusCode);

        (await client.PostAsJsonAsync("/api/puzzles/results", new PuzzleSubmitRequest("queens", "level", 1, true, 60_000, null, null, null, 0))).EnsureSuccessStatusCode();
        progress = await client.GetFromJsonAsync<LevelProgressDto>("/api/puzzles/queens/progress");
        Assert.Equal(2, progress!.Level);
        Assert.Null(progress.SavedState);
    }

    [Fact]
    public async Task WordLevels_KeepEnglishAndPersianApart()
    {
        var client = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 880006, "bilingual");
        (await client.PostAsJsonAsync("/api/puzzles/results", new PuzzleSubmitRequest("word", "level-fa", 1, true, null, null, 3, null, 0))).EnsureSuccessStatusCode();
        Assert.Equal(2, (await client.GetFromJsonAsync<LevelProgressDto>("/api/puzzles/word/progress?track=level-fa"))!.Level);
        Assert.Equal(1, (await client.GetFromJsonAsync<LevelProgressDto>("/api/puzzles/word/progress"))!.Level);
    }

    [Fact]
    public async Task PlayersWithOldDailies_StartPastThem()
    {
        var client = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 880007, "veteran");
        var userId = AuthTestHelper.UserIdOf(_factory, 880007);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BazimoonDbContext>();
            foreach (var number in new[] { 140, 141, 141, 142 })
                db.PuzzleResults.Add(new PuzzleResultRecord { UserId = userId, Game = "sudoku", Mode = "daily", PuzzleNumber = number, Solved = true, Day = 280 });
            db.PuzzleResults.Add(new PuzzleResultRecord { UserId = userId, Game = "sudoku", Mode = "daily", PuzzleNumber = 143, Solved = false, Day = 281 });
            await db.SaveChangesAsync();
        }
        Assert.Equal(4, (await client.GetFromJsonAsync<LevelProgressDto>("/api/puzzles/sudoku/progress"))!.Level);

        // An older app still sending "daily" is kept as practice and unlocks nothing.
        var old = await (await client.PostAsJsonAsync("/api/puzzles/results", new PuzzleSubmitRequest("sudoku", "daily", null, true, 300_000, null, null, null, 0)))
            .Content.ReadFromJsonAsync<PuzzleResultDto>();
        Assert.False(old!.CountedAsDaily);
        Assert.Equal(4, (await client.GetFromJsonAsync<LevelProgressDto>("/api/puzzles/sudoku/progress"))!.Level);
    }

    [Fact]
    public async Task EndlessScores_FeedTheWeeklyLadder()
    {
        var client = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 880004, "merger");
        foreach (var score in new[] { 1200, 3400, 900 })
            (await client.PostAsJsonAsync("/api/puzzles/results", new PuzzleSubmitRequest("merge", "classic", null, true, null, score, 300, 256, 0))).EnsureSuccessStatusCode();
        var weekly = await client.GetFromJsonAsync<WeeklyDto>("/api/puzzles/merge/weekly");
        var me = Assert.Single(weekly!.Rows, r => r.IsYou);
        Assert.Equal(3400, me.Score);
        Assert.NotNull(weekly.YourRank);
    }

    [Fact]
    public async Task UnknownGame_IsRejected()
    {
        var client = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 880002, "solver2");
        var response = await client.PostAsJsonAsync("/api/puzzles/results",
            new PuzzleSubmitRequest("chess", "daily", null, true, 1000, null, null, null, 0));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Settings_RoundTrip()
    {
        var client = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 880003, "settings");
        var saved = await (await client.PutAsJsonAsync("/api/me/settings", new SettingsDto("fa", false, "21:30", true, false)))
            .Content.ReadFromJsonAsync<SettingsDto>();
        Assert.Equal(new SettingsDto("fa", false, "21:30", true, false), saved);
    }

    [Fact]
    public async Task FinishedMafiaGame_RatesPlayers_AndShowsOpenTablesInYourGroups()
    {
        var clients = new List<HttpClient>();
        for (int i = 0; i < 3; i++)
            clients.Add(await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 881000 + i, $"rated{i}"));
        var created = await (await clients[0].PostAsync("/api/games", null)).Content.ReadFromJsonAsync<CreateGameResponse>();
        var gameId = created!.GameId;

        var tables = await clients[0].GetFromJsonAsync<List<TableDto>>("/api/hub/tables");
        Assert.Contains(tables!, t => t.GameId == gameId && t.Phase == GamePhase.Lobby);

        foreach (var c in clients.Skip(1))
            (await c.PostAsync($"/api/games/{gameId}/players", null)).EnsureSuccessStatusCode();
        (await clients[0].PostAsync($"/api/games/{gameId}/start", null)).EnsureSuccessStatusCode();
        var views = new List<GameView>();
        foreach (var c in clients) views.Add((await c.GetFromJsonAsync<GameView>($"/api/games/{gameId}"))!);
        var godfather = views.Single(v => v.YourRole == Role.Godfather).YourPlayerId;
        (await clients[0].PostAsync($"/api/games/{gameId}/resolve-night", null)).EnsureSuccessStatusCode();
        (await clients[0].PostAsync($"/api/games/{gameId}/start-voting", null)).EnsureSuccessStatusCode();
        for (int i = 0; i < clients.Count; i++)
            if (views[i].YourPlayerId != godfather)
                (await clients[i].PostAsJsonAsync($"/api/games/{gameId}/votes", new SubmitVoteRequest(godfather))).EnsureSuccessStatusCode();
        (await clients[0].PostAsync($"/api/games/{gameId}/resolve-voting", null)).EnsureSuccessStatusCode();
        (await clients[views.FindIndex(v => v.YourPlayerId == godfather)].PostAsync($"/api/games/{gameId}/last-words/finish", null)).EnsureSuccessStatusCode();

        for (int i = 0; i < clients.Count; i++)
        {
            var mine = await clients[i].GetFromJsonAsync<MyGameResultDto>($"/api/me/games/{gameId}");
            bool town = views[i].YourPlayerId != godfather;
            Assert.Equal(town, mine!.Won);
            Assert.True(town ? mine.RatingDelta > 0 : mine.RatingDelta < 0);
        }

        var league = await clients[1].GetFromJsonAsync<LeagueDto>("/api/hub/league?board=mafia");
        Assert.Equal(1, league!.Qualification.Played);
        Assert.Null(league.You.Rank); // 15 games are needed to qualify.

        var home = await clients[1].GetFromJsonAsync<HomeDto>("/api/hub/home");
        Assert.Equal(5, home!.Levels.Count); // zip, queens, sudoku, word, ladder
        Assert.Null(home.Table); // the finished game is no longer an open table
    }
}
