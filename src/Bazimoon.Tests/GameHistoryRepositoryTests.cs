using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Bazimoon.Domain;
using Bazimoon.Infrastructure.History;

namespace Bazimoon.Tests;

// Verified against Sqlite in-memory rather than a live Postgres: this sandbox has no local
// Postgres available, and the model uses no Postgres-specific SQL (only provider-agnostic
// fluent-API annotations), so Sqlite is a faithful enough substitute for mapping/query behavior.
public class GameHistoryRepositoryTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly BazimoonDbContext _db;
    private readonly GameHistoryRepository _repository;

    public GameHistoryRepositoryTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<BazimoonDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new BazimoonDbContext(options);
        _db.Database.EnsureCreated();
        _repository = new GameHistoryRepository(_db);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private static GameState EndedGame(out List<Player> players, long telegramChatId = 1)
    {
        var (game, ps) = TestGameFactory.CreateAssignedGame(5, telegramChatId: telegramChatId);
        players = ps;
        var godfather = ps.Godfather();

        game.ResolveNight(); // NightZero
        game.StartVoting();
        foreach (var voter in ps.Where(p => p.Id != godfather.Id))
        {
            game.SubmitVote(voter.Id, godfather.Id);
        }
        game.ResolveVoting(); // eliminates the sole Godfather -> last words
        game.FinishLastWords(); // -> VillagersWin, phase Ended

        return game;
    }

    [Fact]
    public async Task SaveCompletedGameAsync_NonEndedGame_Throws()
    {
        var (game, _) = TestGameFactory.CreateAssignedGame(5, telegramChatId: 1);

        await Assert.ThrowsAsync<InvalidOperationException>(() => _repository.SaveCompletedGameAsync(game));
    }

    [Fact]
    public async Task SaveCompletedGameAsync_AppTableWithoutChat_IsSavedWithChatZero()
    {
        var game = EndedGame(out _, telegramChatId: 0);
        // Tables opened in the app belong to no Telegram group.
        var gameWithoutChat = GameState.FromSnapshot(game.ToSnapshot() with { TelegramChatId = null });

        await _repository.SaveCompletedGameAsync(gameWithoutChat);

        var record = await _repository.GetAsync(gameWithoutChat.GameId);
        Assert.Equal(0, record!.TelegramChatId);
    }

    [Fact]
    public async Task SaveCompletedGameAsync_ThenGet_RoundTripsGameAndPlayers()
    {
        var game = EndedGame(out var players, telegramChatId: 555);

        await _repository.SaveCompletedGameAsync(game);

        var record = await _repository.GetAsync(game.GameId);

        Assert.NotNull(record);
        Assert.Equal(game.GameId, record!.Id);
        Assert.Equal(555, record.TelegramChatId);
        Assert.Equal(WinCondition.VillagersWin, record.Result);
        Assert.Equal(players.Count, record.Players.Count);

        var godfatherRecord = record.Players.Single(p => p.Role == Role.Godfather);
        Assert.False(godfatherRecord.SurvivedToEnd);
        Assert.Equal(1, godfatherRecord.GodfatherRank);
    }

    [Fact]
    public async Task GetForChatAsync_OnlyReturnsGamesForThatChat_NewestFirst()
    {
        var gameA = EndedGame(out _, telegramChatId: 100);
        var gameB = EndedGame(out _, telegramChatId: 100);
        var gameOtherChat = EndedGame(out _, telegramChatId: 200);

        await _repository.SaveCompletedGameAsync(gameA);
        await _repository.SaveCompletedGameAsync(gameB);
        await _repository.SaveCompletedGameAsync(gameOtherChat);

        var results = await _repository.GetForChatAsync(100);

        Assert.Equal(2, results.Count);
        Assert.All(results, r => Assert.Equal(100, r.TelegramChatId));
    }

    [Fact]
    public async Task GetAsync_UnknownId_ReturnsNull()
    {
        var record = await _repository.GetAsync(Guid.NewGuid());

        Assert.Null(record);
    }

    [Fact]
    public async Task PlayerWhoLeft_LosesEvenWhenTheirTeamWins()
    {
        var (game, ps) = TestGameFactory.CreateAssignedGame(5, telegramChatId: 1);
        var leaver = ps.Villagers()[0];
        game.LeaveMidGame(leaver.Id, DateTimeOffset.UtcNow);
        game.LeaveMidGame(ps.Godfather().Id, DateTimeOffset.UtcNow); // town wins

        await _repository.SaveCompletedGameAsync(game);

        var players = await _db.GamePlayers.ToListAsync();
        Assert.False(players.Single(p => p.PlayerId == leaver.Id).Won);
        Assert.True(players.Single(p => p.PlayerId == ps.Detective().Id).Won);
    }

    [Fact]
    public async Task SaveCompletedGameAsync_StoresTheLogAndWhatEachPlayerDid()
    {
        var game = EndedGame(out var players);

        await _repository.SaveCompletedGameAsync(game);

        var record = await _repository.GetAsync(game.GameId);
        var events = System.Text.Json.JsonSerializer.Deserialize<List<GameEvent>>(record!.EventsJson!);
        Assert.Equal(game.Events.Count, events!.Count);
        var detective = record.Players.Single(p => p.PlayerId == players.Detective().Id);
        Assert.Equal(1, detective.VotesOnMafia);
        Assert.True(detective.VotedOutGodfather);
        Assert.NotNull(detective.MvpPoints);
        Assert.Contains(record.Players, p => p.IsMvp);
        Assert.All(record.Players.Where(p => p.IsMvp), p => Assert.True(p.Won));
    }

    [Fact]
    public void Achievements_AreDatedByTheGameThatFirstEarnedThem_AndOldGamesStillCount()
    {
        var day1 = new GameRecord { Id = Guid.NewGuid(), EndedAt = new DateTime(2026, 9, 1) };
        var day2 = new GameRecord { Id = Guid.NewGuid(), EndedAt = new DateTime(2026, 9, 2) };
        var rows = new List<GamePlayerRecord>
        {
            // Before the log: won as Detective counts for Sharp eye.
            new() { GameRecord = day1, GameRecordId = day1.Id, Role = Role.Detective, Won = true, SurvivedToEnd = true },
            new() { GameRecord = day2, GameRecordId = day2.Id, Role = Role.Doctor, Won = false, KillsBlocked = 1, MvpPoints = 4, SurvivedToEnd = true },
        };

        var a = Bazimoon.Infrastructure.Hub.MafiaStats.Achievements(rows).ToDictionary(x => x.Key);
        Assert.Equal(day1.Id, a["sharpEye"].GameId);
        Assert.Equal(day2.Id, a["guardianAngel"].GameId);
        Assert.Null(a["theDon"].EarnedAt);
        Assert.Equal(2, a["survivor"].Progress);
        Assert.Null(a["survivor"].EarnedAt);
        Assert.Equal(1, Bazimoon.Infrastructure.Hub.MafiaStats.Skills(rows).TrackedGames);
    }
}
