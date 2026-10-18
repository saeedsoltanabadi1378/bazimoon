namespace Nightfall.Domain;

public sealed class GameState
{
    private readonly List<Player> _players = new();
    private readonly Dictionary<Guid, NightAction> _nightActions = new();
    private readonly Dictionary<Guid, Guid?> _votes = new();
    private readonly HashSet<Guid> _investigatedTargets = new();
    private int? _lastDoctorSelfHealNight;
    private readonly List<Guid> _discussionSpeakerOrder = new();
    private readonly HashSet<Guid> _completedSpeakers = new();
    private readonly HashSet<Guid> _pendingChallengeRequests = new();
    private readonly List<Guid> _runoffCandidates = new();
    private GamePhase _afterLastWords = GamePhase.Results;
    private readonly HashSet<Guid> _ready = new();
    private readonly Dictionary<Guid, int> _strikes = new();
    private readonly List<Guid> _lastRemoved = new();

    /// <summary>Seconds between everyone being ready at a full table and the game starting by itself.</summary>
    public const int AutoStartSeconds = 5;

    /// <summary>Two timed turns missed in a row remove a player.</summary>
    public const int StrikesToRemove = 2;

    public Guid GameId { get; private init; }
    public DateTimeOffset CreatedAt { get; private init; }

    /// <summary>Which Telegram chat this game belongs to. Optional/nullable so pure-Domain usage
    /// (e.g. unit tests) doesn't need a fake chat id; the API always supplies one.</summary>
    public long? TelegramChatId { get; private init; }

    public GameConfig Config { get; private init; } = GameConfig.Default;
    public GamePhase CurrentPhase { get; private set; } = GamePhase.Lobby;
    public int NightNumber { get; private set; }
    public IReadOnlyList<Player> Players => _players;

    /// <summary>Outcome of the most recent ResolveNight() call, if any. Lets a caller (e.g. an API
    /// handler on a later request) show "your investigation result" / "who died" after the fact.</summary>
    public NightResult? LastNightResult { get; private set; }

    /// <summary>Outcome of the most recent ResolveVoting() call, if any.</summary>
    public VotingResult? LastVotingResult { get; private set; }
    public DiscussionStateSnapshot? Discussion { get; private set; }

    /// <summary>The follow-up game started from this one's Game over screen, if any.</summary>
    public Guid? RematchGameId { get; private set; }

    /// <summary>1 for the day's vote; 2 for the re-vote between the players tied in round 1.</summary>
    public int VotingRound { get; private set; } = 1;

    /// <summary>The players tied in round 1: they defend themselves, and round 2 is between them only.</summary>
    public IReadOnlyList<Guid> RunoffCandidates => _runoffCandidates;

    /// <summary>When the current Night, Voting or LastWords phase moves on by itself. Null when the
    /// creator moves it on by hand (or the phase has no timer). Day turns keep their own deadline in Discussion.</summary>
    public DateTimeOffset? PhaseDeadline { get; private set; }

    /// <summary>Who is saying their last words, during LastWords.</summary>
    public Guid? LastWordsPlayerId { get; private set; }

    /// <summary>Lobby players who tapped Ready.</summary>
    public IReadOnlyCollection<Guid> ReadyPlayers => _ready;

    /// <summary>When a full lobby where everyone is ready starts by itself.</summary>
    public DateTimeOffset? AutoStartAt { get; private set; }

    /// <summary>Timed turns each player has missed in a row.</summary>
    public IReadOnlyDictionary<Guid, int> Strikes => _strikes;

    /// <summary>Players removed for inactivity when the last timed night or vote closed.</summary>
    public IReadOnlyList<Guid> LastRemovedForInactivity => _lastRemoved;

    /// <summary>Who runs the game: the longest-seated player who has not left. Being killed or voted
    /// out does not hand it over; leaving or being removed for inactivity does.</summary>
    public Player? Controller => _players.FirstOrDefault(p => p.EliminatedBy != EliminationCause.Left);

    /// <summary>The phase LastWords leads to: Results after a vote, Day after a night kill (or Ended if the game is won).</summary>
    public GamePhase AfterLastWords => _afterLastWords;

    public GameState(GameConfig? config = null, Guid? gameId = null, long? telegramChatId = null)
    {
        Config = config ?? GameConfig.Default;
        GameId = gameId ?? Guid.NewGuid();
        CreatedAt = DateTimeOffset.UtcNow;
        TelegramChatId = telegramChatId;
    }

    public Player? GetPlayer(Guid id) => _players.FirstOrDefault(p => p.Id == id);

