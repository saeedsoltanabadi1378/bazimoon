using Bazimoon.Domain.Cards;

namespace Bazimoon.Domain.Shelem;

public enum ShelemPhase { Lobby, Bidding, Discard, Trump, Playing, RoundResult, Finished }

public sealed class ShelemPlayer
{
    public int Seat { get; init; }
    public Guid? UserId { get; init; }
    public string Name { get; init; } = string.Empty;
    public bool IsBot { get; init; }
    public bool Ready { get; set; }
    public bool Passed { get; set; }
    public List<PlayingCard> Hand { get; } = [];
    public List<PlayingCard> Captured { get; } = [];
    public int Tricks { get; set; }
}

public readonly record struct ShelemPlay(int Seat, PlayingCard Card);

/// <summary>Server-authoritative rules for classic four-player Shelem (two fixed partnerships).</summary>
public sealed class ShelemGame
{
    public const int WinningScore = 660;
    public Guid Id { get; } = Guid.NewGuid();
    public ShelemPhase Phase { get; private set; } = ShelemPhase.Lobby;
    public List<ShelemPlayer> Players { get; } = [];
    // BeginRound advances the dealer before dealing. Starting at seat 2 makes
    // seat 3 the first dealer and gives seat 0 the opening bid in a new room.
    public int DealerSeat { get; private set; } = 2;
    public int TurnSeat { get; private set; }
    public int Round { get; private set; }
    public int? HighestBid { get; private set; }
    public int? DeclarerSeat { get; private set; }
    public bool ShelemCalled { get; private set; }
    public CardSuit? Trump { get; private set; }
    public List<PlayingCard> Zamin { get; } = [];
    public List<PlayingCard> Discards { get; } = [];
    public List<ShelemPlay> Trick { get; } = [];
    public List<ShelemPlay> LastTrick { get; } = [];
    public int? LastTrickWinner { get; private set; }
    public int[] TeamScores { get; } = [0, 0];
    public int[] RoundPoints { get; } = [0, 0];
    public int[] RoundDelta { get; } = [0, 0];
    public int? WinnerTeam { get; private set; }

    public ShelemPlayer AddPlayer(Guid userId, string name, bool isBot = false)
    {
        if (Phase != ShelemPhase.Lobby) throw new GameException("This game has already started.", "already_started");
        var existing = Players.FirstOrDefault(p => p.UserId == userId);
        if (existing is not null) return existing;
        if (Players.Count >= 4) throw new GameException("This room is full.", "room_full");
        var player = new ShelemPlayer { Seat = Players.Count, UserId = userId, Name = CleanName(name), IsBot = isBot, Ready = isBot };
        Players.Add(player);
        return player;
    }

    public ShelemPlayer AddBot(string name)
    {
        if (Players.Count >= 4) throw new GameException("This room is full.", "room_full");
        var player = new ShelemPlayer { Seat = Players.Count, Name = name, IsBot = true, Ready = true };
        Players.Add(player);
        return player;
    }

    public void SetReady(int seat, bool ready)
    {
        RequirePhase(ShelemPhase.Lobby);
        Player(seat).Ready = ready;
    }

    public void Start(Random? random = null)
    {
        RequirePhase(ShelemPhase.Lobby);
        if (Players.Count != 4 || Players.Any(p => !p.Ready)) throw new GameException("Four ready seats are needed.", "four_ready_needed");
        BeginRound(random ?? Random.Shared);
    }

