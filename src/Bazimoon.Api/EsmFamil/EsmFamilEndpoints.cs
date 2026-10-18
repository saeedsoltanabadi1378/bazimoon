using Bazimoon.Api.Auth;

namespace Bazimoon.Api.EsmFamil;

public static class EsmFamilEndpoints
{
    public static void MapEsmFamilEndpoints(this IEndpointRouteBuilder app)
    {
        var rooms = app.MapGroup("/api/esmfamil/rooms").RequireAuthorization();

        rooms.MapPost("", (EsmRoomSettings settings, EsmFamilRoomService service, HttpContext http) =>
            service.CreateAsync(http.User.GetUserId(), http.User.GetDisplayName(), settings)).WithName("CreateEsmFamilRoom");

        rooms.MapGet("/{code}", (string code, EsmFamilRoomService service, HttpContext http) =>
            service.GetAsync(code, http.User.GetUserId())).WithName("GetEsmFamilRoom");

        rooms.MapPost("/{code}/join", (string code, EsmFamilRoomService service, HttpContext http) =>
            service.JoinAsync(code, http.User.GetUserId(), http.User.GetDisplayName())).WithName("JoinEsmFamilRoom");

        rooms.MapPost("/{code}/ready", (string code, EsmReadyRequest request, EsmFamilRoomService service, HttpContext http) =>
            service.SetReadyAsync(code, http.User.GetUserId(), request.Ready)).WithName("SetEsmFamilReady");

        rooms.MapPut("/{code}/settings", (string code, EsmRoomSettings settings, EsmFamilRoomService service, HttpContext http) =>
            service.UpdateSettingsAsync(code, http.User.GetUserId(), settings)).WithName("UpdateEsmFamilSettings");

        rooms.MapPost("/{code}/start", (string code, EsmFamilRoomService service, HttpContext http) =>
            service.StartAsync(code, http.User.GetUserId())).WithName("StartEsmFamilRoom");

        rooms.MapPut("/{code}/answers", (string code, EsmAnswersRequest request, EsmFamilRoomService service, HttpContext http) =>
            service.SaveAnswersAsync(code, http.User.GetUserId(), request.Answers)).WithName("SaveEsmFamilAnswers");

        rooms.MapPost("/{code}/stop", (string code, EsmAnswersRequest request, EsmFamilRoomService service, HttpContext http) =>
            service.StopAsync(code, http.User.GetUserId(), request.Answers)).WithName("StopEsmFamilRound");

        rooms.MapPost("/{code}/votes", (string code, EsmVoteRequest request, EsmFamilRoomService service, HttpContext http) =>
            service.VoteAsync(code, http.User.GetUserId(), request)).WithName("VoteEsmFamil");

        rooms.MapPost("/{code}/next", (string code, EsmFamilRoomService service, HttpContext http) =>
            service.NextRoundAsync(code, http.User.GetUserId())).WithName("NextEsmFamilRound");

        rooms.MapPost("/{code}/leave", (string code, EsmFamilRoomService service, HttpContext http) =>
            service.LeaveAsync(code, http.User.GetUserId())).WithName("LeaveEsmFamilRoom");
    }
}
