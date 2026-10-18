using Bazimoon.Api.Auth;

namespace Bazimoon.Api.Lounge;

public static class TableEndpoints
{
    public static void MapTableEndpoints(this IEndpointRouteBuilder app)
    {
        var tables = app.MapGroup("/api/tables").RequireAuthorization();

        tables.MapGet("", async (string? scope, TableService service, HttpContext http) =>
        {
            Guid userId = http.User.GetUserId();
            return scope == "mine" ? await service.GetYourTablesAsync(userId) : await service.GetOpenTablesAsync(userId);
        }).WithName("ListTables");

        tables.MapPost("", (CreateTableRequest request, TableService service, HttpContext http) =>
            service.CreateAsync(http.User.GetUserId(), http.User.GetDisplayName(), request)).WithName("CreateTable");

        tables.MapGet("/code/{code}", async (string code, TableService service) =>
            await service.ResolveAsync(code) is { } gameId
                ? Results.Ok(new Games.CreateGameResponse(gameId))
                : Results.Problem(statusCode: 404, title: "Game not found", detail: "No live table has that code.")).WithName("ResolveTableCode");

        tables.MapGet("/{gameId:guid}", async (Guid gameId, TableService service, HttpContext http) =>
            await service.GetInfoAsync(gameId, http.User.GetUserId()) is { } info
                ? Results.Ok(info)
                : Results.Problem(statusCode: 404, title: "Game not found", detail: "That table no longer exists.")).WithName("GetTable");

        tables.MapPut("/{gameId:guid}/open", (Guid gameId, SetTableOpenRequest request, TableService service, HttpContext http) =>
            service.SetOpenAsync(gameId, http.User.GetUserId(), request.IsOpen)).WithName("SetTableOpen");
    }
}
