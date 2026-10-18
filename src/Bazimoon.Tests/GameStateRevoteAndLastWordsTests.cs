using System.Text.Json;
using System.Text.Json.Nodes;
using Bazimoon.Domain;

namespace Bazimoon.Tests;

/// <summary>The day flow after a vote: a tie gives the tied players a defence and a second vote between
/// them only; a player who is out gets last words before their role is shown; and table timers.</summary>
public class GameStateRevoteAndLastWordsTests
{
    private static readonly DateTimeOffset T0 = new(2026, 10, 18, 20, 0, 0, TimeSpan.Zero);

    private static (GameState Game, List<Player> Players) InVoting(int count, GameConfig? config = null)
    {
        var (game, players) = TestGameFactory.CreateNightZeroGame(count, config);
        game.ResolveNight(T0); // NightZero → Day
        game.StartVoting(T0);
        return (game, players);
    }

    /// <summary>Two villagers tie 2–2 in round 1.</summary>
    private static (GameState Game, List<Player> Players, Player A, Player B) TiedInRoundOne(GameConfig? config = null)
    {
        var (game, players) = InVoting(9, config);
        var a = players.Villagers()[0];
        var b = players.Villagers()[1];
        var others = players.Where(p => p != a && p != b).ToList();
        game.SubmitVote(others[0].Id, a.Id);
        game.SubmitVote(others[1].Id, a.Id);
        game.SubmitVote(others[2].Id, b.Id);
        game.SubmitVote(others[3].Id, b.Id);
        game.ResolveVoting(T0);
        return (game, players, a, b);
    }

    private static void FinishDefences(GameState game)
    {
        while (game.CurrentPhase == GamePhase.Defence)
            game.FinishDiscussionSegment(game.Discussion!.ActivePlayerId, T0);
    }

    [Fact]
    public void Tie_StartsDefence_ForTheTiedPlayersInSeatOrder_WithNoChallenges()
    {
        var (game, players, a, b) = TiedInRoundOne();

        Assert.Equal(GamePhase.Defence, game.CurrentPhase);
        Assert.Equal(2, game.VotingRound);
        Assert.Equal(new[] { a.Id, b.Id }, game.RunoffCandidates);
        Assert.Equal(new[] { a.Id, b.Id }, game.Discussion!.SpeakerOrder);
        Assert.Equal(a.Id, game.Discussion.ActivePlayerId);
        Assert.Equal(T0.AddSeconds(30), game.Discussion.Deadline);

        var listener = players.First(p => p != a && p != b);
        Assert.Throws<GameException>(() => game.RequestChallenge(listener.Id, T0));
    }

    [Fact]
    public void AfterTheDefences_RoundTwo_AcceptsVotesForTheTiedPlayersOnly()
    {
        var (game, players, a, _) = TiedInRoundOne();
        FinishDefences(game);

        Assert.Equal(GamePhase.Voting, game.CurrentPhase);
        var outsider = players.Detective();
        var voter = players.Doctor();
        Assert.Throws<GameException>(() => game.SubmitVote(voter.Id, outsider.Id));
        game.SubmitVote(voter.Id, a.Id);
        game.SubmitVote(outsider.Id, null);
    }

    [Fact]
    public void RoundTwoTie_NobodyIsOut_AndTheNextDayStartsAtRoundOne()
    {
        var (game, players, a, b) = TiedInRoundOne();
        FinishDefences(game);
        var others = players.Where(p => p != a && p != b).ToList();
        game.SubmitVote(others[0].Id, a.Id);
        game.SubmitVote(others[1].Id, b.Id);

        var result = game.ResolveVoting(T0);

        Assert.True(result.WasTie);
        Assert.Null(result.Eliminated);
        Assert.Equal(2, result.Round);
        Assert.NotNull(result.PreviousRound);
        Assert.Equal(1, result.PreviousRound!.Round);
        Assert.True(a.IsAlive && b.IsAlive);
        Assert.Equal(GamePhase.Results, game.CurrentPhase);
        Assert.Equal(1, game.VotingRound);
        Assert.Empty(game.RunoffCandidates);
    }

    [Fact]
    public void RoundTwoMajority_IsOut_AfterTheirLastWords()
    {
        var (game, players, a, b) = TiedInRoundOne();
        FinishDefences(game);
        var others = players.Where(p => p != a && p != b).ToList();
        game.SubmitVote(others[0].Id, a.Id);
        game.SubmitVote(others[1].Id, a.Id);
        game.SubmitVote(others[2].Id, b.Id);

        var result = game.ResolveVoting(T0);

        Assert.Equal(a.Id, result.Eliminated);
        Assert.Equal(2, result.Round);
        Assert.Equal(GamePhase.LastWords, game.CurrentPhase);
        Assert.Equal(a.Id, game.LastWordsPlayerId);
        Assert.Equal(T0.AddSeconds(20), game.PhaseDeadline);
        Assert.Equal(GamePhase.Results, game.AfterLastWords);
        Assert.Equal(1, game.VotingRound);
    }

