using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bazimoon.Api.Games;
using Bazimoon.Api.Lounge;
using Bazimoon.Domain;
using Bazimoon.Infrastructure.Sessions;

namespace Bazimoon.Tests;

/// <summary>The public game log and the table chat's rules.</summary>
public class TableTalkDomainTests
{
    private static readonly DateTimeOffset T0 = new(2026, 11, 13, 20, 0, 0, TimeSpan.Zero);

    private static string[] Kinds(GameState game, Guid viewer) => GameView.For(game, viewer).Log!.Select(l => l.Kind).ToArray();

    [Fact]
    public void Log_SaysWhoDiedAndWhoWasVotedOut_AndNothingAboutWhoActed()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(7);
        var godfather = players.Godfather();
        var detective = players.Detective();
        var doctor = players.Doctor();
        var victim = players.Villagers()[0];
        var witness = players.Villagers()[1];
        var accused = players.Mafia()[0];

        // The day after the first night already had its vote, with nobody out.
        Assert.Equal(["VoteNone"], Kinds(game, witness.Id));

        game.SubmitNightAction(godfather.Id, victim.Id, NightActionType.Kill);
        game.SubmitNightAction(detective.Id, godfather.Id, NightActionType.Investigate);
        game.SubmitNightAction(doctor.Id, witness.Id, NightActionType.Heal);
        game.ResolveNight(T0);

        var night = GameView.For(game, witness.Id).Log![^1];
        Assert.Equal("NightKill", night.Kind);
        Assert.Equal(victim.Id, night.PlayerId);

        game.StartVoting(T0);
        foreach (var voter in players.Where(p => p.IsAlive && p.Id != accused.Id)) game.SubmitVote(voter.Id, accused.Id);
        game.ResolveVoting(T0);

        var log = GameView.For(game, witness.Id).Log!;
        Assert.Equal(["VoteNone", "NightKill", "VotedOut"], log.Select(l => l.Kind));
        Assert.Equal(accused.Id, log[2].PlayerId);

        // Everyone reads the same log, and it names nobody who acted in the night.
        var json = JsonSerializer.Serialize(log);
        Assert.Equal(json, JsonSerializer.Serialize(GameView.For(game, godfather.Id).Log));
        Assert.DoesNotContain(godfather.Id.ToString(), json);
        Assert.DoesNotContain(detective.Id.ToString(), json);
        Assert.DoesNotContain(doctor.Id.ToString(), json);
        Assert.DoesNotContain(witness.Id.ToString(), json);
    }

    [Fact]
    public void Log_TellsASaveFromAQuietNight_AndAVoteWithNobodyOut()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(7);
        var target = players.Villagers()[0];

        game.SubmitNightAction(players.Godfather().Id, target.Id, NightActionType.Kill);
        game.SubmitNightAction(players.Doctor().Id, target.Id, NightActionType.Heal);
        game.ResolveNight(T0);
        Assert.Equal(["VoteNone", "NightSaved"], Kinds(game, target.Id));

        game.CycleThroughToNextNight();
        // Nobody acts: the Mafia let the night pass.
        game.ResolveNight(T0);
        Assert.Equal(["VoteNone", "NightSaved", "VoteNone", "NightQuiet"], Kinds(game, target.Id));
    }

    [Fact]
    public void TableChat_IsForTheLiving_WhileTheTownIsAwake_AndNotForTheSilenced()
    {
        var config = new GameConfig { Roles = new RoleSetup(RolePreset.Custom, 2, [Role.Silencer]) };
        var (game, players) = TestGameFactory.CreateAssignedGame(7, config);
        var silenced = players.Villagers()[0];
        var victim = players.Villagers()[1];
        var free = players.Villagers()[2];

        // Night: the town is asleep.
        Assert.False(game.TableChatOpen);
        Assert.Contains("closed", Assert.Throws<GameException>(() => game.EnsureCanWriteTableChat(free.Id)).Message);

        game.SubmitNightAction(players.Single(p => p.Role == Role.Silencer).Id, silenced.Id, NightActionType.Silence);
        game.SubmitNightAction(players.Godfather().Id, victim.Id, NightActionType.Kill);
        game.ResolveNight(T0);

        Assert.True(game.TableChatOpen);
        game.EnsureCanWriteTableChat(free.Id);
        game.EnsureCanWriteTableChat(players.Godfather().Id);
        Assert.Contains("silenced today", Assert.Throws<GameException>(() => game.EnsureCanWriteTableChat(silenced.Id)).Message);
        Assert.Contains("Only living players", Assert.Throws<GameException>(() => game.EnsureCanWriteTableChat(victim.Id)).Message);
        Assert.Contains("Only living players", Assert.Throws<GameException>(() => game.EnsureCanWriteTableChat(Guid.NewGuid())).Message);

        game.StartVoting(T0);
        game.EnsureCanWriteTableChat(free.Id);
        game.ResolveVoting(T0);
        game.StartNight(T0);

        Assert.False(game.TableChatOpen);
        Assert.Throws<GameException>(() => game.EnsureCanWriteTableChat(free.Id));
    }
}

public class TableChatEndpointsTests : IClassFixture<BazimoonApiFactory>, IAsyncLifetime
{
    private readonly BazimoonApiFactory _factory;

    public TableChatEndpointsTests(BazimoonApiFactory factory)
    {
        _factory = factory;
    }

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Chat_IsReadableAtTheTable_ClosedAtNight_AndHiddenFromOutsiders()
    {
        var clients = new List<HttpClient>();
        for (int i = 0; i < 3; i++) clients.Add(await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 931000 + i, $"talker{i}"));
        var outsider = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 931100, "outsider");

        var gameId = (await (await clients[0].PostAsJsonAsync("/api/tables", new CreateTableRequest(null, true, null)))
            .Content.ReadFromJsonAsync<CreateGameResponse>())!.GameId;
        foreach (var c in clients.Skip(1)) (await c.PostAsync($"/api/games/{gameId}/players", null)).EnsureSuccessStatusCode();
        (await clients[0].PostAsync($"/api/games/{gameId}/start", null)).EnsureSuccessStatusCode();

        // Seated players can read the (empty) chat and get the public log with their view.
        Assert.Empty((await clients[1].GetFromJsonAsync<List<TableChatMessage>>($"/api/games/{gameId}/chat/messages"))!);
        Assert.Empty((await clients[1].GetFromJsonAsync<GameView>($"/api/games/{gameId}"))!.Log!);

        // The first night: nobody writes while the town sleeps.
        Assert.Equal(HttpStatusCode.BadRequest, (await clients[1].PostAsJsonAsync($"/api/games/{gameId}/chat/messages", new SendTableChatMessageRequest("hello"))).StatusCode);

        // Someone who isn't at the table can neither read nor write.
        Assert.Equal(HttpStatusCode.Forbidden, (await outsider.GetAsync($"/api/games/{gameId}/chat/messages")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await outsider.PostAsJsonAsync($"/api/games/{gameId}/chat/messages", new SendTableChatMessageRequest("hello"))).StatusCode);
    }
}
