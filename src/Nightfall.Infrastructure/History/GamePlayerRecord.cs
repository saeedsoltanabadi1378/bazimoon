using Nightfall.Domain;

namespace Nightfall.Infrastructure.History;

public sealed class GamePlayerRecord
{
    public Guid Id { get; set; }
    public Guid GameRecordId { get; set; }
    public GameRecord GameRecord { get; set; } = null!;
    public Guid PlayerId { get; set; }
    public long? TelegramUserId { get; set; }
    public string TelegramUsername { get; set; } = string.Empty;
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
}
