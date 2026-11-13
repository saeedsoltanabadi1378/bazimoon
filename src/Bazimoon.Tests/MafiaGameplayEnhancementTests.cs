using Bazimoon.Api.Games;
using Bazimoon.Domain;

namespace Bazimoon.Tests;

/// <summary>Fairer scoring, auto-advance, suspicion picks, bots, accolades, and the Negotiator and Bodyguard.</summary>
public class MafiaGameplayEnhancementTests
{
    private static readonly DateTimeOffset T0 = new(2026, 11, 12, 20, 0, 0, TimeSpan.Zero);

    private static GameConfig Custom(int mafia, params Role[] optional) =>
        new() { Roles = new RoleSetup(RolePreset.Custom, mafia, optional) };

    private static Player Of(List<Player> ps, Role role) => ps.First(p => p.Role == role);

    // ------------------------------------------------------------ auto-advance and suspicions

    [Fact]
    public void Night_EndsByItself_OnceEveryLivingPlayerHasActed()
    {
        var (game, ps) = TestGameFactory.CreateAssignedGame(5);
        var villagers = ps.Villagers();
        game.SubmitNightAction(ps.Godfather().Id, villagers[0].Id, NightActionType.Kill);
        game.SubmitNightAction(ps.Detective().Id, ps.Godfather().Id, NightActionType.Investigate);
        game.SubmitNightAction(ps.Doctor().Id, ps.Doctor().Id, NightActionType.Heal);
        game.SubmitSuspicion(villagers[0].Id, ps.Godfather().Id);
        Assert.False(game.AdvanceIfEveryoneActed(T0));

        game.SubmitSuspicion(villagers[1].Id, ps.Doctor().Id);
        Assert.True(game.AdvanceIfEveryoneActed(T0));

        Assert.Equal(GamePhase.Day, game.CurrentPhase);
        var night = game.Events.Last(e => e.Kind == GameEventKind.Night);
        Assert.Equal(ps.Godfather().Id, night.Suspicions![villagers[0].Id]);
        Assert.Empty(game.Suspicions);
    }

    [Fact]
    public void Vote_IsCountedByItself_OnceEveryoneHasVoted()
    {
        var (game, ps) = TestGameFactory.CreateAssignedGame(5);
        game.ResolveNight(T0);
        game.StartVoting(T0);
        foreach (var p in ps.Skip(1)) game.SubmitVote(p.Id, ps[0].Id);
        Assert.False(game.AdvanceIfEveryoneActed(T0));
        game.SubmitVote(ps[0].Id, null);
        Assert.True(game.AdvanceIfEveryoneActed(T0));
        Assert.Equal(GamePhase.LastWords, game.CurrentPhase);
    }

    [Fact]
    public void Suspicion_CannotBeYourself_AndOnlyAtNight()
    {
        var (game, ps) = TestGameFactory.CreateAssignedGame(5);
        Assert.Throws<GameException>(() => game.SubmitSuspicion(ps[4].Id, ps[4].Id));
        game.ResolveNight(T0);
        Assert.Throws<GameException>(() => game.SubmitSuspicion(ps[4].Id, ps[0].Id));
    }

    [Fact]
    public void TimedTable_MovesOnFromFirstNightAndResults_WithoutTheCreator()
    {
        var (game, _) = TestGameFactory.CreateNightZeroGame(5, new GameConfig { NightSeconds = 60, VotingSeconds = 30 });
        Assert.True(game.AdvanceExpiredPhase(T0));
        Assert.Equal(T0.AddSeconds(60), game.PhaseDeadline);
        Assert.True(game.AdvanceExpiredPhase(T0.AddSeconds(61)));
        Assert.Equal(GamePhase.Day, game.CurrentPhase);

        game.StartVoting(T0);
        game.ResolveVoting(T0);
        Assert.Equal(GamePhase.Results, game.CurrentPhase);
        Assert.True(game.AdvanceExpiredPhase(T0));
        Assert.True(game.AdvanceExpiredPhase(T0.AddSeconds(GameState.ResultsSeconds + 1)));
        Assert.Equal(GamePhase.Night, game.CurrentPhase);
    }

