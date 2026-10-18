namespace Bazimoon.Bot;

/// <summary>A non-success response from Bazimoon.Api, with the server's own error detail (from
/// BazimoonExceptionHandler's { title, detail } JSON shape) as a user-facing message the bot can
/// relay directly to the chat, instead of a raw HTTP exception.</summary>
public sealed class BazimoonApiException : Exception
{
    public BazimoonApiException(string message) : base(message)
    {
    }
}
