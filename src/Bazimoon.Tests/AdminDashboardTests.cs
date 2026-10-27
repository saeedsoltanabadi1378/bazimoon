using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Bazimoon.Api.Admin;
using Bazimoon.Api.Auth;
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
        // A player solves Zip level 1, and a group opens a Mafia lobby.
        var player = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 870001, "dashplayer");
        (await player.PostAsJsonAsync("/api/puzzles/results", new PuzzleSubmitRequest("zip", "level", 1, true, 50_000, null, null, null, 0))).EnsureSuccessStatusCode();
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
        Assert.Equal("direct", row.Source);
        Assert.Equal("none", row.Medium);
        var detail = await admin.GetFromJsonAsync<AdminPlayerDetailDto>($"/api/admin/players/{row.Id}");
        Assert.Equal(1, detail!.PuzzlesSolved);
        Assert.Equal("none", detail.Couple.Status);
        Assert.Equal("direct", detail.Acquisition!.Source);

        var directPlayers = await admin.GetFromJsonAsync<AdminPageDto<AdminPlayerRowDto>>("/api/admin/players?source=direct");
        Assert.Contains(directPlayers!.Items, p => p.Id == row.Id);
        var acquisition = await admin.GetFromJsonAsync<AdminAcquisitionSummaryDto>("/api/admin/players/acquisition");
        Assert.Contains(acquisition!.Sources, s => s.Value == "direct" && s.Players >= 1);

        var puzzles = await admin.GetFromJsonAsync<AdminPuzzlesDto>("/api/admin/puzzles");
        var zip = Assert.Single(puzzles!.Levels, l => l.Game == "zip");
        Assert.True(zip.Players >= 1 && zip.SolvedToday >= 1 && zip.TopLevel >= 1);
        Assert.DoesNotContain(puzzles.Dailies, d => d.Game == "zip");
        Assert.Equal(5, puzzles.Divisions.Count);

        var events = await admin.GetFromJsonAsync<AdminEventsDto>("/api/admin/events?level=info&pageSize=5");
        Assert.Contains(events!.Items, e => e.Message == "Game created");
        Assert.All(events.Items, e => Assert.Equal("info", e.Level));

        var live = await admin.GetFromJsonAsync<JsonElement>("/api/admin/games?status=active");
        Assert.True(live.GetProperty("total").GetInt32() >= 1);
    }

    [Fact]
    public async Task PlayerActivity_CombinesGamesPuzzlesAndAdminAudit_AndFiltersByKind()
    {
        var player = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 870003, "activityplayer");
        (await player.PostAsJsonAsync("/api/puzzles/results", new PuzzleSubmitRequest("zip", "level", 1, true, 40_000, null, null, null, 0))).EnsureSuccessStatusCode();

        var client = _factory.CreateClient();
        (await client.PostAsJsonAsync("/api/admin/auth/login", new LoginRequest(BazimoonApiFactory.AdminUsername, BazimoonApiFactory.AdminPassword))).EnsureSuccessStatusCode();
        var csrf = await client.GetFromJsonAsync<JsonElement>("/api/admin/auth/csrf");
        client.DefaultRequestHeaders.Add("X-CSRF-Token", csrf.GetProperty("token").GetString());

        var players = await client.GetFromJsonAsync<AdminPageDto<AdminPlayerRowDto>>("/api/admin/players?search=activityplayer");
        var id = Assert.Single(players!.Items).Id;
        (await client.PutAsJsonAsync($"/api/admin/players/{id}/bot", new BotRequest(true))).EnsureSuccessStatusCode();

        var all = await client.GetFromJsonAsync<AdminPageDto<AdminActivityItemDto>>($"/api/admin/players/{id}/activity");
        Assert.Contains(all!.Items, a => a.Kind == "puzzle");
        Assert.Contains(all.Items, a => a.Kind == "admin" && a.Message == "Player marked as a bot" && a.Actor == "admin");

        var puzzleOnly = await client.GetFromJsonAsync<AdminPageDto<AdminActivityItemDto>>($"/api/admin/players/{id}/activity?kind=puzzle");
        Assert.All(puzzleOnly!.Items, a => Assert.Equal("puzzle", a.Kind));
        Assert.DoesNotContain(puzzleOnly.Items, a => a.Kind == "admin");
    }

    [Fact]
    public async Task Players_CanBeReportedAndFilteredByAcquisitionSourceAndCampaign()
    {
        var player = _factory.CreateClient();
        var authResponse = await player.PostAsJsonAsync("/api/auth/guest", new GuestAuthRequest("utmplayer",
            Attribution: new AttributionRequest("chatgpt", "ai_referral", "autumn-launch", LandingPath: "/games")));
        authResponse.EnsureSuccessStatusCode();
        var session = await authResponse.Content.ReadFromJsonAsync<AuthSessionResponse>();
        player.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session!.AccessToken);
        (await player.PostAsJsonAsync("/api/puzzles/results", new PuzzleSubmitRequest("zip", "level", 1, true, 45_000, null, null, null, 0))).EnsureSuccessStatusCode();

        var admin = await AdminAsync();
        var filtered = await admin.GetFromJsonAsync<AdminPageDto<AdminPlayerRowDto>>(
            "/api/admin/players?source=chatgpt&campaign=autumn-launch");
        var row = Assert.Single(filtered!.Items, p => p.Id == session.User.Id);
        Assert.Equal("ai_referral", row.Medium);
        Assert.Equal("autumn-launch", row.Campaign);

        var detail = await admin.GetFromJsonAsync<AdminPlayerDetailDto>($"/api/admin/players/{session.User.Id}");
        Assert.Equal("/games", detail!.Acquisition!.LandingPath);
        var summary = await admin.GetFromJsonAsync<AdminAcquisitionSummaryDto>("/api/admin/players/acquisition");
        Assert.Contains(summary!.Sources, x => x.Value == "chatgpt" && x.Players >= 1);
        Assert.Contains(summary.Campaigns, x => x.Value == "autumn-launch" && x.Players >= 1);
    }

    [Fact]
    public async Task UserActivity_TracksFunnelStepsAndListsThemInTheFeed()
    {
        // Two players: one reaches every step of the puzzle funnel, one only views the intro.
        var finisher = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 870004, "funnelfinisher");
        (await finisher.PostAsJsonAsync("/api/events", new { name = "puzzle_intro_viewed", flow = "puzzle", properties = new { game = "zip" } })).EnsureSuccessStatusCode();
        (await finisher.PostAsJsonAsync("/api/events", new { name = "puzzle_started", flow = "puzzle", properties = new { game = "zip" } })).EnsureSuccessStatusCode();
        (await finisher.PostAsJsonAsync("/api/puzzles/results", new PuzzleSubmitRequest("zip", "level", 1, true, 40_000, null, null, null, 0))).EnsureSuccessStatusCode();

        var looker = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 870005, "funnellooker");
        (await looker.PostAsJsonAsync("/api/events", new { name = "puzzle_intro_viewed", flow = "puzzle", properties = new { game = "zip" } })).EnsureSuccessStatusCode();
        (await looker.PostAsJsonAsync("/api/events", new { name = "screen_viewed", flow = "navigation", properties = new { screen = "home", previousScreen = (string?)null } })).EnsureSuccessStatusCode();
        (await looker.PostAsJsonAsync("/api/events", new { name = "screen_left", flow = "navigation", properties = new { screen = "home", timeOnScreenMs = 4200 } })).EnsureSuccessStatusCode();

        var admin = await AdminAsync();
        var funnel = await admin.GetFromJsonAsync<AdminFunnelDto>("/api/admin/funnels/puzzle?days=7");
        Assert.Equal(3, funnel!.Steps.Count);
        Assert.Equal("puzzle_intro_viewed", funnel.Steps[0].Name);
        Assert.True(funnel.Steps[0].Users >= 2);
        Assert.True(funnel.Steps[2].Users >= 1);
        Assert.True(funnel.Steps[2].Users <= funnel.Steps[0].Users);
        Assert.Equal(100, funnel.Steps[0].PctOfFirst);

        var feed = await admin.GetFromJsonAsync<AdminPageDto<AdminActivityFeedItemDto>>("/api/admin/activity?flow=puzzle&pageSize=50");
        Assert.Contains(feed!.Items, e => e.Name == "puzzle_completed" && e.UserName == "funnelfinisher");
        Assert.All(feed.Items, e => Assert.Equal("puzzle", e.Flow));

        var navFeed = await admin.GetFromJsonAsync<AdminPageDto<AdminActivityFeedItemDto>>("/api/admin/activity?flow=navigation&pageSize=50");
        Assert.Contains(navFeed!.Items, e => e.Name == "screen_viewed" && e.PropertiesJson != null && e.PropertiesJson.Contains("home"));
        Assert.Contains(navFeed.Items, e => e.Name == "screen_left" && e.PropertiesJson != null && e.PropertiesJson.Contains("4200"));

        // An unknown event name is refused rather than silently accepted, even a real one from another flow.
        var rejected = await finisher.PostAsJsonAsync("/api/events", new { name = "made_up_event" });
        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        var alsoRejected = await finisher.PostAsJsonAsync("/api/events", new { name = "mafia_game_ended" });
        Assert.Equal(HttpStatusCode.BadRequest, alsoRejected.StatusCode);
    }

    [Fact]
    public async Task MafiaFunnel_CountsJoinedStartedAndEndedSeparately()
    {
        var host = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 870006, "funnelhost");
        var guest = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 870007, "funnelguest");
        var create = await host.PostAsJsonAsync("/api/tables", new { name = "Funnel table", isOpen = true });
        create.EnsureSuccessStatusCode();
        var gameId = (await create.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("gameId").GetGuid();
        (await guest.PostAsJsonAsync($"/api/games/{gameId}/players", new { })).EnsureSuccessStatusCode();

        var admin = await AdminAsync();
        var funnel = await admin.GetFromJsonAsync<AdminFunnelDto>("/api/admin/funnels/mafia?days=7");
        Assert.Equal(["mafia_lobby_joined", "mafia_game_started", "mafia_game_ended"], funnel!.Steps.Select(s => s.Name));
        Assert.True(funnel.Steps[0].Users >= 2);

        var feed = await admin.GetFromJsonAsync<AdminPageDto<AdminActivityFeedItemDto>>("/api/admin/activity?flow=mafia&pageSize=50");
        var joined = Assert.Single(feed!.Items, e => e.Name == "mafia_lobby_joined" && e.PropertiesJson != null && e.PropertiesJson.Contains("\"host\":true") && e.PropertiesJson.Contains(gameId.ToString()));
        Assert.Contains("\"seats\"", joined.PropertiesJson);
    }
}
