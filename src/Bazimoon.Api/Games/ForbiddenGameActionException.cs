namespace Bazimoon.Api.Games;

public sealed class ForbiddenGameActionException : Exception
{
    public ForbiddenGameActionException(string message, string? code = null) : base(message)
    {
        Code = code;
    }

    public string? Code { get; }
}
