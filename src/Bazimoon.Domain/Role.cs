using System.Text.Json.Serialization;

namespace Bazimoon.Domain;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum Role
{
    Villager,
    Detective,
    Doctor,
    Mafia,
    Godfather,
    /// <summary>Town. One night shot per game: a Mafia target dies, a Town target kills the Sniper instead.</summary>
    Sniper,
    /// <summary>Town. Survives the first night kill; once per game can call an Inquiry.</summary>
    DieHard,
    /// <summary>Mafia. Silences one player each night for the next day.</summary>
    Silencer,
    /// <summary>On their own. Wins if voted out in the day.</summary>
    Joker,
    /// <summary>Town. Can reveal on their speaking turn; then their vote counts twice.</summary>
    Mayor,
    /// <summary>Mafia. Once per game, instead of the night kill, tries to recruit a player: a plain Villager joins the Mafia.</summary>
    Negotiator,
    /// <summary>Town. Guards one other player each night; if the Mafia come for them, the Bodyguard dies in their place.</summary>
    Bodyguard
}
