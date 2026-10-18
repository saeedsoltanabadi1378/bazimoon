using System.Security.Cryptography;
using System.Text;

namespace Bazimoon.Infrastructure;

/// <summary>
/// Deterministically derives a Domain Player.Id from (gameId, userId), instead of storing a separate
/// user-to-player-id mapping. The API derives "which Player am I in this game" from the caller's
/// authenticated user id and the game route parameter alone, never from a client-supplied actor id.
/// The id isn't a secret (JWT auth gates who can act); it only needs to be stable and collision-free.
/// </summary>
public static class PlayerIdentity
{
    public static Guid DeriveId(Guid gameId, Guid userId)
    {
        Span<byte> input = stackalloc byte[32];
        gameId.TryWriteBytes(input);
        userId.TryWriteBytes(input[16..]);

        Span<byte> hash = stackalloc byte[32];
        SHA256.HashData(input, hash);

        return new Guid(hash[..16]);
    }
}