    /// <summary>Captures full-fidelity state, including in-flight submissions not exposed by the public API, for persistence (see GameStateSnapshot).</summary>
    public GameStateSnapshot ToSnapshot() => new(
        GameId,
        CreatedAt,
        TelegramChatId,
        CurrentPhase,
        NightNumber,
        Config,
        _players.Select(p => new PlayerSnapshot(p.Id, p.TelegramUsername, p.Role, p.IsAlive, p.GodfatherRank, p.EliminatedBy, p.EliminatedRound, p.WasPromoted)).ToList(),
        _nightActions.Values.Select(a => new NightActionSnapshot(a.ActorId, a.TargetId, a.ActionType)).ToList(),
        new Dictionary<Guid, Guid?>(_votes),
        _investigatedTargets.ToList(),
        _lastDoctorSelfHealNight,
        LastNightResult,
        LastVotingResult,
        Discussion,
        RematchGameId,
        VotingRound,
        _runoffCandidates.ToList(),
        PhaseDeadline,
        LastWordsPlayerId,
        _afterLastWords,
        _ready.ToList(),
        AutoStartAt,
        new Dictionary<Guid, int>(_strikes),
        _lastRemoved.ToList());

    /// <summary>Reconstructs a GameState (including in-flight submissions) from a snapshot, bypassing normal transition guards.</summary>
    public static GameState FromSnapshot(GameStateSnapshot snapshot)
    {
        var game = new GameState(snapshot.Config, snapshot.GameId, snapshot.TelegramChatId)
        {
            CreatedAt = snapshot.CreatedAt,
            CurrentPhase = snapshot.CurrentPhase,
            NightNumber = snapshot.NightNumber,
            LastNightResult = snapshot.LastNightResult,
            LastVotingResult = snapshot.LastVotingResult,
            RematchGameId = snapshot.RematchGameId,
            VotingRound = snapshot.VotingRound,
            PhaseDeadline = snapshot.PhaseDeadline,
            LastWordsPlayerId = snapshot.LastWordsPlayerId,
            _afterLastWords = snapshot.AfterLastWords,
            AutoStartAt = snapshot.AutoStartAt
        };
        if (snapshot.ReadyPlayers is { } ready) game._ready.UnionWith(ready);
        if (snapshot.Strikes is { } strikes) foreach (var (id, n) in strikes) game._strikes[id] = n;
        if (snapshot.LastRemovedForInactivity is { } removed) game._lastRemoved.AddRange(removed);
        if (snapshot.RunoffCandidates is { } runoff)
            game._runoffCandidates.AddRange(runoff);

        foreach (var ps in snapshot.Players)
        {
            var player = new Player(ps.Id, ps.TelegramUsername);
            if (ps.Role.HasValue)
                player.AssignRole(ps.Role.Value);
            if (ps.GodfatherRank.HasValue)
                player.SetGodfatherRank(ps.GodfatherRank);
            if (!ps.IsAlive)
                player.Eliminate();
            player.RestoreElimination(ps.EliminatedBy, ps.EliminatedRound);
            player.RestorePromotion(ps.WasPromoted);
            game._players.Add(player);
        }

        foreach (var action in snapshot.PendingNightActions)
        {
            game._nightActions[action.ActorId] = new NightAction(action.ActorId, action.TargetId, action.ActionType);
        }

        foreach (var (voterId, targetId) in snapshot.PendingVotes)
        {
            game._votes[voterId] = targetId;
        }

        foreach (var targetId in snapshot.InvestigatedTargets)
        {
            game._investigatedTargets.Add(targetId);
        }

        game._lastDoctorSelfHealNight = snapshot.LastDoctorSelfHealNight;

        if (snapshot.Discussion is { } discussion)
        {
            game._discussionSpeakerOrder.AddRange(discussion.SpeakerOrder);
            game._completedSpeakers.UnionWith(discussion.CompletedSpeakers);
            game._pendingChallengeRequests.UnionWith(discussion.PendingChallengeRequests);
            game.RefreshDiscussion(discussion.ActivePlayerId, discussion.OriginalSpeakerId, discussion.SegmentType, discussion.Deadline);
        }

        return game;
    }

    public void AddPlayer(Player player)
    {
        ArgumentNullException.ThrowIfNull(player);
        if (CurrentPhase != GamePhase.Lobby)
            throw new GameException("Players can only join during the Lobby phase.");
        if (_players.Any(p => p.Id == player.Id))
            throw new GameException("A player with this id has already joined.");
        if (_players.Count >= Config.MaxPlayers)
            throw new GameException($"Lobby is full (max {Config.MaxPlayers} players).");

        _players.Add(player);
        ResetAutoStart();
    }

