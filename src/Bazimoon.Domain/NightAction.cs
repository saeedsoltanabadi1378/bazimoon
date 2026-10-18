namespace Bazimoon.Domain;

public sealed record NightAction(Guid ActorId, Guid TargetId, NightActionType ActionType);
