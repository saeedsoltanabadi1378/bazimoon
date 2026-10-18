using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Bazimoon.Api.Auth;
using Bazimoon.Infrastructure.History;

namespace Bazimoon.Tests;

public class BotDetectionTests : IClassFixture<BazimoonApiFactory>, IAsyncLifetime
{
    private readonly BazimoonApiFactory _factory;

    public BotDetectionTests(BazimoonApiFactory factory) => _factory = factory;

    public Task InitializeAsync() => _factory.EnsureDatabaseCreatedAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    [Theory]
    [InlineData("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")]
    [InlineData("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36")]
    [InlineData("curl/8.4.0")]
    [InlineData("python-requests/2.31.0")]
    [InlineData("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")]
    public void Crawlers_AreRecognised(string userAgent) => Assert.True(BotDetector.IsCrawler(userAgent));

    [Theory]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1")]
    [InlineData("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36")]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0")]
    [InlineData("")]
    [InlineData(null)]
    public void People_AreNotRecognisedAsCrawlers(string? userAgent) => Assert.False(BotDetector.IsCrawler(userAgent));

    [Fact]
    public async Task GuestFromCrawler_IsMarkedAsBot_ButBrowserGuestIsNot()
    {
        var crawler = _factory.CreateClient();
        crawler.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)");
        var bot = await (await crawler.PostAsJsonAsync("/api/auth/guest", new GuestAuthRequest())).Content.ReadFromJsonAsync<AuthSessionResponse>();

        var browser = _factory.CreateClient();
        browser.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0");
        var person = await (await browser.PostAsJsonAsync("/api/auth/guest", new GuestAuthRequest())).Content.ReadFromJsonAsync<AuthSessionResponse>();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BazimoonDbContext>();
        var botUser = await db.Users.FindAsync(bot!.User.Id);
        var personUser = await db.Users.FindAsync(person!.User.Id);
        Assert.True(botUser!.IsBot);
        Assert.Equal("crawler", botUser.BotReason);
        Assert.NotNull(botUser.BotMarkedAt);
        Assert.False(personUser!.IsBot);
        Assert.Null(personUser.BotReason);
    }
}