    /// <summary>A lobby player taps Ready (or Not ready). A full table where everyone is ready starts
    /// <see cref="AutoStartSeconds"/> later; anyone un-readying or leaving stops the countdown.</summary>
    public void SetReady(Guid playerId, bool ready, DateTimeOffset now)
    {
        if (CurrentPhase != GamePhase.Lobby)
            throw new GameException("Ready can only be set in the lobby.");
        if (GetPlayer(playerId) is null)
            throw new GameException("You are not in this lobby.");
        if (ready) _ready.Add(playerId); else _ready.Remove(playerId);
        bool everyone = _players.Count >= Config.MaxPlayers && _players.Count >= Config.MinPlayers && _players.All(p => _ready.Contains(p.Id));
        AutoStartAt = everyone ? AutoStartAt ?? now.AddSeconds(AutoStartSeconds) : null;
    }

    private void ResetAutoStart() => AutoStartAt = null;

    /// <summary>Links a finished game to the rematch its players can join.</summary>
    public void SetRematch(Guid rematchGameId)
    {
        if (CurrentPhase != GamePhase.Ended)
            throw new GameException("A rematch can only be started once the game is over.");
        RematchGameId ??= rematchGameId;
    }

    /// <summary>Removes a player who changed their mind while the lobby is still open.</summary>
    public void RemovePlayer(Guid playerId)
    {
        if (CurrentPhase != GamePhase.Lobby)
            throw new GameException("Players can only leave during the Lobby phase.");
        var player = GetPlayer(playerId) ?? throw new GameException("You are not in this lobby.");
        _players.Remove(player);
        _ready.Remove(playerId);
        ResetAutoStart();
    }

    /// <summary>Players the Detective has already investigated (each can be checked only once).</summary>
    public IReadOnlyCollection<Guid> InvestigatedTargets => _investigatedTargets;

    /// <summary>True when the Doctor healed themselves last night and so cannot do so tonight.</summary>
    public bool DoctorSelfHealBlocked => _lastDoctorSelfHealNight.HasValue && _lastDoctorSelfHealNight == NightNumber;

    /// <summary>Night actions submitted so far this night.</summary>
    public IReadOnlyCollection<NightAction> PendingNightActions => _nightActions.Values;

    /// <summary>Living night roles whose action is required before the night can end (Godfather, Detective, Doctor).</summary>
    public int RequiredNightActionCount => CurrentPhase == GamePhase.Night
        ? _players.Count(p => p.IsAlive && p.Role is Role.Godfather or Role.Detective or Role.Doctor)
        : 0;

    /// <summary>How many of the required night actions are already in.</summary>
    public int SubmittedRequiredNightActionCount => CurrentPhase == GamePhase.Night
        ? _players.Count(p => p.IsAlive && p.Role is Role.Godfather or Role.Detective or Role.Doctor && _nightActions.ContainsKey(p.Id))
        : 0;

    /// <summary>Randomly assigns roles to all lobby players.</summary>
    public void AssignRoles(Random? random = null)
    {
        ValidateReadyForRoleAssignment();
        random ??= Random.Shared;
        var shuffled = _players.OrderBy(_ => random.Next()).ToList();
        AssignRolesCore(shuffled);
    }

    /// <summary>Assigns roles deterministically in the given player order (first players fill Mafia/Godfather, then Detective, Doctor, Villagers). Useful for tests and custom setups.</summary>
    public void AssignRoles(IReadOnlyList<Guid> playerOrder)
    {
        ArgumentNullException.ThrowIfNull(playerOrder);
        ValidateReadyForRoleAssignment();
        if (playerOrder.Count != _players.Count ||
            playerOrder.Distinct().Count() != _players.Count ||
            playerOrder.Any(id => GetPlayer(id) is null))
        {
            throw new GameException("playerOrder must contain every player in the lobby exactly once.");
        }

        AssignRolesCore(playerOrder.Select(id => GetPlayer(id)!).ToList());
    }

    private void ValidateReadyForRoleAssignment()
    {
        if (CurrentPhase != GamePhase.Lobby)
            throw new GameException("Roles can only be assigned from the Lobby phase.");
        if (_players.Count < Config.MinPlayers)
            throw new GameException($"At least {Config.MinPlayers} players are required to start.");
    }

