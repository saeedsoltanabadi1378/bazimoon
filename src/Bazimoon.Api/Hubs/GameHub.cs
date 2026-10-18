using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Bazimoon.Api.Auth;
using Bazimoon.Infrastructure;
using Bazimoon.Infrastructure.Sessions;

namespace Bazimoon.Api.Hubs;

[Authorize]
public sealed class GameHub : Hub
{
    private readonly IGameSessionStore _sessionStore;

    public GameHub(IGameSessionStore sessionStore)
    {
        _sessionStore = sessionStore;
    }

    /// <summary>Joins the caller's connection to a game's broadcast group, after verifying they're
    /// actually a player or a spectator in that game (derived from their authenticated Telegram id).</summary>
    public async Task JoinGame(Guid gameId)
    {
        var game = await _sessionStore.GetAsync(gameId) ?? throw new HubException("Game not found.");
        long telegramUserId = Context.User!.GetTelegramUserId();
        var playerId = PlayerIdentity.DeriveId(gameId, telegramUserId);

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
        var id = PlayerIdentity.DeriveId(gameId, Context.User!.GetTelegramUserId());
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
}
