namespace Bazimoon.Domain;

/// <summary>Which end-of-game accolade a player is voting for.</summary>
[System.Text.Json.Serialization.JsonConverter(typeof(System.Text.Json.Serialization.JsonStringEnumConverter))]
public enum AccoladeKind
{
    /// <summary>The player who bluffed best.</summary>
    Bluff,
    /// <summary>The player who read the table best.</summary>
    Read
}

/// <summary>One player's accolade picks once the game is over.</summary>
public sealed record AccoladeBallot(Guid? Bluff = null, Guid? Read = null);

// Suspicion picks, passing the night, moving on once everyone has acted, bots, and accolades.
public sealed partial class GameState
{
    private readonly Dictionary<Guid, Guid> _suspicions = new();
    private readonly HashSet<Guid> _nightPasses = new();
    private readonly Dictionary<Guid, AccoladeBallot> _accolades = new();
    private Guid? _lastGuardedTarget;

    /// <summary>How long the vote result stays up before a timed table moves on to the night by itself.</summary>
    public const int ResultsSeconds = 12;

    /// <summary>How long a bot holds the floor: long enough to read who it suspects.</summary>
    public const int BotTurnSeconds = 6;

    /// <summary>Tonight's private "who do you think is Mafia?" picks.</summary>
    public IReadOnlyDictionary<Guid, Guid> Suspicions => _suspicions;

    /// <summary>Players who chose to do nothing tonight.</summary>
    public IReadOnlyCollection<Guid> NightPasses => _nightPasses;

    /// <summary>End-of-game accolade picks, by voter.</summary>
    public IReadOnlyDictionary<Guid, AccoladeBallot> Accolades => _accolades;

    /// <summary>Who the Bodyguard guarded last night (they can't guard the same player twice in a row).</summary>
    public Guid? LastGuardedTarget => _lastGuardedTarget;

    /// <summary>A living player's private guess at who is Mafia. It changes nothing in the game; it gives
    /// players without a night role something to do, feeds the recap, and hides who is really acting.</summary>
    public void SubmitSuspicion(Guid playerId, Guid targetId)
    {
        if (CurrentPhase != GamePhase.Night)
            throw new GameException("Suspicions can only be picked during Night.");
        GetAliveOrThrow(playerId, "Player");
        GetAliveOrThrow(targetId, "Target");
        if (playerId == targetId)
            throw new GameException("You cannot suspect yourself.");
        _suspicions[playerId] = targetId;
    }

    /// <summary>A living player chooses to do nothing tonight (the Sniper holding fire, for example).</summary>
    public void PassNight(Guid playerId)
    {
        if (CurrentPhase != GamePhase.Night)
            throw new GameException("You can only pass during Night.");
        GetAliveOrThrow(playerId, "Player");
        _nightPasses.Add(playerId);
    }

    /// <summary>Whether this player has done their part tonight: an action, a suspicion or a pass.</summary>
    public bool IsNightDone(Guid playerId) =>
        _nightActions.ContainsKey(playerId) || _suspicions.ContainsKey(playerId) || _nightPasses.Contains(playerId);

    /// <summary>Ends the night once every living player has acted, and counts the vote once every living
    /// player has voted, so nobody waits on the creator or the timer. Returns true when the phase moved on.</summary>
    public bool AdvanceIfEveryoneActed(DateTimeOffset now)
    {
        var alive = _players.Where(p => p.IsAlive).ToList();
        if (alive.Count == 0) return false;
        if (CurrentPhase == GamePhase.Night && AreRequiredNightActionsComplete() && alive.All(p => IsNightDone(p.Id)))
        {
            // Everyone acted, so nobody is inactive whatever the clock says.
            PhaseDeadline = null;
            ResolveNight(now);
            return true;
        }
        if (CurrentPhase == GamePhase.Voting && alive.All(p => _votes.ContainsKey(p.Id)))
        {
            PhaseDeadline = null;
            ResolveVoting(now);
            return true;
        }
        return false;
    }

    /// <summary>At a timed table the first night and the vote result move on by themselves too.</summary>
    private bool AdvanceUnattendedPhase(DateTimeOffset now)
    {
        if (Config.NightSeconds is not { } nightSeconds || CurrentPhase is not (GamePhase.NightZero or GamePhase.Results))
            return false;
        if (PhaseDeadline is null)
        {
            PhaseDeadline = now.AddSeconds(CurrentPhase == GamePhase.Results ? ResultsSeconds : nightSeconds);
            return true;
        }
        if (PhaseDeadline > now) return false;
        if (CurrentPhase == GamePhase.Results) StartNight(now);
        else ResolveNight(now);
        return true;
    }