    private void AssignRolesCore(List<Player> ordered)
    {
        CurrentPhase = GamePhase.RoleAssignment;
        _ready.Clear();
        AutoStartAt = null;

        int mafiaCount = DetermineMafiaCount(ordered.Count);
        int i = 0;
        for (int rank = 1; rank <= mafiaCount; rank++, i++)
        {
            var player = ordered[i];
            player.AssignRole(rank == 1 ? Role.Godfather : Role.Mafia);
            player.SetGodfatherRank(rank);
        }

        if (ordered.Count == 3)
        {
            for (; i < ordered.Count; i++)
            {
                ordered[i].AssignRole(Role.Villager);
            }

            CurrentPhase = GamePhase.NightZero;
            return;
        }

        ordered[i++].AssignRole(Role.Detective);
        ordered[i++].AssignRole(Role.Doctor);
        for (; i < ordered.Count; i++)
        {
            ordered[i].AssignRole(Role.Villager);
        }

        CurrentPhase = GamePhase.NightZero;
    }

    private static int DetermineMafiaCount(int playerCount) => playerCount / 3;

    public void SubmitNightAction(Guid playerId, Guid targetId, NightActionType actionType)
    {
        if (CurrentPhase == GamePhase.NightZero)
            throw new GameException("The first night is for Mafia discussion only; role actions begin on the next night.");
        if (CurrentPhase != GamePhase.Night)
            throw new GameException("Night actions can only be submitted during Night.");

        var actor = GetAliveOrThrow(playerId, "Actor");
        GetAliveOrThrow(targetId, "Target");

        switch (actionType)
        {
            case NightActionType.Investigate:
                if (actor.Role != Role.Detective)
                    throw new GameException("Only the Detective can investigate.");
                if (_investigatedTargets.Contains(targetId))
                    throw new GameException("This player has already been investigated.");
                break;

            case NightActionType.Heal:
                if (actor.Role != Role.Doctor)
                    throw new GameException("Only the Doctor can heal.");
                if (targetId == playerId && _lastDoctorSelfHealNight == NightNumber)
                    throw new GameException("The Doctor cannot self-heal two nights in a row.");
                break;

            case NightActionType.Kill:
                if (!actor.IsMafiaAligned)
                    throw new GameException("Only Mafia-aligned players can submit a kill.");
                if (GetPlayer(targetId)!.IsMafiaAligned)
                    throw new GameException("The Mafia cannot target its own team.");
                break;

            default:
                throw new ArgumentOutOfRangeException(nameof(actionType));
        }

        _nightActions[playerId] = new NightAction(playerId, targetId, actionType);
    }

    public NightResult ResolveNight(DateTimeOffset? now = null)
    {
        if (CurrentPhase is not (GamePhase.Night or GamePhase.NightZero))
            throw new GameException("ResolveNight can only be called during Night or NightZero.");
        var at = now ?? DateTimeOffset.UtcNow;
        bool timedOut = PhaseDeadline is { } nightDeadline && nightDeadline <= at;
        PhaseDeadline = null;
        _lastRemoved.Clear();
        if (CurrentPhase == GamePhase.Night && timedOut)
        {
            var required = _players.Where(p => p.IsAlive && p.Role is Role.Godfather or Role.Detective or Role.Doctor).Select(p => p.Id);
            RemoveInactive(required, id => _nightActions.ContainsKey(id));
        }

        NightNumber++;

        Guid? killTarget = ResolveGodfatherKillTarget();
        Guid? healTarget = ResolveDoctorHealTarget();
        var (investigateTarget, investigateResult) = ResolveDetectiveInvestigation();

        bool wasSaved = killTarget.HasValue && killTarget == healTarget;
        Guid? eliminated = null;
        if (killTarget.HasValue && !wasSaved && GetPlayer(killTarget.Value)!.IsAlive)
        {
            var victim = GetPlayer(killTarget.Value)!;
            victim.Eliminate(EliminationCause.Night, NightNumber);
            eliminated = victim.Id;
        }

        _nightActions.Clear();

        Guid? promotedId = eliminated.HasValue ? HandlePotentialGodfatherDeath(eliminated.Value) : null;

        if (eliminated.HasValue && Config.LastWordsForNightKills)
        {
            EnterLastWords(eliminated.Value, GamePhase.Day, at);
        }
        else
        {
            AdvancePhaseAfterResolution(GamePhase.Day);
            if (CurrentPhase == GamePhase.Day)
                StartDiscussion(at);
        }

        var result = new NightResult(NightNumber, eliminated, wasSaved, investigateTarget, investigateResult, promotedId);
        LastNightResult = result;
        return result;
    }

