using Nightfall.Api.Auth;

namespace Nightfall.Api.EsmFamil;

public static class EsmFamilEndpoints
{
    public static void MapEsmFamilEndpoints(this IEndpointRouteBuilder app)
    {
        var rooms = app.MapGroup("/api/esmfamil/rooms").RequireAuthorization();

        rooms.MapPost("", (EsmRoomSettings settings, EsmFamilRoomService service, HttpContext http) =>
            service.CreateAsync(http.User.GetTelegramUserId(), http.User.GetTelegramUsername(), settings)).WithName("CreateEsmFamilRoom");

        rooms.MapGet("/{code}", (string code, EsmFamilRoomService service, HttpContext http) =>
            service.GetAsync(code, http.User.GetTelegramUserId())).WithName("GetEsmFamilRoom");

        rooms.MapPost("/{code}/join", (string code, EsmFamilRoomService service, HttpContext http) =>
            service.JoinAsync(code, http.User.GetTelegramUserId(), http.User.GetTelegramUsername())).WithName("JoinEsmFamilRoom");

        rooms.MapPost("/{code}/ready", (string code, EsmReadyRequest request, EsmFamilRoomService service, HttpContext http) =>
            service.SetReadyAsync(code, http.User.GetTelegramUserId(), request.Ready)).WithName("SetEsmFamilReady");

        rooms.MapPut("/{code}/settings", (string code, EsmRoomSettings settings, EsmFamilRoomService service, HttpContext http) =>
            service.UpdateSettingsAsync(code, http.User.GetTelegramUserId(), settings)).WithName("UpdateEsmFamilSettings");

        rooms.MapPost("/{code}/start", (string code, EsmFamilRoomService service, HttpContext http) =>
            service.StartAsync(code, http.User.GetTelegramUserId())).WithName("StartEsmFamilRoom");

        rooms.MapPut("/{code}/answers", (string code, EsmAnswersRequest request, EsmFamilRoomService service, HttpContext http) =>
            service.SaveAnswersAsync(code, http.User.GetTelegramUserId(), request.Answers)).WithName("SaveEsmFamilAnswers");

        rooms.MapPost("/{code}/stop", (string code, EsmAnswersRequest request, EsmFamilRoomService service, HttpContext http) =>
            service.StopAsync(code, http.User.GetTelegramUserId(), request.Answers)).WithName("StopEsmFamilRound");

        rooms.MapPost("/{code}/votes", (string code, EsmVoteRequest request, EsmFamilRoomService service, HttpContext http) =>
            service.VoteAsync(code, http.User.GetTelegramUserId(), request)).WithName("VoteEsmFamil");

        rooms.MapPost("/{code}/next", (string code, EsmFamilRoomService service, HttpContext http) =>
            service.NextRoundAsync(code, http.User.GetTelegramUserId())).WithName("NextEsmFamilRound");

        rooms.MapPost("/{code}/leave", (string code, EsmFamilRoomService service, HttpContext http) =>
            service.LeaveAsync(code, http.User.GetTelegramUserId())).WithName("LeaveEsmFamilRoom");
    }
}
