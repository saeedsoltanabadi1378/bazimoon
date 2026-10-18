using Bazimoon.Infrastructure.Auth;
using Bazimoon.Infrastructure.Identity;

namespace Bazimoon.Api.Auth;

public static class AuthEndpoints
{
    public const string GuestSignUpPolicy = "guest-signup";

    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/guest", async (GuestAuthRequest? request, UserAccountService accounts, AuthSessionFactory sessions) =>
        {
            var user = await accounts.CreateGuestAsync(request?.DisplayName, request?.Language);
            return Results.Ok(await sessions.CreateAsync(user));
        })
        .WithName("SignInAsGuest")
        .RequireRateLimiting(GuestSignUpPolicy)
        .AllowAnonymous();

        group.MapPost("/google", async (GoogleAuthRequest request, IGoogleTokenValidator google, UserAccountService accounts, AuthSessionFactory sessions) =>
        {
            if (await google.ValidateAsync(request.IdToken) is not { } identity)
                return Results.Unauthorized();
            var user = await accounts.FindOrCreateAsync(IdentityProviders.Google, identity.Subject, identity.Name ?? "Player", request.Language, identity.Email);
            return Results.Ok(await sessions.CreateAsync(user));
        })
        .WithName("SignInWithGoogle")
        .AllowAnonymous();

        // A guest keeps their progress by linking Google. When that Google account already has a
        // profile, 409 lets the app offer to switch to it (POST /google) and drop the guest's progress.
        group.MapPost("/link/google", async (GoogleAuthRequest request, HttpContext http, IGoogleTokenValidator google,
            UserAccountService accounts, AuthSessionFactory sessions, RefreshTokenService refresh) =>
        {
            if (await google.ValidateAsync(request.IdToken) is not { } identity)
                return Results.Unauthorized();
            var result = await accounts.LinkAsync(http.User.GetUserId(), IdentityProviders.Google, identity.Subject, identity.Name, identity.Email);
            switch (result.Outcome)
            {
                case LinkOutcome.Linked:
                    // Old tokens still say "guest"; the app swaps to the pair returned here.
                    await refresh.RevokeAllAsync(result.User!.Id);
                    return Results.Ok(await sessions.CreateAsync(result.User));
                case LinkOutcome.AlreadyLinkedElsewhere:
                    return Results.Problem(statusCode: 409, title: "account_exists", detail: "This Google account already has a Bazimoon profile.");
                case LinkOutcome.NotAGuest:
                    return Results.Problem(statusCode: 400, title: "not_a_guest", detail: "This profile is already linked to a sign-in.");
                default:
                    return Results.Unauthorized();
            }
        })
        .WithName("LinkGoogle")
        .RequireAuthorization();

        group.MapPost("/refresh", async (RefreshRequest request, RefreshTokenService refresh, AuthSessionFactory sessions) =>
            await refresh.RedeemAsync(request.RefreshToken) is { } user
                ? Results.Ok(await sessions.CreateAsync(user))
                : Results.Unauthorized())
        .WithName("RefreshSession")
        .AllowAnonymous();

        group.MapPost("/logout", async (RefreshRequest request, RefreshTokenService refresh) =>
        {
            await refresh.RevokeAsync(request.RefreshToken);
            return Results.NoContent();
        })
        .WithName("SignOut")
        .AllowAnonymous();

    }
}

/// <summary>Issues the access + refresh token pair the app keeps.</summary>
public sealed class AuthSessionFactory
{
    private readonly JwtTokenService _tokens;
    private readonly RefreshTokenService _refresh;

    public AuthSessionFactory(JwtTokenService tokens, RefreshTokenService refresh)
    {
        _tokens = tokens;
        _refresh = refresh;
    }

    public async Task<AuthSessionResponse> CreateAsync(UserRecord user) => new(
        _tokens.IssueToken(user),
        await _refresh.IssueAsync(user.Id),
        new AuthUserDto(user.Id, user.DisplayName, user.IsGuest, user.Language));
}

public sealed record GuestAuthRequest(string? DisplayName = null, string? Language = null);

public sealed record GoogleAuthRequest(string IdToken, string? Language = null);

public sealed record RefreshRequest(string? RefreshToken);

public sealed record AuthUserDto(Guid Id, string DisplayName, bool IsGuest, string Language);

public sealed record AuthSessionResponse(string AccessToken, string RefreshToken, AuthUserDto User);