    public bool AreRequiredNightActionsComplete()
    {
        if (CurrentPhase == GamePhase.NightZero)
            return true;
        if (CurrentPhase != GamePhase.Night)
            return false;

        return _players
            .Where(player => player.IsAlive && player.Role is Role.Godfather or Role.Detective or Role.Doctor)
            .All(player => _nightActions.ContainsKey(player.Id));
    }

    private Guid? ResolveGodfatherKillTarget()
    {
        var godfather = _players.FirstOrDefault(p => p.IsAlive && p.Role == Role.Godfather);
        if (godfather is null)
            return null;
        if (_nightActions.TryGetValue(godfather.Id, out var action) && action.ActionType == NightActionType.Kill)
            return action.TargetId;
        // The Godfather did nothing: the kill goes to the living target the other Mafia suggested most.
        // A tie between suggestions, or none at all, means nobody dies.
        var top = _nightActions.Values
            .Where(a => a.ActionType == NightActionType.Kill && GetPlayer(a.ActorId)?.IsAlive == true && GetPlayer(a.TargetId)?.IsAlive == true)
            .GroupBy(a => a.TargetId)
            .Select(g => (Target: g.Key, Count: g.Count()))
            .OrderByDescending(x => x.Count)
            .Take(2)
            .ToList();
        if (top.Count == 0 || (top.Count == 2 && top[0].Count == top[1].Count))
            return null;
        return top[0].Target;
    }

    private Guid? ResolveDoctorHealTarget()
    {
        var doctor = _players.FirstOrDefault(p => p.IsAlive && p.Role == Role.Doctor);
        if (doctor is null)
            return null;
        if (!_nightActions.TryGetValue(doctor.Id, out var action) || action.ActionType != NightActionType.Heal)
            return null;

        if (action.TargetId == doctor.Id)
            _lastDoctorSelfHealNight = NightNumber;

        return action.TargetId;
    }

    private (Guid? Target, bool? IsMafiaAligned) ResolveDetectiveInvestigation()
    {
        var detective = _players.FirstOrDefault(p => p.IsAlive && p.Role == Role.Detective);
        if (detective is null)
            return (null, null);
        if (!_nightActions.TryGetValue(detective.Id, out var action) || action.ActionType != NightActionType.Investigate)
            return (null, null);

        var target = GetPlayer(action.TargetId)!;
        _investigatedTargets.Add(target.Id);
        return (target.Id, target.IsMafiaAligned);
    }

    public void SubmitVote(Guid playerId, Guid? targetId)
    {
        if (CurrentPhase != GamePhase.Voting)
            throw new GameException("Votes can only be submitted during Voting.");

        GetAliveOrThrow(playerId, "Voter");
        if (targetId.HasValue)
        {
            GetAliveOrThrow(targetId.Value, "Vote target");
            if (VotingRound == 2 && !_runoffCandidates.Contains(targetId.Value))
                throw new GameException("In the re-vote you can only vote for one of the tied players.");
        }

        _votes[playerId] = targetId;
    }

    /// <summary>Counts the vote. Round 1: a single top player is out (after their last words), a tie
    /// sends the tied players to Defence and then a round 2 between them only. Round 2: a tie again
    /// means nobody is out.</summary>
    public VotingResult ResolveVoting(DateTimeOffset? now = null)
    {
        if (CurrentPhase != GamePhase.Voting)
            throw new GameException("ResolveVoting can only be called during Voting.");
        var at = now ?? DateTimeOffset.UtcNow;
        bool timedOut = PhaseDeadline is { } voteDeadline && voteDeadline <= at;
        _lastRemoved.Clear();
        if (timedOut)
            RemoveInactive(_players.Where(p => p.IsAlive).Select(p => p.Id), id => _votes.ContainsKey(id));

        var ballots = new Dictionary<Guid, Guid?>(_votes);
        var tally = _votes.Values
            .Where(v => v.HasValue && GetPlayer(v.Value)?.IsAlive == true)
            .GroupBy(v => v!.Value)
            .Select(g => (PlayerId: g.Key, Count: g.Count()))
            .ToList();

        _votes.Clear();
        PhaseDeadline = null;
        int round = VotingRound;
        var previous = round == 2 ? LastVotingResult : null;

        if (tally.Count == 0 || CheckWinCondition() != WinCondition.None)
        {
            var noVotesResult = new VotingResult(null, false, Array.Empty<Guid>(), null, ballots, round, previous);
            LastVotingResult = noVotesResult;
            EndRunoff();
            AdvancePhaseAfterResolution(GamePhase.Results);
            return noVotesResult;
        }

        int maxVotes = tally.Max(t => t.Count);
        var topVoted = tally.Where(t => t.Count == maxVotes).Select(t => t.PlayerId).ToList();

        if (topVoted.Count > 1)
        {
            var tieResult = new VotingResult(null, true, topVoted, null, ballots, round, previous);
            LastVotingResult = tieResult;
            if (round == 1)
            {
                StartRunoff(topVoted, at);
            }
            else
            {
                EndRunoff();
                AdvancePhaseAfterResolution(GamePhase.Results);
            }
            return tieResult;
        }

        var victim = GetPlayer(topVoted[0])!;
        victim.Eliminate(EliminationCause.Vote, NightNumber);
        Guid? promotedId = HandlePotentialGodfatherDeath(victim.Id);

        var result = new VotingResult(victim.Id, false, topVoted, promotedId, ballots, round, previous);
        LastVotingResult = result;
        EndRunoff();
        EnterLastWords(victim.Id, GamePhase.Results, at);
        return result;
    }

