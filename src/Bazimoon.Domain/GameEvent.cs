using System.Text.Json.Serialization;

namespace Bazimoon.Domain;

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
    Removed,

    /// <summary>The Mayor revealed themselves.</summary>
    MayorRevealed,

    /// <summary>The Die Hard called an Inquiry: the roles of everyone out were announced.</summary>
    Inquiry
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
/// <param name="SniperId">Night: the Sniper who fired.</param>
/// <param name="ShotTarget">Night: who the Sniper shot.</param>
/// <param name="ShotOutcome">Night: what the shot did.</param>
/// <param name="Silenced">Night: who the Silencer silenced for the next day.</param>
/// <param name="DieHardSurvived">Night: the Die Hard who survived the Mafia's kill.</param>
/// <param name="SilencerId">Night: the Silencer who acted.</param>
/// <param name="NegotiatorId">Night: the Negotiator who negotiated (there was no kill that night).</param>
/// <param name="NegotiationTarget">Night: who the Negotiator tried to recruit.</param>
/// <param name="Negotiated">Night: whether the target joined the Mafia.</param>
/// <param name="BodyguardId">Night: the Bodyguard who acted.</param>
/// <param name="Guarded">Night: who the Bodyguard guarded.</param>
/// <param name="BodyguardDied">Night: the Bodyguard died in place of the Mafia's target.</param>
/// <param name="Suspicions">Night: each player's private guess at who is Mafia (player → suspect).</param>
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
    IReadOnlyList<Guid>? Tied = null,
    Guid? SniperId = null,
    Guid? ShotTarget = null,
    SniperOutcome? ShotOutcome = null,
    Guid? Silenced = null,
    Guid? DieHardSurvived = null,
    Guid? SilencerId = null,
    Guid? NegotiatorId = null,
    Guid? NegotiationTarget = null,
    bool? Negotiated = null,
    Guid? BodyguardId = null,
    Guid? Guarded = null,
    bool? BodyguardDied = null,
    IReadOnlyDictionary<Guid, Guid>? Suspicions = null);
