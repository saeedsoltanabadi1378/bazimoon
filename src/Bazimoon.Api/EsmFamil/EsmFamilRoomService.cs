using Bazimoon.Api.Games;
using Bazimoon.Domain;
using Bazimoon.Infrastructure.Admin;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Hub;

namespace Bazimoon.Api.EsmFamil;

/// <summary>
/// Online Esm-Famil rooms, kept in memory. Every call advances the room's clock first (writing ends
/// at the deadline, judging when everyone is done or time runs out, scores move on after a pause),
/// so clients only need to poll. Finished games award XP once.
/// </summary>
public sealed class EsmFamilRoomService
{
    private readonly object _gate = new();
    private readonly Dictionary<string, Room> _rooms = new(StringComparer.Ordinal);
    private readonly TimeProvider _clock;
    private readonly IServiceScopeFactory _scopes;
    private readonly IBotSettingsService _settings;

    public EsmFamilRoomService(TimeProvider clock, IServiceScopeFactory scopes, IBotSettingsService settings)
    {
        _clock = clock;
        _scopes = scopes;
        _settings = settings;
    }

    private DateTimeOffset Now => _clock.GetUtcNow();

    public async Task<EsmRoomView> CreateAsync(long userId, string name, EsmRoomSettings settings)
    {
        if (!(await _settings.GetAsync()).IsGameOn("esmfamil")) throw new GameException("Esm-Famil is switched off for now.");
        var clean = Clean(settings);
        lock (_gate)
        {
            Purge();
            string code;
            do code = NewCode(); while (_rooms.ContainsKey(code));
            var room = new Room { Code = code, Settings = clean, LastActivity = Now };
            room.Players.Add(new Seat { Id = room.NextSeat++, UserId = userId, Name = Display(name), Ready = true });
            room.HostSeat = room.Players[0].Id;
            _rooms[code] = room;
            return View(room, userId);
        }
    }

    public async Task<EsmRoomView> GetAsync(string code, long userId) => await Act(code, userId, (_, _) => { }, requireMember: true);

    public async Task<EsmRoomView> JoinAsync(string code, long userId, string name)
    {
        return await Act(code, userId, (room, seat) =>
        {
            if (seat is not null) { seat.Left = false; return; }
            if (room.Phase != EsmPhase.Lobby) throw new GameException("This game has already started.");
            if (room.Active.Count() >= EsmFamilRules.MaxPlayers) throw new GameException("This room is full.");
            room.Players.Add(new Seat { Id = room.NextSeat++, UserId = userId, Name = Display(name) });
        }, requireMember: false);
    }

    public Task<EsmRoomView> SetReadyAsync(string code, long userId, bool ready) => Act(code, userId, (room, seat) =>
    {
        if (room.Phase != EsmPhase.Lobby) throw new GameException("The game has already started.");
        seat!.Ready = ready || seat.Id == room.HostSeat;
    });

    public Task<EsmRoomView> UpdateSettingsAsync(string code, long userId, EsmRoomSettings settings)
    {
        var clean = Clean(settings);
        return Act(code, userId, (room, seat) =>
        {
            RequireHost(room, seat!);
            if (room.Phase != EsmPhase.Lobby) throw new GameException("Settings are locked once the game starts.");
            room.Settings = clean;
        });
    }

    public Task<EsmRoomView> StartAsync(string code, long userId) => Act(code, userId, (room, seat) =>
    {
        RequireHost(room, seat!);
        if (room.Phase != EsmPhase.Lobby) throw new GameException("The game has already started.");
        var ready = room.Active.Where(p => p.Ready).ToList();
        if (ready.Count < 2) throw new GameException("At least 2 ready players are needed.");
        // Players who never said they were ready stay in the room as spectators of the lobby only.
        room.Players.RemoveAll(p => !p.Ready);
        foreach (var p in room.Players) p.Total = 0;
        StartRound(room, 0);
    });

    public Task<EsmRoomView> SaveAnswersAsync(string code, long userId, IReadOnlyList<string>? answers) => Act(code, userId, (room, seat) =>
    {
        if (room.Phase != EsmPhase.Writing) return; // too late: the round already moved on
        if (Now > room.Deadline.AddSeconds(1.5)) return;
        seat!.Answers = Fit(answers, room.Settings.Categories.Count);
    });