    [Fact]
    public void NightAndVote_AreAlwaysTimed()
    {
        Assert.Equal(GameConfig.DefaultNightSeconds, GameService.BuildConfig(3, 10, null, isOpen: true).NightSeconds);
        Assert.Equal(GameConfig.DefaultNightSeconds, GameService.BuildConfig(3, 10, null, isOpen: false).NightSeconds);
        Assert.Equal(GameConfig.DefaultVotingSeconds, GameService.BuildConfig(3, 10, new TableRules(), isOpen: true).VotingSeconds);
        Assert.Equal(GameConfig.DefaultVotingSeconds, GameService.BuildConfig(3, 10, null, isOpen: false).VotingSeconds);
        var off = GameService.BuildConfig(3, 10, new TableRules(NightSeconds: 0, VotingSeconds: 0), isOpen: true);
        Assert.Equal(GameConfig.DefaultNightSeconds, off.NightSeconds);
        Assert.Equal(GameConfig.DefaultVotingSeconds, off.VotingSeconds);
        Assert.Equal(90, GameService.BuildConfig(3, 10, new TableRules(NightSeconds: 90), isOpen: false).NightSeconds);
    }

    // ------------------------------------------------------------ bots

    [Fact]
    public void Bots_FillSeats_AreAlwaysReady_AndNeverRunTheTable()
    {
        var game = new GameState(new GameConfig { MaxPlayers = 4 });
        var human = new Player(Guid.NewGuid(), "host");
        game.AddPlayer(human);
        var bot = game.AddBot(human.Id);
        game.AddBot(human.Id);
        game.AddBot(human.Id);
        Assert.True(bot.IsBot);
        Assert.Equal(3, game.Players.Select(p => p.DisplayName).Distinct().Count(n => n.EndsWith("🤖")));
        Assert.Throws<GameException>(() => game.AddBot(human.Id));
        Assert.Throws<GameException>(() => game.AddBot(bot.Id));

        game.SetReady(human.Id, true, T0);
        Assert.NotNull(game.AutoStartAt);
        Assert.Equal(human.Id, game.Controller!.Id);

        game.RemoveBot(human.Id, bot.Id);
        Assert.Equal(3, game.Players.Count);
        game.RemovePlayer(human.Id);
        Assert.Empty(game.Players);
    }

    [Fact]
    public void Bots_SurviveASnapshotRoundTrip()
    {
        var game = new GameState();
        var human = new Player(Guid.NewGuid(), "host");
        game.AddPlayer(human);
        game.AddBot(human.Id);
        var restored = GameState.FromSnapshot(game.ToSnapshot());
        Assert.True(restored.Players[1].IsBot);
        Assert.Equal(human.Id, restored.Controller!.Id);
    }

    [Fact]
    public void AGameOfOneHumanAndBots_PlaysItselfToTheEnd()
    {
        var game = new GameState(new GameConfig { NightSeconds = 60, VotingSeconds = 30, SpeakerSeconds = 30 });
        var human = new Player(Guid.NewGuid(), "host");
        game.AddPlayer(human);
        for (int i = 0; i < 6; i++) game.AddBot(human.Id);
        game.AssignRoles(new Random(7));
        var random = new Random(11);

        // The human never touches the game: timers and bots carry it.
        var now = T0;
        for (int tick = 0; tick < 5000 && game.CurrentPhase != GamePhase.Ended; tick++)
        {
            now = now.AddSeconds(1);
            game.AdvanceExpiredPhase(now, random);
        }

        Assert.Equal(GamePhase.Ended, game.CurrentPhase);
        Assert.NotEqual(WinCondition.None, game.CheckWinCondition());
        // Bots voted and acted at night rather than letting every timer run out on them.
        Assert.Contains(game.Events, e => e.Kind == GameEventKind.Vote && e.Ballots!.Count > 0);
        Assert.Contains(game.Events, e => e.Kind == GameEventKind.Night && e.KillTarget.HasValue);
        Assert.DoesNotContain(game.Events, e => e.Kind == GameEventKind.Removed && game.GetPlayer(e.PlayerId!.Value)!.IsBot);
    }

    [Fact]
    public void ABotSuspect_IsTheSameAllDay_AndAMafiaBotNeverPointsAtItsTeam()
    {
        var game = new GameState();
        var human = new Player(Guid.NewGuid(), "host");
        game.AddPlayer(human);
        for (int i = 0; i < 6; i++) game.AddBot(human.Id);
        game.AssignRoles(game.Players.Select(p => p.Id).Reverse().ToList());
        var mafiaBot = game.Players.First(p => p.IsBot && p.IsMafiaAligned);
        var suspect = game.BotSuspect(mafiaBot);
        Assert.Equal(suspect, game.BotSuspect(mafiaBot));
        Assert.False(game.GetPlayer(suspect!.Value)!.IsMafiaAligned);
    }

