using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Bazimoon.Api.Auth;
using Microsoft.Extensions.DependencyInjection;

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

    /// <summary>Runs the first night's timer out, as the phase clock would, so the test need not wait for it.</summary>
    public static async Task EndFirstNightAsync(BazimoonApiFactory factory, Guid gameId)
    {
        using var scope = factory.Services.CreateScope();
        var games = scope.ServiceProvider.GetRequiredService<Bazimoon.Api.Games.GameService>();
        for (int hours = 1; (await games.LoadOrThrowAsync(gameId)).CurrentPhase == Bazimoon.Domain.GamePhase.NightZero; hours++)
            await games.AdvanceExpiredAsync(gameId, DateTimeOffset.UtcNow.AddHours(hours));
    }

    /// <summary>Has every speaker give up the floor in turn, which takes the day into voting.</summary>
    public static async Task FinishDiscussionAsync(IReadOnlyList<HttpClient> clients, Guid gameId)
    {
        var byPlayer = new Dictionary<Guid, HttpClient>();
        foreach (var client in clients)
            byPlayer[(await client.GetFromJsonAsync<Bazimoon.Api.Games.GameView>($"/api/games/{gameId}"))!.YourPlayerId] = client;
        while ((await clients[0].GetFromJsonAsync<Bazimoon.Api.Games.GameView>($"/api/games/{gameId}"))!
               is { Phase: Bazimoon.Domain.GamePhase.Day, Discussion: { } discussion })
            (await byPlayer[discussion.ActivePlayerId].PostAsync($"/api/games/{gameId}/discussion/finish", null)).EnsureSuccessStatusCode();
    }

    /// <summary>The user id the test player got when it signed in.</summary>
    public static Guid UserIdOf(BazimoonApiFactory factory, long testUserId) => UserIds[(factory, testUserId)];
}