    [Fact]
    public void LastWords_OnlyTheSpeakerCanFinishThem()
    {
        var (game, players) = InVoting(5);
        var target = players.Villagers()[0];
        foreach (var voter in players.Where(p => p != target))
            game.SubmitVote(voter.Id, target.Id);
        game.ResolveVoting(T0);

        Assert.Throws<GameException>(() => game.FinishLastWords(players.Godfather().Id, T0));
        game.FinishLastWords(target.Id, T0);
        Assert.Equal(GamePhase.Results, game.CurrentPhase);
        Assert.Null(game.LastWordsPlayerId);
    }

    [Fact]
    public void LastWords_EndOnTheirOwn_WhenTheTimerRunsOut()
    {
        var (game, players) = InVoting(5, new GameConfig { LastWordsSeconds = 10 });
        var target = players.Villagers()[0];
        foreach (var voter in players.Where(p => p != target))
            game.SubmitVote(voter.Id, target.Id);
        game.ResolveVoting(T0);

        Assert.False(game.AdvanceExpiredPhase(T0.AddSeconds(9)));
        Assert.True(game.AdvanceExpiredPhase(T0.AddSeconds(10)));
        Assert.Equal(GamePhase.Results, game.CurrentPhase);
    }

    [Fact]
    public void NightKill_HasNoLastWords_ByDefault()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(5);
        game.SubmitNightAction(players.Godfather().Id, players.Villagers()[0].Id, NightActionType.Kill);
        game.SubmitNightAction(players.Doctor().Id, players.Doctor().Id, NightActionType.Heal);
        game.SubmitNightAction(players.Detective().Id, players.Godfather().Id, NightActionType.Investigate);

        game.ResolveNight(T0);

