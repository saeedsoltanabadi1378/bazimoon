using System.Security.Claims;
using Bazimoon.Infrastructure.Auth;

namespace Bazimoon.Api.Auth;

public static class ClaimsPrincipalExtensions
{
    public static long GetTelegramUserId(this ClaimsPrincipal principal)
    {
        var claim = principal.FindFirst(BazimoonClaimTypes.TelegramUserId)
            ?? throw new InvalidOperationException($"Authenticated principal is missing the '{BazimoonClaimTypes.TelegramUserId}' claim.");
        return long.Parse(claim.Value);
    }

    public static string GetTelegramUsername(this ClaimsPrincipal principal)
    {
        var claim = principal.FindFirst(BazimoonClaimTypes.TelegramUsername)
            ?? throw new InvalidOperationException($"Authenticated principal is missing the '{BazimoonClaimTypes.TelegramUsername}' claim.");
        return claim.Value;
    }
}
