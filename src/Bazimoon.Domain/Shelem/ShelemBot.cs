using Bazimoon.Domain.Cards;

namespace Bazimoon.Domain.Shelem;

/// <summary>A fair, deterministic-friendly bot: it reads only its own hand and public play.</summary>
public static class ShelemBot
{
    public static (int? Bid, bool Shelem) ChooseBid(ShelemGame game, int seat, Random random)
    {
        var hand = game.Players[seat].Hand;
        int points = hand.Sum(ShelemGame.CardPoints);
        int aces = hand.Count(c => c.Rank == CardRank.Ace);
        int kings = hand.Count(c => c.Rank == CardRank.King);
        int longest = Enum.GetValues<CardSuit>().Max(s => hand.Count(c => c.Suit == s));
        int estimate = 80 + points / 2 + aces * 8 + kings * 3 + Math.Max(0, longest - 3) * 5 + random.Next(-5, 6);
        estimate = Math.Clamp(estimate / 5 * 5, 100, 165);
        int floor = (game.HighestBid ?? 95) + 5;
        if (estimate < floor || (game.HighestBid is not null && random.NextDouble() < .18)) return (null, false);
        return (Math.Min(165, Math.Max(floor, estimate)), false);
    }

    public static CardSuit BestTrump(ShelemGame game, int seat) =>
        Enum.GetValues<CardSuit>().OrderByDescending(s => game.Players[seat].Hand.Where(c => c.Suit == s).Sum(Power)).First();

    public static IReadOnlyList<PlayingCard> ChooseDiscards(ShelemGame game, int seat)
    {
        var trump = BestTrump(game, seat);
        return game.Players[seat].Hand.OrderBy(c => c.Suit == trump ? 1 : 0).ThenBy(Power).Take(4).ToArray();
    }

    public static PlayingCard ChoosePlay(ShelemGame game, int seat, Random random)
    {
        var legal = game.LegalCards(seat).ToList();
        if (game.Trick.Count == 0)
        {
            // Lead high cards when they are likely to control the trick, otherwise shed a cheap card.
            var aces = legal.Where(c => c.Rank == CardRank.Ace).ToList();
            return aces.Count > 0 ? aces[random.Next(aces.Count)] : legal.OrderBy(Power).First();
        }

        int partner = (seat + 2) % 4;
        int currentWinner = ShelemGame.TrickWinner(game.Trick, game.Trump!.Value);
        if (currentWinner == partner) return legal.OrderBy(Power).First();

        var winners = legal.Where(card => ShelemGame.TrickWinner([.. game.Trick, new ShelemPlay(seat, card)], game.Trump!.Value) == seat).ToList();
        return winners.Count > 0 ? winners.OrderBy(Power).First() : legal.OrderBy(Power).First();
    }

    private static int Power(PlayingCard card) => (int)card.Rank + ShelemGame.CardPoints(card) * 2;
}