    // ---------------------------------------------------------------- accolades

    /// <summary>Once the game is over, each player picks one other player for an accolade.</summary>
    public void SubmitAccolade(Guid voterId, AccoladeKind kind, Guid targetId)
    {
        if (CurrentPhase != GamePhase.Ended)
            throw new GameException("Accolades are picked once the game is over.");
        if (GetPlayer(voterId) is not { IsBot: false })
            throw new GameException("Only players in this game can pick accolades.");
        if (GetPlayer(targetId) is null)
            throw new GameException("That player is not in this game.");
        if (voterId == targetId)
            throw new GameException("You cannot pick yourself.");
        var ballot = _accolades.GetValueOrDefault(voterId) ?? new AccoladeBallot();
        _accolades[voterId] = kind == AccoladeKind.Bluff ? ballot with { Bluff = targetId } : ballot with { Read = targetId };
    }

    // ---------------------------------------------------------------- bots

    private static readonly string[] BotNames = ["Dara", "Nika", "Sam", "Tara", "Borna", "Rosha", "Arad", "Mahsa", "Navid", "Sevda", "Kasra"];

    /// <summary>The table creator fills an empty lobby seat with a bot. Bots are always ready.</summary>
    public Player AddBot(Guid callerId)
    {
        if (CurrentPhase != GamePhase.Lobby)
            throw new GameException("Bots can only be added in the lobby.");
        if (Controller?.Id != callerId)
            throw new GameException("Only the table creator can add bots.");
        string name = BotNames.Select(n => $"{n} 🤖").FirstOrDefault(n => _players.All(p => p.DisplayName != n))
            ?? throw new GameException("This table has all the bots it can take.");
        var bot = new Player(Guid.NewGuid(), name, isBot: true);
        AddPlayer(bot);
        _ready.Add(bot.Id);
        return bot;
    }

    public void RemoveBot(Guid callerId, Guid botId)
    {
        if (Controller?.Id != callerId)
            throw new GameException("Only the table creator can remove bots.");
        if (GetPlayer(botId) is not { IsBot: true })
            throw new GameException("That seat is not a bot.");
        RemovePlayer(botId);
    }

    /// <summary>Who a bot suspects today: the same answer all day, so what it "says" on its turn matches its vote.
    /// A Detective bot goes for a Mafia member it found; a Mafia bot never points at its own team.</summary>
    public Guid? BotSuspect(Player bot)
    {
        var candidates = _players.Where(p => p.IsAlive && p.Id != bot.Id && !(bot.IsMafiaAligned && p.IsMafiaAligned)).ToList();
        if (bot.Role == Role.Detective)
        {
            var checks = _events.Where(e => e.Kind == GameEventKind.Night && e.DetectiveId == bot.Id && e.Checked.HasValue).ToList();
            if (candidates.FirstOrDefault(p => checks.Any(c => c.Checked == p.Id && c.CheckedIsMafia == true)) is { } found)
                return found.Id;
            var cleared = candidates.Where(p => checks.Any(c => c.Checked == p.Id)).ToList();
            if (cleared.Count < candidates.Count) candidates = candidates.Except(cleared).ToList();
        }
        if (candidates.Count == 0) return null;
        int seed = unchecked(GameId.GetHashCode() * 31 + bot.Id.GetHashCode() * 17 + NightNumber);
        return candidates[new Random(seed).Next(candidates.Count)].Id;
    }