    public Task<EsmRoomView> StopAsync(string code, long userId, IReadOnlyList<string>? answers) => Act(code, userId, (room, seat) =>
    {
        if (room.Phase != EsmPhase.Writing) return;
        seat!.Answers = Fit(answers, room.Settings.Categories.Count);
        if (seat.Answers.Any(string.IsNullOrWhiteSpace)) throw new GameException("Fill every category before you press Stop.");
        if (room.StoppedBy is not null) return;
        room.StoppedBy = seat.Id;
        var stopAt = Now.AddSeconds(EsmFamilRules.StopGraceSeconds);
        if (stopAt < room.Deadline) room.Deadline = stopAt;
    });

    public Task<EsmRoomView> VoteAsync(string code, long userId, EsmVoteRequest request) => Act(code, userId, (room, seat) =>
    {
        if (room.Phase != EsmPhase.Judging) return;
        foreach (var v in request.Votes ?? [])
        {
            if (v.Seat == seat!.Id) continue; // nobody judges their own answers
            if (v.Category < 0 || v.Category >= room.Settings.Categories.Count) continue;
            if (room.Players.All(p => p.Id != v.Seat)) continue;
            room.Votes[(seat.Id, v.Seat, v.Category)] = v.Reject;
        }
        if (request.Done) seat!.VotesDone = true;
    });

    public Task<EsmRoomView> NextRoundAsync(string code, long userId) => Act(code, userId, (room, seat) =>
    {
        RequireHost(room, seat!);
        if (room.Phase == EsmPhase.Scores) AdvanceFromScores(room);
    });

    public Task<EsmRoomView> LeaveAsync(string code, long userId) => Act(code, userId, (room, seat) =>
    {
        if (room.Phase == EsmPhase.Lobby) room.Players.Remove(seat!);
        else seat!.Left = true;
        if (room.HostSeat == seat!.Id && room.Active.FirstOrDefault() is { } next) room.HostSeat = next.Id;
    });

    // ------------------------------------------------------------------ internals

    private async Task<EsmRoomView> Act(string code, long userId, Action<Room, Seat?> action, bool requireMember = true)
    {
        List<Award>? awards;
        EsmRoomView view;
        lock (_gate)
        {
            var room = Find(code);
            Tick(room);
            var seat = room.Players.FirstOrDefault(p => p.UserId == userId);
            if (requireMember && seat is null) throw new ForbiddenGameActionException("You are not in this room.");
            action(room, seat);
            Tick(room);
            room.LastActivity = Now;
            room.Version++;
            if (room.Active.Count() == 0 && room.Phase == EsmPhase.Lobby) _rooms.Remove(room.Code);
            awards = room.PendingAwards;
            room.PendingAwards = null;
            view = View(room, userId);
        }
        if (awards is { Count: > 0 }) await RecordAsync(awards);
        return view;
    }

    private Room Find(string code)
    {
        var key = NormalizeCode(code);
        return _rooms.TryGetValue(key, out var room) ? room : throw new GameException("No room has that code.");
    }

    private static void RequireHost(Room room, Seat seat)
    {
        if (seat.Id != room.HostSeat) throw new ForbiddenGameActionException("Only the host can do that.");
    }

    private void StartRound(Room room, int round)
    {
        var pool = EsmFamilRules.Letters[room.Settings.Letters].Where(l => !room.UsedLetters.Contains(l)).ToArray();
        if (pool.Length == 0) { room.UsedLetters.Clear(); pool = EsmFamilRules.Letters[room.Settings.Letters]; }
        room.Letter = pool[Random.Shared.Next(pool.Length)];
        room.UsedLetters.Add(room.Letter);
        room.Round = round;
        room.Phase = EsmPhase.Writing;
        room.Deadline = Now.AddSeconds(room.Settings.Seconds);
        room.StoppedBy = null;
        room.Votes.Clear();
        foreach (var p in room.Players)
        {
            p.Answers = new string[room.Settings.Categories.Count];
            Array.Fill(p.Answers, string.Empty);
            p.VotesDone = false;
            p.RoundPoints = 0;
            p.CategoryPoints = new int[room.Settings.Categories.Count];
        }
    }

    /// <summary>Moves the room along its timeline as far as the clock allows.</summary>
    private void Tick(Room room)
    {
        if (room.Phase == EsmPhase.Writing && Now >= room.Deadline)
        {
            room.Phase = EsmPhase.Judging;
            room.Deadline = Now.AddSeconds(EsmFamilRules.JudgingSeconds);
        }
        if (room.Phase == EsmPhase.Judging && (Now >= room.Deadline || room.Active.All(p => p.VotesDone)))
        {
            Score(room);
            room.Phase = EsmPhase.Scores;
            room.Deadline = Now.AddSeconds(EsmFamilRules.ScoresSeconds);
        }
        if (room.Phase == EsmPhase.Scores && Now >= room.Deadline) AdvanceFromScores(room);
    }

