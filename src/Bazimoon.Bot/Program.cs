using Microsoft.Extensions.Options;
using Bazimoon.Bot;
using Bazimoon.Infrastructure;
using Telegram.Bot;

var builder = Host.CreateApplicationBuilder(args);

// Bot only actually uses JwtTokenService + the chat/roster indexes out of everything this
// registers — see AddBazimoonInfrastructure's own doc comment for why it's still the single
// shared entry point rather than a separate, narrower registration.
builder.Services.AddBazimoonInfrastructure(builder.Configuration);

builder.Services.AddOptions<TelegramBotOptions>()
    .Bind(builder.Configuration.GetSection(TelegramBotOptions.SectionName))
    .Validate(o => !string.IsNullOrWhiteSpace(o.BotToken), $"Missing required configuration: {TelegramBotOptions.SectionName}:BotToken")
    .ValidateOnStart();

builder.Services.AddOptions<BotOptions>()
    .Bind(builder.Configuration.GetSection(BotOptions.SectionName))
    .Validate(o => !string.IsNullOrWhiteSpace(o.BazimoonApiBaseUrl), $"Missing required configuration: {BotOptions.SectionName}:BazimoonApiBaseUrl")
    .ValidateOnStart();

builder.Services.AddHttpClient("telegram-bot-api");
builder.Services.AddSingleton<ITelegramBotClient>(sp =>
{
    var options = sp.GetRequiredService<IOptions<TelegramBotOptions>>().Value;
    var httpClientFactory = sp.GetRequiredService<IHttpClientFactory>();
    return new TelegramBotClient(options.BotToken, httpClientFactory.CreateClient("telegram-bot-api"));
});

builder.Services.AddHttpClient<IBazimoonApiClient, BazimoonApiClient>((sp, client) =>
{
    var options = sp.GetRequiredService<IOptions<BotOptions>>().Value;
    client.BaseAddress = new Uri(options.BazimoonApiBaseUrl);
});

builder.Services.AddSingleton<IBotMessenger, TelegramBotMessenger>();
builder.Services.AddSingleton<CommandDispatcher>();
builder.Services.AddHostedService<Worker>();
builder.Services.AddHostedService<BotHeartbeatService>();

var host = builder.Build();
host.Run();