    /// <summary>Gives a strike to every one of <paramref name="expected"/> who did not act, clears the strikes of
    /// those who did, and removes anyone who reached <see cref="StrikesToRemove"/>.</summary>
    private void RemoveInactive(IEnumerable<Guid> expected, Func<Guid, bool> acted)
    {
        foreach (var id in expected.ToList())
        {
            if (acted(id)) { _strikes.Remove(id); continue; }
            _strikes[id] = _strikes.GetValueOrDefault(id) + 1;
            if (_strikes[id] < StrikesToRemove) continue;
            var player = GetPlayer(id)!;
            player.Eliminate(EliminationCause.Left, NightNumber);
            _strikes.Remove(id);
            _lastRemoved.Add(id);
            HandlePotentialGodfatherDeath(id);
        }
    }

    /// <summary>A player leaves a game that has started: they are out, their role is shown, and it counts as
    /// a loss. If they held the floor their turn ends; if they were the creator, the next seat takes over.</summary>
    public void LeaveMidGame(Guid playerId, DateTimeOffset now)
    {
        if (CurrentPhase is GamePhase.Lobby or GamePhase.Ended)
            throw new GameException("You can only leave a game that is under way.");
        var player = GetAliveOrThrow(playerId, "Player");
        player.Eliminate(EliminationCause.Left, NightNumber);
        _votes.Remove(playerId);
        _nightActions.Remove(playerId);
        _strikes.Remove(playerId);
        HandlePotentialGodfatherDeath(playerId);

        if (CheckWinCondition() != WinCondition.None && CurrentPhase != GamePhase.LastWords)
        {
            Discussion = null;
            PhaseDeadline = null;
            CurrentPhase = GamePhase.Ended;
            return;
        }
        if (Discussion?.ActivePlayerId == playerId)
            CompleteActiveDiscussionSegment(now);
        if (CurrentPhase == GamePhase.Voting && VotingRound == 2 && _runoffCandidates.All(id => GetPlayer(id)?.IsAlive != true))
        {
            // Nobody left to vote for in the re-vote.
            ResolveVoting(now);
        }
    }

    private void StartRunoff(IReadOnlyCollection<Guid> tied, DateTimeOffset now)
    {
        VotingRound = 2;
        _runoffCandidates.Clear();
        _runoffCandidates.AddRange(_players.Where(p => tied.Contains(p.Id) && p.IsAlive).Select(p => p.Id));
        CurrentPhase = GamePhase.Defence;
        _discussionSpeakerOrder.Clear();
        _discussionSpeakerOrder.AddRange(_runoffCandidates);
        _completedSpeakers.Clear();
        _pendingChallengeRequests.Clear();
        StartNextSpeaker(now);
    }

    private void EndRunoff()
    {
        VotingRound = 1;
        _runoffCandidates.Clear();
    }

    private void EnterLastWords(Guid playerId, GamePhase next, DateTimeOffset now)
    {
        CurrentPhase = GamePhase.LastWords;
        Discussion = null;
        LastWordsPlayerId = playerId;
        _afterLastWords = next;
        PhaseDeadline = now.AddSeconds(Config.LastWordsSeconds);
    }

    /// <summary>The player saying their last words ends them early.</summary>
    public void FinishLastWords(Guid playerId, DateTimeOffset now)
    {
        if (CurrentPhase != GamePhase.LastWords)
            throw new GameException("Nobody is saying their last words.");
        if (LastWordsPlayerId != playerId)
            throw new GameException("Only the player saying their last words can finish them.");
        CompleteLastWords(now);
    }

