using System.Net;
using System.Net.Http.Json;
using Nightfall.Api.Games;
using Nightfall.Api.Lounge;

namespace Nightfall.Tests;

public class TableEndpointsTests : IClassFixture<NightfallApiFactory>, IAsyncLifetime
{
    private readonly NightfallApiFactory _factory;

    public TableEndpointsTests(NightfallApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task PublicTable_NeedsNoGroup_IsListedForEveryone_AndJoinableByCode()
    {
        var host = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 890001, "host1");
        var outsider = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 890002, "outsider1");

        var response = await host.PostAsJsonAsync("/api/tables", new CreateTableRequest("Friday night table", true, 6));
        response.EnsureSuccessStatusCode();
        var gameId = (await response.Content.ReadFromJsonAsync<CreateGameResponse>())!.GameId;
        Assert.DoesNotContain(_factory.Notifier.Sent, m => m.StartParam == gameId.ToString());

        var open = await outsider.GetFromJsonAsync<List<TableDto>>("/api/tables?scope=open");
        var row = Assert.Single(open!, t => t.GameId == gameId);
        Assert.Equal("Friday night table", row.Name);
        Assert.Null(row.ChatTitle);
        Assert.Equal("host1", row.Host);
        Assert.True(row.IsOpen);
        Assert.Equal(6, row.MaxPlayers);
        Assert.False(row.YouAreSeated);

        var hostInfo = await host.GetFromJsonAsync<TableInfoDto>($"/api/tables/{gameId}");
        Assert.True(hostInfo!.IsHost);
        Assert.Equal(6, hostInfo.InviteCode!.Length);
        var outsiderInfo = await outsider.GetFromJsonAsync<TableInfoDto>($"/api/tables/{gameId}");
        Assert.False(outsiderInfo!.IsHost);
        Assert.Null(outsiderInfo.InviteCode);

        foreach (var input in new[] { hostInfo.InviteCode, $"t_{hostInfo.InviteCode.ToLowerInvariant()}", $"https://t.me/NightfallBot/app?startapp=t_{hostInfo.InviteCode}" })
        {
            var resolved = await outsider.GetFromJsonAsync<CreateGameResponse>($"/api/tables/code/{Uri.EscapeDataString(input)}");
            Assert.Equal(gameId, resolved!.GameId);
        }
        Assert.Equal(HttpStatusCode.NotFound, (await outsider.GetAsync("/api/tables/code/ZZZZZZ")).StatusCode);

        Assert.DoesNotContain(await outsider.GetFromJsonAsync<List<TableDto>>("/api/tables?scope=mine") ?? [], t => t.GameId == gameId);
        (await outsider.PostAsync($"/api/games/{gameId}/players", null)).EnsureSuccessStatusCode();
        open = await outsider.GetFromJsonAsync<List<TableDto>>("/api/tables?scope=open");
        Assert.True(open!.Single(t => t.GameId == gameId).YouAreSeated);
        Assert.Contains(await outsider.GetFromJsonAsync<List<TableDto>>("/api/tables?scope=mine") ?? [], t => t.GameId == gameId);
    }

    [Fact]
    public async Task PrivateTable_StaysOffThePublicList_UntilTheHostMakesItPublic()
    {
        var host = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 890011, "host2");
        var other = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 890012, "other2");

        var gameId = (await (await host.PostAsJsonAsync("/api/tables", new CreateTableRequest(null, false, null)))
            .Content.ReadFromJsonAsync<CreateGameResponse>())!.GameId;

        Assert.DoesNotContain(await other.GetFromJsonAsync<List<TableDto>>("/api/tables?scope=open") ?? [], t => t.GameId == gameId);
        var mine = await host.GetFromJsonAsync<List<TableDto>>("/api/tables?scope=mine");
        Assert.Contains(mine!, t => t.GameId == gameId && !t.IsOpen && t.YouAreSeated);

        // The invite code still lets anyone in.
        var code = (await host.GetFromJsonAsync<TableInfoDto>($"/api/tables/{gameId}"))!.InviteCode!;
        Assert.Equal(gameId, (await other.GetFromJsonAsync<CreateGameResponse>($"/api/tables/code/{code}"))!.GameId);

        Assert.Equal(HttpStatusCode.Forbidden, (await other.PutAsJsonAsync($"/api/tables/{gameId}/open", new SetTableOpenRequest(true))).StatusCode);
        var info = await (await host.PutAsJsonAsync($"/api/tables/{gameId}/open", new SetTableOpenRequest(true))).Content.ReadFromJsonAsync<TableInfoDto>();
        Assert.True(info!.IsOpen);
        Assert.Contains(await other.GetFromJsonAsync<List<TableDto>>("/api/tables?scope=open") ?? [], t => t.GameId == gameId);

        // A host can run more than one table; none is tied to a group.
        Assert.Equal(HttpStatusCode.OK, (await host.PostAsJsonAsync("/api/tables", new CreateTableRequest(null, true, null))).StatusCode);
    }
}
