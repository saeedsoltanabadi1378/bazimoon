using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Bazimoon.Api.Auth;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Hub;
using Bazimoon.Infrastructure.Identity;

namespace Bazimoon.Tests;

public class AuthFlowTests : IClassFixture<BazimoonApiFactory>, IAsyncLifetime
{
    private readonly BazimoonApiFactory _factory;

    public AuthFlowTests(BazimoonApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private async Task<AuthSessionResponse> PostAsync(string path, object body, string? accessToken = null)
    {
        var response = await SendAsync(path, body, accessToken);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<AuthSessionResponse>())!;
    }

    private async Task<HttpResponseMessage> SendAsync(string path, object body, string? accessToken = null)
    {
        var client = _factory.CreateClient();
        if (accessToken is not null) client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return await client.PostAsJsonAsync(path, body);
    }

    private HttpClient ClientWith(string accessToken)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return client;
    }

    [Fact]
    public async Task Guest_CanPlayStraightAway()
    {
        var session = await PostAsync("/api/auth/guest", new GuestAuthRequest(Language: "fa"));

        Assert.True(session.User.IsGuest);
        Assert.StartsWith("Player ", session.User.DisplayName);
        Assert.Equal("fa", session.User.Language);
        Assert.False(string.IsNullOrEmpty(session.RefreshToken));
        using (var scope = _factory.Services.CreateScope())
        {
            var acquisition = await scope.ServiceProvider.GetRequiredService<BazimoonDbContext>()
                .UserAcquisitions.SingleAsync(x => x.UserId == session.User.Id);
            Assert.Equal("direct", acquisition.Source);
            Assert.Equal("none", acquisition.Medium);
        }
        (await ClientWith(session.AccessToken).GetAsync("/api/me/profile")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Guest_StoresFirstTouchAttribution_AndClassifiesKnownReferrers()
    {
        var tagged = await PostAsync("/api/auth/guest", new GuestAuthRequest(
            Attribution: new AttributionRequest("ChatGPT", "AI_Referral", "launch", Referrer: "https://chatgpt.com/c/secret?token=private", LandingPath: "/fa/play", Gclid: " click-123 ")));
        var inferred = await PostAsync("/api/auth/guest", new GuestAuthRequest(
            Attribution: new AttributionRequest(Referrer: "https://gemini.google.com/app/abc?private=yes", LandingPath: "/")));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BazimoonDbContext>();
        var taggedTouch = await db.UserAcquisitions.SingleAsync(x => x.UserId == tagged.User.Id);
        var inferredTouch = await db.UserAcquisitions.SingleAsync(x => x.UserId == inferred.User.Id);

        Assert.Equal("chatgpt", taggedTouch.Source);
        Assert.Equal("ai_referral", taggedTouch.Medium);
        Assert.Equal("launch", taggedTouch.Campaign);
        Assert.Equal("https://chatgpt.com/c/secret", taggedTouch.Referrer);
        Assert.Equal("/fa/play", taggedTouch.LandingPath);
        Assert.Equal("click-123", taggedTouch.Gclid);
        Assert.Equal("gemini", inferredTouch.Source);
        Assert.Equal("referral", inferredTouch.Medium);
        Assert.Equal("https://gemini.google.com/app/abc", inferredTouch.Referrer);
    }

    [Fact]
    public async Task ExistingGoogleUser_KeepsOriginalAttribution()
    {
        var first = await PostAsync("/api/auth/google", new GoogleAuthRequest(
            FakeGoogleTokenValidator.Token("g-attribution", "Sara"),
            Attribution: new AttributionRequest("google", "organic")));
        await PostAsync("/api/auth/google", new GoogleAuthRequest(
            FakeGoogleTokenValidator.Token("g-attribution", "Sara"),
            Attribution: new AttributionRequest("gemini", "ai_referral")));

        using var scope = _factory.Services.CreateScope();
        var touch = await scope.ServiceProvider.GetRequiredService<BazimoonDbContext>()
            .UserAcquisitions.SingleAsync(x => x.UserId == first.User.Id);
        Assert.Equal("google", touch.Source);
        Assert.Equal("organic", touch.Medium);
    }

    [Fact]
    public async Task Google_SignIn_CreatesOneUserPerGoogleAccount()
    {
        var first = await PostAsync("/api/auth/google", new GoogleAuthRequest(FakeGoogleTokenValidator.Token("g-100", "Sara")));
        var again = await PostAsync("/api/auth/google", new GoogleAuthRequest(FakeGoogleTokenValidator.Token("g-100", "Sara")));

        Assert.False(first.User.IsGuest);
        Assert.Equal("Sara", first.User.DisplayName);
        Assert.Equal(first.User.Id, again.User.Id);
    }

    [Fact]
    public async Task Google_InvalidToken_IsRejected()
    {
        var response = await SendAsync("/api/auth/google", new GoogleAuthRequest("not-a-google-token"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Google_TokenWithTheWrongNonce_IsRejected()
    {
        var ok = await SendAsync("/api/auth/google", new GoogleAuthRequest(FakeGoogleTokenValidator.Token("g-500", "Nonce", "n-1"), Nonce: "n-1"));
        var wrong = await SendAsync("/api/auth/google", new GoogleAuthRequest(FakeGoogleTokenValidator.Token("g-500", "Nonce", "n-1"), Nonce: "n-2"));
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
    }

    [Fact]
    public async Task LinkingGoogle_KeepsTheGuestsProgress()
    {
        var guest = await PostAsync("/api/auth/guest", new GuestAuthRequest());
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BazimoonDbContext>();
            db.PlayerStats.Add(new PlayerStatsRecord { UserId = guest.User.Id, Username = guest.User.DisplayName, Xp = 420 });
            await db.SaveChangesAsync();
        }

        var linked = await PostAsync("/api/auth/link/google", new GoogleAuthRequest(FakeGoogleTokenValidator.Token("g-200", "Navid")), guest.AccessToken);

        Assert.Equal(guest.User.Id, linked.User.Id);
        Assert.False(linked.User.IsGuest);
        Assert.Equal("Navid", linked.User.DisplayName);
        // Signing in with that Google account later lands on the same profile and its progress.
        var later = await PostAsync("/api/auth/google", new GoogleAuthRequest(FakeGoogleTokenValidator.Token("g-200", "Navid")));
        Assert.Equal(guest.User.Id, later.User.Id);
        using var check = _factory.Services.CreateScope();
        Assert.Equal(420, (await check.ServiceProvider.GetRequiredService<BazimoonDbContext>().PlayerStats.SingleAsync(s => s.UserId == guest.User.Id)).Xp);
        // The guest's old refresh token no longer works; it described a guest.
        Assert.Equal(HttpStatusCode.Unauthorized, (await SendAsync("/api/auth/refresh", new RefreshRequest(guest.RefreshToken))).StatusCode);
    }

    [Fact]
    public async Task LinkingGoogle_ThatAlreadyHasAProfile_Returns409()
    {
        await PostAsync("/api/auth/google", new GoogleAuthRequest(FakeGoogleTokenValidator.Token("g-300", "Owner")));
        var guest = await PostAsync("/api/auth/guest", new GuestAuthRequest());

        var response = await SendAsync("/api/auth/link/google", new GoogleAuthRequest(FakeGoogleTokenValidator.Token("g-300", "Owner")), guest.AccessToken);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("account_exists", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task LinkingGoogle_WhenAlreadySignedIn_Returns400()
    {
        var user = await PostAsync("/api/auth/google", new GoogleAuthRequest(FakeGoogleTokenValidator.Token("g-400", "Signed")));
        var response = await SendAsync("/api/auth/link/google", new GoogleAuthRequest(FakeGoogleTokenValidator.Token("g-401", "Other")), user.AccessToken);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_RotatesTheToken_AndReusingAnOldOneSignsOutEverywhere()
    {
        var session = await PostAsync("/api/auth/guest", new GuestAuthRequest());

        var next = await PostAsync("/api/auth/refresh", new RefreshRequest(session.RefreshToken));
        Assert.Equal(session.User.Id, next.User.Id);
        Assert.NotEqual(session.RefreshToken, next.RefreshToken);

        // The first token was used up; using it again revokes the newer one too.
        Assert.Equal(HttpStatusCode.Unauthorized, (await SendAsync("/api/auth/refresh", new RefreshRequest(session.RefreshToken))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await SendAsync("/api/auth/refresh", new RefreshRequest(next.RefreshToken))).StatusCode);
    }

    [Fact]
    public async Task Logout_RevokesTheRefreshToken()
    {
        var session = await PostAsync("/api/auth/guest", new GuestAuthRequest());

        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync("/api/auth/logout", new RefreshRequest(session.RefreshToken))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await SendAsync("/api/auth/refresh", new RefreshRequest(session.RefreshToken))).StatusCode);
    }

    [Fact]
    public async Task Cleanup_DeletesOnlyGuestsInactiveFor30Days()
    {
        var now = DateTimeOffset.UtcNow;
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BazimoonDbContext>();
        var staleGuest = new UserRecord { IsGuest = true, DisplayName = "stale", LastSeenAt = now.UtcDateTime.AddDays(-31) };
        var activeGuest = new UserRecord { IsGuest = true, DisplayName = "active", LastSeenAt = now.UtcDateTime.AddDays(-2) };
        var oldMember = new UserRecord { IsGuest = false, DisplayName = "member", LastSeenAt = now.UtcDateTime.AddDays(-90) };
        db.Users.AddRange(staleGuest, activeGuest, oldMember);
        db.PlayerStats.Add(new PlayerStatsRecord { UserId = staleGuest.Id, Username = "stale" });
        await db.SaveChangesAsync();

        await GuestCleanupService.DeleteInactiveGuestsAsync(db, now);

        Assert.Null(await db.Users.FindAsync(staleGuest.Id));
        Assert.False(await db.PlayerStats.AnyAsync(s => s.UserId == staleGuest.Id));
        Assert.NotNull(await db.Users.FindAsync(activeGuest.Id));
        Assert.NotNull(await db.Users.FindAsync(oldMember.Id));
    }
}
