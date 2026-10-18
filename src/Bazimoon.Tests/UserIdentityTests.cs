using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Bazimoon.Api.Auth;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Identity;

namespace Bazimoon.Tests;

public class UserIdentityTests : IClassFixture<BazimoonApiFactory>, IAsyncLifetime
{
    private readonly BazimoonApiFactory _factory;

    public UserIdentityTests(BazimoonApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    private async Task<AuthUserResponse> SignInAsync(long telegramUserId, string username)
    {
        var client = _factory.CreateClient();
        var initData = TelegramInitDataFixture.Sign(BazimoonApiFactory.TestBotToken, telegramUserId, username);
        var response = await client.PostAsJsonAsync("/api/auth/telegram", new TelegramAuthRequest(initData));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<AuthUserResponse>())!;
    }

    [Fact]
    public async Task SigningInAgain_WithTheSameIdentity_ReturnsTheSameUser()
    {
        var first = await SignInAsync(880001, "returning");
        var second = await SignInAsync(880001, "returning");
        var other = await SignInAsync(880002, "someone");

        Assert.Equal(first.UserId, second.UserId);
        Assert.NotEqual(first.UserId, other.UserId);
        Assert.False(first.IsGuest);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BazimoonDbContext>();
        var identity = await db.UserIdentities.SingleAsync(i => i.UserId == first.UserId);
        Assert.Equal(IdentityProviders.Telegram, identity.Provider);
        Assert.Equal("880001", identity.ProviderUserId);
        Assert.Equal("returning", (await db.Users.FindAsync(first.UserId))!.DisplayName);
    }

    [Fact]
    public async Task Token_CarriesTheUserIdNameAndGuestFlag()
    {
        var auth = await SignInAsync(880011, "claims");
        var token = new JwtSecurityTokenHandler().ReadJwtToken(auth.Token);

        Assert.Equal(auth.UserId.ToString(), token.Claims.Single(c => c.Type == "user_id").Value);
        Assert.Equal("claims", token.Claims.Single(c => c.Type == "display_name").Value);
        Assert.Equal("false", token.Claims.Single(c => c.Type == "is_guest").Value);
    }
}
