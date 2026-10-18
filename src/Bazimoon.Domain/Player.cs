namespace Bazimoon.Domain;

public sealed class Player
{
    public Guid Id { get; }
    public string DisplayName { get; }
    public Role? Role { get; private set; }
    public bool IsAlive { get; private set; } = true;

    /// <summary>Succession order within the Mafia team, assigned at role-assignment time. 1 = starts as Godfather.</summary>
    public int? GodfatherRank { get; private set; }

    /// <summary>How this player left the game, if they have. Null while alive.</summary>
    public EliminationCause? EliminatedBy { get; private set; }

    /// <summary>The round (night/day number) in which the player was eliminated.</summary>
    public int? EliminatedRound { get; private set; }

    /// <summary>True once a Mafia member has been promoted to Godfather after the original fell.</summary>
    public bool WasPromoted { get; private set; }

    public Player(Guid id, string displayName)
    {
        if (id == Guid.Empty)
            throw new ArgumentException("Player id must not be empty.", nameof(id));
        if (string.IsNullOrWhiteSpace(displayName))
            throw new ArgumentException("Display name is required.", nameof(displayName));

        Id = id;
        DisplayName = displayName;
    }

    public bool IsMafiaAligned => Team == Bazimoon.Domain.Team.Mafia;

    /// <summary>The player's team; Town before roles are dealt.</summary>
    public Team Team => Role?.TeamOf() ?? Bazimoon.Domain.Team.Town;

    /// <summary>The Mayor revealed themselves: everyone knows, and their vote counts twice.</summary>
    public bool Revealed { get; private set; }

    /// <summary>Sniper: the one shot is spent. Die Hard: the extra life is spent.</summary>
    public bool AbilityUsed { get; private set; }

    /// <summary>Die Hard: the Inquiry has been called.</summary>
    public bool InquiryUsed { get; private set; }

    internal void Reveal() => Revealed = true;
    internal void UseAbility() => AbilityUsed = true;
    internal void UseInquiry() => InquiryUsed = true;
    internal void RestoreAbilities(bool revealed, bool abilityUsed, bool inquiryUsed)
    {
        Revealed = revealed;
        AbilityUsed = abilityUsed;
        InquiryUsed = inquiryUsed;
    }

    internal void AssignRole(Role role) => Role = role;

    internal void Promote()
    {
        Role = Bazimoon.Domain.Role.Godfather;
        WasPromoted = true;
    }

    internal void RestorePromotion(bool wasPromoted) => WasPromoted = wasPromoted;

    internal void SetGodfatherRank(int? rank) => GodfatherRank = rank;

    internal void Eliminate() => IsAlive = false;

    internal void Eliminate(EliminationCause cause, int round)
    {
        IsAlive = false;
        EliminatedBy = cause;
        EliminatedRound = round;
    }

    internal void RestoreElimination(EliminationCause? cause, int? round)
    {
        EliminatedBy = cause;
        EliminatedRound = round;
    }
}
