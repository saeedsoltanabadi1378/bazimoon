using System.Text.Json.Serialization;

namespace Bazimoon.Domain;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum NightActionType
{
    Investigate,
    Heal,
    Kill,
    Shoot,
    Silence
}
