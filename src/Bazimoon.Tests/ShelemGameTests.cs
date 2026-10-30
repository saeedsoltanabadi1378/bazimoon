using Bazimoon.Domain;
using Bazimoon.Domain.Cards;
using Bazimoon.Domain.Shelem;

namespace Bazimoon.Tests;

public sealed class ShelemGameTests
{
    [Fact]
    public void Start_DealsEveryCardExactlyOnce()
    {
        var game = FourBots();
        game.Start(new Random(42));

        Assert.Equal(0, game.TurnSeat);

        var cards = game.Players.SelectMany(p => p.Hand).Concat(game.Zamin).ToList();
        Assert.Equal(52, cards.Count);
        Assert.Equal(52, cards.Distinct().Count());
        Assert.All(game.Players, p => Assert.Equal(12, p.Hand.Count));
        Assert.Equal(4, game.Zamin.Count);
    }

    [Fact]
    public void Play_RequiresFollowingTheLedSuit()
    {
        var game = FourBots();
        game.Start(new Random(7));
        FinishAuction(game);
        game.Discard(game.TurnSeat, game.Players[game.TurnSeat].Hand.Take(4).ToArray());
        game.ChooseTrump(game.TurnSeat, CardSuit.Spades);

        int leader = game.TurnSeat;
        var lead = game.Players[leader].Hand.GroupBy(c => c.Suit).First(g => game.Players[(leader + 1) % 4].Hand.Any(x => x.Suit == g.Key)).First();
        game.Play(leader, lead);
        int follower = game.TurnSeat;
        var wrong = game.Players[follower].Hand.FirstOrDefault(c => c.Suit != lead.Suit);
        Assert.NotEqual(default, wrong);
        var error = Assert.Throws<GameException>(() => game.Play(follower, wrong));
        Assert.Equal("must_follow_suit", error.Code);
    }

    [Fact]
    public void Bots_CompleteAFullMatchWithoutIllegalMoves()
    {
        for (int seed = 0; seed < 12; seed++)
        {
            var random = new Random(seed);
            var game = FourBots();
            game.Start(random);
            int actions = 0;
            while (game.Phase != ShelemPhase.Finished && actions++ < 12_000)
            {
                int seat = game.TurnSeat;
                switch (game.Phase)
                {
                    case ShelemPhase.Bidding:
                        var bid = ShelemBot.ChooseBid(game, seat, random);
                        game.Bid(seat, bid.Bid, bid.Shelem);
                        break;
                    case ShelemPhase.Discard:
                        game.Discard(seat, ShelemBot.ChooseDiscards(game, seat));
                        break;
                    case ShelemPhase.Trump:
                        game.ChooseTrump(seat, ShelemBot.BestTrump(game, seat));
                        break;
                    case ShelemPhase.Playing:
                        game.Play(seat, ShelemBot.ChoosePlay(game, seat, random));
                        break;
                    case ShelemPhase.RoundResult:
                        Assert.Equal(165, game.RoundPoints.Sum());
                        game.NextRound(random);
                        break;
                }
            }
            Assert.True(actions < 12_000, $"Seed {seed} did not finish");
            Assert.Contains(game.WinnerTeam, new int?[] { 0, 1 });
            Assert.Equal(game.Round, game.ScoreHistory.Count);
            Assert.Equal(game.TeamScores, game.ScoreHistory.Last().Totals);
            for (int index = 0; index < game.ScoreHistory.Count; index++)
            {
                var score = game.ScoreHistory[index];
                Assert.Equal(index + 1, score.Round);
                for (int team = 0; team < 2; team++)
                    Assert.Equal(game.ScoreHistory.Take(index + 1).Sum(row => row.Delta[team]), score.Totals[team]);
            }
        }
    }

    [Theory]
    [InlineData("AS", 10)]
    [InlineData("TD", 10)]
    [InlineData("5H", 5)]
    [InlineData("KC", 0)]
    public void CardPoints_UsesThe165PointSystem(string code, int points) => Assert.Equal(points, ShelemGame.CardPoints(PlayingCard.Parse(code)));

    private static ShelemGame FourBots()
    {
        var game = new ShelemGame();
        for (int i = 0; i < 4; i++) game.AddBot($"Bot {i + 1}");
        return game;
    }

    private static void FinishAuction(ShelemGame game)
    {
        int bidder = game.TurnSeat;
        game.Bid(bidder, 100);
        while (game.Phase == ShelemPhase.Bidding) game.Bid(game.TurnSeat, null);
    }
}
