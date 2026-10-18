namespace Bazimoon.Domain;

public sealed record NightResult(
    int NightNumber,
    Guid? Eliminated,
    bool TargetWasSaved,
    Guid? DetectiveTarget,
    bool? DetectiveResultIsMafiaAligned,
    Guid? PromotedGodfatherId,
    Guid? SniperTarget = null,
    SniperOutcome? SniperOutcome = null,
    Guid? SilencedPlayer = null,
    /// <summary>The Die Hard survived the Mafia's kill (only they are told).</summary>
    Guid? DieHardSurvived = null);

[System.Text.Json.Serialization.JsonConverter(typeof(System.Text.Json.Serialization.JsonStringEnumConverter))]
public enum SniperOutcome
{
    /// <summary>The target was Mafia and died.</summary>
    Hit,
    /// <summary>The target was Mafia, but the Doctor saved them.</summary>
    Saved,
    /// <summary>The target was not Mafia: the Sniper died instead.</summary>
    Backfired
}