    public void Bid(int seat, int? bid, bool shelem = false)
    {
        RequireTurn(ShelemPhase.Bidding, seat);
        var player = Player(seat);
        if (player.Passed) throw new GameException("You already passed.", "already_passed");
        if (shelem)
        {
            HighestBid = 165;
            DeclarerSeat = seat;
            ShelemCalled = true;
            WinAuction();
            return;
        }
        if (bid is null)
        {
            player.Passed = true;
            int active = Players.Count(p => !p.Passed);
            if (HighestBid is not null && active == 1) { WinAuction(); return; }
            if (active == 0)
            {
                DealerSeat = Next(DealerSeat);
                BeginRound(Random.Shared, keepDealer: true);
                return;
            }
        }
        else
        {
            if (bid < 100 || bid > 165 || bid % 5 != 0 || bid <= (HighestBid ?? 95))
                throw new GameException("Bid from 100 to 165 in steps of five, above the current bid.", "invalid_bid");
            HighestBid = bid;
            DeclarerSeat = seat;
        }
        TurnSeat = NextActive(seat);
    }

    public void Discard(int seat, IEnumerable<PlayingCard> cards)
    {
        RequireTurn(ShelemPhase.Discard, seat);
        var chosen = cards.ToList();
        if (chosen.Count != 4 || chosen.Distinct().Count() != 4) throw new GameException("Choose exactly four different cards.", "discard_four");
        var player = Player(seat);
        if (chosen.Any(c => !player.Hand.Contains(c))) throw new GameException("You do not hold that card.", "card_not_held");
        foreach (var card in chosen) player.Hand.Remove(card);
        Discards.Clear(); Discards.AddRange(chosen);
        Phase = ShelemPhase.Trump;
    }

    public void ChooseTrump(int seat, CardSuit suit)
    {
        RequireTurn(ShelemPhase.Trump, seat);
        Trump = suit;
        Phase = ShelemPhase.Playing;
        TurnSeat = seat;
    }

    public IReadOnlyList<PlayingCard> LegalCards(int seat)
    {
        var hand = Player(seat).Hand;
        if (Trick.Count == 0) return hand;
        var led = Trick[0].Card.Suit;
        var follow = hand.Where(c => c.Suit == led).ToList();
        return follow.Count > 0 ? follow : hand;
    }

    public void Play(int seat, PlayingCard card)
    {
        RequireTurn(ShelemPhase.Playing, seat);
        var player = Player(seat);
        if (!player.Hand.Contains(card)) throw new GameException("You do not hold that card.", "card_not_held");
        if (!LegalCards(seat).Contains(card)) throw new GameException("You must follow the led suit.", "must_follow_suit");
        player.Hand.Remove(card);
        Trick.Add(new ShelemPlay(seat, card));
        if (Trick.Count < 4) { TurnSeat = Next(seat); return; }

        int winner = TrickWinner(Trick, Trump!.Value);
        var winnerPlayer = Player(winner);
        winnerPlayer.Captured.AddRange(Trick.Select(x => x.Card));
        winnerPlayer.Tricks++;
        LastTrick.Clear(); LastTrick.AddRange(Trick);
        LastTrickWinner = winner;
        Trick.Clear();
        TurnSeat = winner;
        if (Players.All(p => p.Hand.Count == 0)) ScoreRound();
    }

    public void NextRound(Random? random = null)
    {
        RequirePhase(ShelemPhase.RoundResult);
        DealerSeat = Next(DealerSeat);
        BeginRound(random ?? Random.Shared, keepDealer: true);
    }

    public static int TrickWinner(IReadOnlyList<ShelemPlay> trick, CardSuit trump)
    {
        if (trick.Count == 0) throw new ArgumentException("A trick cannot be empty.", nameof(trick));
        var led = trick[0].Card.Suit;
        return trick.OrderByDescending(p => p.Card.Suit == trump ? 2 : p.Card.Suit == led ? 1 : 0)
            .ThenByDescending(p => (int)p.Card.Rank).First().Seat;
    }

    public static int CardPoints(PlayingCard card) => card.Rank switch { CardRank.Ace or CardRank.Ten => 10, CardRank.Five => 5, _ => 0 };