    private void CompleteLastWords(DateTimeOffset now)
    {
        LastWordsPlayerId = null;
        PhaseDeadline = null;
        AdvancePhaseAfterResolution(_afterLastWords);
        if (CurrentPhase == GamePhase.Day)
            StartDiscussion(now);
    }

    /// <summary>Moves on any phase whose timer has run out: a day or defence turn, last words, a timed
    /// night (night roles that have not acted do nothing) or a timed vote (missing votes abstain).
    /// Returns true when something changed.</summary>
    public bool AdvanceExpiredPhase(DateTimeOffset now)
    {
        switch (CurrentPhase)
        {
            case GamePhase.Day:
            {
                bool started = Discussion is null;
                bool advanced = AdvanceExpiredDiscussion(now);
                return started || advanced;
            }
            case GamePhase.Defence:
                return AdvanceExpiredDiscussion(now);
            case GamePhase.LastWords when PhaseDeadline <= now:
                CompleteLastWords(now);
                return true;
            case GamePhase.Lobby when AutoStartAt <= now:
                AssignRoles();
                return true;
            case GamePhase.Night when PhaseDeadline <= now:
                ResolveNight(now);
                return true;
            case GamePhase.Voting when PhaseDeadline <= now:
                ResolveVoting(now);
                return true;
            default:
                return false;
        }
    }

    public void StartVoting(DateTimeOffset? now = null)
    {
        if (CurrentPhase != GamePhase.Day)
            throw new GameException("Voting can only start from the Day phase.");
        CurrentPhase = GamePhase.Voting;
        SetVotingDeadline(now ?? DateTimeOffset.UtcNow);
    }

    private void SetVotingDeadline(DateTimeOffset now) =>
        PhaseDeadline = Config.VotingSeconds is { } seconds ? now.AddSeconds(seconds) : null;

    public void EnsureDiscussionStarted(DateTimeOffset now)
    {
        if (CurrentPhase != GamePhase.Day || Discussion is not null)
            return;
        StartDiscussion(now);
    }

    public bool AdvanceExpiredDiscussion(DateTimeOffset now)
    {
        EnsureDiscussionStarted(now);
        if (Discussion is null || Discussion.Deadline > now)
            return false;
        CompleteActiveDiscussionSegment(now);
        return true;
    }

    public void RequestChallenge(Guid challengerId, DateTimeOffset now)
    {
        AdvanceExpiredDiscussion(now);
        var discussion = RequireSpeakerSegment();
        var challenger = GetAliveOrThrow(challengerId, "Challenger");
        if (challenger.Id == discussion.ActivePlayerId)
            throw new GameException("The current speaker cannot challenge themselves.");
        if (!_pendingChallengeRequests.Add(challenger.Id))
            throw new GameException("You have already requested a challenge.");
        RefreshDiscussionFromCurrent();
    }

    public void CancelChallenge(Guid challengerId, DateTimeOffset now)
    {
        AdvanceExpiredDiscussion(now);
        RequireSpeakerSegment();
        if (!_pendingChallengeRequests.Remove(challengerId))
            throw new GameException("You do not have a pending challenge request.");
        RefreshDiscussionFromCurrent();
    }

    public void RejectChallenge(Guid speakerId, Guid challengerId, DateTimeOffset now)
    {
        AdvanceExpiredDiscussion(now);
        var discussion = RequireSpeakerSegment();
        if (discussion.ActivePlayerId != speakerId)
            throw new GameException("Only the current speaker can reject challenges.");
        if (!_pendingChallengeRequests.Remove(challengerId))
            throw new GameException("That challenge request is no longer pending.");
        RefreshDiscussionFromCurrent();
    }

    public void AcceptChallenge(Guid speakerId, Guid challengerId, DateTimeOffset now)
    {
        AdvanceExpiredDiscussion(now);
        var discussion = RequireSpeakerSegment();
        if (discussion.ActivePlayerId != speakerId)
            throw new GameException("Only the current speaker can accept a challenge.");
        if (!_pendingChallengeRequests.Contains(challengerId))
            throw new GameException("That challenge request is no longer pending.");
        GetAliveOrThrow(challengerId, "Challenger");
        _pendingChallengeRequests.Clear();
        RefreshDiscussion(challengerId, discussion.OriginalSpeakerId, DiscussionSegmentType.Challenge, now.AddSeconds(Config.ChallengeSeconds));
    }

