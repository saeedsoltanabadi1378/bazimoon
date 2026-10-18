using System.Text.Json.Serialization;

namespace Bazimoon.Domain;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WinCondition
{
    None,
    VillagersWin,
    MafiaWin,
    /// <summary>The Joker was voted out at a table where that ends the game; everyone else loses.</summary>
    JokerWins
}
