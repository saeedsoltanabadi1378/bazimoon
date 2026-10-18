using Microsoft.AspNetCore.Authorization;
using Bazimoon.Api.Auth;
using Bazimoon.Domain;
using Bazimoon.Infrastructure;
using Bazimoon.Infrastructure.Agora;

namespace Bazimoon.Api.Games;

public static class GameEndpoints
{
    public static void MapGameEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/games").RequireAuthorization();

        group.MapPost("/", async (CreateGameRequest request, GameService games, HttpContext http) =>
        {
            var gameId = await games.CreateGameAsync(request.TelegramChatId, http.User.GetTelegramUserId(), http.User.GetTelegramUsername(), request.ChatTitle);
            return Results.Ok(new CreateGameResponse(gameId));
        }).WithName("CreateGame");

        group.MapPost("/{gameId:guid}/players", async (Guid gameId, GameService games, HttpContext http) =>
        {
            await games.JoinGameAsync(gameId, http.User.GetTelegramUserId(), http.User.GetTelegramUsername());
            return Results.Ok();
        }).WithName("JoinGame");

        group.MapPost("/{gameId:guid}/rematch", async (Guid gameId, GameService games, HttpContext http) =>
        {
            var rematchId = await games.RematchAsync(gameId, http.User.GetTelegramUserId(), http.User.GetTelegramUsername());
            return Results.Ok(new CreateGameResponse(rematchId));
        }).WithName("Rematch");

        group.MapDelete("/{gameId:guid}/players", async (Guid gameId, GameService games, HttpContext http) =>
        {
            await games.LeaveGameAsync(gameId, http.User.GetTelegramUserId());
            return Results.Ok();
        }).WithName("LeaveGame");

        group.MapGet("/{gameId:guid}", async (Guid gameId, GameService games, HttpContext http) =>
        {
            var game = await games.LoadOrThrowAsync(gameId);
            var viewerId = PlayerIdentity.DeriveId(gameId, http.User.GetTelegramUserId());
            return Results.Ok(GameView.For(game, viewerId));
        }).WithName("GetGame");

        group.MapGet("/by-chat/{telegramChatId:long}", async (long telegramChatId, GameService games) =>
        {
            var gameId = await games.GetActiveGameForChatOrThrowAsync(telegramChatId);
            return Results.Ok(new CreateGameResponse(gameId));
        }).WithName("GetActiveGameForChat");

        group.MapPost("/{gameId:guid}/start", async (Guid gameId, GameService games, HttpContext http) =>
        {
            await games.StartGameAsync(gameId, http.User.GetTelegramUserId());
            return Results.Ok();
        }).WithName("StartGame");

        group.MapPost("/{gameId:guid}/night-actions", async (Guid gameId, SubmitNightActionRequest request, GameService games, HttpContext http) =>
        {
            await games.SubmitNightActionAsync(gameId, http.User.GetTelegramUserId(), request.TargetPlayerId, request.ActionType);
            return Results.Ok();
        }).WithName("SubmitNightAction");

        group.MapPost("/{gameId:guid}/resolve-night", async (Guid gameId, GameService games, HttpContext http) =>
        {
            var result = await games.ResolveNightAsync(gameId, http.User.GetTelegramUserId());
            return Results.Ok(result);
        }).WithName("ResolveNight");

        group.MapPost("/{gameId:guid}/votes", async (Guid gameId, SubmitVoteRequest request, GameService games, HttpContext http) =>
        {
            await games.SubmitVoteAsync(gameId, http.User.GetTelegramUserId(), request.TargetPlayerId);
            return Results.Ok();
        }).WithName("SubmitVote");

        group.MapPost("/{gameId:guid}/resolve-voting", async (Guid gameId, GameService games, HttpContext http) =>
        {
            var result = await games.ResolveVotingAsync(gameId, http.User.GetTelegramUserId());
            return Results.Ok(result);
        }).WithName("ResolveVoting");

        group.MapPost("/{gameId:guid}/start-voting", async (Guid gameId, GameService games, HttpContext http) =>
        {
            await games.StartVotingAsync(gameId, http.User.GetTelegramUserId());
            return Results.Ok();
        }).WithName("StartVoting");

        group.MapPost("/{gameId:guid}/start-night", async (Guid gameId, GameService games, HttpContext http) =>
        {
            await games.StartNightAsync(gameId, http.User.GetTelegramUserId());
            return Results.Ok();
        }).WithName("StartNight");

        group.MapPost("/{gameId:guid}/discussion/challenges", async (Guid gameId, GameService games, HttpContext http) =>
        {
            await games.RequestChallengeAsync(gameId, http.User.GetTelegramUserId());
            return Results.Ok();
        }).WithName("RequestDiscussionChallenge");

        group.MapDelete("/{gameId:guid}/discussion/challenges", async (Guid gameId, GameService games, HttpContext http) =>
        {
            await games.CancelChallengeAsync(gameId, http.User.GetTelegramUserId());
            return Results.Ok();
        }).WithName("CancelDiscussionChallenge");

