using Microsoft.EntityFrameworkCore;
using Nightfall.Domain;
using Nightfall.Infrastructure.Hub;
using Nightfall.Infrastructure.Sessions;

namespace Nightfall.Infrastructure.History;

public sealed class GameHistoryRepository : IGameHistoryRepository
{
    private readonly NightfallDbContext _db;
    private readonly IGameRosterStore? _rosterStore;

    public GameHistoryRepository(NightfallDbContext db, IGameRosterStore? rosterStore = null)
    {
        _db = db;
        _rosterStore = rosterStore;
    }

    public async Task SaveCompletedGameAsync(GameState game, CancellationToken ct = default)
    {
        if (game.CurrentPhase != GamePhase.Ended)
            throw new InvalidOperationException("Only a game that has reached the Ended phase can be saved to history.");

        var roster = _rosterStore is null ? [] : await _rosterStore.GetAsync(game.GameId);
        var result = game.CheckWinCondition();
        var record = new GameRecord
        {
            Id = game.GameId,
            // 0 = a table opened in the app, not in a Telegram group.
            TelegramChatId = game.TelegramChatId ?? 0,
            CreatedAt = game.CreatedAt.UtcDateTime,
            EndedAt = DateTime.UtcNow,
            Result = result,
            Players = game.Players.Select(p => new GamePlayerRecord
            {
                Id = Guid.NewGuid(),
                PlayerId = p.Id,
                TelegramUserId = roster.FirstOrDefault(r => r.Username == p.TelegramUsername)?.TelegramUserId,
                TelegramUsername = p.TelegramUsername,
                Role = p.Role,
                SurvivedToEnd = p.IsAlive,
                GodfatherRank = p.GodfatherRank,
                EliminatedBy = p.EliminatedBy,
                EliminatedRound = p.EliminatedRound,
                WasPromoted = p.WasPromoted,
                // Leaving mid-game, or being removed for inactivity, is always a loss.
                Won = result == WinCondition.None ? null : p.EliminatedBy != EliminationCause.Left && p.IsMafiaAligned == (result == WinCondition.MafiaWin)
            }).ToList()
        };

        await ApplyRatingsAsync(record, ct);
        _db.Games.Add(record);
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>Team Elo across the two sides; also awards Mafia XP. Players without a known Telegram id stay unrated.</summary>
    private async Task ApplyRatingsAsync(GameRecord record, CancellationToken ct)
    {
        var rated = record.Players.Where(p => p.TelegramUserId.HasValue && p.Won.HasValue).ToList();
        if (rated.Count == 0) return;

        var stats = new Dictionary<long, PlayerStatsRecord>();
        foreach (var p in rated)
            stats[p.TelegramUserId!.Value] = await _db.GetOrCreateStatsAsync(p.TelegramUserId.Value, p.TelegramUsername, ct);

        double Average(bool mafia)
        {
            var side = rated.Where(p => (p.Role is Role.Mafia or Role.Godfather) == mafia).ToList();
            return side.Count == 0 ? Progression.StartingRating : side.Average(p => stats[p.TelegramUserId!.Value].Rating);
        }

        double mafiaAverage = Average(mafia: true);
        double townAverage = Average(mafia: false);
        foreach (var p in rated)
        {
            var s = stats[p.TelegramUserId!.Value];
            bool isMafia = p.Role is Role.Mafia or Role.Godfather;
            int delta = Progression.RatingDelta(isMafia ? mafiaAverage : townAverage, isMafia ? townAverage : mafiaAverage, p.Won!.Value);
            p.RatingBefore = s.Rating;
            p.RatingDelta = delta;
            s.Rating += delta;
            s.Xp += Progression.MafiaXp(p.Won.Value);
            s.UpdatedAt = DateTime.UtcNow;
        }
    }

    public Task<GameRecord?> GetAsync(Guid gameId, CancellationToken ct = default) =>
        _db.Games.Include(g => g.Players).FirstOrDefaultAsync(g => g.Id == gameId, ct);

    public async Task<IReadOnlyList<GameRecord>> GetForChatAsync(long telegramChatId, CancellationToken ct = default) =>
        await _db.Games
            .Include(g => g.Players)
            .Where(g => g.TelegramChatId == telegramChatId)
            .OrderByDescending(g => g.EndedAt)
            .ToListAsync(ct);
}
