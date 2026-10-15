using Nightfall.Api.Auth;

namespace Nightfall.Api.Lounge;

public static class TableEndpoints
{
    public static void MapTableEndpoints(this IEndpointRouteBuilder app)
    {
        var tables = app.MapGroup("/api/tables").RequireAuthorization();

        tables.MapGet("", async (string? scope, TableService service, HttpContext http) =>
        {
            long userId = http.User.GetTelegramUserId();
            return scope == "groups" ? await service.GetGroupTablesAsync(userId) : await service.GetOpenTablesAsync(userId);
        }).WithName("ListTables");

        tables.MapGet("/groups", (TableService service, HttpContext http) =>
            service.GetGroupsAsync(http.User.GetTelegramUserId())).WithName("ListTableGroups");

        tables.MapPost("", (CreateTableRequest request, TableService service, HttpContext http) =>
            service.CreateAsync(http.User.GetTelegramUserId(), http.User.GetTelegramUsername(), request)).WithName("CreateTable");

        tables.MapGet("/code/{code}", async (string code, TableService service) =>
            await service.ResolveAsync(code) is { } gameId
                ? Results.Ok(new Games.CreateGameResponse(gameId))
                : Results.Problem(statusCode: 404, title: "Game not found", detail: "No live table has that code.")).WithName("ResolveTableCode");

        tables.MapGet("/{gameId:guid}", async (Guid gameId, TableService service, HttpContext http) =>
            await service.GetInfoAsync(gameId, http.User.GetTelegramUserId()) is { } info
                ? Results.Ok(info)
                : Results.Problem(statusCode: 404, title: "Game not found", detail: "That table no longer exists.")).WithName("GetTable");

        tables.MapPut("/{gameId:guid}/open", (Guid gameId, SetTableOpenRequest request, TableService service, HttpContext http) =>
            service.SetOpenAsync(gameId, http.User.GetTelegramUserId(), request.IsOpen)).WithName("SetTableOpen");
    }
}
