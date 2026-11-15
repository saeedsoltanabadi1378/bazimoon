using Bazimoon.Api.Auth;

namespace Bazimoon.Api.Lounge;

public static class ClanEndpoints
{
    public static void MapClanEndpoints(this IEndpointRouteBuilder app)
    {
        var clans = app.MapGroup("/api/clans").RequireAuthorization();

        clans.MapGet("/me", (ClanService service, HttpContext http) =>
            service.GetMeAsync(http.User.GetUserId())).WithName("GetMyClan");

        clans.MapGet("", (string? search, ClanService service, HttpContext http) =>
            service.SearchAsync(http.User.GetUserId(), search)).WithName("FindClans");

        clans.MapPost("", (ClanEditRequest request, ClanService service, HttpContext http) =>
            service.CreateAsync(http.User.GetUserId(), http.User.GetDisplayName(), request)).WithName("CreateClan");

        clans.MapGet("/code/{code}", (string code, ClanService service, HttpContext http) =>
            service.PreviewCodeAsync(http.User.GetUserId(), code)).WithName("PreviewClanInvite");

        clans.MapPost("/code/{code}", (string code, ClanService service, HttpContext http) =>
            service.JoinByCodeAsync(http.User.GetUserId(), http.User.GetDisplayName(), code)).WithName("JoinClanByCode");

        clans.MapGet("/{clanId:guid}", (Guid clanId, ClanService service, HttpContext http) =>
            service.GetAsync(clanId, http.User.GetUserId())).WithName("GetClan");

        clans.MapPut("/{clanId:guid}", (Guid clanId, ClanEditRequest request, ClanService service, HttpContext http) =>
            service.UpdateAsync(clanId, http.User.GetUserId(), request)).WithName("UpdateClan");

        clans.MapDelete("/{clanId:guid}", async (Guid clanId, ClanService service, HttpContext http) =>
        {
            await service.DeleteAsync(clanId, http.User.GetUserId());
            return Results.NoContent();
        }).WithName("DeleteClan");

        clans.MapPost("/{clanId:guid}/invite-code", (Guid clanId, ClanService service, HttpContext http) =>
            service.ResetInviteCodeAsync(clanId, http.User.GetUserId())).WithName("ResetClanInviteCode");

        // ---------------------------------------------------------------- members

        clans.MapPost("/{clanId:guid}/requests", async (Guid clanId, ClanService service, HttpContext http) =>
        {
            await service.RequestAsync(clanId, http.User.GetUserId(), http.User.GetDisplayName());
            return Results.NoContent();
        }).WithName("AskToJoinClan");

        clans.MapDelete("/{clanId:guid}/requests", async (Guid clanId, ClanService service, HttpContext http) =>
        {
            await service.CancelRequestAsync(clanId, http.User.GetUserId());
            return Results.NoContent();
        }).WithName("CancelClanRequest");

        clans.MapPost("/{clanId:guid}/requests/{userId:guid}/accept", async (Guid clanId, Guid userId, ClanService service, HttpContext http) =>
        {
            await service.AcceptRequestAsync(clanId, http.User.GetUserId(), userId);
            return Results.NoContent();
        }).WithName("AcceptClanRequest");

        clans.MapPost("/{clanId:guid}/requests/{userId:guid}/decline", async (Guid clanId, Guid userId, ClanService service, HttpContext http) =>
        {
            await service.DeclineRequestAsync(clanId, http.User.GetUserId(), userId);
            return Results.NoContent();
        }).WithName("DeclineClanRequest");

        clans.MapPost("/{clanId:guid}/leave", async (Guid clanId, ClanService service, HttpContext http) =>
        {
            await service.LeaveAsync(clanId, http.User.GetUserId());
            return Results.NoContent();
        }).WithName("LeaveClan");

        clans.MapDelete("/{clanId:guid}/members/{userId:guid}", async (Guid clanId, Guid userId, ClanService service, HttpContext http) =>
        {
            await service.KickAsync(clanId, http.User.GetUserId(), userId);
            return Results.NoContent();
        }).WithName("RemoveClanMember");

        clans.MapPut("/{clanId:guid}/members/{userId:guid}/role", async (Guid clanId, Guid userId, ClanRoleRequest request, ClanService service, HttpContext http) =>
        {
            await service.SetRoleAsync(clanId, http.User.GetUserId(), userId, request.Role);
            return Results.NoContent();
        }).WithName("SetClanRole");

        clans.MapPost("/{clanId:guid}/members/{userId:guid}/owner", async (Guid clanId, Guid userId, ClanService service, HttpContext http) =>
        {
            await service.TransferAsync(clanId, http.User.GetUserId(), userId);
            return Results.NoContent();
        }).WithName("TransferClan");

        // ---------------------------------------------------------------- chat

        clans.MapGet("/{clanId:guid}/messages", (Guid clanId, long? after, ClanService service, HttpContext http) =>
            service.GetMessagesAsync(clanId, http.User.GetUserId(), after)).WithName("GetClanMessages");

        clans.MapPost("/{clanId:guid}/messages", (Guid clanId, ClanPostRequest request, ClanService service, HttpContext http) =>
            service.PostAsync(clanId, http.User.GetUserId(), http.User.GetDisplayName(), request)).WithName("PostClanMessage");

        clans.MapDelete("/{clanId:guid}/messages/{messageId:long}", async (Guid clanId, long messageId, ClanService service, HttpContext http) =>
        {
            await service.DeleteMessageAsync(clanId, http.User.GetUserId(), messageId);
            return Results.NoContent();
        }).WithName("DeleteClanMessage");

        // ---------------------------------------------------------------- game nights and tables

        clans.MapPost("/{clanId:guid}/events", (Guid clanId, ClanEventRequest request, ClanService service, HttpContext http) =>
            service.CreateEventAsync(clanId, http.User.GetUserId(), request)).WithName("CreateClanEvent");

        clans.MapDelete("/{clanId:guid}/events/{eventId:long}", async (Guid clanId, long eventId, ClanService service, HttpContext http) =>
        {
            await service.CancelEventAsync(clanId, http.User.GetUserId(), eventId);
            return Results.NoContent();
        }).WithName("CancelClanEvent");

        clans.MapPut("/{clanId:guid}/events/{eventId:long}/rsvp", async (Guid clanId, long eventId, ClanRsvpRequest request, ClanService service, HttpContext http) =>
        {
            await service.RsvpAsync(clanId, http.User.GetUserId(), eventId, request.Answer);
            return Results.NoContent();
        }).WithName("AnswerClanEvent");

        clans.MapPost("/{clanId:guid}/events/{eventId:long}/seat", async (Guid clanId, long eventId, ClanService service, HttpContext http) =>
            new ClanGameDto(await service.TakeEventSeatAsync(clanId, http.User.GetUserId(), http.User.GetDisplayName(), eventId))).WithName("TakeClanEventSeat");

        clans.MapPost("/{clanId:guid}/tables", async (Guid clanId, ClanTableRequest request, ClanService service, HttpContext http) =>
            new ClanGameDto(await service.OpenTableAsync(clanId, http.User.GetUserId(), http.User.GetDisplayName(), request))).WithName("OpenClanTable");

        clans.MapGet("/{clanId:guid}/ranking", (Guid clanId, string? period, ClanService service, HttpContext http) =>
            service.GetRankingAsync(clanId, http.User.GetUserId(), period)).WithName("GetClanRanking");

        // ---------------------------------------------------------------- admin console

        var admin = app.MapGroup("/api/admin/clans").RequireAuthorization("AdminOnly");

        admin.MapGet("", (string? search, ClanService service) => service.AdminListAsync(search)).WithName("AdminListClans");

        admin.MapDelete("/{clanId:guid}", async (Guid clanId, ClanService service, Bazimoon.Infrastructure.History.BazimoonDbContext db, HttpContext http) =>
        {
            if (!Admin.AdminEndpoints.ValidCsrf(http)) return Results.BadRequest(new { detail = "Invalid CSRF token." });
            if (!await service.AdminDeleteAsync(clanId)) return Results.NotFound();
            db.OperationalEvents.Add(new() { Category = "AdminAudit", Message = "Clan deleted", IsAdminAudit = true, TargetType = "Clan", TargetId = clanId.ToString(),
                MetadataJson = System.Text.Json.JsonSerializer.Serialize(new { actor = http.User.Identity?.Name }) });
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).WithName("AdminDeleteClan");
    }
}
