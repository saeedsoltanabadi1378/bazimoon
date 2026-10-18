using Bazimoon.Api.Games;
using Bazimoon.Domain;

namespace Bazimoon.Tests;

/// <summary>Covers the per-viewer data the Mini App screens rely on (team, suggestions, history, fates).</summary>
public class GameViewDesignDataTests
{
    [Fact]
    public void MafiaTeam_IsVisibleToMafiaOnly_InSuccessionOrder()
    {
        var (game, players) = TestGameFactory.CreateNightZeroGame(7);
        var godfather = players.Godfather();
        var mafia = players.Mafia()[0];

        var mafiaView = GameView.For(game, mafia.Id);
        Assert.NotNull(mafiaView.MafiaTeam);
        Assert.Equal([godfather.Id, mafia.Id], mafiaView.MafiaTeam!.Select(m => m.PlayerId));
        Assert.Equal([1, 2], mafiaView.MafiaTeam.Select(m => m.Rank!.Value));

        Assert.Null(GameView.For(game, players.Detective().Id).MafiaTeam);
        Assert.Null(GameView.For(game, players.Villagers()[0].Id).MafiaTeam);
    }

    [Fact]
    public void MafiaCannotTargetTeammate()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(7);

        Assert.Throws<GameException>(() =>
            game.SubmitNightAction(players.Godfather().Id, players.Mafia()[0].Id, NightActionType.Kill));
    }

    [Fact]
    public void MafiaSuggestion_IsVisibleToGodfather_NotToTown()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(7);
        var target = players.Villagers()[0];
        game.SubmitNightAction(players.Mafia()[0].Id, target.Id, NightActionType.Kill);

        var godfatherView = GameView.For(game, players.Godfather().Id);
        var suggestion = Assert.Single(godfatherView.MafiaSuggestions!);
        Assert.Equal(players.Mafia()[0].Id, suggestion.ActorPlayerId);
        Assert.Equal(target.Id, suggestion.TargetPlayerId);

        Assert.Null(GameView.For(game, players.Detective().Id).MafiaSuggestions);
        Assert.Equal(target.Id, GameView.For(game, players.Mafia()[0].Id).YourNightActionTargetId);
    }

    [Fact]
    public void Detective_SeesEveryPastInvestigation()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(7);
        var detective = players.Detective();
        game.SubmitNightAction(detective.Id, players.Godfather().Id, NightActionType.Investigate);
        game.ResolveNight();
        game.CycleThroughToNextNight();
        game.SubmitNightAction(detective.Id, players.Villagers()[0].Id, NightActionType.Investigate);
        game.ResolveNight();

        var view = GameView.For(game, detective.Id);
        Assert.Equal(2, view.YourInvestigations!.Count);
        Assert.Contains(view.YourInvestigations, r => r.TargetPlayerId == players.Godfather().Id && r.IsMafiaAligned);
        Assert.Contains(view.YourInvestigations, r => r.TargetPlayerId == players.Villagers()[0].Id && !r.IsMafiaAligned);
        Assert.Null(GameView.For(game, players.Doctor().Id).YourInvestigations);
    }

    [Fact]
    public void Doctor_IsToldWhenSelfHealIsBlocked()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(7);
        var doctor = players.Doctor();
        Assert.False(GameView.For(game, doctor.Id).YouCannotHealSelf);

        game.SubmitNightAction(doctor.Id, doctor.Id, NightActionType.Heal);
        game.ResolveNight();
        game.CycleThroughToNextNight();

        Assert.True(GameView.For(game, doctor.Id).YouCannotHealSelf);
    }

    [Fact]
    public void NightProgress_IsShownToControllerOnly()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(7);
        game.SubmitNightAction(players.Godfather().Id, players.Villagers()[0].Id, NightActionType.Kill);

        var controllerView = GameView.For(game, players[0].Id);
        Assert.Equal(new NightProgressView(1, 3), controllerView.NightProgress);
        Assert.Null(GameView.For(game, players[1].Id).NightProgress);
    }

    [Fact]
    public void VotingResult_KeepsBallots_AndFatesAreRecorded()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(7);
        var victim = players.Villagers()[0];
        game.SubmitNightAction(players.Godfather().Id, victim.Id, NightActionType.Kill);
        game.ResolveNight();
        game.StartVoting();
        var votedOut = players.Villagers()[1];
        game.SubmitVote(players.Godfather().Id, votedOut.Id);
        game.SubmitVote(players.Detective().Id, votedOut.Id);
        game.SubmitVote(players.Doctor().Id, null);
        game.ResolveVoting();

        var view = GameView.For(game, players.Detective().Id);
        Assert.Equal(3, view.LastVotingElimination!.Ballots!.Count);
        var night = view.Players.Single(p => p.PlayerId == victim.Id);
        Assert.Equal(EliminationCause.Night, night.EliminatedBy);
        Assert.Equal(game.NightNumber, night.EliminatedRound);
        var day = view.Players.Single(p => p.PlayerId == votedOut.Id);
        Assert.Equal(EliminationCause.Vote, day.EliminatedBy);

        var restored = GameState.FromSnapshot(game.ToSnapshot());
        Assert.Equal(EliminationCause.Vote, restored.GetPlayer(votedOut.Id)!.EliminatedBy);
        Assert.Equal(3, restored.LastVotingResult!.Votes!.Count);
    }

    [Fact]
    public void Promotion_FlagsTheResult_ButOnlyMafiaSeeWho()
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(7);
        var godfatherId = players.Godfather().Id;
        var successorId = players.Mafia()[0].Id;
        game.ResolveNight();
        game.StartVoting();
        foreach (var p in players.Where(p => p.Id != godfatherId))
            game.SubmitVote(p.Id, godfatherId);
        game.ResolveVoting();

        var townView = GameView.For(game, players.Detective().Id);
        Assert.True(townView.LastVotingElimination!.GodfatherPromoted);
        Assert.DoesNotContain(townView.Players, p => p.WasPromoted);

        var mafiaView = GameView.For(game, successorId);
        Assert.Contains(mafiaView.Players, p => p.WasPromoted && p.PlayerId == successorId);
    }

    [Fact]
    public void RemovePlayer_OnlyInLobby()
    {
        var game = new GameState();
        var a = new Player(Guid.NewGuid(), "a");
        var b = new Player(Guid.NewGuid(), "b");
        game.AddPlayer(a);
        game.AddPlayer(b);
        game.RemovePlayer(b.Id);
        Assert.Single(game.Players);

        var (started, players) = TestGameFactory.CreateNightZeroGame(3);
        Assert.Throws<GameException>(() => started.RemovePlayer(players[1].Id));
    }

    [Fact]
    public void Discussion_ExposesSpeakingOrder()
    {
        var (game, players) = TestGameFactory.CreateNightZeroGame(5);
        game.ResolveNight();

        var view = GameView.For(game, players[0].Id);
        Assert.Equal(players.Select(p => p.Id), view.Discussion!.SpeakerOrder!);
        Assert.Empty(view.Discussion.CompletedSpeakerIds!);
    }
}
