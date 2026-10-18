namespace Bazimoon.Domain;

/// <summary>Someone watching a game without a seat. They see only the public board and can't act.</summary>
public sealed class Spectator
{
    public Spectator(Guid id, string username)
    {
        Id = id;
        Username = username;
    }

    public Guid Id { get; }
    public string Username { get; set; }

    /// <summary>The table creator muted them in the graveyard chat.</summary>
    public bool Muted { get; set; }
}
