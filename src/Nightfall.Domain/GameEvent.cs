using System.Text.Json.Serialization;

namespace Nightfall.Domain;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum GameEventKind
{
    /// <summary>A night was resolved: the kill, the Doctor's save and the Detective's check.</summary>
    Night,

    /// <summary>A vote round was counted.</summary>
    Vote,

    /// <summary>A player said their last words.</summary>
    LastWords,

    /// <summary>A Mafia member became the Godfather after the Godfather fell.</summary>
    Promoted,

    /// <summary>A player left the game.</summary>
    Left,

    /// <summary>A player was removed for missing two timed turns in a row.</summary>
    Removed
}

/// <summary>
/// One entry in a game's log, kept so the recap, stats, MVP and achievements can be worked out once
/// the game ends. One flat record (instead of a type per kind) keeps the JSON plain; fields that do
/// not apply to a kind stay null.
/// </summary>
/// <param name="Round">The night/day number the event happened in.</param>
/// <param name="PlayerId">LastWords, Promoted, Left, Removed: who it is about.</param>
/// <param name="KillerId">Night: the Mafia member whose pick decided the kill target.</param>
/// <param name="KillTarget">Night: who the Mafia went for.</param>
/// <param name="Killed">Night: who died (null when nobody did).</param>
/// <param name="DoctorId">Night: the Doctor who acted.</param>
/// <param name="Saved">Night: who the Doctor protected.</param>
/// <param name="DetectiveId">Night: the Detective who acted.</param>
/// <param name="Checked">Night: who the Detective checked.</param>
/// <param name="CheckedIsMafia">Night: what the Detective was told.</param>
/// <param name="VoteRound">Vote: 1 for the day's vote, 2 for the re-vote.</param>
/// <param name="Ballots">Vote: voter → target (null = abstained).</param>
/// <param name="VotedOut">Vote: who went out.</param>
/// <param name="Tied">Vote: the players tied for the most votes.</param>
public sealed record GameEvent(
    GameEventKind Kind,
    int Round,
    Guid? PlayerId = null,
    Guid? KillerId = null,
    Guid? KillTarget = null,
    Guid? Killed = null,
    Guid? DoctorId = null,
    Guid? Saved = null,
    Guid? DetectiveId = null,
    Guid? Checked = null,
    bool? CheckedIsMafia = null,
    int VoteRound = 1,
    IReadOnlyDictionary<Guid, Guid?>? Ballots = null,
    Guid? VotedOut = null,
    IReadOnlyList<Guid>? Tied = null);
