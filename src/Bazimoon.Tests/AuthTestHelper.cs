using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Bazimoon.Api.Auth;

namespace Bazimoon.Tests;

internal static class AuthTestHelper
{
    private static readonly ConcurrentDictionary<(BazimoonApiFactory, long), Guid> UserIds = new();

    /// <summary>Signs in through the Telegram endpoint as the given test Telegram user.</summary>
    public static async Task<HttpClient> CreateAuthenticatedClientAsync(BazimoonApiFactory factory, long telegramUserId, string username)
    {
        var client = factory.CreateClient();
        string initData = TelegramInitDataFixture.Sign(BazimoonApiFactory.TestBotToken, telegramUserId, username);

        var response = await client.PostAsJsonAsync("/api/auth/telegram", new TelegramAuthRequest(initData));
        response.EnsureSuccessStatusCode();

        var auth = await response.Content.ReadFromJsonAsync<AuthUserResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        UserIds[(factory, telegramUserId)] = auth.UserId;

        return client;
    }

    /// <summary>The Bazimoon user id a test Telegram user got when it signed in.</summary>
    public static Guid UserIdOf(BazimoonApiFactory factory, long telegramUserId) => UserIds[(factory, telegramUserId)];
}
