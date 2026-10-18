extern alias ApiAssembly;

using ApiAssembly::Bazimoon.Api.Auth;

namespace Bazimoon.Tests;

/// <summary>Accepts made-up tokens of the form <c>google:&lt;subject&gt;:&lt;name&gt;</c> (optionally
/// <c>:&lt;nonce&gt;</c>) instead of checking a real Google signature. Anything else is rejected.</summary>
public sealed class FakeGoogleTokenValidator : IGoogleTokenValidator
{
    public static string Token(string subject, string name, string? nonce = null) => nonce is null ? $"google:{subject}:{name}" : $"google:{subject}:{name}:{nonce}";

    public Task<GoogleIdentity?> ValidateAsync(string idToken, string? nonce = null)
    {
        var parts = idToken.Split(':');
        GoogleIdentity? identity = parts switch
        {
            ["google", var sub, var name] when nonce is null => new GoogleIdentity(sub, $"{sub}@example.com", name),
            ["google", var sub, var name, var tokenNonce] when nonce is null || nonce == tokenNonce => new GoogleIdentity(sub, $"{sub}@example.com", name),
            _ => null,
        };
        return Task.FromResult(identity);
    }
}
