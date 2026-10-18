namespace Bazimoon.Infrastructure.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string SigningKey { get; set; } = string.Empty;
    public string Issuer { get; set; } = "bazimoon";
    public string Audience { get; set; } = "bazimoon-clients";
    public TimeSpan TokenLifetime { get; set; } = TimeSpan.FromHours(12);
}
