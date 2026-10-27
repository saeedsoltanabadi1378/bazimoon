using Bazimoon.Infrastructure.Hub;

namespace Bazimoon.Tests;

public class ProgressionTests
{
    [Fact]
    public void DailyNumbers_CountFromEachSeriesStart_AndLevelGamesHaveNone()
    {
        int day = Progression.PuzzleDay(new DateTimeOffset(2026, 10, 13, 12, 0, 0, TimeSpan.Zero));
        Assert.Equal(43, Progression.DailyNumber("mines", day));
        Assert.Null(Progression.DailyNumber("merge", day));
        foreach (var game in Progression.LevelGames)
            Assert.Null(Progression.DailyNumber(game, day));
    }

    [Theory]
    [InlineData("zip", "level", "level")]
    [InlineData("word", "level-fa", "level-fa")]
    [InlineData("ladder", "level-fa", "level-fa")]
    [InlineData("zip", "level-fa", "level")]
    [InlineData("zip", "practice", null)]
    [InlineData("mines", "level", null)]
    public void LevelTrack_OnlyForLevelGames(string game, string mode, string? track)
    {
        Assert.Equal(track, Progression.LevelTrack(game, mode));
    }

    [Fact]
    public void StartingLevel_FollowsSolvedDailies()
    {
        Assert.Equal(1, Progression.StartingLevel(0));
        Assert.Equal(13, Progression.StartingLevel(12));
    }

    [Fact]
    public void PuzzleDay_RollsOverAtTehranMidnight()
    {
        var beforeMidnight = new DateTimeOffset(2026, 10, 13, 20, 29, 0, TimeSpan.Zero); // 23:59 Tehran
        var afterMidnight = new DateTimeOffset(2026, 10, 13, 20, 31, 0, TimeSpan.Zero); // 00:01 Tehran
        Assert.Equal(Progression.PuzzleDay(beforeMidnight) + 1, Progression.PuzzleDay(afterMidnight));
    }

    [Theory]
    [InlineData(0, 1, 0)]
    [InlineData(999, 1, 999)]
    [InlineData(1000, 2, 0)]
    [InlineData(2150, 3, 0)]
    public void Levels_UseGrowingThresholds(int xp, int level, int into)
    {
        var (l, i, _) = Progression.Level(xp);
        Assert.Equal(level, l);
        Assert.Equal(into, i);
    }

    [Theory]
    [InlineData(1500, "Silver", 1)]
    [InlineData(1560, "Gold", 3)]
    [InlineData(1642, "Gold", 2)]
    [InlineData(1690, "Gold", 1)]
    [InlineData(1200, "Bronze", 3)]
    [InlineData(1900, "Diamond", 1)]
    public void Divisions_FollowRating(int rating, string division, int tier)
    {
        Assert.Equal((division, tier), Progression.Division(rating));
    }

    [Fact]
    public void Streak_Advances_UsesFreeze_AndResets()
    {
        var s = Progression.AdvanceStreak(5, 10, 1, 11);
        Assert.Equal((6, 11, 1, true), s);

        var frozen = Progression.AdvanceStreak(5, 10, 1, 12);
        Assert.Equal(6, frozen.Streak);
        Assert.Equal(0, frozen.Freezes);

        var reset = Progression.AdvanceStreak(5, 10, 0, 12);
        Assert.Equal(1, reset.Streak);

        var sameDay = Progression.AdvanceStreak(5, 10, 1, 10);
        Assert.False(sameDay.Extended);

        Assert.Equal(0, Progression.CurrentStreak(5, 10, 0, 12));
        Assert.Equal(5, Progression.CurrentStreak(5, 10, 0, 11));
    }

    [Fact]
    public void ZipLevelXp_IsFlat_SoManyLevelsADayCannotRideTheStreak()
    {
        var solved = new Progression.PuzzleOutcome("zip", "level", true, 42_000, null, null, null, 0);
        Assert.Equal(20, Progression.SoloXp(solved, puzzleStreak: 13, newBest: false));
        Assert.Equal(15, Progression.SoloXp(solved with { Hints = 1 }, 13, false));
        Assert.Equal(15, Progression.SoloXp(solved with { Mode = "practice" }, 13, false));
        Assert.Equal(5, Progression.SoloXp(solved with { Solved = false }, 13, false));
    }

    [Fact]
    public void LadderXp_FollowsParRewardsAndHintCost()
    {
        var atPar = new Progression.PuzzleOutcome("ladder", "level", true, 86_000, null, 4, 0, 0);
        Assert.Equal(25, Progression.SoloXp(atPar, 1, false));
        Assert.Equal(40, Progression.SoloXp(atPar with { Detail = -1 }, 1, false));
        Assert.Equal(10, Progression.SoloXp(atPar with { Detail = 1, Hints = 1 }, 1, false));
        Assert.Equal(5, Progression.SoloXp(atPar with { Solved = false }, 1, false));
    }

    [Fact]
    public void RatingDelta_IsSymmetricForEvenTeams()
    {
        Assert.Equal(16, Progression.RatingDelta(1500, 1500, won: true));
        Assert.Equal(-16, Progression.RatingDelta(1500, 1500, won: false));
    }
}
