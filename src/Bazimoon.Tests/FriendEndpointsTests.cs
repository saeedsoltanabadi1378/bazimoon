using System.Net;
using System.Net.Http.Json;
using Bazimoon.Api.EsmFamil;
using Bazimoon.Api.Games;
using Bazimoon.Api.Lounge;

namespace Bazimoon.Tests;

public class FriendEndpointsTests : IClassFixture<BazimoonApiFactory>, IAsyncLifetime
{
    private readonly BazimoonApiFactory _factory;

    public FriendEndpointsTests(BazimoonApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private async Task<(HttpClient A, HttpClient B)> FriendsAsync(long a, long b)
    {
        var alice = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, a, $"alice{a}");
        var bob = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, b, $"bob{b}");
        var code = (await alice.GetFromJsonAsync<FriendsDto>("/api/friends"))!.Code;
        (await bob.PostAsync($"/api/friends/code/{code}", null)).EnsureSuccessStatusCode();
        return (alice, bob);
    }

    [Fact]
    public async Task AddingByCode_MakesBothFriends_AndTellsTheCodeOwner()
    {
        var (alice, bob) = await FriendsAsync(930001, 930002);
        var aliceId = AuthTestHelper.UserIdOf(_factory, 930001);

        var preview = await bob.GetFromJsonAsync<FriendCodePreviewDto>($"/api/friends/code/{(await alice.GetFromJsonAsync<FriendsDto>("/api/friends"))!.Code}");
        Assert.True(preview!.AlreadyFriends);

        var mine = await alice.GetFromJsonAsync<FriendsDto>("/api/friends");
        Assert.Equal("bob930002", Assert.Single(mine!.Friends).Name);
        var theirs = await bob.GetFromJsonAsync<FriendsDto>("/api/friends");
        Assert.Equal(aliceId, Assert.Single(theirs!.Friends).UserId);
        Assert.Contains(_factory.Notifier.Sent, m => m.UserId == aliceId && m.Target == "/friends");

        var ownCode = await alice.PostAsync($"/api/friends/code/{mine.Code}", null);
        Assert.Equal(HttpStatusCode.BadRequest, ownCode.StatusCode);
        var unknown = await alice.PostAsync("/api/friends/code/NOPE999", null);
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);

        (await alice.DeleteAsync($"/api/friends/{AuthTestHelper.UserIdOf(_factory, 930002)}")).EnsureSuccessStatusCode();
        Assert.Empty((await bob.GetFromJsonAsync<FriendsDto>("/api/friends"))!.Friends);
    }

    [Fact]
    public async Task Requests_OnlyGoToPeopleYouPlayedWith()
    {
        var alice = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 930011, "alice930011");
        await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 930012, "stranger930012");
        var response = await alice.PostAsJsonAsync("/api/friends/requests", new FriendRequestBody(AuthTestHelper.UserIdOf(_factory, 930012)));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task FriendsLeague_RanksOnlyYouAndYourFriends()
    {
        var (alice, _) = await FriendsAsync(930021, 930022);
        await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 930023, "outsider930023");

        var board = await alice.GetFromJsonAsync<LeagueDto>("/api/hub/league?board=mafia&scope=friends");
        Assert.Equal(2, board!.PlayerCount);
        Assert.Equal(["alice930021", "bob930022"], board.Rows.Select(r => r.Name).Order());
        Assert.All(board.Rows, r => Assert.Equal("safe", r.Zone));
        Assert.NotNull(board.You.Rank);
    }

    [Fact]
    public async Task MafiaInvite_ReachesTheFriend_AndAcceptingJoinsTheLobby()
    {
        var (alice, bob) = await FriendsAsync(930031, 930032);
        var outsider = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 930033, "outsider930033");
        var bobId = AuthTestHelper.UserIdOf(_factory, 930032);
        var gameId = (await (await alice.PostAsync("/api/games", null)).Content.ReadFromJsonAsync<CreateGameResponse>())!.GameId;

        // Only friends get the invite; a stranger in the list is skipped.
        var sent = await (await alice.PostAsJsonAsync("/api/invites", new InviteRequest("mafia", gameId.ToString(),
            [bobId, AuthTestHelper.UserIdOf(_factory, 930033)]))).Content.ReadFromJsonAsync<InviteResultDto>();
        Assert.Equal(1, sent!.Sent);
        Assert.Contains(_factory.Notifier.Sent, m => m.UserId == bobId && m.Text.Contains("Mafia"));
        Assert.Empty((await outsider.GetFromJsonAsync<List<GameInviteDto>>("/api/invites"))!);

        // Inviting again while it is still waiting sends nothing new.
        var again = await (await alice.PostAsJsonAsync("/api/invites", new InviteRequest("mafia", gameId.ToString(), [bobId]))).Content.ReadFromJsonAsync<InviteResultDto>();
        Assert.Equal(0, again!.Sent);

        var invite = Assert.Single((await bob.GetFromJsonAsync<List<GameInviteDto>>("/api/invites"))!);
        Assert.Equal("alice930031", invite.FromName);
        var accepted = await (await bob.PostAsync($"/api/invites/{invite.Id}/accept", null)).Content.ReadFromJsonAsync<AcceptInviteDto>();
        Assert.Equal(gameId, accepted!.GameId);
        (await bob.GetAsync($"/api/games/{gameId}")).EnsureSuccessStatusCode();
        Assert.Empty((await bob.GetFromJsonAsync<List<GameInviteDto>>("/api/invites"))!);

        var status = await alice.GetFromJsonAsync<List<SentInviteDto>>($"/api/invites/sent?kind=mafia&target={gameId}");
        Assert.Equal("accepted", Assert.Single(status!).Status);

        // Someone outside the lobby can't send invites into it.
        var notIn = await outsider.PostAsJsonAsync("/api/invites", new InviteRequest("mafia", gameId.ToString(), [bobId]));
        Assert.Equal(HttpStatusCode.BadRequest, notIn.StatusCode);
    }

    [Fact]
    public async Task EsmFamilInvite_CanBeDeclined_OrAccepted()
    {
        var (alice, bob) = await FriendsAsync(930041, 930042);
        var bobId = AuthTestHelper.UserIdOf(_factory, 930042);
        var room = (await (await alice.PostAsJsonAsync("/api/esmfamil/rooms",
            new EsmRoomSettings(["name", "family", "city", "food"], 2, 90, "fa"))).Content.ReadFromJsonAsync<EsmRoomView>())!;

        (await alice.PostAsJsonAsync("/api/invites", new InviteRequest("esmfamil", room.Code, [bobId]))).EnsureSuccessStatusCode();
        var invite = Assert.Single((await bob.GetFromJsonAsync<List<GameInviteDto>>("/api/invites"))!);
        Assert.Equal("esmfamil", invite.Kind);
        (await bob.PostAsync($"/api/invites/{invite.Id}/decline", null)).EnsureSuccessStatusCode();
        Assert.Empty((await bob.GetFromJsonAsync<List<GameInviteDto>>("/api/invites"))!);
        Assert.Equal(HttpStatusCode.BadRequest, (await bob.PostAsync($"/api/invites/{invite.Id}/accept", null)).StatusCode);

        // A declined invite can be sent again.
        var resend = await (await alice.PostAsJsonAsync("/api/invites", new InviteRequest("esmfamil", room.Code, [bobId]))).Content.ReadFromJsonAsync<InviteResultDto>();
        Assert.Equal(1, resend!.Sent);
        var second = Assert.Single((await bob.GetFromJsonAsync<List<GameInviteDto>>("/api/invites"))!);
        var joined = await (await bob.PostAsync($"/api/invites/{second.Id}/accept", null)).Content.ReadFromJsonAsync<AcceptInviteDto>();
        Assert.Equal(room.Code, joined!.Code);
        var seen = await bob.GetFromJsonAsync<EsmRoomView>($"/api/esmfamil/rooms/{room.Code}");
        Assert.Equal(2, seen!.Players.Count);
    }
}
