using System.Net.Http.Json;
using Bazimoon.Api.Lounge;
using Bazimoon.Infrastructure.Hub;

namespace Bazimoon.Tests;

public class BricksRulesTests
{
    [Theory]
    [InlineData("endless", true, 4200, 0, false, 42)]
    [InlineData("endless", true, 4200, 0, true, 52)]
    [InlineData("endless", true, 40_000, 0, false, 150)]
    [InlineData("adventure", true, 900, 3, false, 25)]
    [InlineData("adventure", false, 300, 0, false, 5)]
    [InlineData("challenge", true, 9600, 2, false, 20)]
    [InlineData("challenge-solo", true, 9600, 1, false, 15)]
    public void BricksXp_FollowsTheGameScreens(string mode, bool solved, int score, int detail, bool newBest, int xp)
    {
        var outcome = new Progression.PuzzleOutcome("bricks", mode, solved, null, score, 5, detail, 0);
        Assert.Equal(xp, Progression.SoloXp(outcome, 1, newBest));
    }

    [Fact]
    public void Bricks_IsAGameWithADailySeriesAndThreeTries()
    {
        Assert.Contains("bricks", Progression.Games);
        Assert.False(Progression.StreakGames.Contains("bricks"));
        Assert.Equal(1, Progression.DailyNumber("bricks", Progression.PuzzleDay(new DateTimeOffset(2026, 11, 18, 12, 0, 0, TimeSpan.Zero))));
        Assert.Equal(3, Progression.DailyTries("bricks"));
        Assert.Equal(1, Progression.DailyTries("blocks"));
    }
}

public class BricksBoardTests : IClassFixture<BazimoonApiFactory>, IAsyncLifetime
{
    private readonly BazimoonApiFactory _factory;

    public BricksBoardTests(BazimoonApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private static Task<HttpResponseMessage> Submit(HttpClient client, string mode, int? number, bool solved, int score, int moves, int detail) =>
        client.PostAsJsonAsync("/api/puzzles/results", new PuzzleSubmitRequest("bricks", mode, number, solved, null, score, moves, detail, 0));

    [Fact]
    public async Task DailyTries_CountThreeTimes_AndTheBoardKeepsEachPlayersBest()
    {
        var player = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 894001, "bricker");
        var counted = new List<bool>();
        foreach (var score in new[] { 1200, 3400, 2100, 5000 })
        {
            var res = await Submit(player, "daily", null, true, score, 6, 8);
            res.EnsureSuccessStatusCode();
            counted.Add((await res.Content.ReadFromJsonAsync<PuzzleResultDto>())!.CountedAsDaily);
        }
        Assert.Equal([true, true, true, false], counted);

        var board = await player.GetFromJsonAsync<BoardDto>("/api/puzzles/bricks/board");
        var mine = Assert.Single(board!.Rows, r => r.IsYou);
        Assert.Equal(3400, mine.Score);
    }

    [Fact]
    public async Task Challenges_HaveTheirOwnBoard_AndTheWeeklyLadderIsEndlessOnly()
    {
        var player = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 894002, "challenger");
        (await Submit(player, "challenge", 7, true, 9600, 4, 2)).EnsureSuccessStatusCode();
        (await Submit(player, "challenge", 7, true, 9800, 2, 3)).EnsureSuccessStatusCode();
        (await Submit(player, "adventure", 12, true, 99_000, 3, 3)).EnsureSuccessStatusCode();
        (await Submit(player, "endless", null, true, 4321, 30, 31)).EnsureSuccessStatusCode();

        var board = await player.GetFromJsonAsync<BoardDto>("/api/puzzles/bricks/board?number=7&mode=challenge");
        var mine = Assert.Single(board!.Rows, r => r.IsYou);
        Assert.Equal(2, mine.Moves);
        Assert.Equal(7, board.Number);

        var weekly = await player.GetFromJsonAsync<WeeklyDto>("/api/puzzles/bricks/weekly");
        Assert.Equal(4321, Assert.Single(weekly!.Rows, r => r.IsYou).Score);
    }
}
