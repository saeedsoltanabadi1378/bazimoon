using Bazimoon.Domain;

namespace Bazimoon.Tests;

/// <summary>The game log written while a game is played, and the stats and MVP worked out from it.</summary>
public class GameEventLogAndScoringTests
{
    /// <summary>
    /// 6 players: Godfather, Mafia, Detective, Doctor, two Villagers.
    /// Night 1: the Godfather goes for villager 1 and the Doctor saves them; the Detective finds the Mafia.
    /// Day 1: everyone else votes the Mafia out. Night 2: villager 2 is killed; the Detective finds the Godfather.
    /// Day 2: the Godfather is voted out and the town wins.
    /// </summary>
    private static (GameState Game, List<Player> Players) ScriptedTownWin()
    {
        var (game, p) = TestGameFactory.CreateAssignedGame(6);
        var gf = p.Godfather(); var mafia = p.Mafia()[0]; var det = p.Detective(); var doc = p.Doctor();
        var v1 = p.Villagers()[0]; var v2 = p.Villagers()[1];

        game.SubmitNightAction(gf.Id, v1.Id, NightActionType.Kill);
        game.SubmitNightAction(doc.Id, v1.Id, NightActionType.Heal);
        game.SubmitNightAction(det.Id, mafia.Id, NightActionType.Investigate);
        game.ResolveNight();
        game.StartVoting();
        foreach (var voter in new[] { det, doc, v1, v2 })
            game.SubmitVote(voter.Id, mafia.Id);
        game.ResolveVoting();
        game.FinishLastWords();
        game.StartNight();

        game.SubmitNightAction(gf.Id, v2.Id, NightActionType.Kill);
        game.SubmitNightAction(doc.Id, doc.Id, NightActionType.Heal);
        game.SubmitNightAction(det.Id, gf.Id, NightActionType.Investigate);
        game.ResolveNight();
        game.StartVoting();
        foreach (var voter in new[] { det, doc, v1 })
            game.SubmitVote(voter.Id, gf.Id);
        game.ResolveVoting();
        game.FinishLastWords();
        return (game, p);
    }

    [Fact]
    public void TheLog_RecordsEachNightVoteAndLastWords_InOrder()
    {
        var (game, p) = ScriptedTownWin();

        Assert.Equal(GamePhase.Ended, game.CurrentPhase);
        var kinds = game.Events.Select(e => e.Kind).ToList();
        // The empty first day of CreateAssignedGame is logged as a vote with no ballots.
        Assert.Equal(new[] { GameEventKind.Vote, GameEventKind.Night, GameEventKind.Vote, GameEventKind.LastWords, GameEventKind.Night, GameEventKind.Vote, GameEventKind.LastWords }, kinds);

        var night1 = game.Events[1];
        Assert.Equal(2, night1.Round); // Night zero counts as night 1.
        Assert.Equal(p.Godfather().Id, night1.KillerId);
        Assert.Equal(p.Villagers()[0].Id, night1.KillTarget);
        Assert.Null(night1.Killed);
        Assert.Equal(p.Villagers()[0].Id, night1.Saved);
        Assert.True(night1.CheckedIsMafia);

        var night2 = game.Events[4];
        Assert.Equal(p.Villagers()[1].Id, night2.Killed);
        Assert.Equal(p.Godfather().Id, game.Events[5].VotedOut);
    }

