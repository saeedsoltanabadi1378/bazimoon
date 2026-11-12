using Bazimoon.Api.Hubs;
using Bazimoon.Domain;
using Microsoft.AspNetCore.SignalR;

namespace Bazimoon.Tests;

public class MafiaReactionTests
{
    private static (GameState Game, Guid PlayerId) Create(GamePhase phase = GamePhase.Day)
    {
        var (game, players) = TestGameFactory.CreateNightZeroGame(7);
        return (GameState.FromSnapshot(game.ToSnapshot() with { CurrentPhase = phase }), players[0].Id);
    }

    [Theory]
    [InlineData("suspect")]
    [InlineData("trust")]
    [InlineData("bluff")]
    [InlineData("think")]
    [InlineData("shock")]
    [InlineData("applause")]
    public void ApprovedReactionsCarryOnlyPublicSenderAndPhase(string kind)
    {
        using var service = new MafiaReactions(TimeProvider.System);
        var (game, id) = Create();
        var reaction = service.Create(game, id, kind);
        Assert.Equal(id, reaction.SenderId);
        Assert.Equal(game.GetPlayer(id)!.DisplayName, reaction.SenderName);
        Assert.Equal(kind, reaction.Kind);
        Assert.Equal(game.CurrentPhase, reaction.Phase);
        Assert.Equal(game.NightNumber, reaction.Round);
    }

    [Theory]
    [InlineData(GamePhase.Lobby)]
    [InlineData(GamePhase.NightZero)]
    [InlineData(GamePhase.Night)]
    [InlineData(GamePhase.Results)]
    [InlineData(GamePhase.Ended)]
    public void PrivateOrInactivePhasesRejectReactions(GamePhase phase)
    {
        using var service = new MafiaReactions(TimeProvider.System);
        var (game, id) = Create(phase);
        Assert.Throws<HubException>(() => service.Create(game, id, "trust"));
    }

    [Theory]
    [InlineData(GamePhase.Day)]
    [InlineData(GamePhase.Defence)]
    [InlineData(GamePhase.Voting)]
    [InlineData(GamePhase.LastWords)]
    public void PublicPhasesAllowLivingPlayers(GamePhase phase)
    {
        using var service = new MafiaReactions(TimeProvider.System);
        var (game, id) = Create(phase);
        Assert.Equal(phase, service.Create(game, id, "think").Phase);
    }

    [Fact]
    public void RejectsOutsidersDeadSilencedAndUnknownKinds()
    {
        using var service = new MafiaReactions(TimeProvider.System);
        var (game, id) = Create();
        Assert.Throws<HubException>(() => service.Create(game, Guid.NewGuid(), "trust"));
        Assert.Throws<HubException>(() => service.Create(game, id, "role_mafia"));
        var snapshot = game.ToSnapshot();
        var silenced = GameState.FromSnapshot(snapshot with { SilencedPlayerId = id });
        Assert.Throws<HubException>(() => service.Create(silenced, id, "trust"));
        var dead = GameState.FromSnapshot(snapshot with { Players = snapshot.Players.Select(p => p.Id == id ? p with { IsAlive = false } : p).ToList() });
        Assert.Throws<HubException>(() => service.Create(dead, id, "trust"));
    }

    [Fact]
    public async Task CooldownIsAtomicPerPlayerAndExpires()
    {
        var clock = new ReactionClock();
        using var service = new MafiaReactions(clock);
        var (game, id) = Create();
        var sends = await Task.WhenAll(Enumerable.Range(0, 12).Select(_ => Task.Run(() => {
            try { service.Create(game, id, "trust"); return true; }
            catch (HubException) { return false; }
        })));
        Assert.Single(sends, ok => ok);
        service.Create(game, game.ToSnapshot().Players[1].Id, "applause");
        clock.Now = clock.Now.AddSeconds(3);
        service.Create(game, id, "trust");
    }
    private sealed class ReactionClock : TimeProvider
    {
        public DateTimeOffset Now = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
