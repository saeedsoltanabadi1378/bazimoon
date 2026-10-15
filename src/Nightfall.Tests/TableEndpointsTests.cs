using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Nightfall.Api.Games;
using Nightfall.Api.Lounge;
using Nightfall.Infrastructure.History;
using Nightfall.Infrastructure.Hub;

namespace Nightfall.Tests;

public class TableEndpointsTests : IClassFixture<NightfallApiFactory>, IAsyncLifetime
{
    private readonly NightfallApiFactory _factory;

    public TableEndpointsTests(NightfallApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private async Task SeedMemberAsync(long chatId, long userId, string title)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NightfallDbContext>();
        db.ChatMembers.Add(new ChatMemberRecord { TelegramChatId = chatId, TelegramUserId = userId });
        if (await db.ChatProfiles.FindAsync(chatId) is null)
            db.ChatProfiles.Add(new() { TelegramChatId = chatId, Title = title, FirstSeenAt = DateTime.UtcNow, LastSeenAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task OpenTable_IsListedForEveryone_PostedInTheGroup_AndJoinableByCode()
    {
        var host = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 890001, "host1");
        var outsider = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 890002, "outsider1");
        await SeedMemberAsync(-7001, 890001, "Uni night crew");

        var groups = await host.GetFromJsonAsync<List<TableGroupDto>>("/api/tables/groups");
        Assert.Contains(groups!, g => g.TelegramChatId == -7001 && g.Title == "Uni night crew" && g.ActiveGameId == null);

        var response = await host.PostAsJsonAsync("/api/tables", new CreateTableRequest(-7001, "Friday night table", true, 6));
        response.EnsureSuccessStatusCode();
        var gameId = (await response.Content.ReadFromJsonAsync<CreateGameResponse>())!.GameId;
        Assert.Contains(_factory.Notifier.Sent, m => m.UserId == -7001 && m.StartParam == gameId.ToString() && m.Text.Contains("Friday night table"));

        var open = await outsider.GetFromJsonAsync<List<TableDto>>("/api/tables?scope=open");
        var row = Assert.Single(open!, t => t.GameId == gameId);
        Assert.Equal("Friday night table", row.Name);
        Assert.Equal("Uni night crew", row.ChatTitle);
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

        (await outsider.PostAsync($"/api/games/{gameId}/players", null)).EnsureSuccessStatusCode();
        open = await outsider.GetFromJsonAsync<List<TableDto>>("/api/tables?scope=open");
        Assert.True(open!.Single(t => t.GameId == gameId).YouAreSeated);
    }

    [Fact]
    public async Task GroupOnlyTable_StaysOffTheOpenList_UntilTheHostOpensIt()
    {
        var host = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 890011, "host2");
        var other = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 890012, "other2");
        await SeedMemberAsync(-7002, 890011, "Karimi family");

        var gameId = (await (await host.PostAsJsonAsync("/api/tables", new CreateTableRequest(-7002, null, false, null)))
            .Content.ReadFromJsonAsync<CreateGameResponse>())!.GameId;

        Assert.DoesNotContain(await other.GetFromJsonAsync<List<TableDto>>("/api/tables?scope=open") ?? [], t => t.GameId == gameId);
        var mine = await host.GetFromJsonAsync<List<TableDto>>("/api/tables?scope=groups");
        Assert.Contains(mine!, t => t.GameId == gameId && !t.IsOpen && t.YouAreSeated);

        Assert.Equal(HttpStatusCode.Forbidden, (await other.PutAsJsonAsync($"/api/tables/{gameId}/open", new SetTableOpenRequest(true))).StatusCode);
        var info = await (await host.PutAsJsonAsync($"/api/tables/{gameId}/open", new SetTableOpenRequest(true))).Content.ReadFromJsonAsync<TableInfoDto>();
        Assert.True(info!.IsOpen);
        Assert.Contains(await other.GetFromJsonAsync<List<TableDto>>("/api/tables?scope=open") ?? [], t => t.GameId == gameId);

        // One table per group at a time.
        Assert.Equal(HttpStatusCode.Conflict, (await host.PostAsJsonAsync("/api/tables", new CreateTableRequest(-7002, null, true, null))).StatusCode);
    }

    [Fact]
    public async Task CreatingATable_NeedsAGroupYouPlayIn()
    {
        var stranger = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 890021, "stranger");
        var response = await stranger.PostAsJsonAsync("/api/tables", new CreateTableRequest(-7003, "Nope", true, 6));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
