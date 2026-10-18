using System.Text.RegularExpressions;

namespace Bazimoon.Api.Auth;

/// <summary>Recognises crawlers and scripts from the browser's User-Agent: search engines, link
/// previews, headless browsers and HTTP libraries. An empty User-Agent is not treated as a bot.</summary>
public static partial class BotDetector
{
    [GeneratedRegex(@"bot\b|bot/|crawl|spider|slurp|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|facebookexternalhit|embedly|preview|^curl/|^wget/|python-requests|python-urllib|aiohttp|httpx|go-http-client|okhttp|java/|apache-httpclient|axios/|node-fetch|undici|libwww-perl|scrapy",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex CrawlerPattern();

    public static bool IsCrawler(string? userAgent) =>
        !string.IsNullOrWhiteSpace(userAgent) && CrawlerPattern().IsMatch(userAgent);
}
