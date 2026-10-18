using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bazimoon.Api.Admin;
using Bazimoon.Api.Lounge;

namespace Bazimoon.Tests;

public class AdminDashboardTests : IClassFixture<BazimoonApiFactory>, IAsyncLifetime
{
    private readonly BazimoonApiFactory _factory;

    public AdminDashboardTests(BazimoonApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private async Task<HttpClient> AdminAsync()
    {
        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/admin/auth/login", new LoginRequest(BazimoonApiFactory.AdminUsername, BazimoonApiFactory.AdminPassword));
        login.EnsureSuccessStatusCode();
        return client;
    }

    [Fact]
    public async Task AdminPages_NeedASignIn()
    {
        var anonymous = _factory.CreateClient();
        var response = await anonymous.GetAsync("/api/admin/overview");
        Assert.True(response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden or HttpStatusCode.Redirect, response.StatusCode.ToString());
    }

    [Fact]
    public async Task Dashboard_ReflectsPlayersPuzzlesAndLiveTables()
    {
        // A player solves today's Zip, and a group opens a Mafia lobby.
        var player = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 870001, "dashplayer");
        (await player.PostAsJsonAsync("/api/puzzles/results", new PuzzleSubmitRequest("zip", "daily", null, true, 50_000, null, null, null, 0))).EnsureSuccessStatusCode();
        (await player.PostAsJsonAsync("/api/tables", new { name = "Dashboard crew", isOpen = false })).EnsureSuccessStatusCode();

        var admin = await AdminAsync();
        var overview = await admin.GetFromJsonAsync<AdminOverviewDto>("/api/admin/overview?days=7");
        Assert.Equal(7, overview!.RangeDays);
        Assert.Equal(7, overview.Activity.Count);
        Assert.True(overview.ActivePlayers >= 1);
        Assert.True(overview.DailySolves >= 1);
        Assert.Contains(overview.Live, g => g.Title == "Dashboard crew" && g.Phase == "Lobby");
        Assert.Contains(overview.Services, s => s.Key == "database" && s.Status == "healthy");

        var players = await admin.GetFromJsonAsync<AdminPageDto<AdminPlayerRowDto>>("/api/admin/players?search=dashplayer");
        var row = Assert.Single(players!.Items);
        var detail = await admin.GetFromJsonAsync<AdminPlayerDetailDto>($"/api/admin/players/{row.Id}");
        Assert.Equal(1, detail!.PuzzlesSolved);
        Assert.Equal("none", detail.Couple.Status);

        var puzzles = await admin.GetFromJsonAsync<AdminPuzzlesDto>("/api/admin/puzzles");
        var zip = Assert.Single(puzzles!.Dailies, d => d.Game == "zip");
        Assert.True(zip.Players >= 1 && zip.Solved >= 1);
        Assert.Equal(5, puzzles.Divisions.Count);

        var events = await admin.GetFromJsonAsync<AdminEventsDto>("/api/admin/events?level=info&pageSize=5");
        Assert.Contains(events!.Items, e => e.Message == "Game created");
        Assert.All(events.Items, e => Assert.Equal("info", e.Level));

        var live = await admin.GetFromJsonAsync<JsonElement>("/api/admin/games?status=active");
        Assert.True(live.GetProperty("total").GetInt32() >= 1);
    }
}
