using Nightfall.Domain;

namespace Nightfall.Tests;

/// <summary>M4 roles: Sniper, Die Hard, Silencer, Joker and Mayor, role setups, and hidden roles.</summary>
public class GameStateRolesTests
{
    private static readonly DateTimeOffset T0 = new(2026, 10, 18, 20, 0, 0, TimeSpan.Zero);

    private static GameConfig Custom(int mafia, params Role[] optional) =>
        new() { Roles = new RoleSetup(RolePreset.Custom, mafia, optional) };

    /// <summary>Deals roles in seat order and moves to the first night where roles act.</summary>
    private static (GameState Game, List<Player> Players) Started(int count, GameConfig config)
    {
        var (game, players) = TestGameFactory.CreateAssignedGame(count, config);
        return (game, players);
    }

    private static Player Of(List<Player> ps, Role role) => ps.First(p => p.Role == role);

    [Fact]
    public void IranianSetup_DealsItsSixRoles_ThenVillagers()
    {
        var (_, ps) = Started(8, new GameConfig { Roles = RoleSetup.Iranian });
        Assert.Equal(new[] { Role.Godfather, Role.Silencer, Role.Detective, Role.Doctor, Role.Sniper, Role.DieHard, Role.Villager, Role.Villager }, ps.Select(p => p.Role!.Value));
        Assert.Equal(2, ps.Single(p => p.Role == Role.Silencer).GodfatherRank);
    }

    [Fact]
    public void Setup_ThatDoesNotFit_BlocksTheStart()
    {
        var setup = new RoleSetup(RolePreset.Custom, 3, [Role.Detective, Role.Doctor]);
        Assert.Null(setup.RolesFor(6, out var problem));
        Assert.Equal(SetupProblem.TooManyMafia, problem);
        Assert.Null(RoleSetup.Iranian.RolesFor(5, out problem));
        Assert.Equal(SetupProblem.TooFewPlayers, problem);
        Assert.Equal(6, RoleSetup.Iranian.MinimumPlayers());

        var game = new GameState(new GameConfig { Roles = RoleSetup.Iranian });
        for (int i = 0; i < 5; i++) game.AddPlayer(new Player(Guid.NewGuid(), $"p{i}"));
        Assert.Throws<GameException>(() => game.AssignRoles());
    }

    [Fact]
    public void Classic_StillDealsTheOriginalRoles()
    {
        foreach (var n in new[] { 3, 4, 7, 12 })
        {
            var roles = RoleSetup.Classic.RolesFor(n, out _)!;
            Assert.Equal(n / 3, roles.Count(r => r is Role.Godfather or Role.Mafia));
            Assert.Equal(n > 3, roles.Contains(Role.Detective));
        }
    }

    [Fact]
    public void Sniper_HittingMafia_KillsThem_AndUsesTheShot()
    {
        var (game, ps) = Started(7, Custom(2, Role.Sniper, Role.Detective, Role.Doctor));
        var sniper = Of(ps, Role.Sniper);
        var mafia = Of(ps, Role.Mafia);
        game.SubmitNightAction(sniper.Id, mafia.Id, NightActionType.Shoot);
        var result = game.ResolveNight(T0);

        Assert.Equal(SniperOutcome.Hit, result.SniperOutcome);
        Assert.False(mafia.IsAlive);
        Assert.True(sniper.AbilityUsed);
        game.StartVoting(T0); game.ResolveVoting(T0); game.StartNight(T0);
        Assert.Throws<GameException>(() => game.SubmitNightAction(sniper.Id, Of(ps, Role.Godfather).Id, NightActionType.Shoot));
    }

    [Fact]
    public void Sniper_HittingTown_DiesInstead_AndTheDoctorCanSaveAMafiaTarget()
    {
        var (game, ps) = Started(7, Custom(2, Role.Sniper, Role.Detective, Role.Doctor));
        var sniper = Of(ps, Role.Sniper);
        game.SubmitNightAction(sniper.Id, Of(ps, Role.Detective).Id, NightActionType.Shoot);
        Assert.Equal(SniperOutcome.Backfired, game.ResolveNight(T0).SniperOutcome);
        Assert.False(sniper.IsAlive);
        Assert.True(Of(ps, Role.Detective).IsAlive);

        var (game2, ps2) = Started(7, Custom(2, Role.Sniper, Role.Detective, Role.Doctor));
        var target = Of(ps2, Role.Mafia);
        game2.SubmitNightAction(Of(ps2, Role.Sniper).Id, target.Id, NightActionType.Shoot);
        game2.SubmitNightAction(Of(ps2, Role.Doctor).Id, target.Id, NightActionType.Heal);
        Assert.Equal(SniperOutcome.Saved, game2.ResolveNight(T0).SniperOutcome);
        Assert.True(target.IsAlive);
    }

