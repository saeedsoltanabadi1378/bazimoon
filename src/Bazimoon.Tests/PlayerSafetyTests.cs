using System.Net;
using System.Net.Http.Json;
using Bazimoon.Api.Games;

namespace Bazimoon.Tests;

public sealed class PlayerSafetyTests : IClassFixture<BazimoonApiFactory>, IAsyncLifetime
{
    private readonly BazimoonApiFactory _factory;

    public PlayerSafetyTests(BazimoonApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Block_IsPrivateAndPreventsFutureSharedLobby()
    {
        var host = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 970001, "host970001");
        var guest = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 970002, "guest970002");
        var gameId = (await (await host.PostAsync("/api/games", null)).Content.ReadFromJsonAsync<CreateGameResponse>())!.GameId;
        (await guest.PostAsync($"/api/games/{gameId}/players", null)).EnsureSuccessStatusCode();
        var view = await host.GetFromJsonAsync<GameView>($"/api/games/{gameId}");
        var target = Assert.Single(view!.Players, player => player.DisplayName == "guest970002");

        var blocked = await (await host.PostAsync($"/api/games/{gameId}/players/{target.PlayerId}/block", null))
            .Content.ReadFromJsonAsync<PlayerSafetyTargetDto>();
        Assert.Equal(target.PlayerId, blocked!.PlayerId);
        var mine = await host.GetFromJsonAsync<PlayerSafetyDto>($"/api/games/{gameId}/safety");
        Assert.Contains(target.PlayerId, mine!.BlockedPlayerIds);

        var next = (await (await host.PostAsync("/api/games", null)).Content.ReadFromJsonAsync<CreateGameResponse>())!.GameId;
        var refused = await guest.PostAsync($"/api/games/{next}/players", null);
        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
        var problem = await refused.Content.ReadFromJsonAsync<Dictionary<string, object>>();
        Assert.Equal("blocked_player_at_table", problem!["code"].ToString());
    }

    [Fact]
    public async Task Report_IsLimitedToOncePerPlayerAndGame()
    {
        var host = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 970011, "host970011");
        var guest = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 970012, "guest970012");
        var gameId = (await (await host.PostAsync("/api/games", null)).Content.ReadFromJsonAsync<CreateGameResponse>())!.GameId;
        (await guest.PostAsync($"/api/games/{gameId}/players", null)).EnsureSuccessStatusCode();
        var view = await host.GetFromJsonAsync<GameView>($"/api/games/{gameId}");
        var target = Assert.Single(view!.Players, player => player.DisplayName == "guest970012");

        var first = await host.PostAsJsonAsync($"/api/games/{gameId}/players/{target.PlayerId}/reports", new PlayerReportRequest("voice", "Repeated shouting"));
        first.EnsureSuccessStatusCode();
        var second = await host.PostAsJsonAsync($"/api/games/{gameId}/players/{target.PlayerId}/reports", new PlayerReportRequest("voice", null));
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        var problem = await second.Content.ReadFromJsonAsync<Dictionary<string, object>>();
        Assert.Equal("report_already_sent", problem!["code"].ToString());
    }
}
