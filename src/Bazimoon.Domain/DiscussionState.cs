using System.Text.Json.Serialization;

namespace Bazimoon.Domain;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum DiscussionSegmentType
{
    Speaker,
    Challenge
}

public sealed record DiscussionStateSnapshot(
    IReadOnlyList<Guid> SpeakerOrder,
    IReadOnlyCollection<Guid> CompletedSpeakers,
    Guid ActivePlayerId,
    Guid OriginalSpeakerId,
    DiscussionSegmentType SegmentType,
    DateTimeOffset Deadline,
    IReadOnlyCollection<Guid> PendingChallengeRequests);