    [Fact]
    public void DieHard_SurvivesTheFirstKill_Quietly_ButNotTheSecond()
    {
        var (game, ps) = Started(7, Custom(2, Role.DieHard));
        var dieHard = Of(ps, Role.DieHard);
        game.SubmitNightAction(Of(ps, Role.Godfather).Id, dieHard.Id, NightActionType.Kill);
        var night = game.ResolveNight(T0);
        Assert.True(dieHard.IsAlive);
        Assert.Null(night.Eliminated);
        Assert.False(night.TargetWasSaved);
        Assert.Equal(dieHard.Id, night.DieHardSurvived);

        game.StartVoting(T0); game.ResolveVoting(T0); game.StartNight(T0);
        game.SubmitNightAction(Of(ps, Role.Godfather).Id, dieHard.Id, NightActionType.Kill);
        game.ResolveNight(T0);
        Assert.False(dieHard.IsAlive);
    }

    [Fact]
    public void Silencer_SkipsTheTargetsTurn_ForOneDay_AndCantPickThemTwiceInARow()
    {
        var (game, ps) = Started(7, Custom(2, Role.Silencer));
        var silencer = Of(ps, Role.Silencer);
        var target = ps.Villagers()[0];
        game.SubmitNightAction(silencer.Id, target.Id, NightActionType.Silence);
        // The Silencer is shot... no Sniper here, so kill the Silencer some other way: the result still applies.
        game.ResolveNight(T0);

        Assert.Equal(target.Id, game.SilencedPlayerId);
        Assert.DoesNotContain(target.Id, game.Discussion!.SpeakerOrder);
        game.StartVoting(T0);
        game.SubmitVote(target.Id, null); // can still vote
        game.ResolveVoting(T0);
        game.StartNight(T0);
        Assert.Null(game.SilencedPlayerId);
        Assert.Throws<GameException>(() => game.SubmitNightAction(silencer.Id, target.Id, NightActionType.Silence));
    }

    [Fact]
    public void Silencer_ShotTheSameNight_StillSilences()
    {
        var (game, ps) = Started(9, Custom(2, Role.Silencer, Role.Sniper));
        var silencer = Of(ps, Role.Silencer);
        var target = ps.Villagers()[0];
        game.SubmitNightAction(silencer.Id, target.Id, NightActionType.Silence);
        game.SubmitNightAction(Of(ps, Role.Sniper).Id, silencer.Id, NightActionType.Shoot);
        game.ResolveNight(T0);
        Assert.False(silencer.IsAlive);
        Assert.Equal(target.Id, game.SilencedPlayerId);
    }

    [Fact]
    public void Joker_VotedOut_WinsAndEndsTheGame_WhenTheTableSaysSo()
    {
        var (game, ps) = Started(7, Custom(2, Role.Joker));
        var joker = Of(ps, Role.Joker);
        game.ResolveNight(T0);
        game.StartVoting(T0);
        foreach (var p in ps.Where(p => p != joker)) game.SubmitVote(p.Id, joker.Id);
        game.ResolveVoting(T0);
        game.FinishLastWords(joker.Id, T0);

        Assert.Equal(GamePhase.Ended, game.CurrentPhase);
        Assert.Equal(WinCondition.JokerWins, game.CheckWinCondition());
        Assert.True(game.DidWin(joker));
        Assert.False(game.DidWin(Of(ps, Role.Godfather)));
        Assert.False(game.DidWin(ps.Villagers()[0]));
    }

    [Fact]
    public void Joker_VotedOut_WinsAndPlayGoesOn_WhenTheTableSaysSo()
    {
        var config = new GameConfig { Roles = new RoleSetup(RolePreset.Custom, 2, [Role.Joker]), JokerWinEndsGame = false };
        var (game, ps) = Started(7, config);
        var joker = Of(ps, Role.Joker);
        game.ResolveNight(T0);
        game.StartVoting(T0);
        foreach (var p in ps.Where(p => p != joker)) game.SubmitVote(p.Id, joker.Id);
        game.ResolveVoting(T0);
        game.FinishLastWords(joker.Id, T0);

        Assert.Equal(GamePhase.Results, game.CurrentPhase);
        Assert.Equal(joker.Id, game.JokerWinnerId);
        Assert.True(game.DidWin(joker));
        Assert.Null(game.DidWin(ps.Villagers()[0]));
    }