    public void FinishDiscussionSegment(Guid playerId, DateTimeOffset now)
    {
        AdvanceExpiredDiscussion(now);
        if (Discussion is null || Discussion.ActivePlayerId != playerId)
            throw new GameException("Only the active speaker can finish this segment.");
        CompleteActiveDiscussionSegment(now);
    }

    private void StartDiscussion(DateTimeOffset now)
    {
        _discussionSpeakerOrder.Clear();
        _discussionSpeakerOrder.AddRange(_players.Where(p => p.IsAlive).Select(p => p.Id));
        _completedSpeakers.Clear();
        _pendingChallengeRequests.Clear();
        StartNextSpeaker(now);
    }

    private void CompleteActiveDiscussionSegment(DateTimeOffset now)
    {
        if (Discussion is null) return;
        _completedSpeakers.Add(Discussion.OriginalSpeakerId);
        _pendingChallengeRequests.Clear();
        StartNextSpeaker(now);
    }

    private void StartNextSpeaker(DateTimeOffset now)
    {
        var next = _discussionSpeakerOrder.FirstOrDefault(id => !_completedSpeakers.Contains(id) && GetPlayer(id)?.IsAlive == true);
        if (next == Guid.Empty)
        {
            Discussion = null;
            CurrentPhase = GamePhase.Voting;
            SetVotingDeadline(now);
            return;
        }
        int seconds = CurrentPhase == GamePhase.Defence ? Config.DefenceSeconds : Config.SpeakerSeconds;
        RefreshDiscussion(next, next, DiscussionSegmentType.Speaker, now.AddSeconds(seconds));
    }

    private DiscussionStateSnapshot RequireSpeakerSegment()
    {
        if (CurrentPhase != GamePhase.Day || Discussion is not { SegmentType: DiscussionSegmentType.Speaker } discussion)
            throw new GameException("Challenges are only available during a speaker turn.");
        return discussion;
    }

    private void RefreshDiscussionFromCurrent()
    {
        var current = Discussion!;
        RefreshDiscussion(current.ActivePlayerId, current.OriginalSpeakerId, current.SegmentType, current.Deadline);
    }

    private void RefreshDiscussion(Guid activePlayerId, Guid originalSpeakerId, DiscussionSegmentType segmentType, DateTimeOffset deadline) =>
        Discussion = new DiscussionStateSnapshot(
            _discussionSpeakerOrder.ToList(), _completedSpeakers.ToList(), activePlayerId, originalSpeakerId,
            segmentType, deadline, _pendingChallengeRequests.ToList());

    public void StartNight(DateTimeOffset? now = null)
    {
        if (CurrentPhase != GamePhase.Results)
            throw new GameException("Night can only start from the Results phase.");
        CurrentPhase = GamePhase.Night;
        PhaseDeadline = Config.NightSeconds is { } seconds ? (now ?? DateTimeOffset.UtcNow).AddSeconds(seconds) : null;
    }

    /// <summary>Promotes the alive Mafia player with the lowest pre-assigned rank to Godfather. Returns null if no successor is available.</summary>
    public Player? PromoteGodfather()
    {
        var successor = _players
            .Where(p => p.IsAlive && p.Role == Role.Mafia && p.GodfatherRank.HasValue)
            .OrderBy(p => p.GodfatherRank)
            .FirstOrDefault();

        successor?.Promote();
        return successor;
    }

    public WinCondition CheckWinCondition()
    {
        int mafiaAlive = _players.Count(p => p.IsAlive && p.IsMafiaAligned);
        int villagersAlive = _players.Count(p => p.IsAlive && !p.IsMafiaAligned);

        if (mafiaAlive == 0)
            return WinCondition.VillagersWin;
        if (mafiaAlive >= villagersAlive)
            return WinCondition.MafiaWin;
        return WinCondition.None;
    }

    private Guid? HandlePotentialGodfatherDeath(Guid eliminatedId)
    {
        var eliminated = GetPlayer(eliminatedId)!;
        if (eliminated.Role != Role.Godfather)
            return null;
        return PromoteGodfather()?.Id;
    }

    private void AdvancePhaseAfterResolution(GamePhase nextPhaseIfContinuing)
    {
        var win = CheckWinCondition();
        CurrentPhase = win == WinCondition.None ? nextPhaseIfContinuing : GamePhase.Ended;
    }

    private Player GetAliveOrThrow(Guid id, string label)
    {
        var player = GetPlayer(id) ?? throw new GameException($"{label} not found.");
        if (!player.IsAlive)
            throw new GameException($"{label} is not alive.");
        return player;
    }
}
