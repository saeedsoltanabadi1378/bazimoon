using Bazimoon.Domain;

namespace Bazimoon.Tests;

/// <summary>Lobby ready check and auto-start, strikes for missed timed turns, leaving mid-game and the creator hand-off.</summary>
public class GameStateReadyAndInactivityTests
{
    private static readonly DateTimeOffset T0 = new(2026, 10, 18, 20, 0, 0, TimeSpan.Zero);

    private static (GameState Game, List<Player> Players) FullLobby(int seats)
    {
        var game = new GameState(new GameConfig { MaxPlayers = seats });
        var players = Enumerable.Range(1, seats).Select(i => new Player(Guid.NewGuid(), $"p{i}")).ToList();
        foreach (var p in players) game.AddPlayer(p);
        return (game, players);
    }

    [Fact]
    public void FullTable_EveryoneReady_StartsAfterTheCountdown()
    {
        var (game, players) = FullLobby(4);
        foreach (var p in players.Take(3)) game.SetReady(p.Id, true, T0);
        Assert.Null(game.AutoStartAt);

        game.SetReady(players[3].Id, true, T0);
        Assert.Equal(T0.AddSeconds(GameState.AutoStartSeconds), game.AutoStartAt);
        Assert.False(game.AdvanceExpiredPhase(T0.AddSeconds(4)));
        Assert.True(game.AdvanceExpiredPhase(T0.AddSeconds(5)));
        Assert.Equal(GamePhase.NightZero, game.CurrentPhase);
        Assert.Empty(game.ReadyPlayers);
    }

    [Fact]
    public void Unreadying_OrSomeoneLeaving_StopsTheCountdown()
    {
        var (game, players) = FullLobby(3);
        foreach (var p in players) game.SetReady(p.Id, true, T0);
        game.SetReady(players[1].Id, false, T0);
        Assert.Null(game.AutoStartAt);

        game.SetReady(players[1].Id, true, T0);
        game.RemovePlayer(players[2].Id);
        Assert.Null(game.AutoStartAt);
        Assert.False(game.AdvanceExpiredPhase(T0.AddMinutes(1)));
    }

    [Fact]
    public void LobbyNotFull_NeverAutoStarts()
    {
        var game = new GameState(new GameConfig { MaxPlayers = 6 });
        var players = Enumerable.Range(1, 4).Select(i => new Player(Guid.NewGuid(), $"p{i}")).ToList();
        foreach (var p in players) { game.AddPlayer(p); game.SetReady(p.Id, true, T0); }
        Assert.Null(game.AutoStartAt);
    }

    /// <summary>A 5-player game on a timed night (60 s), at Night 1.</summary>
    private static (GameState Game, List<Player> Players) TimedNight()
    {
        var (game, players) = TestGameFactory.CreateNightZeroGame(5, new GameConfig { NightSeconds = 60, VotingSeconds = 30 });
        game.ResolveNight(T0);
        game.StartVoting(T0);
        game.ResolveVoting(T0.AddSeconds(1)); // before the deadline: nobody voted, no strikes
        game.StartNight(T0);
        return (game, players);
    }

    [Fact]
    public void MissingTwoTimedTurnsInARow_RemovesThePlayer_AndActingResetsTheCount()
    {
        var (game, players) = TimedNight();
        var doctor = players.Doctor();
        game.SubmitNightAction(players.Godfather().Id, players.Villagers()[0].Id, NightActionType.Kill);
        game.SubmitNightAction(players.Detective().Id, players.Godfather().Id, NightActionType.Investigate);
        game.AdvanceExpiredPhase(T0.AddSeconds(60)); // the Doctor misses night 1
        Assert.Equal(1, game.Strikes[doctor.Id]);
        Assert.True(doctor.IsAlive);

        // Day 1: vote on time (no strikes for anyone who votes).
        while (game.CurrentPhase == GamePhase.Day) game.FinishDiscussionSegment(game.Discussion!.ActivePlayerId, T0);
        foreach (var p in players.Where(p => p.IsAlive)) game.SubmitVote(p.Id, null);
        game.AdvanceExpiredPhase(T0.AddHours(1));
        Assert.Equal(GamePhase.Results, game.CurrentPhase);
        Assert.False(game.Strikes.ContainsKey(doctor.Id)); // voting reset it

        game.StartNight(T0);
        game.AdvanceExpiredPhase(T0.AddSeconds(60)); // nobody acts at night 2
        Assert.True(doctor.IsAlive);
        Assert.Equal(1, game.Strikes[doctor.Id]);
    }

