using Bazimoon.Domain;
using Bazimoon.Infrastructure.Auth;

namespace Bazimoon.Bot;

public interface IBazimoonApiClient
{
    Task<Guid> CreateGameAsync(long telegramChatId, TelegramIdentity actor, string? chatTitle = null);
    Task JoinGameAsync(Guid gameId, TelegramIdentity actor);
    Task StartGameAsync(Guid gameId, TelegramIdentity actor);
    Task<GameViewDto> GetGameAsync(Guid gameId, TelegramIdentity actor);
    Task<Guid?> GetActiveGameForChatAsync(long telegramChatId, TelegramIdentity actor);
    Task SubmitNightActionAsync(Guid gameId, TelegramIdentity actor, Guid targetPlayerId, NightActionType actionType);
    Task<NightResult> ResolveNightAsync(Guid gameId, TelegramIdentity actor);
    Task SubmitVoteAsync(Guid gameId, TelegramIdentity actor, Guid? targetPlayerId);
    Task<VotingResult> ResolveVotingAsync(Guid gameId, TelegramIdentity actor);
    Task StartVotingAsync(Guid gameId, TelegramIdentity actor);
    Task StartNightAsync(Guid gameId, TelegramIdentity actor);
}