    /// <summary>Lets the bots take their turns: night actions, votes, and giving up the floor after a few
    /// seconds (they have no voice). Returns true when something changed.</summary>
    private bool RunBots(DateTimeOffset now, Random random)
    {
        if (!_players.Any(p => p.IsBot)) return false;
        bool changed = false;
        // Bots act at a human pace, but never let a timer run out on them.
        bool closing = PhaseDeadline is { } deadline && deadline <= now.AddSeconds(3);
        bool Ready() => closing || random.Next(4) == 0;

        switch (CurrentPhase)
        {
            case GamePhase.Night:
                foreach (var bot in _players.Where(p => p.IsBot && p.IsAlive && !IsNightDone(p.Id)).ToList())
                {
                    if (!Ready()) continue;
                    BotNightAction(bot, random);
                    changed = true;
                }
                break;

            case GamePhase.Voting:
                foreach (var bot in _players.Where(p => p.IsBot && p.IsAlive && !_votes.ContainsKey(p.Id)).ToList())
                {
                    if (!Ready()) continue;
                    _votes[bot.Id] = BotVoteTarget(bot);
                    changed = true;
                }
                break;

            case GamePhase.Day or GamePhase.Defence when Discussion is { } discussion && GetPlayer(discussion.ActivePlayerId) is { IsBot: true }:
            {
                int turn = CurrentPhase == GamePhase.Defence ? Config.DefenceSeconds
                    : discussion.SegmentType == DiscussionSegmentType.Challenge ? Config.ChallengeSeconds : Config.SpeakerSeconds;
                if (now >= discussion.Deadline.AddSeconds(Math.Min(0, BotTurnSeconds - turn)))
                {
                    CompleteActiveDiscussionSegment(now);
                    changed = true;
                }
                break;
            }

            case GamePhase.LastWords when LastWordsPlayerId is { } speaker && GetPlayer(speaker) is { IsBot: true }
                && PhaseDeadline is { } wordsDeadline && now >= wordsDeadline.AddSeconds(Math.Min(0, 3 - Config.LastWordsSeconds)):
                CompleteLastWords(now);
                changed = true;
                break;
        }

        if (changed) AdvanceIfEveryoneActed(now);
        return changed;
    }

    private Guid? BotVoteTarget(Player bot)
    {
        var suspect = BotSuspect(bot);
        if (VotingRound != 2) return suspect;
        if (suspect is { } id && _runoffCandidates.Contains(id)) return id;
        // Re-vote: only the tied players can be picked.
        return _runoffCandidates
            .Where(c => c != bot.Id && GetPlayer(c) is { IsAlive: true } p && !(bot.IsMafiaAligned && p.IsMafiaAligned))
            .Select(c => (Guid?)c).FirstOrDefault();
    }

    private void BotNightAction(Player bot, Random random)
    {
        Guid? Pick(Func<Player, bool> allowed)
        {
            var options = _players.Where(p => p.IsAlive && allowed(p)).ToList();
            return options.Count == 0 ? null : options[random.Next(options.Count)].Id;
        }

        try
        {
            switch (bot.Role)
            {
                case Role.Godfather or Role.Mafia or Role.Negotiator:
                {
                    // A bot follows the team: the target the other Mafia suggested most, else a revealed Mayor, else anyone in the town.
                    var suggested = _nightActions.Values.Where(a => a.ActionType == NightActionType.Kill && GetPlayer(a.TargetId)?.IsAlive == true)
                        .GroupBy(a => a.TargetId).OrderByDescending(g => g.Count()).Select(g => (Guid?)g.Key).FirstOrDefault();
                    var target = suggested ?? Pick(p => p.Revealed && !p.IsMafiaAligned) ?? Pick(p => !p.IsMafiaAligned);
                    if (target is { } kill) { SubmitNightAction(bot.Id, kill, NightActionType.Kill); return; }
                    break;
                }
                case Role.Silencer when Pick(p => !p.IsMafiaAligned && p.Id != _lastSilencedTarget) is { } quiet:
                    SubmitNightAction(bot.Id, quiet, NightActionType.Silence);
                    return;
                case Role.Detective when Pick(p => p.Id != bot.Id && !_investigatedTargets.Contains(p.Id)) is { } check:
                    SubmitNightAction(bot.Id, check, NightActionType.Investigate);
                    return;
                case Role.Doctor when Pick(p => p.Id != bot.Id || _lastDoctorSelfHealNight != NightNumber) is { } heal:
                    SubmitNightAction(bot.Id, heal, NightActionType.Heal);
                    return;
                case Role.Bodyguard when Pick(p => p.Id != bot.Id && p.Id != _lastGuardedTarget) is { } guard:
                    SubmitNightAction(bot.Id, guard, NightActionType.Guard);
                    return;
            }
            // No action tonight (or a Sniper bot, which never gambles its one shot): a suspicion pick like everyone else.
            if (bot.Role is not (Role.Godfather or Role.Detective or Role.Doctor) && BotSuspect(bot) is { } suspect) _suspicions[bot.Id] = suspect;
            else _nightPasses.Add(bot.Id);
        }
        catch (GameException)
        {
            _nightPasses.Add(bot.Id);
        }
    }
}
