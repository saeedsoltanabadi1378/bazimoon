namespace Bazimoon.Infrastructure.Sessions;

/// <summary>A joined player's user id and name for a game. Needed because Player.Id in the
/// Domain/Api is a one-way derived hash (see PlayerIdentity), so nothing can turn it back into a user id.</summary>
public sealed record GameRosterEntry(Guid UserId, string Username);
