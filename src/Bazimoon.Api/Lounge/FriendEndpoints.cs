using Bazimoon.Api.Auth;

namespace Bazimoon.Api.Lounge;

public static class FriendEndpoints
{
    public static void MapFriendEndpoints(this IEndpointRouteBuilder app)
    {
        var friends = app.MapGroup("/api/friends").RequireAuthorization();

        friends.MapGet("", (FriendService service, HttpContext http) =>
            service.GetAsync(http.User.GetUserId(), http.User.GetDisplayName())).WithName("GetFriends");

        friends.MapGet("/code/{code}", (string code, FriendService service, HttpContext http) =>
            service.PreviewCodeAsync(http.User.GetUserId(), code)).WithName("PreviewFriendCode");

        friends.MapPost("/code/{code}", (string code, FriendService service, HttpContext http) =>
            service.AddByCodeAsync(http.User.GetUserId(), http.User.GetDisplayName(), code)).WithName("AddFriendByCode");

        friends.MapPost("/requests", async (FriendRequestBody body, FriendService service, HttpContext http) =>
        {
            await service.RequestAsync(http.User.GetUserId(), http.User.GetDisplayName(), body.UserId);
            return Results.NoContent();
        }).WithName("SendFriendRequest");

        friends.MapPost("/requests/{id:long}/accept", async (long id, FriendService service, HttpContext http) =>
        {
            await service.AcceptAsync(http.User.GetUserId(), http.User.GetDisplayName(), id);
            return Results.NoContent();
        }).WithName("AcceptFriendRequest");

        friends.MapDelete("/{userId:guid}", async (Guid userId, FriendService service, HttpContext http) =>
        {
            await service.RemoveAsync(http.User.GetUserId(), userId);
            return Results.NoContent();
        }).WithName("RemoveFriend");

        var invites = app.MapGroup("/api/invites").RequireAuthorization();

        invites.MapGet("", (FriendService service, HttpContext http) =>
            service.GetInvitesAsync(http.User.GetUserId())).WithName("GetGameInvites");

        invites.MapPost("", async (InviteRequest request, FriendService service, HttpContext http) =>
            new InviteResultDto(await service.InviteAsync(http.User.GetUserId(), http.User.GetDisplayName(), request))).WithName("InviteFriends");

        invites.MapGet("/sent", (string kind, string target, FriendService service, HttpContext http) =>
            service.GetSentAsync(http.User.GetUserId(), kind, target)).WithName("GetSentGameInvites");

        invites.MapPost("/{id:long}/accept", (long id, FriendService service, HttpContext http) =>
            service.AcceptInviteAsync(http.User.GetUserId(), http.User.GetDisplayName(), id)).WithName("AcceptGameInvite");

        invites.MapPost("/{id:long}/decline", async (long id, FriendService service, HttpContext http) =>
        {
            await service.DeclineInviteAsync(http.User.GetUserId(), id);
            return Results.NoContent();
        }).WithName("DeclineGameInvite");
    }
}