    [Fact]
    public void Scoring_CountsWhatEachPlayerDid_AndPicksTheMvpFromTheWinningTeam()
    {
        var (game, p) = ScriptedTownWin();
        var scores = MafiaScoring.Score(game).ToDictionary(s => s.PlayerId);

        var det = scores[p.Detective().Id];
        Assert.Equal(2, det.ChecksMade);
        Assert.Equal(2, det.MafiaFound);
        Assert.Equal(2, det.VotesOnMafiaOut);
        Assert.Equal(2, det.NightsSurvived);
        Assert.True(det.VotedOutGodfather);
        // Won 3 + 2 Mafia found 6 + 2 votes on Mafia who went out 4 + 2 nights 2.
        Assert.Equal(15, det.Points);
        Assert.True(det.IsMvp);

        var doc = scores[p.Doctor().Id];
        Assert.Equal(2, doc.SavesMade);
        Assert.Equal(1, doc.KillsBlocked);
        Assert.Equal(12, doc.Points);
        Assert.False(doc.IsMvp);

        var gf = scores[p.Godfather().Id];
        Assert.Equal(1, gf.KillsMade);
        Assert.False(gf.IsMvp);
        Assert.Single(scores.Values, s => s.IsMvp);
    }

    [Fact]
    public void Scoring_EveryoneTiedOnPoints_IsMvp()
    {
        // Nobody acts and the town votes out both Mafia on days 1 and 2: the two villagers tie.
        var (game, p) = TestGameFactory.CreateAssignedGame(6);
        game.ResolveNight();
        game.StartVoting();
        foreach (var voter in p.Where(x => !x.IsMafiaAligned))
            game.SubmitVote(voter.Id, p.Mafia()[0].Id);
        game.ResolveVoting();
        game.FinishLastWords();
        game.StartNight();
        game.ResolveNight();
        game.StartVoting();
        foreach (var voter in p.Where(x => !x.IsMafiaAligned))
            game.SubmitVote(voter.Id, p.Godfather().Id);
        game.ResolveVoting();
        game.FinishLastWords();

        var mvps = MafiaScoring.Score(game).Where(s => s.IsMvp).Select(s => s.PlayerId).ToHashSet();
        Assert.Equal(p.Where(x => !x.IsMafiaAligned).Select(x => x.Id).ToHashSet(), mvps);
    }

    [Fact]
    public void Scoring_PlayersWhoLeft_AreNeverMvp()
    {
        var (game, p) = TestGameFactory.CreateAssignedGame(6);
        game.LeaveMidGame(p.Villagers()[0].Id, DateTimeOffset.UtcNow);
        Assert.Contains(game.Events, e => e.Kind == GameEventKind.Left && e.PlayerId == p.Villagers()[0].Id);

        var score = MafiaScoring.Score(game).Single(s => s.PlayerId == p.Villagers()[0].Id);
        Assert.False(score.IsMvp);
    }

    [Fact]
    public void SurvivingARevote_IsRecorded()
    {
        var (game, p) = TestGameFactory.CreateAssignedGame(9);
        game.ResolveNight();
        game.StartVoting();
        var a = p.Villagers()[0]; var b = p.Villagers()[1];
        var others = p.Where(x => x != a && x != b).ToList();
        game.SubmitVote(others[0].Id, a.Id);
        game.SubmitVote(others[1].Id, b.Id);
        game.ResolveVoting();
        while (game.CurrentPhase == GamePhase.Defence)
            game.FinishDiscussionSegment(game.Discussion!.ActivePlayerId, DateTimeOffset.UtcNow);
        game.SubmitVote(others[0].Id, a.Id);
        game.ResolveVoting();

        var scores = MafiaScoring.Score(game).ToDictionary(s => s.PlayerId);
        Assert.False(scores[a.Id].SurvivedRevote);
        Assert.True(scores[b.Id].SurvivedRevote);
    }

    [Fact]
    public void TheLog_SurvivesASnapshotRoundTrip()
    {
        var (game, _) = ScriptedTownWin();
        var copy = GameState.FromSnapshot(System.Text.Json.JsonSerializer.Deserialize<GameStateSnapshot>(System.Text.Json.JsonSerializer.Serialize(game.ToSnapshot()))!);
        Assert.Equal(game.Events.Count, copy.Events.Count);
        Assert.Equal(game.Events[1].KillTarget, copy.Events[1].KillTarget);
        Assert.Equal(game.Events[2].Ballots!.Count, copy.Events[2].Ballots!.Count);
    }
}
