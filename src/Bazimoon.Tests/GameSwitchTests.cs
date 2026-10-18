using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bazimoon.Api.Admin;
using Bazimoon.Api.Lounge;
using Bazimoon.Infrastructure.Hub;

namespace Bazimoon.Tests;

public class GameSwitchTests : IClassFixture<BazimoonApiFactory>, IAsyncLifetime
{
    private readonly BazimoonApiFactory _factory;

    public GameSwitchTests(BazimoonApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private async Task<HttpClient> AdminAsync()
    {
        var client = _factory.CreateClient();
        (await client.PostAsJsonAsync("/api/admin/auth/login", new LoginRequest(BazimoonApiFactory.AdminUsername, BazimoonApiFactory.AdminPassword))).EnsureSuccessStatusCode();
        var csrf = await client.GetFromJsonAsync<JsonElement>("/api/admin/auth/csrf");
        client.DefaultRequestHeaders.Add("X-CSRF-Token", csrf.GetProperty("token").GetString());
        return client;
    }

    private static async Task<HttpResponseMessage> SaveDisabledAsync(HttpClient admin, params string[] games)
    {
        var current = await admin.GetFromJsonAsync<JsonElement>("/api/admin/settings");
        var body = JsonSerializer.Deserialize<Dictionary<string, object?>>(current.GetRawText())!;
        body["disabledGames"] = games;
        return await admin.PutAsJsonAsync("/api/admin/settings", body);
    }

    [Fact]
    public async Task SwitchedOffGames_AreReportedToTheApp_AndBlockNewMafiaTables()
    {
        var player = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 893001, "switcher");
        var admin = await AdminAsync();

        Assert.Empty((await player.GetFromJsonAsync<AppConfigDto>("/api/hub/config"))!.DisabledGames);

        Assert.Equal(HttpStatusCode.BadRequest, (await SaveDisabledAsync(admin, "chess")).StatusCode);
        (await SaveDisabledAsync(admin, "mafia", "nard")).EnsureSuccessStatusCode();

        var config = await player.GetFromJsonAsync<AppConfigDto>("/api/hub/config");
        Assert.Equal(["mafia", "nard"], config!.DisabledGames.Order().ToArray());

        // No new tables while Mafia is off, from the bot or the app.
        var refused = await player.PostAsJsonAsync("/api/games", new { telegramChatId = -893001 });
        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Contains("switched off", await refused.Content.ReadAsStringAsync());

        // A switched-off solo game can still be finished and recorded.
        (await player.PostAsJsonAsync("/api/puzzles/results", new PuzzleSubmitRequest("nard", "classic", null, true, null, null, null, 1, 0))).EnsureSuccessStatusCode();

        (await SaveDisabledAsync(admin)).EnsureSuccessStatusCode();
        (await player.PostAsJsonAsync("/api/games", new { telegramChatId = -893001 })).EnsureSuccessStatusCode();
    }

    [Theory]
    [InlineData("daily", 0, 30)]
    [InlineData("daily", 2, 20)]
    [InlineData("easy", 0, 15)]
    [InlineData("expert", 1, 35)]
    public void SudokuXp_FollowsTheResultScreen(string mode, int hints, int xp)
    {
        var outcome = new Progression.PuzzleOutcome("sudoku", mode, true, 400_000, null, null, null, hints);
        Assert.Equal(xp, Progression.SoloXp(outcome, 1, false));
        Assert.True(Progression.StreakGames.Contains("sudoku"));
    }

    [Theory]
    [InlineData(12, false, 15)]
    [InlineData(40, true, 50)]
    [InlineData(400, true, 150)]
    public void SnakeXp_IsAPointEachPlusABonus(int score, bool newBest, int xp)
    {
        var outcome = new Progression.PuzzleOutcome("snake", "classic", true, null, score, null, null, 0);
        Assert.Equal(xp, Progression.SoloXp(outcome, 1, newBest));
        Assert.False(Progression.StreakGames.Contains("snake"));
        Assert.Equal(1, Progression.DailyNumber("snake", Progression.PuzzleDay(new DateTimeOffset(2026, 10, 15, 12, 0, 0, TimeSpan.Zero))));
    }

    [Theory]
    [InlineData("easy", true, 20)]
    [InlineData("smart", true, 40)]
    [InlineData("big", true, 50)]
    [InlineData("smart", false, 5)]
    public void DoozXp_ByOpponent(string mode, bool won, int xp)
    {
        var outcome = new Progression.PuzzleOutcome("dooz", mode, won, null, 3, 0, 1, 0);
        Assert.Equal(xp, Progression.SoloXp(outcome, 1, false));
    }

    [Fact]
    public async Task NewGames_CanBeSwitchedOffAndRecorded()
    {
        var admin = await AdminAsync();
        var player = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 893005, "snaker");
        (await SaveDisabledAsync(admin, "spy", "esmfamil")).EnsureSuccessStatusCode();
        var config = await player.GetFromJsonAsync<AppConfigDto>("/api/hub/config");
        Assert.Equal(["esmfamil", "spy"], config!.DisabledGames.Order().ToArray());
        (await player.PostAsJsonAsync("/api/puzzles/results", new PuzzleSubmitRequest("snake", "daily", null, true, null, 14, 12, 15, 0))).EnsureSuccessStatusCode();
        (await player.PostAsJsonAsync("/api/puzzles/results", new PuzzleSubmitRequest("dooz", "smart", null, true, null, 3, 1, 2, 0))).EnsureSuccessStatusCode();
        (await SaveDisabledAsync(admin)).EnsureSuccessStatusCode();
    }
}

public class BotSettingsParsingTests
{
    [Theory]
    [InlineData("")]
    [InlineData("not json")]
    public void DamagedJsonColumns_FallBackInsteadOfThrowing(string value)
    {
        var row = new Bazimoon.Infrastructure.Admin.BotSettingsRecord { DisabledGamesJson = value, EnabledCommandsJson = value };
        var snapshot = Bazimoon.Infrastructure.Admin.BotSettingsService.ToSnapshot(row);
        Assert.Empty(snapshot.DisabledGames!);
        Assert.True(snapshot.IsGameOn("mafia"));
        // Unreadable commands fall back to the defaults rather than switching every command off.
        Assert.Contains("newgame", snapshot.EnabledCommands);
    }
}
