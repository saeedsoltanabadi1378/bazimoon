using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Bazimoon.Api.Admin;
using Bazimoon.Api.Lounge;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Identity;

namespace Bazimoon.Tests;

public class AdminInsightsTests : IClassFixture<BazimoonApiFactory>, IAsyncLifetime
{
    private readonly BazimoonApiFactory _factory;

    public AdminInsightsTests(BazimoonApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private async Task<HttpClient> AdminAsync()
    {
        var client = _factory.CreateClient();
        (await client.PostAsJsonAsync("/api/admin/auth/login", new LoginRequest(BazimoonApiFactory.AdminUsername, BazimoonApiFactory.AdminPassword))).EnsureSuccessStatusCode();
        return client;
    }

    [Fact]
    public async Task GameStats_ShowOneGamesPlaysModesLevelsFunnelAndPlayers()
    {
        var player = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 880001, "statsplayer");
        (await player.PostAsJsonAsync("/api/events", new { name = "puzzle_intro_viewed", flow = "puzzle", properties = new { game = "queens" } })).EnsureSuccessStatusCode();
        (await player.PostAsJsonAsync("/api/events", new { name = "screen_viewed", flow = "navigation", properties = new { screen = "game_queens_play", previousScreen = "game_queens_intro", timeOnPreviousMs = 3000 } })).EnsureSuccessStatusCode();
        (await player.PostAsJsonAsync("/api/puzzles/results", new PuzzleSubmitRequest("queens", "level", 1, true, 30_000, null, null, null, 0))).EnsureSuccessStatusCode();

        var admin = await AdminAsync();
        var stats = await admin.GetFromJsonAsync<AdminGameStatsDto>("/api/admin/game-stats/queens?days=7");
        Assert.Equal("queens", stats!.Game);
        Assert.True(stats.Enabled);
        Assert.Equal(7, stats.Daily.Count);
        Assert.True(stats.Totals.PlaysInRange >= 1 && stats.Totals.PlayersToday >= 1);
        Assert.Contains(stats.Modes, m => m.Mode == "level" && m.Solved >= 1);
        var track = Assert.Single(stats.Levels, l => l.Track == "level");
        Assert.True(track.Players >= 1 && track.TopLevel >= 1);
        Assert.Equal("puzzle_intro_viewed", stats.Funnel[0].Name);
        Assert.True(stats.Funnel[0].Users >= 1 && stats.Funnel[2].Users >= 1);
        Assert.Contains(stats.Screens, s => s.Screen == "game_queens_play" && s.Views >= 1);
        Assert.Contains(stats.Screens, s => s.Screen == "game_queens_intro" && s.MedianDwellMs == 3000);
        Assert.Contains(stats.TopPlayers, p => p.Name == "statsplayer" && p.Wins >= 1);
        Assert.Contains(stats.Recent, r => r.Name == "statsplayer" && r.Mode == "level" && r.TimeMs == 30_000);
        Assert.Null(stats.Mafia);

        var mafia = await admin.GetFromJsonAsync<AdminGameStatsDto>("/api/admin/game-stats/mafia");
        Assert.NotNull(mafia!.Mafia);
        Assert.Equal(3, mafia.Funnel.Count);
        var couple = await admin.GetFromJsonAsync<AdminGameStatsDto>("/api/admin/game-stats/couple");
        Assert.NotNull(couple!.Couple);
        var shelem = await admin.GetFromJsonAsync<AdminGameStatsDto>("/api/admin/game-stats/shelem");
        Assert.NotNull(shelem!.Rooms);

        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync("/api/admin/game-stats/chess")).StatusCode);
    }

    [Fact]
    public async Task Interactions_SummariseFlowsScreensSessionsAndActivePlayers()
    {
        var player = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 880002, "interactor");
        (await player.PostAsJsonAsync("/api/events", new { name = "screen_viewed", flow = "navigation", properties = new { screen = "home" } })).EnsureSuccessStatusCode();
        (await player.PostAsJsonAsync("/api/events", new { name = "screen_viewed", flow = "navigation", properties = new { screen = "friends", previousScreen = "home", timeOnPreviousMs = 1500 } })).EnsureSuccessStatusCode();

        var admin = await AdminAsync();
        var summary = await admin.GetFromJsonAsync<AdminInteractionsDto>("/api/admin/interactions?days=7");
        Assert.True(summary!.Events >= 3 && summary.Users >= 1 && summary.Sessions >= 1);
        Assert.Equal(7 * 24, summary.Heatmap.Count);
        Assert.Equal(summary.Events, summary.Heatmap.Sum());
        Assert.Contains(summary.Flows, f => f.Flow == "navigation" && f.Events >= 2);
        Assert.Contains(summary.Screens, s => s.Screen == "home" && s.MedianDwellMs == 1500);
        Assert.Contains(summary.TopUsers, u => u.Name == "interactor" && u.Screens == 2 && !u.Registered);
        Assert.True(summary.GuestSignUps >= 1);

        var id = AuthTestHelper.UserIdOf(_factory, 880002);
        var journey = await admin.GetFromJsonAsync<AdminPageDto<AdminActivityFeedItemDto>>($"/api/admin/activity?userId={id}&pageSize=200");
        Assert.True(journey!.Items.Count >= 3);
        Assert.All(journey.Items, e => Assert.Equal(id, e.UserId));
        var viewsOnly = await admin.GetFromJsonAsync<AdminPageDto<AdminActivityFeedItemDto>>($"/api/admin/activity?userId={id}&name=screen_viewed");
        Assert.Equal(2, viewsOnly!.Items.Count);
    }

    [Fact]
    public async Task RegisteredPlayers_HaveTheirOwnTabWithEmailAndSummary()
    {
        var guest = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 880003, "plainguest");
        var member = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 880004, "signedmember");
        (await guest.GetAsync("/api/me/profile")).EnsureSuccessStatusCode();
        (await member.GetAsync("/api/me/profile")).EnsureSuccessStatusCode();
        (await member.PostAsJsonAsync("/api/puzzles/results", new PuzzleSubmitRequest("zip", "level", 1, true, 40_000, null, null, null, 0))).EnsureSuccessStatusCode();
        var memberId = AuthTestHelper.UserIdOf(_factory, 880004);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BazimoonDbContext>();
            var user = await db.Users.SingleAsync(u => u.Id == memberId);
            user.IsGuest = false;
            db.UserIdentities.Add(new UserIdentityRecord { UserId = memberId, Provider = IdentityProviders.Google, ProviderUserId = "g-880004", Email = "member@example.test" });
            await db.SaveChangesAsync();
        }

        var admin = await AdminAsync();
        var registered = await admin.GetFromJsonAsync<AdminPageDto<AdminPlayerRowDto>>("/api/admin/players?segment=registered&pageSize=100");
        var row = Assert.Single(registered!.Items, p => p.Id == memberId);
        Assert.False(row.IsGuest);
        Assert.Equal("member@example.test", row.Email);
        Assert.Equal("google", row.Provider);
        Assert.NotNull(row.RegisteredAt);
        Assert.DoesNotContain(registered.Items, p => p.Name == "plainguest");
        Assert.All(registered.Items, p => Assert.False(p.IsGuest));
        Assert.NotNull(registered.Counts);
        Assert.True(registered.Counts!.Registered >= 1 && registered.Counts.Players > registered.Counts.Registered);

        var byEmail = await admin.GetFromJsonAsync<AdminPageDto<AdminPlayerRowDto>>("/api/admin/players?segment=registered&search=member@example");
        Assert.Single(byEmail!.Items);

        var detail = await admin.GetFromJsonAsync<AdminPlayerDetailDto>($"/api/admin/players/{memberId}");
        Assert.False(detail!.Account!.IsGuest);
        Assert.Equal("member@example.test", detail.Account.Email);

        var summary = await admin.GetFromJsonAsync<AdminRegisteredSummaryDto>("/api/admin/players/registered-summary?days=7");
        Assert.True(summary!.Registered >= 1 && summary.Guests >= 1 && summary.RegisteredInRange >= 1);
        Assert.Equal(7, summary.Daily.Count);
        Assert.Contains(summary.Providers, p => p.Key == "google" && p.Count >= 1);
    }
}
