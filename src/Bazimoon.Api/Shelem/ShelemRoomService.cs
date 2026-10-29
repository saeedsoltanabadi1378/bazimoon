using Bazimoon.Api.Games;
using Bazimoon.Domain;
using Bazimoon.Domain.Cards;
using Bazimoon.Domain.Shelem;
using Bazimoon.Infrastructure.Admin;

namespace Bazimoon.Api.Shelem;

/// <summary>Live Shelem rooms. The rules engine is pure; this service owns membership, bot timing and player-safe views.</summary>
public sealed class ShelemRoomService
{
    private readonly object _gate = new();
    private readonly Dictionary<string, Room> _rooms = new(StringComparer.Ordinal);
    private readonly TimeProvider _clock;
    private readonly IAppSettingsService _settings;
    private static readonly string[] BotNames = ["Roya", "Arman", "Nika", "Kian"];

    public ShelemRoomService(TimeProvider clock, IAppSettingsService settings) { _clock = clock; _settings = settings; }
    private DateTimeOffset Now => _clock.GetUtcNow();

    public async Task<ShelemRoomView> CreateAsync(Guid userId, string name, bool withBots)
    {
        if (!(await _settings.GetAsync()).IsGameOn("shelem")) throw new GameException("Shelem is switched off for now.", "game_off");
        lock (_gate)
        {
            Purge();
            string code; do code = NewCode(); while (_rooms.ContainsKey(code));
            var game = new ShelemGame();
            var me = game.AddPlayer(userId, name); me.Ready = true;
            var room = new Room { Code = code, Game = game, HostUserId = userId, LastActivity = Now };
            if (withBots)
            {
                FillBots(game);
                game.Start();
                ScheduleBot(room);
            }
            _rooms[code] = room;
            return View(room, userId);
        }
    }

    public Task<ShelemRoomView> GetAsync(string code, Guid userId)
    {
        lock (_gate)
        {
            var room = Find(code);
            Tick(room);
            if (room.Game.Players.All(p => p.UserId != userId)) throw new ForbiddenGameActionException("You are not in this room.");
            room.LastActivity = Now;
            return Task.FromResult(View(room, userId));
        }
    }

    public Task<ShelemRoomView> JoinAsync(string code, Guid userId, string name) => Act(code, userId, (room, me) =>
    {
        if (me is not null) return;
        room.Game.AddPlayer(userId, name);
    }, requireMember: false);

    public Task<ShelemRoomView> ReadyAsync(string code, Guid userId, bool ready) => Act(code, userId, (room, me) => room.Game.SetReady(me!.Seat, ready));

    public Task<ShelemRoomView> StartAsync(string code, Guid userId, bool fillBots) => Act(code, userId, (room, _) =>
    {
        RequireHost(room, userId);
        if (fillBots) FillBots(room.Game);
        room.Game.Start();
    });

    public Task<ShelemRoomView> BidAsync(string code, Guid userId, int? bid, bool shelem) => Act(code, userId, (room, me) => room.Game.Bid(me!.Seat, bid, shelem));
    public Task<ShelemRoomView> DiscardAsync(string code, Guid userId, IReadOnlyList<string> cards) => Act(code, userId, (room, me) => room.Game.Discard(me!.Seat, cards.Select(PlayingCard.Parse)));
    public Task<ShelemRoomView> TrumpAsync(string code, Guid userId, string suit) => Act(code, userId, (room, me) => room.Game.ChooseTrump(me!.Seat, ParseSuit(suit)));
    public Task<ShelemRoomView> PlayAsync(string code, Guid userId, string card) => Act(code, userId, (room, me) => room.Game.Play(me!.Seat, PlayingCard.Parse(card)));
    public Task<ShelemRoomView> NextAsync(string code, Guid userId) => Act(code, userId, (room, _) => { RequireHost(room, userId); room.Game.NextRound(); });

    public bool IsMember(string code, Guid userId)
    {
        lock (_gate) return _rooms.TryGetValue(NormalizeCode(code), out var room) && room.Game.Players.Any(p => p.UserId == userId);
    }

    private Task<ShelemRoomView> Act(string code, Guid userId, Action<Room, ShelemPlayer?> action, bool requireMember = true)
    {
        lock (_gate)
        {
            var room = Find(code);
            Tick(room);
            var me = room.Game.Players.FirstOrDefault(p => p.UserId == userId);
            if (requireMember && me is null) throw new ForbiddenGameActionException("You are not in this room.");
            if (room.TrickVisibleUntil > Now) throw new GameException("Wait for the completed trick.", "trick_pending");
            action(room, me);
            room.Version++;
            room.LastActivity = Now;
            ScheduleBot(room);
            return Task.FromResult(View(room, userId));
        }
    }

    private void Tick(Room room)
    {
        if (room.TrickVisibleUntil != default && Now >= room.TrickVisibleUntil)
        {
            room.TrickVisibleUntil = default;
            room.Version++;
        }
        if (room.BotActAt is null || Now < room.BotActAt) return;
        var game = room.Game;
        var bot = game.Players.FirstOrDefault(p => p.Seat == game.TurnSeat && p.IsBot);
        room.BotActAt = null;
        if (bot is null) return;
        var random = room.Random;
        switch (game.Phase)
        {
            case ShelemPhase.Bidding:
                var choice = ShelemBot.ChooseBid(game, bot.Seat, random);
                game.Bid(bot.Seat, choice.Bid, choice.Shelem);
                break;
            case ShelemPhase.Discard:
                game.Discard(bot.Seat, ShelemBot.ChooseDiscards(game, bot.Seat));
                break;
            case ShelemPhase.Trump:
                game.ChooseTrump(bot.Seat, ShelemBot.BestTrump(game, bot.Seat));
                break;
            case ShelemPhase.Playing:
                game.Play(bot.Seat, ShelemBot.ChoosePlay(game, bot.Seat, random));
                break;
        }
        room.Version++;
        ScheduleBot(room);
    }

