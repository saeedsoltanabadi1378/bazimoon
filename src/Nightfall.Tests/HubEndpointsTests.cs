using System.Net;
using System.Net.Http.Json;
using Nightfall.Api.Games;
using Nightfall.Api.Lounge;
using Nightfall.Domain;

namespace Nightfall.Tests;

public class HubEndpointsTests : IClassFixture<NightfallApiFactory>, IAsyncLifetime
{
    private readonly NightfallApiFactory _factory;

    public HubEndpointsTests(NightfallApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task DailyPuzzle_CountsOnce_AwardsXp_AndStartsStreak()
    {
        var client = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 880001, "solver");
        var first = await (await client.PostAsJsonAsync("/api/puzzles/results",
            new PuzzleSubmitRequest("zip", "daily", null, true, 42_000, null, null, null, 0))).Content.ReadFromJsonAsync<PuzzleResultDto>();
        Assert.True(first!.CountedAsDaily);
        Assert.Equal(1, first.Streak);
        Assert.Equal(20, first.XpGained);

        var replay = await (await client.PostAsJsonAsync("/api/puzzles/results",
            new PuzzleSubmitRequest("zip", "daily", null, true, 30_000, null, null, null, 0))).Content.ReadFromJsonAsync<PuzzleResultDto>();
        Assert.False(replay!.CountedAsDaily);

        var stats = await client.GetFromJsonAsync<GameStatsDto>("/api/puzzles/zip/stats");
        Assert.Equal(2, stats!.Played);
        Assert.Equal(30_000, stats.BestTimeMs);
        Assert.Equal(1, stats.DailyStreak);

        var profile = await client.GetFromJsonAsync<ProfileDto>("/api/me/profile");
        Assert.Equal(1, profile!.Puzzles.Streak);
        Assert.Equal(first.XpGained + replay.XpGained, profile.Xp);

        var board = await client.GetFromJsonAsync<BoardDto>("/api/puzzles/zip/board");
        var row = Assert.Single(board!.Rows);
        Assert.True(row.IsYou);
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
        var created = await (await clients[0].PostAsJsonAsync("/api/games", new CreateGameRequest(42900))).Content.ReadFromJsonAsync<CreateGameResponse>();
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
        Assert.Equal(4, home!.Daily.Count);
        Assert.Null(home.Table); // the finished game is no longer an open table
    }
}
