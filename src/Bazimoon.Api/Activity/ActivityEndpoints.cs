using Bazimoon.Api.Auth;
using Bazimoon.Infrastructure.Activity;
using Bazimoon.Infrastructure.History;

namespace Bazimoon.Api.Activity;

/// <summary>Lets the client report the funnel steps the server has no other way to learn about — a
/// screen was seen, a game was started — before any server-side outcome exists to hang the event off.
/// Everything else (sign-up, Mafia, Couple Quiz, a finished puzzle) is tracked from the server code that
/// already owns that step, which is more reliable than trusting the client to call home.</summary>
public static class ActivityEndpoints
{
    public static void MapActivityEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/events", async (ClientEventRequest request, HttpContext http, IActivityTracker activity, BazimoonDbContext db) =>
        {
            if (string.IsNullOrWhiteSpace(request.Name) || !ActivityEvents.ClientReportable.Contains(request.Name))
                return Results.BadRequest(new { detail = "Unknown event." });
            activity.Track(http.User.GetUserId(), request.Flow ?? ActivityEvents.Puzzle, request.Name, request.Properties);
            await db.SaveChangesAsync();
            return Results.NoContent();
        })
        .WithName("TrackClientEvent")
        .RequireAuthorization();
    }
}

public sealed record ClientEventRequest(string Name, string? Flow = null, object? Properties = null);
