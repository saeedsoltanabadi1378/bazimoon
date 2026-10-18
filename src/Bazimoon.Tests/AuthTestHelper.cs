using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Bazimoon.Api.Auth;

namespace Bazimoon.Tests;

internal static class AuthTestHelper
{
    private static readonly ConcurrentDictionary<(BazimoonApiFactory, long), Guid> UserIds = new();

    /// <summary>Signs in as a new guest named <paramref name="username"/>. <paramref name="testUserId"/>
    /// is the test's own handle for this player; <see cref="UserIdOf"/> turns it into the real user id.</summary>
    public static async Task<HttpClient> CreateAuthenticatedClientAsync(BazimoonApiFactory factory, long testUserId, string username)
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/guest", new GuestAuthRequest(username));
        response.EnsureSuccessStatusCode();

        var auth = await response.Content.ReadFromJsonAsync<AuthSessionResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.AccessToken);
        UserIds[(factory, testUserId)] = auth.User.Id;

        return client;
    }

    /// <summary>The user id the test player got when it signed in.</summary>
    public static Guid UserIdOf(BazimoonApiFactory factory, long testUserId) => UserIds[(factory, testUserId)];
}