    // ------------------------------------------------------------ new roles

    [Fact]
    public void Negotiator_RecruitsAPlainVillager_InPlaceOfTheKill()
    {
        var (game, ps) = TestGameFactory.CreateAssignedGame(8, Custom(2, Role.Negotiator, Role.Detective, Role.Doctor));
        var negotiator = Of(ps, Role.Negotiator);
        var villager = ps.Villagers()[0];
        game.SubmitNightAction(ps.Godfather().Id, ps.Villagers()[1].Id, NightActionType.Kill);
        game.SubmitNightAction(negotiator.Id, villager.Id, NightActionType.Negotiate);
        var result = game.ResolveNight(T0);

        Assert.Null(result.Eliminated);
        Assert.True(result.NegotiationSucceeded);
        Assert.Equal(Role.Mafia, villager.Role);
        Assert.True(villager.WasRecruited && villager.IsMafiaAligned);
        Assert.Equal(3, villager.GodfatherRank);
        Assert.True(negotiator.AbilityUsed);

        game.CycleThroughToNextNight();
        Assert.Throws<GameException>(() => game.SubmitNightAction(negotiator.Id, ps.Villagers()[0].Id, NightActionType.Negotiate));
        Assert.True(GameState.FromSnapshot(game.ToSnapshot()).GetPlayer(villager.Id)!.WasRecruited);
    }

    [Fact]
    public void Negotiator_IsRefused_ByAPowerRole_AndTheAbilityIsSpent()
    {
        var (game, ps) = TestGameFactory.CreateAssignedGame(8, Custom(2, Role.Negotiator, Role.Detective, Role.Doctor));
        var negotiator = Of(ps, Role.Negotiator);
        game.SubmitNightAction(negotiator.Id, ps.Detective().Id, NightActionType.Negotiate);
        var result = game.ResolveNight(T0);
        Assert.False(result.NegotiationSucceeded);
        Assert.Equal(Role.Detective, ps.Detective().Role);
        Assert.True(negotiator.AbilityUsed);
    }

    [Fact]
    public void Bodyguard_DiesInPlaceOfThePlayerTheyGuard_AndCannotGuardThemTwiceRunning()
    {
        var (game, ps) = TestGameFactory.CreateAssignedGame(8, Custom(2, Role.Bodyguard, Role.Detective, Role.Doctor));
        var bodyguard = Of(ps, Role.Bodyguard);
        var target = ps.Detective();
        Assert.Throws<GameException>(() => game.SubmitNightAction(bodyguard.Id, bodyguard.Id, NightActionType.Guard));
        game.SubmitNightAction(bodyguard.Id, target.Id, NightActionType.Guard);
        game.SubmitNightAction(ps.Godfather().Id, ps.Villagers()[0].Id, NightActionType.Kill);
        game.ResolveNight(T0);
        Assert.True(bodyguard.IsAlive);

        game.CycleThroughToNextNight();
        Assert.Throws<GameException>(() => game.SubmitNightAction(bodyguard.Id, target.Id, NightActionType.Guard));
        game.SubmitNightAction(bodyguard.Id, ps.Doctor().Id, NightActionType.Guard);
        game.SubmitNightAction(ps.Godfather().Id, ps.Doctor().Id, NightActionType.Kill);
        var result = game.ResolveNight(T0);

        Assert.Equal(bodyguard.Id, result.Eliminated);
        Assert.Equal(bodyguard.Id, result.BodyguardDied);
        Assert.True(ps.Doctor().IsAlive);
        Assert.False(bodyguard.IsAlive);
        Assert.Equal(1, MafiaScoring.Score(game).Single(s => s.PlayerId == bodyguard.Id).GuardSaves);
    }

    // ------------------------------------------------------------ scoring

