namespace Nightfall.Domain;

/// <summary>The rules a table is played with. Every property has a default matching the original
/// rules, so games saved before a property existed load with today's behaviour.</summary>
public sealed class GameConfig
{
    public int MinPlayers { get; init; } = 3;
    public int MaxPlayers { get; init; } = 12;

    /// <summary>Length of each day speaking turn.</summary>
    public int SpeakerSeconds { get; init; } = 60;

    /// <summary>Length of an accepted challenge.</summary>
    public int ChallengeSeconds { get; init; } = 40;

    /// <summary>Length of each tied player's defence before the second vote.</summary>
    public int DefenceSeconds { get; init; } = 30;

    /// <summary>How long a player who is out gets for their last words.</summary>
    public int LastWordsSeconds { get; init; } = 20;

    /// <summary>When set, the night resolves on its own after this long; null means the creator ends it.</summary>
    public int? NightSeconds { get; init; }

    /// <summary>When set, each vote closes on its own after this long; null means the creator tallies it.</summary>
    public int? VotingSeconds { get; init; }

    /// <summary>Players killed at night also get last words, at the start of the day.</summary>
    public bool LastWordsForNightKills { get; init; }

    /// <summary>Which roles are dealt. Classic is the original rule set.</summary>
    public RoleSetup Roles { get; init; } = RoleSetup.Classic;

    /// <summary>The Detective's check on the Godfather comes back "not Mafia".</summary>
    public bool GodfatherAppearsInnocent { get; init; }

    /// <summary>The Joker being voted out ends the game (everyone else loses). Off: the Joker wins and play goes on.</summary>
    public bool JokerWinEndsGame { get; init; } = true;

    /// <summary>Show a player's role once they are out. Off: roles stay hidden until an Inquiry or the end.</summary>
    public bool RevealRolesOnDeath { get; init; } = true;

    public static GameConfig Default { get; } = new();

    public static readonly IReadOnlyList<int> SpeakerChoices = [30, 45, 60, 90];
    public static readonly IReadOnlyList<int> ChallengeChoices = [20, 30, 40];
    public static readonly IReadOnlyList<int> DefenceChoices = [20, 30, 45];
    public static readonly IReadOnlyList<int> LastWordsChoices = [10, 20, 30];
    public static readonly IReadOnlyList<int> NightChoices = [45, 60, 90];
    public static readonly IReadOnlyList<int> VotingChoices = [30, 45, 60];
}
