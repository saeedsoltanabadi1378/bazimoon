namespace Bazimoon.Domain;

/// <summary>Thrown when an operation would violate a game rule (invalid phase, role, or target).</summary>
public sealed class GameException : Exception
{
    public GameException(string message, string? code = null) : base(message)
    {
        Code = code;
    }

    /// <summary>A stable, language-neutral identifier suitable for localized clients.</summary>
    public string? Code { get; }
}
