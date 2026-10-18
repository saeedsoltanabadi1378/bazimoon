using static Bazimoon.Tests.TestIds;
using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Bazimoon.Api.EsmFamil;
using Bazimoon.Domain;
using Bazimoon.Infrastructure.Admin;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Hub;

namespace Bazimoon.Tests;

public class EsmFamilRulesTests
{
    [Theory]
    [InlineData("  آرش ", "ارش")]
    [InlineData("علي", "علی")]
    [InlineData("كباب", "کباب")]
    [InlineData("Mashhad  City", "mashhad city")]
    [InlineData("می‌خک", "میخک")]
    public void Normalize_FoldsCommonSpellings(string input, string expected) =>
        Assert.Equal(expected, EsmFamilRules.Normalize(input));

    [Fact]
    public void ScoreCategory_UniqueSharedAloneAndEmpty()
    {
        Assert.Equal([5, 5, 10, 0], EsmFamilRules.ScoreCategory(["Mashhad", "mashhad", "Madrid", ""], [true, true, true, false]));
        Assert.Equal([0, 20, 0], EsmFamilRules.ScoreCategory(["x", "Milan", ""], [false, true, false]));
    }

    [Theory]
    [InlineData("مشهد", "م", 0, 3, true)]
    [InlineData("مشهد", "م", 1, 3, true)]
    [InlineData("مشهد", "م", 2, 3, false)] // most of the other players rejected it
    [InlineData("مشهد", "م", 1, 2, true)]  // a tie keeps it
    [InlineData("تهران", "م", 0, 3, false)] // wrong letter is struck out automatically
    [InlineData("م", "م", 0, 3, false)]     // a single letter is not an answer
    public void Accepted_FollowsTheMajorityRule(string answer, string letter, int rejects, int voters, bool expected) =>
        Assert.Equal(expected, EsmFamilRoomService.Accepted(answer, letter, rejects, voters));

    [Fact]
    public void CleanCategories_KeepsBuiltInsAndCustom_AndEnforcesLimits()
    {
        Assert.Equal(["name", "city", "custom:Film"], EsmFamilRules.CleanCategories(["name", "city", "name", "custom: Film "]));
        Assert.Throws<GameException>(() => EsmFamilRules.CleanCategories(["name", "city"]));
        Assert.Throws<GameException>(() => EsmFamilRules.CleanCategories(["name", "city", "planet"]));
    }

    [Theory]
    [InlineData("online", true, 0, 30)]
    [InlineData("online", false, 0, 10)]
    [InlineData("daily", true, 6, 12)] // the server records a first daily-fa try as "daily"
    [InlineData("practice", true, 6, 0)]
    public void Xp_FollowsTheRules(string mode, bool solved, int correct, int xp) =>
        Assert.Equal(xp, Progression.SoloXp(new Progression.PuzzleOutcome("esmfamil", mode, solved, null, 68, correct, null, 0), 0, false));
}

public class EsmFamilRoomTests : IClassFixture<BazimoonApiFactory>, IAsyncLifetime
{
    private readonly BazimoonApiFactory _factory;