    [Fact]
    public void Scoring_RewardsABluffThatHolds_ARightSuspicion_AndTheDieHard()
    {
        var (game, ps) = TestGameFactory.CreateAssignedGame(8, Custom(2, Role.Silencer, Role.Detective, Role.Doctor, Role.DieHard));
        var silencer = Of(ps, Role.Silencer);
        var dieHard = Of(ps, Role.DieHard);
        var villager = ps.Villagers()[0];
        game.SubmitNightAction(ps.Godfather().Id, dieHard.Id, NightActionType.Kill);
        game.SubmitNightAction(silencer.Id, ps.Detective().Id, NightActionType.Silence);
        game.SubmitSuspicion(villager.Id, silencer.Id);
        game.ResolveNight(T0);

        // The Silencer gets a vote, but the Detective goes out instead.
        game.StartVoting(T0);
        game.SubmitVote(villager.Id, silencer.Id);
        game.SubmitVote(ps.Godfather().Id, ps.Detective().Id);
        game.SubmitVote(silencer.Id, ps.Detective().Id);
        game.ResolveVoting(T0);

        var scores = MafiaScoring.Score(game).ToDictionary(s => s.PlayerId);
        Assert.Equal(1, scores[silencer.Id].VotesSurvivedAsMafia);
        Assert.Equal(1, scores[silencer.Id].PowerRolesSilenced);
        Assert.Equal(1, scores[dieHard.Id].AttacksSurvived);
        Assert.Equal(1, scores[villager.Id].SuspicionsRight);
        Assert.Equal(MafiaScoring.PointsVoteSurvivedAsMafia + MafiaScoring.PointsPowerRoleSilenced + MafiaScoring.PointsNightSurvived, scores[silencer.Id].Points);
    }

    [Fact]
    public void Scoring_RewardsTheMayor_WhenTheirSecondVoteDecidesIt()
    {
        var (game, ps) = TestGameFactory.CreateNightZeroGame(7, Custom(2, Role.Mayor, Role.Detective, Role.Doctor));
        var mayor = Of(ps, Role.Mayor);
        var godfather = ps.Godfather();
        game.ResolveNight(T0);
        // The Mayor reveals on their own turn.
        while (game.Discussion!.ActivePlayerId != mayor.Id) game.FinishDiscussionSegment(game.Discussion.ActivePlayerId, T0);
        game.RevealMayor(mayor.Id);
        game.StartVoting(T0);
        // One vote each way without the Mayor's second vote: it is what sends the Godfather out.
        game.SubmitVote(mayor.Id, godfather.Id);
        game.SubmitVote(godfather.Id, mayor.Id);
        game.ResolveVoting(T0);

        Assert.False(godfather.IsAlive);
        Assert.Equal(1, MafiaScoring.Score(game).Single(s => s.PlayerId == mayor.Id).DecidingMayorVotes);
    }

    [Fact]
    public void Scoring_GivesTheJokerTheirWin()
    {
        var (game, ps) = TestGameFactory.CreateNightZeroGame(6, Custom(1, Role.Joker, Role.Detective, Role.Doctor));
        var joker = Of(ps, Role.Joker);
        game.ResolveNight(T0);
        game.StartVoting(T0);
        foreach (var p in ps.Where(p => p.Id != joker.Id)) game.SubmitVote(p.Id, joker.Id);
        game.ResolveVoting(T0);
        game.FinishLastWords();

        var score = MafiaScoring.Score(game).Single(s => s.PlayerId == joker.Id);
        Assert.True(score.JokerWon && score.IsMvp);
        Assert.True(score.Points >= MafiaScoring.PointsJokerWon + MafiaScoring.PointsTeamWon);
    }

    // ------------------------------------------------------------ accolades

    [Fact]
    public void Accolades_ArePickedOnceTheGameIsOver_OneOfEachPerPlayer()
    {
        var (game, ps) = TestGameFactory.CreateAssignedGame(3);
        Assert.Throws<GameException>(() => game.SubmitAccolade(ps[1].Id, AccoladeKind.Bluff, ps[0].Id));
        game.SubmitNightAction(ps.Godfather().Id, ps[1].Id, NightActionType.Kill);
        game.ResolveNight(T0);
        Assert.Equal(GamePhase.Ended, game.CurrentPhase);

        game.SubmitAccolade(ps[1].Id, AccoladeKind.Bluff, ps[0].Id);
        game.SubmitAccolade(ps[1].Id, AccoladeKind.Read, ps[2].Id);
        game.SubmitAccolade(ps[1].Id, AccoladeKind.Bluff, ps[2].Id);
        Assert.Throws<GameException>(() => game.SubmitAccolade(ps[1].Id, AccoladeKind.Read, ps[1].Id));

        var view = GameView.For(GameState.FromSnapshot(game.ToSnapshot()), ps[1].Id).Accolades!;
        Assert.Equal(ps[2].Id, view.YourBluff);
        Assert.Equal(ps[2].Id, view.YourRead);
        Assert.Equal(1, view.Bluff.Single().Count);
    }
}
