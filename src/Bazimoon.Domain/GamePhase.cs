using System.Text.Json.Serialization;

namespace Bazimoon.Domain;

/// <summary>String-converted in JSON (via attribute, so it applies uniformly to any serializer
/// options on any client) rather than left as raw ordinals — the Api's frontend and Bot clients
/// shouldn't have to hardcode magic numbers that would silently break if this enum is reordered.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum GamePhase
{
    Lobby,
    RoleAssignment,
    NightZero,
    Night,
    Day,
    Voting,
    Results,
    Ended,

    /// <summary>After a tied vote: each tied player defends themselves before a second vote between them only.</summary>
    Defence,

    /// <summary>A player who is out speaks once before their role is shown.</summary>
    LastWords
}
