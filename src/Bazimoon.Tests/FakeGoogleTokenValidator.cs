extern alias ApiAssembly;

using ApiAssembly::Bazimoon.Api.Auth;

namespace Bazimoon.Tests;

/// <summary>Accepts made-up tokens of the form <c>google:&lt;subject&gt;:&lt;name&gt;</c> instead of
/// checking a real Google signature. Anything else is rejected.</summary>
public sealed class FakeGoogleTokenValidator : IGoogleTokenValidator
{
    public static string Token(string subject, string name) => $"google:{subject}:{name}";

    public Task<GoogleIdentity?> ValidateAsync(string idToken)
    {
        var parts = idToken.Split(':');
        return Task.FromResult(parts is ["google", var sub, var name]
            ? new GoogleIdentity(sub, $"{sub}@example.com", name)
            : null);
    }
}