    public EsmFamilRoomTests(BazimoonApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private sealed class FakeClock : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2026, 10, 15, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private (EsmFamilRoomService Service, FakeClock Clock) NewService()
    {
        var clock = new FakeClock();
        var service = new EsmFamilRoomService(clock, _factory.Services.GetRequiredService<IServiceScopeFactory>(), _factory.Services.GetRequiredService<IBotSettingsService>());
        return (service, clock);
    }

    private static EsmRoomSettings Settings(int rounds = 1) => new(["name", "city", "animal"], rounds, 60, "en");

    [Fact]
    public async Task FullOnlineGame_StopVoteScoreAndAwardXp()
    {
        var (rooms, clock) = NewService();
        Guid host = U(7_100_001), guest = U(7_100_002), third = U(7_100_003);

        var room = await rooms.CreateAsync(host, "host", Settings());
        Assert.Equal("lobby", room.Phase);
        Assert.True(room.YouAreHost);
        await rooms.JoinAsync(room.Code, guest, "guest");
        await rooms.JoinAsync(room.Code.Replace("EF-", "ef"), third, "third"); // codes are forgiving
        await Assert.ThrowsAsync<GameException>(() => rooms.StartAsync(room.Code, host)); // only the host is ready

        await rooms.SetReadyAsync(room.Code, guest, true);
        await rooms.SetReadyAsync(room.Code, third, true);
        await Assert.ThrowsAsync<Bazimoon.Api.Games.ForbiddenGameActionException>(() => rooms.StartAsync(room.Code, guest));
        room = await rooms.StartAsync(room.Code, host);
        Assert.Equal("writing", room.Phase);
        string letter = room.Letter!;
        Assert.Equal(60_000, room.MsLeft);

        string W(string rest) => letter + rest;
        // Nobody sees anyone else's answers while writing.
        await rooms.SaveAnswersAsync(room.Code, guest, [W("ara"), W("oscow"), ""]);
        room = await rooms.GetAsync(room.Code, host);
        Assert.All(room.Players, p => Assert.Null(p.Answers));
        Assert.Equal(2, room.Players.Single(p => p.Name == "guest").Filled);

        // Stop needs every category filled; then everyone else gets 5 seconds.
        await Assert.ThrowsAsync<GameException>(() => rooms.StopAsync(room.Code, host, [W("ina"), "", W("ouse")]));
        clock.Now = clock.Now.AddSeconds(10);
        room = await rooms.StopAsync(room.Code, host, [W("ina"), W("ilan"), W("ouse")]);
        Assert.Equal("host", room.StoppedBy);
        Assert.Equal(5_000, room.MsLeft);
        await rooms.SaveAnswersAsync(room.Code, third, [W("ina"), "9 city", W("ouse")]);

        clock.Now = clock.Now.AddSeconds(6);
        room = await rooms.GetAsync(room.Code, host);
        Assert.Equal("judging", room.Phase);
        int guestSeat = room.Players.Single(p => p.Name == "guest").Seat;
        int thirdSeat = room.Players.Single(p => p.Name == "third").Seat;

        // Host and third reject guest's city: 2 of 2 other players → struck out.
        await rooms.VoteAsync(room.Code, host, new EsmVoteRequest([new EsmVote(guestSeat, 1, true)], true));
        await rooms.VoteAsync(room.Code, third, new EsmVoteRequest([new EsmVote(guestSeat, 1, true), new EsmVote(thirdSeat, 0, true)], true));
        room = await rooms.VoteAsync(room.Code, guest, new EsmVoteRequest([], true));
        Assert.Equal("scores", room.Phase);

        var byName = room.Players.ToDictionary(p => p.Name);
        // name: host/third share (5 each), guest unique (10). city: only host valid (third wrong letter, guest rejected) → 20.
        // animal: host/third share (5 each), guest empty.
        Assert.Equal([5, 20, 5], byName["host"].CategoryPoints!);
        Assert.Equal([10, 0, 0], byName["guest"].CategoryPoints!);
        Assert.Equal([5, 0, 5], byName["third"].CategoryPoints!);
        Assert.Equal(30, byName["host"].Total);

        clock.Now = clock.Now.AddSeconds(11);
        room = await rooms.GetAsync(room.Code, guest);
        Assert.Equal("finished", room.Phase);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BazimoonDbContext>();
        var results = await db.PuzzleResults.Where(r => r.Game == "esmfamil" && r.Mode == "online" && (r.UserId == host || r.UserId == guest || r.UserId == third)).ToListAsync();
        Assert.Equal(3, results.Count);
        Assert.Equal(30, results.Single(r => r.UserId == host).XpGained);
        Assert.Equal(10, results.Single(r => r.UserId == guest).XpGained);

        // Reading the finished room again never awards twice.
        await rooms.GetAsync(room.Code, third);
        Assert.Equal(3, await db.PuzzleResults.CountAsync(r => r.Game == "esmfamil" && r.Mode == "online" && (r.UserId == host || r.UserId == guest || r.UserId == third)));
    }

    [Fact]
    public async Task HostLeaving_HandsOverTheRoom_AndStrangersCannotPeek()
    {
        var (rooms, _) = NewService();
        var room = await rooms.CreateAsync(U(7_100_011), "a", Settings());
        await rooms.JoinAsync(room.Code, U(7_100_012), "b");
        await Assert.ThrowsAsync<Bazimoon.Api.Games.ForbiddenGameActionException>(() => rooms.GetAsync(room.Code, U(7_100_013)));
        room = await rooms.LeaveAsync(room.Code, U(7_100_011));
        room = await rooms.GetAsync(room.Code, U(7_100_012));
        Assert.True(room.YouAreHost);
        Assert.Single(room.Players);
        await Assert.ThrowsAsync<GameException>(() => rooms.GetAsync("EF-ZZZ", U(7_100_012)));
    }

    [Fact]
    public async Task Endpoints_CreateJoinAndRefuseClientOnlineResults()
    {
        var host = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 7_100_021, "hostie");
        var guest = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 7_100_022, "guestie");
        var created = await host.PostAsJsonAsync("/api/esmfamil/rooms", Settings(2));
        created.EnsureSuccessStatusCode();
        var room = (await created.Content.ReadFromJsonAsync<EsmRoomView>())!;
        Assert.StartsWith("EF-", room.Code);

        (await guest.PostAsync($"/api/esmfamil/rooms/{room.Code}/join", null)).EnsureSuccessStatusCode();
        var seen = await guest.GetFromJsonAsync<EsmRoomView>($"/api/esmfamil/rooms/{room.Code}");
        Assert.Equal(2, seen!.Players.Count);

        var bad = await host.PostAsJsonAsync("/api/esmfamil/rooms", new EsmRoomSettings(["name"], 3, 90, "fa"));
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);

        var cheat = await host.PostAsJsonAsync("/api/puzzles/results", new Bazimoon.Api.Lounge.PuzzleSubmitRequest("esmfamil", "online", null, true, null, null, 999, 1, 0));
        Assert.Equal(HttpStatusCode.BadRequest, cheat.StatusCode);
    }
}
