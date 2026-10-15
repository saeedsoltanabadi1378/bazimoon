using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Nightfall.Api.Admin;
using Nightfall.Api.Lounge;
using Nightfall.Infrastructure.Hub;

namespace Nightfall.Tests;

public class GameSwitchTests : IClassFixture<NightfallApiFactory>, IAsyncLifetime
{
    private readonly NightfallApiFactory _factory;

    public GameSwitchTests(NightfallApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private async Task<HttpClient> AdminAsync()
    {
        var client = _factory.CreateClient();
        (await client.PostAsJsonAsync("/api/admin/auth/login", new LoginRequest(NightfallApiFactory.AdminUsername, NightfallApiFactory.AdminPassword))).EnsureSuccessStatusCode();
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
}
