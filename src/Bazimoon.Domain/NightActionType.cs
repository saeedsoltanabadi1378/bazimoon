using System.Text.Json.Serialization;

namespace Bazimoon.Domain;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum NightActionType
{
    Investigate,
    Heal,
    Kill,
    Shoot,
    Silence,
    /// <summary>Negotiator: try to recruit this player instead of tonight's kill.</summary>
    Negotiate,
    /// <summary>Bodyguard: stand in front of this player tonight.</summary>
    Guard
}