        group.MapPost("/{gameId:guid}/discussion/challenges/{challengerId:guid}/accept", async (Guid gameId, Guid challengerId, GameService games, HttpContext http) =>
        {
            await games.AcceptChallengeAsync(gameId, http.User.GetTelegramUserId(), challengerId);
            return Results.Ok();
        }).WithName("AcceptDiscussionChallenge");

        group.MapPost("/{gameId:guid}/discussion/challenges/{challengerId:guid}/reject", async (Guid gameId, Guid challengerId, GameService games, HttpContext http) =>
        {
            await games.RejectChallengeAsync(gameId, http.User.GetTelegramUserId(), challengerId);
            return Results.Ok();
        }).WithName("RejectDiscussionChallenge");

        group.MapPost("/{gameId:guid}/discussion/finish", async (Guid gameId, GameService games, HttpContext http) =>
        {
            await games.FinishDiscussionAsync(gameId, http.User.GetTelegramUserId());
            return Results.Ok();
        }).WithName("FinishDiscussionSegment");

        group.MapPut("/{gameId:guid}/ready", async (Guid gameId, SetReadyRequest request, GameService games, HttpContext http) =>
        {
            await games.SetReadyAsync(gameId, http.User.GetTelegramUserId(), request.Ready);
            return Results.Ok();
        }).WithName("SetReady");

        group.MapPost("/{gameId:guid}/last-words/finish", async (Guid gameId, GameService games, HttpContext http) =>
        {
            await games.FinishLastWordsAsync(gameId, http.User.GetTelegramUserId());
            return Results.Ok();
        }).WithName("FinishLastWords");

        group.MapPost("/{gameId:guid}/mayor/reveal", async (Guid gameId, GameService games, HttpContext http) =>
        {
            await games.RevealMayorAsync(gameId, http.User.GetTelegramUserId());
            return Results.Ok();
        }).WithName("RevealMayor");

        group.MapPost("/{gameId:guid}/inquiry", async (Guid gameId, GameService games, HttpContext http) =>
        {
            await games.CallInquiryAsync(gameId, http.User.GetTelegramUserId());
            return Results.Ok();
        }).WithName("CallInquiry");

        group.MapGet("/{gameId:guid}/voice-token", async (Guid gameId, string channel, GameService games, IAgoraTokenService agoraTokens, HttpContext http) =>
        {
            var game = await games.LoadOrThrowAsync(gameId);
            long telegramUserId = http.User.GetTelegramUserId();
            var playerId = PlayerIdentity.DeriveId(gameId, telegramUserId);
            var player = game.GetPlayer(playerId) ?? throw new ForbiddenGameActionException("You are not a player in this game.");

            string channelName;
            AgoraRtcRole role;
            switch (channel)
            {
                case "main":
                    channelName = $"bazimoon-{gameId}";
                    // During the timed day discussion and a defence only the active speaker (or accepted challenger)
                    // holds the floor; everyone else listens until their turn. Clients rejoin on every turn change.
                    // Last words are the one time a player who is out may speak.
                    bool mayTalk = game.CurrentPhase switch
                    {
                        // A silenced player only listens all day.
                        GamePhase.Day => player.IsAlive && player.Id != game.SilencedPlayerId && (game.Discussion is null || game.Discussion.ActivePlayerId == player.Id),
                        GamePhase.Defence => player.IsAlive && game.Discussion?.ActivePlayerId == player.Id,
                        GamePhase.LastWords => game.LastWordsPlayerId == player.Id,
                        GamePhase.Voting or GamePhase.Results => player.IsAlive && player.Id != game.SilencedPlayerId,
                        _ => false
                    };
                    role = mayTalk ? AgoraRtcRole.Publisher : AgoraRtcRole.Subscriber;
                    break;
                case "mafia":
                    if (!player.IsAlive || !player.IsMafiaAligned)
                        throw new ForbiddenGameActionException("Only living Mafia-aligned players may join the Mafia voice channel.");
                    if (game.CurrentPhase is not (GamePhase.NightZero or GamePhase.Night))
                        throw new ForbiddenGameActionException("The Mafia voice channel is only available at night.");
                    channelName = $"bazimoon-{gameId}-mafia";
                    role = AgoraRtcRole.Publisher;
                    break;
                default:
                    return Results.BadRequest(new { detail = "channel must be 'main' or 'mafia'." });
            }

            uint uid = unchecked((uint)telegramUserId);
            string token = agoraTokens.BuildRtcToken(channelName, uid, role, TimeSpan.FromHours(6), TimeSpan.FromHours(6));

            return Results.Ok(new VoiceTokenResponse(token, channelName, uid, role.ToString()));
        }).WithName("GetVoiceToken");
    }
}

public sealed record CreateGameRequest(long TelegramChatId, string? ChatTitle = null);

public sealed record CreateGameResponse(Guid GameId);

public sealed record SubmitNightActionRequest(Guid TargetPlayerId, NightActionType ActionType);

public sealed record SubmitVoteRequest(Guid? TargetPlayerId);

public sealed record VoiceTokenResponse(string Token, string Channel, uint Uid, string Role);

public sealed record SetReadyRequest(bool Ready);
