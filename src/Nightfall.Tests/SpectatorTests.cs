using System.Net;
using System.Net.Http.Json;
using Nightfall.Api.Games;
using Nightfall.Api.Lounge;
using Nightfall.Domain;
using Nightfall.Infrastructure.Sessions;

namespace Nightfall.Tests;

public class SpectatorDomainTests
{
    private static readonly GameConfig Watchable = new() { AllowSpectators = true };

    [Fact]
    public void Spectators_NeedTheTableOption_AGameInProgress_AndNoSeat()
    {
        var (closed, _) = TestGameFactory.CreateAssignedGame(5);
        Assert.Throws<GameException>(() => closed.AddSpectator(Guid.NewGuid(), "w"));

        var lobby = new GameState(Watchable);
        Assert.Throws<GameException>(() => lobby.AddSpectator(Guid.NewGuid(), "w"));

        var (game, players) = TestGameFactory.CreateAssignedGame(5, Watchable);
        Assert.Throws<GameException>(() => game.AddSpectator(players[0].Id, "seated"));
        var id = Guid.NewGuid();
        game.AddSpectator(id, "w");
        game.AddSpectator(id, "w");
        Assert.Single(game.Spectators);
    }

    [Fact]
    public void Spectators_AreCappedAt30()
    {
        var (game, _) = TestGameFactory.CreateAssignedGame(5, Watchable);
        for (int i = 0; i < GameState.MaxSpectators; i++) game.AddSpectator(Guid.NewGuid(), $"w{i}");
        Assert.Throws<GameException>(() => game.AddSpectator(Guid.NewGuid(), "one too many"));
    }

    [Fact]
    public void Spectators_CantVoteOrAct()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(5, Watchable);
        var watcher = Guid.NewGuid();
        game.AddSpectator(watcher, "w");
        Assert.ThrowsAny<Exception>(() => game.SubmitNightAction(watcher, players[0].Id, NightActionType.Kill));
        game.ResolveNight(DateTimeOffset.UtcNow);
        game.StartVoting(DateTimeOffset.UtcNow);
        Assert.ThrowsAny<Exception>(() => game.SubmitVote(watcher, players[0].Id));
    }

    [Fact]
    public void SpectatorView_NeverShowsLivingPlayersRoles()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(6, Watchable);
        var watcher = Guid.NewGuid();
        game.AddSpectator(watcher, "w");
        var view = GameView.For(game, watcher);
        Assert.True(view.YouAreSpectator);
        Assert.Null(view.YourRole);
        Assert.Null(view.MafiaTeam);
        Assert.All(view.Players, p => Assert.Null(p.RevealedRole));
        Assert.True(view.YouCanUseGraveyard);
    }

    [Fact]
    public void Graveyard_IsForPlayersWhoAreOutAndSpectators_AndOnlyTheCreatorMutes()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(6, Watchable);
        var watcher = Guid.NewGuid();
        game.AddSpectator(watcher, "w");
        var victim = players.Villagers()[0];
        Assert.False(game.CanUseGraveyard(victim.Id));
        game.SubmitNightAction(players.Godfather().Id, victim.Id, NightActionType.Kill);
        game.ResolveNight(DateTimeOffset.UtcNow);
        Assert.True(game.CanUseGraveyard(victim.Id));
        Assert.True(game.CanUseGraveyard(watcher));

        Assert.Throws<GameException>(() => game.SetSpectatorMuted(players[1].Id, watcher, true));
        game.SetSpectatorMuted(game.Controller!.Id, watcher, true);
        Assert.True(GameView.For(game, watcher).YouAreMutedInGraveyard);
        Assert.Single(GameView.For(game, game.Controller.Id).Spectators!);
    }

    [Fact]
    public void Spectators_SurviveASnapshotRoundTrip()
    {
        var (game, _) = TestGameFactory.CreateAssignedGame(5, Watchable);
        var watcher = Guid.NewGuid();
        game.AddSpectator(watcher, "w");
        game.SetSpectatorMuted(game.Controller!.Id, watcher, true);
        var copy = GameState.FromSnapshot(game.ToSnapshot());
        Assert.True(copy.GetSpectator(watcher)!.Muted);
        Assert.True(copy.Config.AllowSpectators);
    }
}

public class SpectatorEndpointsTests : IClassFixture<NightfallApiFactory>, IAsyncLifetime
{
    private readonly NightfallApiFactory _factory;

