using Google.Apis.Auth;
using Microsoft.Extensions.Options;

namespace Bazimoon.Api.Auth;

public sealed class GoogleAuthOptions
{
    public const string SectionName = "Google";

    /// <summary>OAuth client id of the web app; Google ID tokens must be issued to it.</summary>
    public string ClientId { get; set; } = string.Empty;
}

/// <summary>Who a valid Google ID token belongs to. <paramref name="Subject"/> is Google's stable user id.</summary>
public sealed record GoogleIdentity(string Subject, string? Email, string? Name);

public interface IGoogleTokenValidator
{
    /// <summary>Returns the identity in a valid Google ID token issued to our client, or null.</summary>
    Task<GoogleIdentity?> ValidateAsync(string idToken);
}

/// <summary>Checks the token's signature against Google's published keys, its expiry, issuer and audience.</summary>
public sealed class GoogleTokenValidator : IGoogleTokenValidator
{
    private readonly IOptions<GoogleAuthOptions> _options;
    private readonly ILogger<GoogleTokenValidator> _logger;

    public GoogleTokenValidator(IOptions<GoogleAuthOptions> options, ILogger<GoogleTokenValidator> logger)
    {
        _options = options;
        _logger = logger;
    }

    public async Task<GoogleIdentity?> ValidateAsync(string idToken)
    {
        if (string.IsNullOrWhiteSpace(idToken)) return null;
        try
        {
            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [_options.Value.ClientId],
            });
            return new GoogleIdentity(payload.Subject, payload.EmailVerified ? payload.Email : null, payload.Name ?? payload.GivenName);
        }
        catch (InvalidJwtException ex)
        {
            _logger.LogInformation("Rejected a Google ID token: {Reason}", ex.Message);
            return null;
        }
    }
}

public sealed class GuestSignUpOptions
{
    public const string SectionName = "GuestSignUp";

    /// <summary>How many guests one IP address may create per hour.</summary>
    public int PerIpPerHour { get; set; } = 10;
}
