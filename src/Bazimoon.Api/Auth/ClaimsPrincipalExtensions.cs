using System.Security.Claims;
using Bazimoon.Infrastructure.Auth;

namespace Bazimoon.Api.Auth;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal) => Guid.Parse(Required(principal, BazimoonClaimTypes.UserId));

    public static string GetDisplayName(this ClaimsPrincipal principal) => Required(principal, BazimoonClaimTypes.DisplayName);

    public static bool IsGuest(this ClaimsPrincipal principal) => principal.FindFirst(BazimoonClaimTypes.IsGuest)?.Value == "true";

    private static string Required(ClaimsPrincipal principal, string type) =>
        principal.FindFirst(type)?.Value
            ?? throw new InvalidOperationException($"Authenticated principal is missing the '{type}' claim.");
}
