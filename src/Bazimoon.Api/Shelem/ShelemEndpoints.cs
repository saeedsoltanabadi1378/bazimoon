using Bazimoon.Api.Auth;
using Bazimoon.Api.Games;
using Bazimoon.Infrastructure.Agora;

namespace Bazimoon.Api.Shelem;

public static class ShelemEndpoints
{
    public static void MapShelemEndpoints(this IEndpointRouteBuilder app)
    {
        var rooms = app.MapGroup("/api/shelem/rooms").RequireAuthorization();
        rooms.MapPost("", (CreateShelemRequest request, ShelemRoomService service, HttpContext http) => service.CreateAsync(http.User.GetUserId(), http.User.GetDisplayName(), request.WithBots));
        rooms.MapGet("/{code}", (string code, ShelemRoomService service, HttpContext http) => service.GetAsync(code, http.User.GetUserId()));
        rooms.MapPost("/{code}/join", (string code, ShelemRoomService service, HttpContext http) => service.JoinAsync(code, http.User.GetUserId(), http.User.GetDisplayName()));
        rooms.MapPost("/{code}/seats", (string code, MoveShelemPlayerRequest request, ShelemRoomService service, HttpContext http) => service.MovePlayerAsync(code, http.User.GetUserId(), request.FromSeat, request.ToSeat));
        rooms.MapPost("/{code}/ready", (string code, ReadyShelemRequest request, ShelemRoomService service, HttpContext http) => service.ReadyAsync(code, http.User.GetUserId(), request.Ready));
        rooms.MapPost("/{code}/start", (string code, StartShelemRequest request, ShelemRoomService service, HttpContext http) => service.StartAsync(code, http.User.GetUserId(), request.FillBots));
        rooms.MapPost("/{code}/bid", (string code, BidShelemRequest request, ShelemRoomService service, HttpContext http) => service.BidAsync(code, http.User.GetUserId(), request.Bid, request.Shelem));
        rooms.MapPost("/{code}/discard", (string code, CardsShelemRequest request, ShelemRoomService service, HttpContext http) => service.DiscardAsync(code, http.User.GetUserId(), request.Cards));
        rooms.MapPost("/{code}/trump", (string code, TrumpShelemRequest request, ShelemRoomService service, HttpContext http) => service.TrumpAsync(code, http.User.GetUserId(), request.Suit));
        rooms.MapPost("/{code}/play", (string code, PlayShelemRequest request, ShelemRoomService service, HttpContext http) => service.PlayAsync(code, http.User.GetUserId(), request.Card));
        rooms.MapPost("/{code}/next", (string code, ShelemRoomService service, HttpContext http) => service.NextAsync(code, http.User.GetUserId()));
        rooms.MapGet("/{code}/voice-token", (string code, ShelemRoomService service, IAgoraTokenService tokens, HttpContext http) =>
        {
            var userId = http.User.GetUserId();
            if (!service.IsMember(code, userId)) throw new ForbiddenGameActionException("You are not in this room.");
            string channel = $"bazimoon-shelem-{ShelemRoomService.NormalizeCode(code)}";
            uint uid = ShelemRoomService.VoiceUid(userId);
            string token = tokens.BuildRtcToken(channel, uid, AgoraRtcRole.Publisher, TimeSpan.FromHours(6), TimeSpan.FromHours(6));
            return Results.Ok(new VoiceTokenResponse(token, channel, uid, AgoraRtcRole.Publisher.ToString()));
        });
    }
}

public sealed record CreateShelemRequest(bool WithBots);
public sealed record ReadyShelemRequest(bool Ready);
public sealed record StartShelemRequest(bool FillBots);
public sealed record BidShelemRequest(int? Bid, bool Shelem);
public sealed record CardsShelemRequest(List<string> Cards);
public sealed record TrumpShelemRequest(string Suit);
public sealed record PlayShelemRequest(string Card);

public sealed record MoveShelemPlayerRequest(int FromSeat, int ToSeat);