    private void AdvanceFromScores(Room room)
    {
        if (room.Round + 1 < room.Settings.Rounds && room.Active.Count() >= 2) StartRound(room, room.Round + 1);
        else Finish(room);
    }

    /// <summary>Whether an answer survives judging: it must start with the letter and not be rejected by most other players.</summary>
    public static bool Accepted(string answer, string letter, int rejects, int otherVoters) =>
        EsmFamilRules.StartsWithLetter(answer, letter) && rejects * 2 <= otherVoters;

    private void Score(Room room)
    {
        int n = room.Settings.Categories.Count;
        var players = room.Players;
        foreach (var p in players) p.Accepted = new bool[n];
        for (int c = 0; c < n; c++)
        {
            var answers = players.Select(p => p.Answers[c]).ToList();
            var valid = players.Select(p =>
            {
                int voters = room.Active.Count(o => o.Id != p.Id);
                int rejects = room.Votes.Count(kv => kv.Key.Owner == p.Id && kv.Key.Category == c && kv.Value);
                return Accepted(p.Answers[c], room.Letter, rejects, voters);
            }).ToList();
            var points = EsmFamilRules.ScoreCategory(answers, valid);
            for (int i = 0; i < players.Count; i++)
            {
                players[i].CategoryPoints[c] = points[i];
                players[i].Accepted![c] = valid[i];
            }
        }
        foreach (var p in players)
        {
            p.RoundPoints = p.CategoryPoints.Sum();
            p.Total += p.RoundPoints;
        }
    }

    private void Finish(Room room)
    {
        room.Phase = EsmPhase.Finished;
        if (room.Rewarded) return;
        room.Rewarded = true;
        int top = room.Players.Count == 0 ? 0 : room.Players.Max(p => p.Total);
        var ranked = room.Players.OrderByDescending(p => p.Total).ToList();
        room.PendingAwards = room.Players.Select(p => new Award(p.UserId, p.Name, p.Total == top, p.Total, 1 + ranked.Count(o => o.Total > p.Total))).ToList();
    }