    private void BeginRound(Random random, bool keepDealer = false)
    {
        if (!keepDealer) DealerSeat = Next(DealerSeat);
        Round++;
        HighestBid = null; DeclarerSeat = null; ShelemCalled = false; Trump = null; WinnerTeam = null; LastTrickWinner = null;
        Zamin.Clear(); Discards.Clear(); Trick.Clear(); LastTrick.Clear();
        Array.Clear(RoundPoints); Array.Clear(RoundDelta);
        foreach (var p in Players) { p.Hand.Clear(); p.Captured.Clear(); p.Tricks = 0; p.Passed = false; }
        var deck = PlayingCard.StandardDeck().ToList();
        for (int i = deck.Count - 1; i > 0; i--) { int j = random.Next(i + 1); (deck[i], deck[j]) = (deck[j], deck[i]); }
        for (int i = 0; i < 48; i++) Players[i % 4].Hand.Add(deck[i]);
        Zamin.AddRange(deck.Skip(48));
        Phase = ShelemPhase.Bidding;
        TurnSeat = Next(DealerSeat);
    }

    private void WinAuction()
    {
        if (DeclarerSeat is null || HighestBid is null) throw new GameException("Someone must bid before the auction can finish.", "no_bid");
        var declarer = Player(DeclarerSeat.Value);
        declarer.Hand.AddRange(Zamin);
        Zamin.Clear();
        Phase = ShelemPhase.Discard;
        TurnSeat = declarer.Seat;
    }

    private void ScoreRound()
    {
        for (int team = 0; team < 2; team++)
        {
            var members = Players.Where(p => p.Seat % 2 == team).ToList();
            RoundPoints[team] = members.Sum(p => p.Captured.Sum(CardPoints) + p.Tricks * 5);
        }
        int declaring = DeclarerSeat!.Value % 2;
        int defending = 1 - declaring;
        RoundPoints[declaring] += Discards.Sum(CardPoints) + 5;
        int bid = HighestBid!.Value;
        bool sweep = Players.Where(p => p.Seat % 2 == declaring).Sum(p => p.Tricks) == 12;
        if (ShelemCalled)
        {
            RoundDelta[declaring] = sweep ? 330 : -330;
            RoundDelta[defending] = sweep ? 0 : RoundPoints[defending];
        }
        else if (RoundPoints[declaring] >= bid)
        {
            RoundDelta[declaring] = bid;
            RoundDelta[defending] = RoundPoints[defending];
        }
        else
        {
            bool yasa = RoundPoints[defending] > RoundPoints[declaring];
            RoundDelta[declaring] = -(yasa ? bid * 2 : bid);
            RoundDelta[defending] = RoundPoints[defending];
        }
        TeamScores[0] += RoundDelta[0]; TeamScores[1] += RoundDelta[1];
        if (TeamScores[0] >= WinningScore || TeamScores[1] >= WinningScore)
        {
            WinnerTeam = TeamScores[0] == TeamScores[1] ? null : TeamScores[0] > TeamScores[1] ? 0 : 1;
            Phase = WinnerTeam is null ? ShelemPhase.RoundResult : ShelemPhase.Finished;
        }
        else Phase = ShelemPhase.RoundResult;
    }

    private ShelemPlayer Player(int seat) => Players.FirstOrDefault(p => p.Seat == seat) ?? throw new GameException("That seat does not exist.", "invalid_seat");
    private void RequirePhase(ShelemPhase phase) { if (Phase != phase) throw new GameException("That action is not available now.", "wrong_phase"); }
    private void RequireTurn(ShelemPhase phase, int seat) { RequirePhase(phase); if (TurnSeat != seat) throw new GameException("It is not your turn.", "not_your_turn"); }
    private static int Next(int seat) => (seat + 1) % 4;
    private int NextActive(int seat) { int next = Next(seat); while (Player(next).Passed) next = Next(next); return next; }
    private static string CleanName(string name) { var value = string.IsNullOrWhiteSpace(name) ? "Player" : name.Trim(); return value.Length > 24 ? value[..24] : value; }
}
