using System.Text.Json.Serialization;

namespace Nightfall.Domain;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum Team
{
    Town,
    Mafia,
    /// <summary>Plays for themselves (the Joker).</summary>
    Independent
}

public static class RoleTeams
{
    public static Team TeamOf(this Role role) => role switch
    {
        Role.Mafia or Role.Godfather or Role.Silencer => Team.Mafia,
        Role.Joker => Team.Independent,
        _ => Team.Town
    };
}
