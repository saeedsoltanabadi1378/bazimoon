using System.Text.Json.Serialization;

namespace Bazimoon.Domain;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum RolePreset
{
    /// <summary>The original rules: Godfather, Mafia, Detective, Doctor; one Mafia per 3 players.</summary>
    Classic,
    /// <summary>Godfather, Silencer, Detective, Doctor, Sniper and Die Hard.</summary>
    Iranian,
    /// <summary>The creator sets the Mafia count and switches each optional role on or off.</summary>
    Custom
}

/// <summary>Which roles a table deals. Villagers fill every seat the setup leaves.</summary>
/// <param name="MafiaCount">Custom only: Mafia-team players, including the Godfather and the Silencer.</param>
/// <param name="Optional">Custom only: the optional roles that are on.</param>
public sealed record RoleSetup(RolePreset Preset, int MafiaCount = 1, IReadOnlyList<Role>? Optional = null)
{
    public static RoleSetup Classic { get; } = new(RolePreset.Classic);
    public static RoleSetup Iranian { get; } = new(RolePreset.Iranian);

    /// <summary>Roles that can be switched on in a custom setup.</summary>
    public static readonly IReadOnlyList<Role> OptionalRoles = [Role.Silencer, Role.Detective, Role.Doctor, Role.Sniper, Role.DieHard, Role.Mayor, Role.Joker];

    /// <summary>The special roles for this many players, Mafia team first (Godfather, then Silencer, then Mafia);
    /// the rest of the seats are Villagers. Null when the setup doesn't fit, with the reason in <paramref name="problem"/>.</summary>
    public IReadOnlyList<Role>? RolesFor(int players, out SetupProblem? problem)
    {
        problem = null;
        List<Role> roles;
        switch (Preset)
        {
            case RolePreset.Classic:
            {
                int mafia = players / 3;
                roles = [Role.Godfather, .. Enumerable.Repeat(Role.Mafia, Math.Max(0, mafia - 1))];
                if (players > 3) roles.AddRange([Role.Detective, Role.Doctor]);
                break;
            }
            case RolePreset.Iranian:
                roles = [Role.Godfather, Role.Silencer, Role.Detective, Role.Doctor, Role.Sniper, Role.DieHard];
                break;
            default:
            {
                var on = Optional ?? [];
                int mafia = Math.Max(1, MafiaCount);
                roles = [Role.Godfather];
                if (on.Contains(Role.Silencer) && mafia > 1) roles.Add(Role.Silencer);
                while (roles.Count < mafia) roles.Add(Role.Mafia);
                roles.AddRange(OptionalRoles.Where(r => r != Role.Silencer && on.Contains(r)));
                break;
            }
        }

        int mafiaTeam = roles.Count(r => r.TeamOf() == Team.Mafia);
        if (roles.Count > players)
            problem = SetupProblem.TooFewPlayers;
        else if (mafiaTeam * 2 >= players)
            problem = SetupProblem.TooManyMafia;
        return problem is null ? roles : null;
    }

    /// <summary>The fewest players this setup can start with (at least <paramref name="floor"/>).</summary>
    public int MinimumPlayers(int floor = 3)
    {
        for (int n = floor; n <= 30; n++)
            if (RolesFor(n, out _) is not null) return n;
        return int.MaxValue;
    }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SetupProblem
{
    /// <summary>More special roles than players.</summary>
    TooFewPlayers,
    /// <summary>The Mafia must be fewer than half the players.</summary>
    TooManyMafia
}