    private async Task RecordAsync(List<Award> awards)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BazimoonDbContext>();
        int day = Progression.PuzzleDay(Now);
        foreach (var a in awards)
        {
            var outcome = new Progression.PuzzleOutcome("esmfamil", "online", a.Won, null, null, a.Total, a.Place, 0);
            int xp = Progression.SoloXp(outcome, 0, false);
            var stats = await db.GetOrCreateStatsAsync(a.UserId, a.Name);
            stats.Xp += xp;
            stats.UpdatedAt = DateTime.UtcNow;
            db.PuzzleResults.Add(new PuzzleResultRecord
            {
                TelegramUserId = a.UserId, Game = "esmfamil", Mode = "online", Day = day, Solved = a.Won,
                Moves = a.Total, Detail = a.Place, XpGained = xp, Points = Progression.LeaguePoints(outcome, xp),
            });
        }
        await db.SaveChangesAsync();
    }

    private EsmRoomView View(Room room, long userId)
    {
        var me = room.Players.FirstOrDefault(p => p.UserId == userId);
        bool reveal = room.Phase is EsmPhase.Judging or EsmPhase.Scores or EsmPhase.Finished;
        int msLeft = room.Phase is EsmPhase.Writing or EsmPhase.Judging or EsmPhase.Scores
            ? (int)Math.Max(0, (room.Deadline - Now).TotalMilliseconds) : 0;
        var players = room.Players.Select(p => new EsmPlayerView(
            p.Id, p.Name, p.Ready, p.Id == room.HostSeat, p.UserId == userId, p.Left,
            p.Answers?.Count(a => !string.IsNullOrWhiteSpace(a)) ?? 0, p.VotesDone, p.Total, p.RoundPoints,
            reveal ? p.Answers : null,
            room.Phase is EsmPhase.Scores or EsmPhase.Finished ? p.CategoryPoints : null,
            room.Phase is EsmPhase.Scores or EsmPhase.Finished ? p.Accepted : null)).ToList();
        List<EsmVoteView>? votes = null;
        if (room.Phase == EsmPhase.Judging || room.Phase == EsmPhase.Scores)
        {
            votes = room.Votes.GroupBy(kv => (kv.Key.Owner, kv.Key.Category))
                .Select(g => new EsmVoteView(g.Key.Owner, g.Key.Category, g.Count(kv => kv.Value), g.Count(kv => !kv.Value),
                    me is not null && room.Votes.TryGetValue((me.Id, g.Key.Owner, g.Key.Category), out var mine) ? mine : null))
                .ToList();
        }
        return new EsmRoomView(
            room.Code, room.Version, room.Phase.ToString().ToLowerInvariant(), room.Settings, room.Round, room.Phase == EsmPhase.Lobby ? null : room.Letter,
            msLeft, room.StoppedBy is { } s ? room.Players.FirstOrDefault(p => p.Id == s)?.Name : null, me?.Id, me is not null && me.Id == room.HostSeat,
            me?.Answers, players, votes);
    }

    private void Purge()
    {
        var cutoff = Now.AddHours(-2);
        foreach (var code in _rooms.Where(kv => kv.Value.LastActivity < cutoff).Select(kv => kv.Key).ToList()) _rooms.Remove(code);
    }

    private static EsmRoomSettings Clean(EsmRoomSettings s)
    {
        var cats = EsmFamilRules.CleanCategories(s.Categories);
        int rounds = Math.Clamp(s.Rounds, 1, 8);
        int seconds = s.Seconds is 60 or 90 or 120 ? s.Seconds : 90;
        string letters = s.Letters == "en" ? "en" : "fa";
        return new EsmRoomSettings(cats, rounds, seconds, letters);
    }

    private static string[] Fit(IReadOnlyList<string>? answers, int n)
    {
        var a = new string[n];
        for (int i = 0; i < n; i++)
        {
            var v = answers is not null && i < answers.Count ? (answers[i] ?? string.Empty).Trim() : string.Empty;
            a[i] = v.Length > 40 ? v[..40] : v;
        }
        return a;
    }

    private static string Display(string name) => string.IsNullOrWhiteSpace(name) ? "player" : name.Trim().Length > 24 ? name.Trim()[..24] : name.Trim();

    private const string CodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private static string NewCode() =>
        "EF-" + new string(Enumerable.Range(0, 3).Select(_ => CodeChars[Random.Shared.Next(CodeChars.Length)]).ToArray());

    public static string NormalizeCode(string code)
    {
        var c = (code ?? string.Empty).Trim().ToUpperInvariant().Replace(" ", "");
        if (!c.StartsWith("EF-", StringComparison.Ordinal)) c = c.StartsWith("EF", StringComparison.Ordinal) ? "EF-" + c[2..] : "EF-" + c;
        return c;
    }

    private enum EsmPhase { Lobby, Writing, Judging, Scores, Finished }

    private sealed record Award(long UserId, string Name, bool Won, int Total, int Place);

    private sealed class Seat
    {
        public int Id;
        public long UserId;
        public string Name = string.Empty;
        public bool Ready;
        public bool Left;
        public string[] Answers = [];
        public bool VotesDone;
        public int Total;
        public int RoundPoints;
        public int[] CategoryPoints = [];
        public bool[]? Accepted;
    }

    private sealed class Room
    {
        public string Code = string.Empty;
        public long Version;
        public EsmRoomSettings Settings = new(EsmFamilRules.ClassicCategories.ToList(), 3, 90, "fa");
        public List<Seat> Players { get; } = [];
        public IEnumerable<Seat> Active => Players.Where(p => !p.Left);
        public int NextSeat = 1;
        public int HostSeat;
        public EsmPhase Phase = EsmPhase.Lobby;
        public int Round;
        public string Letter = string.Empty;
        public HashSet<string> UsedLetters { get; } = [];
        public DateTimeOffset Deadline;
        public int? StoppedBy;
        public Dictionary<(int Voter, int Owner, int Category), bool> Votes { get; } = [];
        public bool Rewarded;
        public List<Award>? PendingAwards;
        public DateTimeOffset LastActivity;
    }
}

public sealed record EsmRoomSettings(List<string> Categories, int Rounds, int Seconds, string Letters);
public sealed record EsmJoinRequest(string Code);
public sealed record EsmReadyRequest(bool Ready);
public sealed record EsmAnswersRequest(List<string>? Answers);
public sealed record EsmVote(int Seat, int Category, bool Reject);
public sealed record EsmVoteRequest(List<EsmVote>? Votes, bool Done);

public sealed record EsmPlayerView(
    int Seat, string Name, bool Ready, bool IsHost, bool IsYou, bool Left, int Filled, bool VotesDone, int Total, int RoundPoints,
    string[]? Answers, int[]? CategoryPoints, bool[]? Accepted);

public sealed record EsmVoteView(int Seat, int Category, int Rejects, int Accepts, bool? MyReject);

public sealed record EsmRoomView(
    string Code, long Version, string Phase, EsmRoomSettings Settings, int Round, string? Letter, int MsLeft, string? StoppedBy,
    int? YourSeat, bool YouAreHost, string[]? YourAnswers, List<EsmPlayerView> Players, List<EsmVoteView>? Votes);