    [Fact]
    public void SecondMissInARow_RemovesThem_AsLeft()
    {
        var (game, players) = TimedNight();
        var doctor = players.Doctor();
        game.AdvanceExpiredPhase(T0.AddSeconds(60)); // everyone misses night 1
        while (game.CurrentPhase == GamePhase.Day) game.FinishDiscussionSegment(game.Discussion!.ActivePlayerId, T0);
        // Everyone but the Doctor votes; the vote times out.
        foreach (var p in players.Where(p => p.IsAlive && p != doctor)) game.SubmitVote(p.Id, null);
        game.AdvanceExpiredPhase(T0.AddHours(1));

        Assert.False(doctor.IsAlive);
        Assert.Equal(EliminationCause.Left, doctor.EliminatedBy);
        Assert.Contains(doctor.Id, game.LastRemovedForInactivity);
    }

    [Fact]
    public void GodfatherDoesNothing_TheKillGoesToTheMostSuggestedTarget()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(9);
        var target = players.Villagers()[0];
        foreach (var m in players.Mafia()) game.SubmitNightAction(m.Id, target.Id, NightActionType.Kill);

        var result = game.ResolveNight(T0);

        Assert.Equal(target.Id, result.Eliminated);
    }

    [Fact]
    public void GodfatherDoesNothing_AndSuggestionsTie_NobodyDies()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(9);
        var mafia = players.Mafia();
        game.SubmitNightAction(mafia[0].Id, players.Villagers()[0].Id, NightActionType.Kill);
        game.SubmitNightAction(mafia[1].Id, players.Villagers()[1].Id, NightActionType.Kill);

        Assert.Null(game.ResolveNight(T0).Eliminated);
    }

    [Fact]
    public void UntimedPhases_NeverGiveStrikes()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(5);
        game.ResolveNight(T0.AddHours(1));
        Assert.Empty(game.Strikes);
    }

    [Fact]
    public void LeavingMidGame_IsOut_AndTheNextSeatBecomesCreator()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(9);
        var creator = players[0];
        Assert.Equal(creator.Id, game.Controller!.Id);

        game.LeaveMidGame(creator.Id, T0);

        Assert.Equal(EliminationCause.Left, creator.EliminatedBy);
        Assert.Equal(players[1].Id, game.Controller!.Id);
    }

    [Fact]
    public void VotedOutCreator_StaysCreator()
    {
        var (game, players) = TestGameFactory.CreateNightZeroGame(9);
        var creator = players[0];
        game.ResolveNight(T0);
        game.StartVoting(T0);
        foreach (var p in players.Skip(1)) game.SubmitVote(p.Id, creator.Id);
        game.ResolveVoting(T0);
        game.FinishLastWords();

        Assert.False(creator.IsAlive);
        Assert.Equal(creator.Id, game.Controller!.Id);
    }

    [Fact]
    public void LastMafiaLeaving_EndsTheGame()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(5);
        game.LeaveMidGame(players.Godfather().Id, T0);
        Assert.Equal(GamePhase.Ended, game.CurrentPhase);
        Assert.Equal(WinCondition.VillagersWin, game.CheckWinCondition());
    }

    [Fact]
    public void Snapshot_KeepsReadyStrikesAndRemovals()
    {
        var (game, players) = FullLobby(5);
        game.SetReady(players[0].Id, true, T0);
        var restored = GameState.FromSnapshot(game.ToSnapshot());
        Assert.Contains(players[0].Id, restored.ReadyPlayers);
    }
}
