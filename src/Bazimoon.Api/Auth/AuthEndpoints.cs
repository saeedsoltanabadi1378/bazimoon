using Bazimoon.Infrastructure.Auth;
using Bazimoon.Infrastructure.Identity;

namespace Bazimoon.Api.Auth;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        // Telegram Mini App sign-in, kept until the web app's guest and Google sign-in replace it.
        app.MapPost("/api/auth/telegram", async (
            TelegramAuthRequest request,
            TelegramInitDataValidator validator,
            UserAccountService accounts,
            JwtTokenService tokenService) =>
        {
            if (!validator.TryValidate(request.InitData, out var telegram) || telegram is null)
                return Results.Unauthorized();

            var user = await accounts.FindOrCreateAsync(IdentityProviders.Telegram, telegram.Id.ToString(),
                telegram.Username ?? telegram.FirstName, telegram.LanguageCode);
            return Results.Ok(new AuthUserResponse(tokenService.IssueToken(user), user.Id, user.DisplayName, user.IsGuest));
        })
        .WithName("AuthenticateTelegram")
        .AllowAnonymous();
    }
}

public sealed record TelegramAuthRequest(string InitData);

public sealed record AuthUserResponse(string Token, Guid UserId, string DisplayName, bool IsGuest);
