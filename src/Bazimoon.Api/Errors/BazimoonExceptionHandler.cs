using Microsoft.AspNetCore.Diagnostics;
using Bazimoon.Api.Games;
using Bazimoon.Domain;

namespace Bazimoon.Api.Errors;

/// <summary>Central mapping from domain/application exceptions to HTTP responses, so endpoint
/// handlers don't each need their own try/catch for "this is just a rule violation, return 400".</summary>
public sealed class BazimoonExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (statusCode, title) = exception switch
        {
            GameNotFoundException => (StatusCodes.Status404NotFound, "Game not found"),
            GameException => (StatusCodes.Status400BadRequest, "Invalid game action"),
            ForbiddenGameActionException => (StatusCodes.Status403Forbidden, "Forbidden"),
            _ => (0, string.Empty)
        };

        if (statusCode == 0)
            return false;

        httpContext.Response.StatusCode = statusCode;
        var code = GameErrorCode.For(exception);
        await httpContext.Response.WriteAsJsonAsync(new
        {
            title,
            detail = exception.Message,
            code
        }, cancellationToken);

        return true;
    }
}

/// <summary>Turns legacy exception messages into stable codes while domain call sites migrate to
/// explicit codes. Clients must localize the code and treat <see cref="Exception.Message"/> as a
/// diagnostic fallback only.</summary>
internal static class GameErrorCode
{
    public static string For(Exception exception)
    {
        if (exception is GameException { Code: { Length: > 0 } gameCode }) return gameCode;
        if (exception is ForbiddenGameActionException { Code: { Length: > 0 } forbiddenCode }) return forbiddenCode;
        if (exception is GameNotFoundException) return "game_not_found";

        var message = exception.Message;
        if (message.Contains("Lobby is full", StringComparison.Ordinal)) return "lobby_full";
        if (message.Contains("At least", StringComparison.Ordinal) && message.Contains("players", StringComparison.Ordinal)) return "not_enough_players";
        if (message.Contains("role setup needs", StringComparison.Ordinal)) return "role_setup_invalid";
        if (message.Contains("already joined", StringComparison.Ordinal)) return "already_joined";
        if (message.Contains("only join during", StringComparison.Ordinal)) return "game_already_started";
        if (message.Contains("not in this lobby", StringComparison.Ordinal)) return "not_in_lobby";
        if (message.Contains("Ready can only", StringComparison.Ordinal)) return "ready_unavailable";
        if (message.Contains("night roles must submit", StringComparison.Ordinal)) return "night_actions_pending";
        if (message.Contains("already been investigated", StringComparison.Ordinal)) return "already_investigated";
        if (message.Contains("cannot self-heal", StringComparison.Ordinal)) return "doctor_repeat_self_heal";
        if (message.Contains("cannot target its own", StringComparison.Ordinal)) return "mafia_team_target";
        if (message.Contains("already used their shot", StringComparison.Ordinal)) return "sniper_shot_used";
        if (message.Contains("cannot shoot themselves", StringComparison.Ordinal)) return "cannot_target_self";
        if (message.Contains("cannot silence themselves", StringComparison.Ordinal)) return "cannot_target_self";
        if (message.Contains("silenced two nights", StringComparison.Ordinal)) return "silencer_repeat_target";
        if (message.Contains("can only be submitted during Voting", StringComparison.Ordinal)) return "voting_closed";
        if (message.Contains("only vote for one of the tied", StringComparison.Ordinal)) return "revote_target_invalid";
        if (message.Contains("already requested a challenge", StringComparison.Ordinal)) return "challenge_already_requested";
        if (message.Contains("pending challenge", StringComparison.Ordinal)) return "challenge_not_pending";
        if (message.Contains("Only the active speaker", StringComparison.Ordinal)) return "speaker_only";
        if (message.Contains("Only the current speaker", StringComparison.Ordinal)) return "speaker_only";
        if (message.Contains("Only the game creator", StringComparison.Ordinal)) return "creator_only";
        if (message.Contains("not a player in this game", StringComparison.Ordinal)) return "not_in_game";
        if (message.Contains("doesn't allow spectators", StringComparison.Ordinal)) return "spectators_disabled";
        if (message.Contains("Only a game in progress can be watched", StringComparison.Ordinal)) return "spectating_unavailable";
        if (message.Contains("already has", StringComparison.Ordinal) && message.Contains("spectators", StringComparison.Ordinal)) return "spectators_full";
        if (message.Contains("muted you", StringComparison.Ordinal)) return "graveyard_muted";
        if (message.Contains("Write a message", StringComparison.Ordinal)) return "message_empty";
        if (message.Contains("Messages can be at most", StringComparison.Ordinal)) return "message_too_long";
        if (message.Contains("messages too fast", StringComparison.Ordinal)) return "message_rate_limited";
        if (message.Contains("rematch", StringComparison.OrdinalIgnoreCase)) return "rematch_unavailable";
        if (message.Contains("timer must be one of", StringComparison.Ordinal)) return "timer_invalid";
        return exception is ForbiddenGameActionException ? "action_forbidden" : "game_action_invalid";
    }
}