        Assert.Equal(GamePhase.Day, game.CurrentPhase);
        Assert.NotNull(game.Discussion);
    }

    [Fact]
    public void NightKill_GetsLastWordsAtTheStartOfTheDay_WhenTheTableTurnsThemOn()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(5, new GameConfig { LastWordsForNightKills = true });
        var victim = players.Villagers()[0];
        game.SubmitNightAction(players.Godfather().Id, victim.Id, NightActionType.Kill);
        game.SubmitNightAction(players.Doctor().Id, players.Doctor().Id, NightActionType.Heal);
        game.SubmitNightAction(players.Detective().Id, players.Godfather().Id, NightActionType.Investigate);

        game.ResolveNight(T0);

        Assert.Equal(GamePhase.LastWords, game.CurrentPhase);
        Assert.Equal(victim.Id, game.LastWordsPlayerId);
        Assert.Equal(GamePhase.Day, game.AfterLastWords);
        Assert.Null(game.Discussion);

        game.FinishLastWords(victim.Id, T0.AddSeconds(5));
        Assert.Equal(GamePhase.Day, game.CurrentPhase);
        Assert.Equal(T0.AddSeconds(65), game.Discussion!.Deadline);
    }

    [Fact]
    public void GameWinningVote_StillGivesLastWords_ThenEnds()
    {
        var (game, players) = InVoting(5);
        var godfather = players.Godfather();
        foreach (var voter in players.Where(p => p != godfather))
            game.SubmitVote(voter.Id, godfather.Id);

        game.ResolveVoting(T0);

        Assert.Equal(GamePhase.LastWords, game.CurrentPhase);
        game.FinishLastWords(godfather.Id, T0);
        Assert.Equal(GamePhase.Ended, game.CurrentPhase);
        Assert.Equal(WinCondition.VillagersWin, game.CheckWinCondition());
    }

    [Fact]
    public void Timers_ComeFromTheTableRules()
    {
        var (game, players) = TestGameFactory.CreateNightZeroGame(5, new GameConfig { SpeakerSeconds = 45, ChallengeSeconds = 20 });
        game.ResolveNight(T0);

        var speaker = game.Discussion!.ActivePlayerId;
        Assert.Equal(T0.AddSeconds(45), game.Discussion.Deadline);
        var challenger = players.First(p => p.Id != speaker);
        game.RequestChallenge(challenger.Id, T0);
        game.AcceptChallenge(speaker, challenger.Id, T0);
        Assert.Equal(T0.AddSeconds(20), game.Discussion!.Deadline);
    }

    [Fact]
    public void TimedNight_ResolvesOnItsOwn_AndNightRolesThatDidNotActDoNothing()
    {
        var (game, players) = TestGameFactory.CreateNightZeroGame(5, new GameConfig { NightSeconds = 60 });
        game.ResolveNight(T0);
        game.StartVoting(T0);
        game.ResolveVoting(T0);
        game.StartNight(T0);
        Assert.Equal(T0.AddSeconds(60), game.PhaseDeadline);

        game.SubmitNightAction(players.Doctor().Id, players.Doctor().Id, NightActionType.Heal); // only the Doctor acts

        Assert.False(game.AdvanceExpiredPhase(T0.AddSeconds(59)));
        Assert.True(game.AdvanceExpiredPhase(T0.AddSeconds(60)));
        Assert.Equal(GamePhase.Day, game.CurrentPhase);
        Assert.Null(game.LastNightResult!.Eliminated);
        Assert.Null(game.PhaseDeadline);
    }

    [Fact]
    public void TimedVote_ClosesOnItsOwn_AndMissingVotesAbstain()
    {
        var (game, players) = InVoting(5, new GameConfig { VotingSeconds = 30 });
        Assert.Equal(T0.AddSeconds(30), game.PhaseDeadline);
        var target = players.Villagers()[0];
        game.SubmitVote(players.Godfather().Id, target.Id);

        Assert.True(game.AdvanceExpiredPhase(T0.AddSeconds(30)));

        Assert.Equal(target.Id, game.LastVotingResult!.Eliminated);
        Assert.Equal(GamePhase.LastWords, game.CurrentPhase);
    }

    [Fact]
    public void UntimedNightAndVote_WaitForTheCreator()
    {
        var (game, _) = InVoting(5);
        Assert.Null(game.PhaseDeadline);
        Assert.False(game.AdvanceExpiredPhase(T0.AddHours(1)));
        Assert.Equal(GamePhase.Voting, game.CurrentPhase);
    }

    [Fact]
    public void Snapshot_RoundTrips_MidDefence_AndMidLastWords()
    {
        var (game, _, a, b) = TiedInRoundOne();
        var restored = GameState.FromSnapshot(game.ToSnapshot());
        Assert.Equal(GamePhase.Defence, restored.CurrentPhase);
        Assert.Equal(2, restored.VotingRound);
        Assert.Equal(new[] { a.Id, b.Id }, restored.RunoffCandidates);

        FinishDefences(game);
        game.SubmitVote(a.Id, b.Id);
        game.ResolveVoting(T0);
        restored = GameState.FromSnapshot(game.ToSnapshot());
        Assert.Equal(GamePhase.LastWords, restored.CurrentPhase);
        Assert.Equal(b.Id, restored.LastWordsPlayerId);
        Assert.Equal(game.PhaseDeadline, restored.PhaseDeadline);
        Assert.Equal(GamePhase.Results, restored.AfterLastWords);
    }

    [Fact]
    public void SnapshotSavedBeforeThisRelease_LoadsWithTodaysRules()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var (game, _) = InVoting(5);
        var json = JsonNode.Parse(JsonSerializer.Serialize(game.ToSnapshot(), options))!.AsObject();
        foreach (var key in new[] { "votingRound", "runoffCandidates", "phaseDeadline", "lastWordsPlayerId", "afterLastWords" })
            json.Remove(key);
        var config = json["config"]!.AsObject();
        foreach (var key in config.Select(kv => kv.Key).Where(k => k is not ("minPlayers" or "maxPlayers")).ToList())
            config.Remove(key);

        var restored = GameState.FromSnapshot(json.Deserialize<GameStateSnapshot>(options)!);

        Assert.Equal(GamePhase.Voting, restored.CurrentPhase);
        Assert.Equal(1, restored.VotingRound);
        Assert.Null(restored.PhaseDeadline);
        Assert.Equal(60, restored.Config.SpeakerSeconds);
        Assert.Equal(40, restored.Config.ChallengeSeconds);
        Assert.Null(restored.Config.NightSeconds);
        Assert.False(restored.Config.LastWordsForNightKills);
    }
}

public class GameViewLastWordsTests
{
    [Fact]
    public void WhileSpeaking_TheirRoleStaysHidden_AndTheWinWaits()
    {
        var (game, players) = TestGameFactory.CreateNightZeroGame(5);
        game.ResolveNight();
        game.StartVoting();
        var godfather = players.Godfather();
        foreach (var voter in players.Where(p => p != godfather))
            game.SubmitVote(voter.Id, godfather.Id);
        game.ResolveVoting();

        var townView = Bazimoon.Api.Games.GameView.For(game, players.Detective().Id);
        Assert.Null(townView.Players.Single(p => p.PlayerId == godfather.Id).RevealedRole);
        Assert.Equal(WinCondition.None, townView.WinCondition);
        Assert.Equal(godfather.Id, townView.LastWords!.PlayerId);
        Assert.False(townView.LastWords.YouAreSpeaking);
        Assert.True(Bazimoon.Api.Games.GameView.For(game, godfather.Id).LastWords!.YouAreSpeaking);

        game.FinishLastWords();
        var after = Bazimoon.Api.Games.GameView.For(game, players.Detective().Id);
        Assert.Equal(Role.Godfather, after.Players.Single(p => p.PlayerId == godfather.Id).RevealedRole);
        Assert.Equal(WinCondition.VillagersWin, after.WinCondition);
        Assert.Null(after.LastWords);
    }
}
