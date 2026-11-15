using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Bazimoon.Api.Games;
using Bazimoon.Api.Lounge;
using Bazimoon.Domain;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Hub;

namespace Bazimoon.Tests;

public class ClanEndpointsTests : IClassFixture<BazimoonApiFactory>, IAsyncLifetime
{
    private readonly BazimoonApiFactory _factory;

    public ClanEndpointsTests(BazimoonApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private async Task<T> WithDbAsync<T>(Func<BazimoonDbContext, Task<T>> work)
    {
        using var scope = _factory.Services.CreateScope();
        return await work(scope.ServiceProvider.GetRequiredService<BazimoonDbContext>());
    }

    /// <summary>A player signed in with Google (not a guest), who may start a clan.</summary>
    private async Task<HttpClient> SignedInAsync(long id, string name)
    {
        var client = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, id, name);
        var userId = AuthTestHelper.UserIdOf(_factory, id);
        await WithDbAsync(async db =>
        {
            (await db.Users.FirstAsync(u => u.Id == userId)).IsGuest = false;
            return await db.SaveChangesAsync();
        });
        return client;
    }

    private static async Task<ClanDetailDto> CreateClanAsync(HttpClient owner, string name, bool listed = true)
    {
        var response = await owner.PostAsJsonAsync("/api/clans", new ClanEditRequest(name, "We play on Fridays", "flame", "#F0A83A", listed));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ClanDetailDto>())!;
    }

    private static async Task<string?> CodeOf(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<Dictionary<string, object>>())?["code"]?.ToString();

    [Fact]
    public async Task Guests_CantStartAClan_ButCanJoinByInvite()
    {
        var guest = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 950001, "guest950001");
        var refused = await guest.PostAsJsonAsync("/api/clans", new ClanEditRequest("Guest crew", null, null, null, true));
        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
        Assert.Equal("clan_guest_cannot_create", await CodeOf(refused));

        var owner = await SignedInAsync(950002, "owner950002");
        var clan = await CreateClanAsync(owner, "Night Owls 2");
        Assert.Equal(ClanRoles.Owner, clan.YourRole);

        var preview = await guest.GetFromJsonAsync<ClanInvitePreviewDto>($"/api/clans/code/{clan.InviteCode}");
        Assert.Equal("Night Owls 2", preview!.Clan.Name);
        Assert.False(preview.IsMember);
        (await guest.PostAsync($"/api/clans/code/{clan.InviteCode}", null)).EnsureSuccessStatusCode();

        var me = await guest.GetFromJsonAsync<ClanMeDto>("/api/clans/me");
        Assert.Equal(clan.Id, me!.Clan!.Id);
        Assert.Equal(ClanRoles.Member, me.Clan.Role);

        // A guest can't be made an admin.
        var guestId = AuthTestHelper.UserIdOf(_factory, 950001);
        var promote = await owner.PutAsJsonAsync($"/api/clans/{clan.Id}/members/{guestId}/role", new ClanRoleRequest("admin"));
        Assert.Equal("clan_guest_cannot_admin", await CodeOf(promote));

        // Names are unique regardless of case.
        var other = await SignedInAsync(950003, "other950003");
        var taken = await other.PostAsJsonAsync("/api/clans", new ClanEditRequest("night owls 2", null, null, null, true));
        Assert.Equal("clan_name_taken", await CodeOf(taken));
    }

    [Fact]
    public async Task JoinRequests_AreApprovedByAdmins_AndRemovedPlayersCantUseTheLink()
    {
        var owner = await SignedInAsync(950011, "owner950011");
        var clan = await CreateClanAsync(owner, "Requesters");
        var asker = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 950012, "asker950012");
        var askerId = AuthTestHelper.UserIdOf(_factory, 950012);
        var ownerId = AuthTestHelper.UserIdOf(_factory, 950011);

        var found = await asker.GetFromJsonAsync<List<ClanSummaryDto>>("/api/clans?search=requesters");
        Assert.Equal(clan.Id, Assert.Single(found!).Id);

        (await asker.PostAsync($"/api/clans/{clan.Id}/requests", null)).EnsureSuccessStatusCode();
        Assert.Contains(_factory.Notifier.Sent, m => m.UserId == ownerId && m.Text.Contains("asked to join Requesters"));
        var detail = await owner.GetFromJsonAsync<ClanDetailDto>($"/api/clans/{clan.Id}");
        Assert.Equal(askerId, Assert.Single(detail!.Requests).UserId);

        // Members can't see the clan page until they're in.
        Assert.Equal(HttpStatusCode.Forbidden, (await asker.GetAsync($"/api/clans/{clan.Id}")).StatusCode);

        (await owner.PostAsync($"/api/clans/{clan.Id}/requests/{askerId}/accept", null)).EnsureSuccessStatusCode();
        detail = await owner.GetFromJsonAsync<ClanDetailDto>($"/api/clans/{clan.Id}");
        Assert.Equal(2, detail!.Members.Count);
        Assert.Empty(detail.Requests);

        // A member can't remove anyone; the owner can, and the link no longer lets them back in.
        Assert.Equal(HttpStatusCode.Forbidden, (await asker.DeleteAsync($"/api/clans/{clan.Id}/members/{ownerId}")).StatusCode);
        (await owner.DeleteAsync($"/api/clans/{clan.Id}/members/{askerId}")).EnsureSuccessStatusCode();
        var back = await asker.PostAsync($"/api/clans/code/{clan.InviteCode}", null);
        Assert.Equal("clan_banned", await CodeOf(back));

        // The owner can't walk away from a clan with members in it.
        var other = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 950013, "other950013");
        (await other.PostAsync($"/api/clans/code/{clan.InviteCode}", null)).EnsureSuccessStatusCode();
        var leave = await owner.PostAsync($"/api/clans/{clan.Id}/leave", null);
        Assert.Equal("clan_owner_must_transfer", await CodeOf(leave));

        // One clan at a time.
        var second = await SignedInAsync(950014, "second950014");
        var otherClan = await CreateClanAsync(second, "Second crew");
        var twice = await other.PostAsync($"/api/clans/code/{otherClan.InviteCode}", null);
        Assert.Equal("clan_already_in_clan", await CodeOf(twice));
    }

    [Fact]
    public async Task Chat_CountsUnread_AndAnnouncementsNotifyMembers()
    {
        var owner = await SignedInAsync(950021, "owner950021");
        var clan = await CreateClanAsync(owner, "Chatters");
        var member = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 950022, "member950022");
        (await member.PostAsync($"/api/clans/code/{clan.InviteCode}", null)).EnsureSuccessStatusCode();
        var memberId = AuthTestHelper.UserIdOf(_factory, 950022);

        (await owner.PostAsJsonAsync($"/api/clans/{clan.Id}/messages", new ClanPostRequest("hello", false))).EnsureSuccessStatusCode();
        (await owner.PostAsJsonAsync($"/api/clans/{clan.Id}/messages", new ClanPostRequest("No game this Friday", true))).EnsureSuccessStatusCode();
        Assert.Contains(_factory.Notifier.Sent, m => m.UserId == memberId && m.Text == "Chatters: No game this Friday");

        Assert.Equal(2, (await member.GetFromJsonAsync<ClanMeDto>("/api/clans/me"))!.Clan!.Unread);
        var messages = await member.GetFromJsonAsync<List<ClanMessageDto>>($"/api/clans/{clan.Id}/messages");
        Assert.Equal(["hello", "No game this Friday"], messages!.Select(m => m.Text));
        Assert.Equal(0, (await member.GetFromJsonAsync<ClanMeDto>("/api/clans/me"))!.Clan!.Unread);
        var detail = await member.GetFromJsonAsync<ClanDetailDto>($"/api/clans/{clan.Id}");
        Assert.Equal("No game this Friday", detail!.Announcement!.Text);

        // Only the owner and admins announce.
        var announce = await member.PostAsJsonAsync($"/api/clans/{clan.Id}/messages", new ClanPostRequest("me too", true));
        Assert.Equal(HttpStatusCode.Forbidden, announce.StatusCode);

        var reply = await (await member.PostAsJsonAsync($"/api/clans/{clan.Id}/messages", new ClanPostRequest("ok!", false))).Content.ReadFromJsonAsync<ClanMessageDto>();
        var newer = await owner.GetFromJsonAsync<List<ClanMessageDto>>($"/api/clans/{clan.Id}/messages?after={messages[^1].Id}");
        Assert.Equal("ok!", Assert.Single(newer!).Text);
        // The owner can delete anyone's message.
        (await owner.DeleteAsync($"/api/clans/{clan.Id}/messages/{reply!.Id}")).EnsureSuccessStatusCode();
        Assert.Empty((await owner.GetFromJsonAsync<List<ClanMessageDto>>($"/api/clans/{clan.Id}/messages?after={messages[^1].Id}"))!);
    }

    [Fact]
    public async Task GameNight_RsvpsRemindAndEveryoneLandsAtOneMembersOnlyTable()
    {
        var owner = await SignedInAsync(950031, "owner950031");
        var clan = await CreateClanAsync(owner, "Game nighters");
        var member = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 950032, "member950032");
        (await member.PostAsync($"/api/clans/code/{clan.InviteCode}", null)).EnsureSuccessStatusCode();
        var memberId = AuthTestHelper.UserIdOf(_factory, 950032);
        var outsider = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 950033, "outsider950033");

        var tooSoon = await owner.PostAsJsonAsync($"/api/clans/{clan.Id}/events", new ClanEventRequest("Now", null, DateTimeOffset.UtcNow.AddMinutes(1), 10, false));
        Assert.Equal("clan_event_invalid_time", await CodeOf(tooSoon));

        var created = await owner.PostAsJsonAsync($"/api/clans/{clan.Id}/events",
            new ClanEventRequest("Friday classic", "Bring snacks", DateTimeOffset.UtcNow.AddMinutes(10), 10, true));
        created.EnsureSuccessStatusCode();
        var ev = Assert.Single((await created.Content.ReadFromJsonAsync<ClanDetailDto>())!.Events);
        Assert.Equal("yes", ev.YourAnswer);
        Assert.True(ev.TableOpen);
        Assert.Contains(_factory.Notifier.Sent, m => m.UserId == memberId && m.Text.Contains("planned a game night: Friday classic"));

        (await member.PutAsJsonAsync($"/api/clans/{clan.Id}/events/{ev.Id}/rsvp", new ClanRsvpRequest("yes"))).EnsureSuccessStatusCode();
        var detail = await member.GetFromJsonAsync<ClanDetailDto>($"/api/clans/{clan.Id}");
        Assert.Equal(2, Assert.Single(detail!.Events).Going.Count);

        // The start reminder goes to everyone coming, once.
        await WithDbAsync(async db =>
        {
            await ClanEventService.RunDueAsync(db, _factory.Notifier, DateTime.UtcNow);
            await ClanEventService.RunDueAsync(db, _factory.Notifier, DateTime.UtcNow);
            return 0;
        });
        Assert.Single(_factory.Notifier.Sent, m => m.UserId == memberId && m.Text.Contains("is starting"));

        var first = await (await owner.PostAsync($"/api/clans/{clan.Id}/events/{ev.Id}/seat", null)).Content.ReadFromJsonAsync<ClanGameDto>();
        var second = await (await member.PostAsync($"/api/clans/{clan.Id}/events/{ev.Id}/seat", null)).Content.ReadFromJsonAsync<ClanGameDto>();
        Assert.Equal(first!.GameId, second!.GameId);

        var intruder = await outsider.PostAsync($"/api/games/{first.GameId}/players", null);
        Assert.Equal(HttpStatusCode.Forbidden, intruder.StatusCode);
        Assert.Equal("clan_members_only", await CodeOf(intruder));

        detail = await member.GetFromJsonAsync<ClanDetailDto>($"/api/clans/{clan.Id}");
        var table = Assert.Single(detail!.Tables);
        Assert.Equal(2, table.Seated);
        Assert.True(table.YouAreSeated);

        // A weekly night puts next week's on the calendar once it's over.
        await WithDbAsync(async db =>
        {
            await ClanEventService.RunDueAsync(db, _factory.Notifier, DateTime.UtcNow.AddHours(3));
            return 0;
        });
        var nights = await WithDbAsync(db => db.ClanEvents.Where(e => e.ClanId == clan.Id).OrderBy(e => e.StartsAt).ToListAsync());
        Assert.Equal(2, nights.Count);
        Assert.Equal(nights[0].StartsAt.AddDays(7), nights[1].StartsAt);
    }

    [Fact]
    public async Task Ranking_CountsOnlyGamesAtClanTables()
    {
        var owner = await SignedInAsync(950041, "owner950041");
        var clan = await CreateClanAsync(owner, "Rankers");
        var member = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 950042, "member950042");
        (await member.PostAsync($"/api/clans/code/{clan.InviteCode}", null)).EnsureSuccessStatusCode();
        var ownerId = AuthTestHelper.UserIdOf(_factory, 950041);
        var memberId = AuthTestHelper.UserIdOf(_factory, 950042);

        await WithDbAsync(async db =>
        {
            // Two clan games and one ordinary game the member won.
            AddGame(db, clan.Id, (ownerId, true, true), (memberId, false, false));
            AddGame(db, clan.Id, (ownerId, true, false), (memberId, true, false));
            AddGame(db, null, (memberId, true, true));
            return await db.SaveChangesAsync();
        });

        var ranking = await member.GetFromJsonAsync<ClanRankingDto>($"/api/clans/{clan.Id}/ranking");
        Assert.Equal(2, ranking!.ClanGames);
        Assert.Equal(0, ranking.Unranked);
        var top = ranking.Rows[0];
        Assert.Equal((1, ownerId, 2, 2, 1, 10), (top.Rank, top.UserId, top.Games, top.Wins, top.Mvps, top.Points));
        var you = ranking.Rows[1];
        Assert.Equal((2, memberId, 2, 1, 5), (you.Rank, you.UserId, you.Games, you.Wins, you.Points));
        Assert.True(you.IsYou);

        var outsider = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 950043, "outsider950043");
        Assert.Equal(HttpStatusCode.Forbidden, (await outsider.GetAsync($"/api/clans/{clan.Id}/ranking")).StatusCode);
    }

    private static void AddGame(BazimoonDbContext db, Guid? clanId, params (Guid UserId, bool Won, bool Mvp)[] players)
    {
        var gameId = Guid.NewGuid();
        db.MafiaTables.Add(new MafiaTableRecord { GameId = gameId, CreatorUserId = players[0].UserId, InviteCode = gameId.ToString("N")[..8].ToUpperInvariant(), ClanId = clanId });
        db.Games.Add(new GameRecord
        {
            Id = gameId, CreatedAt = DateTime.UtcNow.AddHours(-1), EndedAt = DateTime.UtcNow, Result = WinCondition.VillagersWin,
            Players = players.Select(p => new GamePlayerRecord { Id = Guid.NewGuid(), PlayerId = Guid.NewGuid(), UserId = p.UserId, DisplayName = "p", Won = p.Won, IsMvp = p.Mvp }).ToList(),
        });
    }
}
