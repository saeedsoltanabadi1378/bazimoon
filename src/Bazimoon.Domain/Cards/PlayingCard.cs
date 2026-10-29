namespace Bazimoon.Domain.Cards;

public enum CardSuit { Clubs, Diamonds, Hearts, Spades }
public enum CardRank { Two = 2, Three, Four, Five, Six, Seven, Eight, Nine, Ten, Jack, Queen, King, Ace }

/// <summary>A standard playing card. The compact two-character code is stable across the API.</summary>
public readonly record struct PlayingCard(CardSuit Suit, CardRank Rank)
{
    public string Code => $"{Rank switch { CardRank.Ten => "T", CardRank.Jack => "J", CardRank.Queen => "Q", CardRank.King => "K", CardRank.Ace => "A", _ => ((int)Rank).ToString() }}{Suit.ToString()[0]}";

    public static PlayingCard Parse(string code)
    {
        if (string.IsNullOrWhiteSpace(code) || code.Length is < 2 or > 3) throw new GameException("That card is not valid.", "invalid_card");
        var rankText = code[..^1].ToUpperInvariant();
        var rank = rankText switch
        {
            "T" or "10" => CardRank.Ten, "J" => CardRank.Jack, "Q" => CardRank.Queen,
            "K" => CardRank.King, "A" => CardRank.Ace,
            _ when int.TryParse(rankText, out var n) && n is >= 2 and <= 9 => (CardRank)n,
            _ => throw new GameException("That card is not valid.", "invalid_card")
        };
        var suit = char.ToUpperInvariant(code[^1]) switch
        {
            'C' => CardSuit.Clubs, 'D' => CardSuit.Diamonds, 'H' => CardSuit.Hearts, 'S' => CardSuit.Spades,
            _ => throw new GameException("That card is not valid.", "invalid_card")
        };
        return new PlayingCard(suit, rank);
    }

    public static IReadOnlyList<PlayingCard> StandardDeck() =>
        Enum.GetValues<CardSuit>().SelectMany(s => Enum.GetValues<CardRank>().Select(r => new PlayingCard(s, r))).ToArray();
}
