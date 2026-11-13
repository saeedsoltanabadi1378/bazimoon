using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Bazimoon.Api.Auth;
using Bazimoon.Api.Shelem;
using Bazimoon.Infrastructure;
using Bazimoon.Infrastructure.Sessions;

namespace Bazimoon.Api.Hubs;

[Authorize]
public sealed class GameHub : Hub
{
    private readonly IGameSessionStore _sessionStore;
    private readonly ShelemRoomService _shelem;

    public GameHub(IGameSessionStore sessionStore, ShelemRoomService shelem)
    {
        _sessionStore = sessionStore;
        _shelem = shelem;
    }

    /// <summary>Joins a Shelem room's update pings. Only seated players may listen.</summary>
    public async Task JoinShelem(string code)
    {
        if (!_shelem.IsMember(code, Context.User!.GetUserId()))
            throw new HubException("You are not in this room.");
        await Groups.AddToGroupAsync(Context.ConnectionId, ShelemGroupName(code));
    }

    public Task SendReaction(Guid gameId, string kind,
        [FromServices] MafiaReactions reactions, [FromServices] Bazimoon.Api.Games.GameMutationLock mutationLock)
        => BroadcastReaction(gameId, kind, null, reactions, mutationLock);

    /// <summary>A reaction aimed at another living player. A separate method, so apps that only know
    /// <see cref="SendReaction"/> keep working.</summary>
    public Task SendAimedReaction(Guid gameId, string kind, Guid targetId,
        [FromServices] MafiaReactions reactions, [FromServices] Bazimoon.Api.Games.GameMutationLock mutationLock)
        => BroadcastReaction(gameId, kind, targetId, reactions, mutationLock);

    private async Task BroadcastReaction(Guid gameId, string kind, Guid? targetId,
        MafiaReactions reactions, Bazimoon.Api.Games.GameMutationLock mutationLock)
    {
        using var lease = await mutationLock.EnterAsync(gameId, Context.ConnectionAborted);
        var game = await _sessionStore.GetAsync(gameId) ?? throw new HubException("reaction_unavailable");
        var playerId = PlayerIdentity.DeriveId(gameId, Context.User!.GetUserId());
        var reaction = reactions.Create(game, playerId, kind, targetId);
        await Clients.Group(GroupName(gameId)).SendAsync("MafiaReaction", new { gameId, reaction });
    }

    public Task LeaveShelem(string code) => Groups.RemoveFromGroupAsync(Context.ConnectionId, ShelemGroupName(code));

    /// <summary>Joins the caller's connection to a game's broadcast group, after verifying they're
    /// actually a player or a spectator in that game (derived from their authenticated user id).</summary>
    public async Task JoinGame(Guid gameId)
    {
        var game = await _sessionStore.GetAsync(gameId) ?? throw new HubException("Game not found.");
        Guid userId = Context.User!.GetUserId();
        var playerId = PlayerIdentity.DeriveId(gameId, userId);

        if (game.GetPlayer(playerId) is null && game.GetSpectator(playerId) is null)
            throw new HubException("You are not a player in this game.");

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(gameId));
        if (game.CanUseGraveyard(playerId))
            await Groups.AddToGroupAsync(Context.ConnectionId, GraveyardGroupName(gameId));
    }

    /// <summary>Adds the connection to the graveyard chat once the caller is out or watching. The living are refused.</summary>
    public async Task JoinGraveyard(Guid gameId)
    {
        var game = await _sessionStore.GetAsync(gameId) ?? throw new HubException("Game not found.");
        var id = PlayerIdentity.DeriveId(gameId, Context.User!.GetUserId());
        if (!game.CanUseGraveyard(id))
            throw new HubException("Only players who are out and spectators can use the graveyard.");
        await Groups.AddToGroupAsync(Context.ConnectionId, GraveyardGroupName(gameId));
    }

    public async Task LeaveGame(Guid gameId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(gameId));
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GraveyardGroupName(gameId));
    }

    internal static string GroupName(Guid gameId) => $"game:{gameId}";

    internal static string GraveyardGroupName(Guid gameId) => $"graveyard:{gameId}";

    internal static string ShelemGroupName(string code) => $"shelem:{ShelemRoomService.NormalizeCode(code)}";
}