    private void ScheduleBot(Room room)
    {
        var game = room.Game;
        var trickKey = string.Join(',', game.LastTrick.Select(p => p.Card.Code));
        if (trickKey.Length > 0 && trickKey != room.CompletedTrickKey)
        {
            room.CompletedTrickKey = trickKey;
            room.TrickVisibleUntil = Now.AddMilliseconds(1800);
        }
        if (room.BotActAt is null && (game.Phase is ShelemPhase.Bidding or ShelemPhase.Discard or ShelemPhase.Trump or ShelemPhase.Playing) &&
            game.Players.FirstOrDefault(p => p.Seat == game.TurnSeat)?.IsBot == true)
            room.BotActAt = (room.TrickVisibleUntil > Now ? room.TrickVisibleUntil : Now).AddMilliseconds(800);
    }

    private ShelemRoomView View(Room room, Guid userId)
    {
        var game = room.Game;
        var me = game.Players.FirstOrDefault(p => p.UserId == userId);
        bool holdingTrick = room.TrickVisibleUntil > Now;
        var legal = me is not null && game.Phase == ShelemPhase.Playing && game.TurnSeat == me.Seat ? game.LegalCards(me.Seat).Select(c => c.Code).ToArray() : [];
        return new ShelemRoomView(
            room.Code, game.Id, room.Version, holdingTrick ? "playing" : game.Phase.ToString().ToLowerInvariant(), game.Round, game.DealerSeat, holdingTrick ? -1 : game.TurnSeat,
            game.HighestBid, game.DeclarerSeat, game.ShelemCalled, game.Trump?.ToString().ToLowerInvariant(), game.TeamScores.ToArray(),
            game.Phase == ShelemPhase.Playing ? Enumerable.Range(0, 2).Select(team => game.Players.Where(p => p.Seat % 2 == team).Sum(p => p.Captured.Sum(ShelemGame.CardPoints) + p.Tricks * 5)).ToArray() : game.RoundPoints.ToArray(),
            game.RoundDelta, game.WinnerTeam, me?.Seat, room.HostUserId == userId, me?.Hand.OrderBy(c => c.Suit).ThenBy(c => c.Rank).Select(c => c.Code).ToArray() ?? [], legal,
            game.Players.Select(p => new ShelemPlayerView(p.Seat, p.Name, p.IsBot, p.Ready, p.Passed, p.Hand.Count, p.UserId == userId,
                p.UserId is { } id ? VoiceUid(id) : 0)).ToArray(),
            (holdingTrick ? game.LastTrick : game.Trick).Select(p => new ShelemPlayView(p.Seat, p.Card.Code)).ToArray(),
            game.LastTrick.Select(p => new ShelemPlayView(p.Seat, p.Card.Code)).ToArray(), game.LastTrickWinner,
            game.Zamin.Count, game.Discards.Count, room.BotActAt is not null);
    }

    private Room Find(string code) => _rooms.TryGetValue(NormalizeCode(code), out var room) ? room : throw new GameException("No room has that code.", "room_not_found");
    private static void RequireHost(Room room, Guid userId) { if (room.HostUserId != userId) throw new ForbiddenGameActionException("Only the host can do that."); }
    private static void FillBots(ShelemGame game) { while (game.Players.Count < 4) game.AddBot(BotNames[game.Players.Count - 1]); }
    private void Purge() { var cutoff = Now.AddHours(-4); foreach (var key in _rooms.Where(x => x.Value.LastActivity < cutoff).Select(x => x.Key).ToArray()) _rooms.Remove(key); }
    private static CardSuit ParseSuit(string suit) => Enum.TryParse<CardSuit>(suit, true, out var value) ? value : throw new GameException("Choose a valid trump suit.", "invalid_suit");
    public static uint VoiceUid(Guid userId) => Math.Max(1u, BitConverter.ToUInt32(userId.ToByteArray()));

    private const string CodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static string NewCode() => "SH-" + new string(Enumerable.Range(0, 4).Select(_ => CodeChars[Random.Shared.Next(CodeChars.Length)]).ToArray());
    public static string NormalizeCode(string code) { var c = (code ?? "").Trim().ToUpperInvariant().Replace(" ", ""); return c.StartsWith("SH-") ? c : c.StartsWith("SH") ? "SH-" + c[2..] : "SH-" + c; }

    private sealed class Room
    {
        public string Code = "";
        public ShelemGame Game = null!;
        public Guid HostUserId;
        public long Version;
        public DateTimeOffset LastActivity;
        public DateTimeOffset? BotActAt;
        public DateTimeOffset TrickVisibleUntil;
        public string CompletedTrickKey = "";
        public Random Random { get; } = new();
    }
}

public sealed record ShelemPlayerView(int Seat, string Name, bool IsBot, bool Ready, bool Passed, int Cards, bool IsYou, uint VoiceUid);
public sealed record ShelemPlayView(int Seat, string Card);
public sealed record ShelemRoomView(string Code, Guid GameId, long Version, string Phase, int Round, int DealerSeat, int TurnSeat,
    int? HighestBid, int? DeclarerSeat, bool ShelemCalled, string? Trump, int[] TeamScores, int[] RoundPoints, int[] RoundDelta,
    int? WinnerTeam, int? YourSeat, bool YouAreHost, string[] Hand, string[] LegalCards, ShelemPlayerView[] Players,
    ShelemPlayView[] Trick, ShelemPlayView[] LastTrick, int? LastTrickWinner, int ZaminCount, int DiscardCount, bool BotThinking);
