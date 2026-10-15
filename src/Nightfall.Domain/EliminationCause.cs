using System.Text.Json.Serialization;

namespace Nightfall.Domain;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum EliminationCause
{
    /// <summary>Killed by the Mafia during a night.</summary>
    Night,

    /// <summary>Voted out by the town during a day.</summary>
    Vote
}