    [Fact]
    public void Mayor_RevealsOnlyOnTheirOwnTurn_AndThenVotesTwice()
    {
        var (game, ps) = Started(7, Custom(2, Role.Mayor));
        var mayor = Of(ps, Role.Mayor);
        game.ResolveNight(T0);
        Assert.Throws<GameException>(() => game.RevealMayor(mayor.Id));
        while (game.Discussion!.ActivePlayerId != mayor.Id)
            game.FinishDiscussionSegment(game.Discussion.ActivePlayerId, T0);
        game.RevealMayor(mayor.Id);
        Assert.True(mayor.Revealed);

        game.StartVoting(T0); // ends the rest of the discussion
        var a = ps.Villagers()[0]; var b = ps.Villagers()[1];
        game.SubmitVote(mayor.Id, a.Id);
        game.SubmitVote(Of(ps, Role.Godfather).Id, b.Id);
        var result = game.ResolveVoting(T0);
        Assert.Equal(a.Id, result.Eliminated); // 2 votes against 1
    }

    [Fact]
    public void GodfatherAppearsInnocent_ChangesTheDetectivesResult()
    {
        var config = new GameConfig { GodfatherAppearsInnocent = true };
        var (game, ps) = Started(6, config);
        game.SubmitNightAction(ps.Detective().Id, ps.Godfather().Id, NightActionType.Investigate);
        Assert.False(game.ResolveNight(T0).DetectiveResultIsMafiaAligned);
    }

    [Fact]
    public void Inquiry_IsOnlyForHiddenRoleTables_AndRevealsEveryoneOut()
    {
        var shown = Started(7, Custom(2, Role.DieHard));
        shown.Game.ResolveNight(T0);
        Assert.Throws<GameException>(() => shown.Game.CallInquiry(Of(shown.Players, Role.DieHard).Id));

        var config = new GameConfig { Roles = new RoleSetup(RolePreset.Custom, 2, [Role.DieHard]), RevealRolesOnDeath = false };
        var (game, ps) = Started(7, config);
        var victim = ps.Villagers()[0];
        game.SubmitNightAction(ps.Godfather().Id, victim.Id, NightActionType.Kill);
        game.ResolveNight(T0);
        game.CallInquiry(Of(ps, Role.DieHard).Id);
        Assert.Contains(victim.Id, game.InquiryRevealed);
        Assert.Throws<GameException>(() => game.CallInquiry(Of(ps, Role.DieHard).Id));
    }

    [Fact]
    public void Silencer_IsMafiaForTheDetective_AndTheWinCheck()
    {
        var (game, ps) = Started(7, Custom(2, Role.Silencer, Role.Detective));
        game.SubmitNightAction(ps.Detective().Id, Of(ps, Role.Silencer).Id, NightActionType.Investigate);
        Assert.True(game.ResolveNight(T0).DetectiveResultIsMafiaAligned);
        Assert.True(Of(ps, Role.Silencer).IsMafiaAligned);
    }
}

public class GameViewHiddenRolesTests
{
    [Fact]
    public void HiddenRoles_AreWithheld_FromEveryone_UntilTheEndOrAnInquiry()
    {
        var config = new GameConfig { Roles = new RoleSetup(RolePreset.Custom, 2, [Role.DieHard]), RevealRolesOnDeath = false };
        var (game, ps) = TestGameFactory.CreateAssignedGame(7, config);
        var victim = ps.Villagers()[0];
        game.SubmitNightAction(ps.Godfather().Id, victim.Id, NightActionType.Kill);
        game.ResolveNight();

        var alive = Nightfall.Api.Games.GameView.For(game, ps.Villagers()[1].Id);
        Assert.Null(alive.Players.Single(p => p.PlayerId == victim.Id).RevealedRole);
        var dead = Nightfall.Api.Games.GameView.For(game, victim.Id);
        Assert.Null(dead.YourRole);
        Assert.All(dead.Players, p => Assert.Null(p.RevealedRole));

        game.CallInquiry(ps.First(p => p.Role == Role.DieHard).Id);
        alive = Nightfall.Api.Games.GameView.For(game, ps.Villagers()[1].Id);
        Assert.Equal(Role.Villager, alive.Players.Single(p => p.PlayerId == victim.Id).RevealedRole);
    }

    [Fact]
    public void SetupView_ReportsWhyTheLobbyCantStart()
    {
        var game = new GameState(new GameConfig { Roles = RoleSetup.Iranian });
        for (int i = 0; i < 5; i++) game.AddPlayer(new Player(Guid.NewGuid(), $"p{i}"));
        var view = Nightfall.Api.Games.GameView.For(game, game.Players[0].Id);
        Assert.Equal(SetupProblem.TooFewPlayers, view.Setup!.Problem);
        Assert.Equal(6, view.Setup.MinimumPlayers);
    }
}
