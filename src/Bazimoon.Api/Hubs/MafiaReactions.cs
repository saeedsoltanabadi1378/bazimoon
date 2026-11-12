using Bazimoon.Domain;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Caching.Memory;

namespace Bazimoon.Api.Hubs;

public sealed record MafiaReaction(Guid Id, Guid SenderId, string SenderName, string Kind, GamePhase Phase, int Round);

/// <summary>Ephemeral public reactions; never carries role or night-action data.</summary>
public sealed class MafiaReactions(TimeProvider clock) : IDisposable
{
    private readonly MemoryCache _cooldowns = new(new MemoryCacheOptions { SizeLimit = 100_000 });
    private readonly object _gate = new();
    public MafiaReaction Create(GameState game, Guid playerId, string kind)
    {
        var player = game.GetPlayer(playerId);
        if (player is null || !player.IsAlive || game.SilencedPlayerId == playerId ||
            game.CurrentPhase is not (GamePhase.Day or GamePhase.Defence or GamePhase.Voting or GamePhase.LastWords))
            throw new HubException("reaction_unavailable");
        if (kind is not ("suspect" or "trust" or "bluff" or "think" or "shock" or "applause"))
            throw new HubException("reaction_invalid");
        lock (_gate)
        {
            var key = (game.GameId, playerId);
            var now = clock.GetUtcNow();
            if (_cooldowns.TryGetValue(key, out DateTimeOffset until) && until > now)
                throw new HubException("reaction_cooldown");
            _cooldowns.Set(key, now.AddSeconds(3), new MemoryCacheEntryOptions
            { AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(3), Size = 1 });
        }
        return new(Guid.NewGuid(), playerId, player.DisplayName, kind, game.CurrentPhase, game.NightNumber);
    }
    public void Dispose() => _cooldowns.Dispose();
}
