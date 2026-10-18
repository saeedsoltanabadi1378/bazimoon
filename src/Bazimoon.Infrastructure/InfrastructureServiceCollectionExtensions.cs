using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Bazimoon.Infrastructure.Agora;
using Bazimoon.Infrastructure.Admin;
using Bazimoon.Infrastructure.Auth;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Sessions;
using StackExchange.Redis;

namespace Bazimoon.Infrastructure;

public static class InfrastructureServiceCollectionExtensions
{
    /// <summary>Registers Postgres (game history), Redis (live game sessions + roster
    /// index), Agora token generation, and JWT issuance. Expects config keys:
    /// ConnectionStrings:Postgres, ConnectionStrings:Redis, Agora:AppId, Agora:AppCertificate,
    /// Jwt:SigningKey.
    ///
    /// All config is consumed lazily via IOptions, validated with ValidateOnStart() rather than
    /// read eagerly here: eager reads of `configuration` at registration time only see whatever
    /// sources have been added *so far*, which breaks under test hosts (e.g. WebApplicationFactory)
    /// that append their own config overrides after the app's own service registration runs but
    /// before the host actually starts. ValidateOnStart() runs during host startup, after all
    /// configuration sources — including test overrides — are fully composed.</summary>
    public static IServiceCollection AddBazimoonInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<ConnectionStringsOptions>()
            .Bind(configuration.GetSection(ConnectionStringsOptions.SectionName))
            .Validate(o => !string.IsNullOrWhiteSpace(o.Postgres), $"Missing required configuration: {ConnectionStringsOptions.SectionName}:Postgres")
            .Validate(o => !string.IsNullOrWhiteSpace(o.Redis), $"Missing required configuration: {ConnectionStringsOptions.SectionName}:Redis")
            .ValidateOnStart();

        services.AddDbContext<BazimoonDbContext>((sp, options) =>
            options.UseNpgsql(sp.GetRequiredService<IOptions<ConnectionStringsOptions>>().Value.Postgres));
        services.AddSingleton<IAppSettingsService, AppSettingsService>();
        services.AddScoped<IGameHistoryRepository, GameHistoryRepository>();

        services.AddSingleton<IConnectionMultiplexer>(sp =>
            ConnectionMultiplexer.Connect(sp.GetRequiredService<IOptions<ConnectionStringsOptions>>().Value.Redis));
        services.AddSingleton<IKeyValueCache, RedisKeyValueCache>();
        services.AddSingleton<IGameSessionStore, GameSessionStore>();
        services.AddSingleton<IGameRosterStore, GameRosterStore>();

        services.AddOptions<AgoraOptions>()
            .Bind(configuration.GetSection(AgoraOptions.SectionName))
            .Validate(o => !string.IsNullOrWhiteSpace(o.AppId), $"Missing required configuration: {AgoraOptions.SectionName}:AppId")
            .Validate(o => !string.IsNullOrWhiteSpace(o.AppCertificate), $"Missing required configuration: {AgoraOptions.SectionName}:AppCertificate")
            .ValidateOnStart();
        services.AddSingleton<IAgoraTokenService, AgoraTokenService>();

        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .Validate(o => !string.IsNullOrWhiteSpace(o.SigningKey), $"Missing required configuration: {JwtOptions.SectionName}:SigningKey")
            .ValidateOnStart();
        services.AddSingleton<JwtTokenService>();

        return services;
    }
}
