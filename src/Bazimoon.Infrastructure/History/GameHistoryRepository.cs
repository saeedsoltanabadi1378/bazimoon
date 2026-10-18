using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Bazimoon.Domain;
using Bazimoon.Infrastructure.Hub;
using Bazimoon.Infrastructure.Sessions;

namespace Bazimoon.Infrastructure.History;

public sealed class GameHistoryRepository : IGameHistoryRepository
{
    private readonly BazimoonDbContext _db;
    private readonly IGameRosterStore? _rosterStore;

    public GameHistoryRepository(BazimoonDbContext db, IGameRosterStore? rosterStore = null)
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
        var scores = MafiaScoring.Score(game).ToDictionary(x => x.PlayerId);
        var record = new GameRecord
        {
            Id = game.GameId,
            // 0 = a table opened in the app, not in a Telegram group.
            TelegramChatId = game.TelegramChatId ?? 0,
            CreatedAt = game.CreatedAt.UtcDateTime,
            EndedAt = DateTime.UtcNow,
            Result = result,
            EventsJson = JsonSerializer.Serialize(game.Events),
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
                Won = game.DidWin(p),
                ChecksMade = scores[p.Id].ChecksMade,
                MafiaFound = scores[p.Id].MafiaFound,
                SavesMade = scores[p.Id].SavesMade,
                KillsBlocked = scores[p.Id].KillsBlocked,
                KillsMade = scores[p.Id].KillsMade,
                VotesCast = scores[p.Id].VotesCast,
                VotesOnMafia = scores[p.Id].VotesOnMafia,
                NightsSurvived = scores[p.Id].NightsSurvived,
                SurvivedRevote = scores[p.Id].SurvivedRevote,
                VotedOutGodfather = scores[p.Id].VotedOutGodfather,
                MvpPoints = scores[p.Id].Points,
                IsMvp = scores[p.Id].IsMvp,
                ShotGodfather = scores[p.Id].ShotGodfather
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

        double Average(Func<GamePlayerRecord, bool> which)
        {
            var side = rated.Where(which).ToList();
            return side.Count == 0 ? Progression.StartingRating : side.Average(p => stats[p.TelegramUserId!.Value].Rating);
        }

        double mafiaAverage = Average(p => p.Role?.TeamOf() == Team.Mafia);
        double townAverage = Average(p => p.Role?.TeamOf() == Team.Town);
        foreach (var p in rated)
        {
            var s = stats[p.TelegramUserId!.Value];
            var team = p.Role?.TeamOf() ?? Team.Town;
            // Each team is rated against the other side; the Joker against everyone else at the table.
            double own = team == Team.Independent ? s.Rating : team == Team.Mafia ? mafiaAverage : townAverage;
            double opponents = team == Team.Independent ? Average(x => x != p) : team == Team.Mafia ? townAverage : mafiaAverage;
            int delta = Progression.RatingDelta(own, opponents, p.Won!.Value);
            p.RatingBefore = s.Rating;
            p.RatingDelta = delta;
            s.Rating += delta;
            s.Xp += Progression.MafiaXp(p.Won.Value, p.IsMvp);
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
