using System.Net;
using System.Net.Http.Json;
using Nightfall.Api.Lounge;
using Nightfall.Infrastructure.Hub;

namespace Nightfall.Tests;

public class CoupleEndpointsTests : IClassFixture<NightfallApiFactory>, IAsyncLifetime
{
    private readonly NightfallApiFactory _factory;

    public CoupleEndpointsTests(NightfallApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private async Task<(HttpClient A, HttpClient B, CoupleStateDto State)> PairAsync(long a, long b)
    {
        var alice = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, a, $"alice{a}");
        var bob = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, b, $"bob{b}");
        var invite = await (await alice.PostAsync("/api/couple/invite", null)).Content.ReadFromJsonAsync<CoupleStateDto>();
        Assert.Equal("pending", invite!.Status);
        var accepted = await bob.PostAsync($"/api/couple/invite/{invite.Invite!.Token}/accept", null);
        accepted.EnsureSuccessStatusCode();
        return (alice, bob, (await accepted.Content.ReadFromJsonAsync<CoupleStateDto>())!);
    }

    [Fact]
    public async Task Invite_Accept_Answer_And_Reveal()
    {
        var (alice, bob, state) = await PairAsync(890001, 890002);
        Assert.Equal("active", state.Status);
        Assert.Equal("alice890001", state.Couple!.PartnerName);
        Assert.Contains(_factory.Notifier.Sent, m => m.UserId == 890001);
        int number = state.Couple.Today.Number;
        Assert.Equal(1, number);

        // Alice answers first: her partner's answers stay hidden.
        var mine = await (await alice.PostAsJsonAsync("/api/couple/answers", new CoupleAnswersRequest(number, new[] { 0, 1, 2, 3, 1, -1 }))).Content.ReadFromJsonAsync<CoupleDayDto>();
        Assert.False(mine!.Revealed);
        Assert.Null(mine.PartnerAnswers);
        var peek = await bob.GetFromJsonAsync<CoupleDayDto>($"/api/couple/days/{number}");
        Assert.False(peek!.Revealed);
        Assert.Null(peek.PartnerAnswers);

        // Answers lock in once sent.
        var again = await alice.PostAsJsonAsync("/api/couple/answers", new CoupleAnswersRequest(number, new[] { 0, 0, 0, 0, 0, 0 }));
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);

        // Bob guesses two of Alice's answers; Alice guessed one of Bob's and skipped her last guess.
        var reveal = await (await bob.PostAsJsonAsync("/api/couple/answers", new CoupleAnswersRequest(number, new[] { 3, 2, 2, 0, 1, 0 }))).Content.ReadFromJsonAsync<CoupleDayDto>();
        Assert.True(reveal!.Revealed);
        Assert.Equal(new[] { true, true, false, true, false, false }, reveal.Matches);
        Assert.Equal(1, reveal.Streak);

        var aliceView = await alice.GetFromJsonAsync<CoupleStateDto>("/api/couple");
        Assert.Equal(3 * 100 / 6, aliceView!.Couple!.MatchRate);
        Assert.Equal(1, aliceView.Couple.Streak);
        Assert.True(aliceView.Couple.Today.YouDone && aliceView.Couple.Today.PartnerDone);

        var profile = await bob.GetFromJsonAsync<ProfileDto>("/api/me/profile");
        Assert.Equal(CoupleRules.XpEach, profile!.Xp);
    }

    [Fact]
    public async Task Nudge_IsOncePerDay_AndOnlyWhileThePartnerHasNotPlayed()
    {
        var (alice, bob, state) = await PairAsync(890011, 890012);
        (await alice.PostAsync("/api/couple/nudge", null)).EnsureSuccessStatusCode();
        Assert.Contains(_factory.Notifier.Sent, m => m.UserId == 890012 && m.StartParam == "couple");
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PostAsync("/api/couple/nudge", null)).StatusCode);

        (await alice.PostAsJsonAsync("/api/couple/answers", new CoupleAnswersRequest(state.Couple!.Today.Number, new[] { 0, 0, 0, 0, 0, 0 }))).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.BadRequest, (await bob.PostAsync("/api/couple/nudge", null)).StatusCode);
    }

    [Fact]
    public async Task Leave_DeletesTheSpaceForBoth_AndTellsThePartner()
    {
        var (alice, bob, _) = await PairAsync(890021, 890022);
        (await bob.PostAsync("/api/couple/leave", null)).EnsureSuccessStatusCode();
        Assert.Equal("none", (await alice.GetFromJsonAsync<CoupleStateDto>("/api/couple"))!.Status);
        Assert.Equal("none", (await bob.GetFromJsonAsync<CoupleStateDto>("/api/couple"))!.Status);
        Assert.Contains(_factory.Notifier.Sent, m => m.UserId == 890021 && m.Text.Contains("left"));
    }

    [Fact]
    public async Task Invites_CannotBeReused_OrAcceptedByTheirOwner()
    {
        var alice = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 890031, "alice31");
        var bob = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 890032, "bob32");
        var carol = await AuthTestHelper.CreateAuthenticatedClientAsync(_factory, 890033, "carol33");
        var invite = await (await alice.PostAsync("/api/couple/invite", null)).Content.ReadFromJsonAsync<CoupleStateDto>();
        string token = invite!.Invite!.Token;

        Assert.Equal("own", (await alice.GetFromJsonAsync<CoupleInvitePreviewDto>($"/api/couple/invite/{token}"))!.Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await alice.PostAsync($"/api/couple/invite/{token}/accept", null)).StatusCode);

        var preview = await bob.GetFromJsonAsync<CoupleInvitePreviewDto>($"/api/couple/invite/{token}");
        Assert.Equal("open", preview!.Status);
        Assert.Equal("alice31", preview.InviterName);
        (await bob.PostAsync($"/api/couple/invite/{token}/accept", null)).EnsureSuccessStatusCode();

        Assert.Equal("used", (await carol.GetFromJsonAsync<CoupleInvitePreviewDto>($"/api/couple/invite/{token}"))!.Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await carol.PostAsync($"/api/couple/invite/{token}/accept", null)).StatusCode);
        Assert.Equal("invalid", (await carol.GetFromJsonAsync<CoupleInvitePreviewDto>("/api/couple/invite/NOPE"))!.Status);
    }

    [Fact]
    public void Matches_IgnoreSkippedAnswersAndGuesses()
    {
        var matches = CoupleRules.Matches(new[] { 0, -1, 2, 1, 1, -1 }, new[] { 1, 1, 3, 0, -1, 2 });
        Assert.Equal(new[] { true, true, false, true, false, true }, matches);
        Assert.Equal(0, CoupleRules.SetForDay(1));
        Assert.Equal(0, CoupleRules.SetForDay(CoupleRules.QuestionSetCount + 1));
        Assert.Equal(0, CoupleRules.CurrentStreak(5, 10, 12));
        Assert.Equal(5, CoupleRules.CurrentStreak(5, 10, 11));
    }
}
