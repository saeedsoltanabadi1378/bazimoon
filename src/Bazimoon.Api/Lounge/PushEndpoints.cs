using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Bazimoon.Api.Auth;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Identity;

namespace Bazimoon.Api.Lounge;

public static class PushEndpoints
{
    public static void MapPushEndpoints(this IEndpointRouteBuilder app)
    {
        var push = app.MapGroup("/api/push");

        // The app needs the public VAPID key to subscribe; empty means notifications are off.
        push.MapGet("/key", (IOptions<PushOptions> options) =>
            Results.Ok(new PushKeyResponse(options.Value.IsConfigured ? options.Value.PublicKey : null)))
            .WithName("GetPushKey")
            .AllowAnonymous();

        push.MapPost("/subscriptions", async (PushSubscriptionRequest request, HttpContext http, BazimoonDbContext db) =>
        {
            if (!IsValid(request)) return Results.BadRequest(new { detail = "A push subscription needs an https endpoint and its keys." });
            var userId = http.User.GetUserId();
            // A device belongs to whoever subscribed it last (e.g. after logging out and in as someone else).
            var existing = await db.PushSubscriptions.FirstOrDefaultAsync(s => s.Endpoint == request.Endpoint);
            if (existing is null)
            {
                db.PushSubscriptions.Add(new PushSubscriptionRecord { UserId = userId, Endpoint = request.Endpoint, P256dh = request.Keys!.P256dh!, Auth = request.Keys.Auth! });
            }
            else
            {
                existing.UserId = userId;
                existing.P256dh = request.Keys!.P256dh!;
                existing.Auth = request.Keys.Auth!;
            }
            await db.SaveChangesAsync();
            return Results.NoContent();
        })
        .WithName("SubscribePush")
        .RequireAuthorization();

        push.MapPost("/subscriptions/remove", async (PushUnsubscribeRequest request, HttpContext http, BazimoonDbContext db) =>
        {
            var userId = http.User.GetUserId();
            var existing = await db.PushSubscriptions.FirstOrDefaultAsync(s => s.Endpoint == request.Endpoint && s.UserId == userId);
            if (existing is not null)
            {
                db.PushSubscriptions.Remove(existing);
                await db.SaveChangesAsync();
            }
            return Results.NoContent();
        })
        .WithName("UnsubscribePush")
        .RequireAuthorization();
    }

    private static bool IsValid(PushSubscriptionRequest r) =>
        Uri.TryCreate(r.Endpoint, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps && r.Endpoint.Length <= 1024
        && r.Keys is { P256dh.Length: > 0 and <= 128, Auth.Length: > 0 and <= 64 };
}

public sealed record PushKeyResponse(string? PublicKey);

public sealed record PushKeys(string? P256dh, string? Auth);

public sealed record PushSubscriptionRequest(string Endpoint, PushKeys? Keys);

public sealed record PushUnsubscribeRequest(string Endpoint);
