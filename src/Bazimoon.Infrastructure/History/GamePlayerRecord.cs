using Bazimoon.Domain;

namespace Bazimoon.Infrastructure.History;

public sealed class GamePlayerRecord
{
    public Guid Id { get; set; }
    public Guid GameRecordId { get; set; }
    public GameRecord GameRecord { get; set; } = null!;
    public Guid PlayerId { get; set; }
    public Guid? UserId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public Role? Role { get; set; }
    public bool SurvivedToEnd { get; set; }
    public int? GodfatherRank { get; set; }
    public EliminationCause? EliminatedBy { get; set; }
    public int? EliminatedRound { get; set; }
    public bool WasPromoted { get; set; }
    /// <summary>Mafia rating before this game and the change it caused (null when unrated).</summary>
    public int? RatingBefore { get; set; }
    public int? RatingDelta { get; set; }
    public bool? Won { get; set; }

    // What the player did, worked out from the game log. Null for games played before the log existed.
    public int? ChecksMade { get; set; }
    public int? MafiaFound { get; set; }
    public int? SavesMade { get; set; }
    public int? KillsBlocked { get; set; }
    public int? KillsMade { get; set; }
    public int? VotesCast { get; set; }
    public int? VotesOnMafia { get; set; }
    public int? NightsSurvived { get; set; }
    public bool? SurvivedRevote { get; set; }
    public bool? VotedOutGodfather { get; set; }
    public int? MvpPoints { get; set; }
    public bool IsMvp { get; set; }
    /// <summary>As Sniper, shot the Godfather.</summary>
    public bool? ShotGodfather { get; set; }
}
