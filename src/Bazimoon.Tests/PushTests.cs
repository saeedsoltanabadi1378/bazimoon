using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Bazimoon.Api.Games;
using Bazimoon.Api.Lounge;
using Bazimoon.Infrastructure.History;

namespace Bazimoon.Tests;

public class PushTests : IClassFixture<BazimoonApiFactory>, IAsyncLifetime
{
    private readonly BazimoonApiFactory _factory;

    public PushTests(BazimoonApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Subscribing_StoresTheDevice_AndTheLastSubscriberOwnsIt()
    {
        var first = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 860001, "phone1");
        var second = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 860002, "phone2");
        var device = new PushSubscriptionRequest("https://push.example.com/send/abc", new PushKeys("p256dh-key", "auth-key"));

        Assert.Equal(HttpStatusCode.NoContent, (await first.PostAsJsonAsync("/api/push/subscriptions", device)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await second.PostAsJsonAsync("/api/push/subscriptions", device)).StatusCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BazimoonDbContext>();
            var stored = await db.PushSubscriptions.SingleAsync(s => s.Endpoint == device.Endpoint);
            Assert.Equal(AuthTestHelper.UserIdOf(_factory, 860002), stored.UserId);
        }

        await second.PostAsJsonAsync("/api/push/subscriptions/remove", new PushUnsubscribeRequest(device.Endpoint));
        using var check = _factory.Services.CreateScope();
        Assert.False(await check.ServiceProvider.GetRequiredService<BazimoonDbContext>().PushSubscriptions.AnyAsync(s => s.Endpoint == device.Endpoint));
    }

    [Fact]
    public async Task Subscribing_RejectsAnythingButAnHttpsEndpointWithKeys()
    {
        var client = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 860011, "bad");
        var noKeys = await client.PostAsJsonAsync("/api/push/subscriptions", new PushSubscriptionRequest("https://push.example.com/x", null));
        var http = await client.PostAsJsonAsync("/api/push/subscriptions", new PushSubscriptionRequest("http://push.example.com/x", new PushKeys("a", "b")));
        Assert.Equal(HttpStatusCode.BadRequest, noKeys.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, http.StatusCode);
    }

    [Fact]
    public async Task StartingAGame_NotifiesEveryoneElseAtTheTable()
    {
        var host = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 860021, "hosty");
        var created = await host.PostAsJsonAsync("/api/tables", new CreateTableRequest("Late table", false, 6));
        var gameId = (await created.Content.ReadFromJsonAsync<CreateGameResponse>())!.GameId;
        for (long id = 860022; id <= 860025; id++)
        {
            var player = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, id, $"p{id}");
            (await player.PostAsync($"/api/games/{gameId}/players", null)).EnsureSuccessStatusCode();
        }

        (await host.PostAsync($"/api/games/{gameId}/start", null)).EnsureSuccessStatusCode();

        var sent = _factory.Notifier.Sent.Where(m => m.Target == $"/g/{gameId}").ToList();
        Assert.Equal(4, sent.Count);
        Assert.DoesNotContain(sent, m => m.UserId == AuthTestHelper.UserIdOf(_factory, 860021));
        Assert.All(sent, m => Assert.Equal("hosty started Late table. Your role is waiting.", m.Text));
        Assert.All(sent, m => Assert.Contains("Late table", m.TextFa));
    }

    [Fact]
    public void PushText_PicksPersianForPersianPlayers()
    {
        var text = new PushText("Hello", "سلام");
        Assert.Equal("سلام", text.For("fa"));
        Assert.Equal("Hello", text.For("en"));
        Assert.Equal("Hello", new PushText("Hello", "").For("fa"));
    }
}