    public SpectatorEndpointsTests(NightfallApiFactory factory)
    {
        _factory = factory;
    }

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Watcher_SeesThePublicBoard_GetsVoiceByChannel_AndUsesTheGraveyard()
    {
        var clients = new List<HttpClient>();
        for (int i = 0; i < 3; i++) clients.Add(await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 930000 + i, $"seat{i}"));
        var watcher = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 930100, "watcher");

        var gameId = (await (await clients[0].PostAsJsonAsync("/api/tables", new CreateTableRequest(null, true, null)))
            .Content.ReadFromJsonAsync<CreateGameResponse>())!.GameId;
        foreach (var c in clients.Skip(1)) (await c.PostAsync($"/api/games/{gameId}/players", null)).EnsureSuccessStatusCode();

        // Nothing to watch in the lobby.
        Assert.Equal(HttpStatusCode.BadRequest, (await watcher.PostAsync($"/api/games/{gameId}/spectate", null)).StatusCode);
        (await clients[0].PostAsync($"/api/games/{gameId}/start", null)).EnsureSuccessStatusCode();
        (await watcher.PostAsync($"/api/games/{gameId}/spectate", null)).EnsureSuccessStatusCode();

        var row = (await watcher.GetFromJsonAsync<List<TableDto>>("/api/tables?scope=open"))!.Single(t => t.GameId == gameId);
        Assert.True(row.AllowSpectators);
        Assert.Equal(1, row.Spectators);
        Assert.True(row.YouAreWatching);

        var view = await watcher.GetFromJsonAsync<GameView>($"/api/games/{gameId}");
        Assert.True(view!.YouAreSpectator);
        Assert.All(view.Players, p => Assert.Null(p.RevealedRole));

        var main = await watcher.GetFromJsonAsync<VoiceTokenResponse>($"/api/games/{gameId}/voice-token?channel=main");
        Assert.Equal("Subscriber", main!.Role);
        Assert.Equal(HttpStatusCode.Forbidden, (await watcher.GetAsync($"/api/games/{gameId}/voice-token?channel=mafia")).StatusCode);
        var grave = await watcher.GetFromJsonAsync<VoiceTokenResponse>($"/api/games/{gameId}/voice-token?channel=graveyard");
        Assert.Equal("Publisher", grave!.Role);
        Assert.Equal(HttpStatusCode.Forbidden, (await clients[1].GetAsync($"/api/games/{gameId}/voice-token?channel=graveyard")).StatusCode);

        // The living can't send or read graveyard messages.
        Assert.Equal(HttpStatusCode.Forbidden, (await clients[1].PostAsJsonAsync($"/api/games/{gameId}/graveyard/messages", new SendGraveyardMessageRequest("hi"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await clients[1].GetAsync($"/api/games/{gameId}/graveyard/messages")).StatusCode);

        Assert.Equal(HttpStatusCode.BadRequest, (await watcher.PostAsJsonAsync($"/api/games/{gameId}/graveyard/messages", new SendGraveyardMessageRequest(new string('a', 301)))).StatusCode);
        (await watcher.PostAsJsonAsync($"/api/games/{gameId}/graveyard/messages", new SendGraveyardMessageRequest("who is it?"))).EnsureSuccessStatusCode();
        // One message every 2 seconds.
        Assert.Equal(HttpStatusCode.BadRequest, (await watcher.PostAsJsonAsync($"/api/games/{gameId}/graveyard/messages", new SendGraveyardMessageRequest("again"))).StatusCode);
        var history = await watcher.GetFromJsonAsync<List<GraveyardMessage>>($"/api/games/{gameId}/graveyard/messages");
        Assert.Equal("who is it?", Assert.Single(history!).Text);

        // The creator mutes the watcher.
        var hostView = await clients[0].GetFromJsonAsync<GameView>($"/api/games/{gameId}");
        var spectatorId = Assert.Single(hostView!.Spectators!).Id;
        Assert.Equal(HttpStatusCode.BadRequest, (await clients[1].PutAsJsonAsync($"/api/games/{gameId}/spectators/{spectatorId}/muted", new SetMutedRequest(true))).StatusCode);
        (await clients[0].PutAsJsonAsync($"/api/games/{gameId}/spectators/{spectatorId}/muted", new SetMutedRequest(true))).EnsureSuccessStatusCode();
        await Task.Delay(2100);
        Assert.Equal(HttpStatusCode.Forbidden, (await watcher.PostAsJsonAsync($"/api/games/{gameId}/graveyard/messages", new SendGraveyardMessageRequest("muted?"))).StatusCode);
    }
}
