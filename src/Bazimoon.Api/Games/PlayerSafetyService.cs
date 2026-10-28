using Bazimoon.Domain;
using Bazimoon.Infrastructure;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Identity;
using Bazimoon.Infrastructure.Sessions;
using Microsoft.EntityFrameworkCore;

namespace Bazimoon.Api.Games;

public sealed class PlayerSafetyService
{
    private static readonly HashSet<string> Categories = new(StringComparer.Ordinal)
        { "harassment", "cheating", "voice", "name", "other" };

    private readonly BazimoonDbContext _db;
    private readonly IGameRosterStore _rosters;

    public PlayerSafetyService(BazimoonDbContext db, IGameRosterStore rosters)
    {
        _db = db;
        _rosters = rosters;
    }

    public async Task<PlayerSafetyDto> GetAsync(Guid gameId, Guid userId)
    {
        var blockedUsers = await _db.PlayerBlocks.AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => x.BlockedUserId)
            .ToListAsync();
        var roster = await _rosters.GetAsync(gameId);
        var players = roster.Select(x => Target(gameId, x.UserId)).ToArray();
        var blocked = roster.Where(x => blockedUsers.Contains(x.UserId))
            .Select(x => PlayerIdentity.DeriveId(gameId, x.UserId)).ToArray();
        return new PlayerSafetyDto(players, blocked);
    }

    public async Task<PlayerSafetyTargetDto> BlockAsync(Guid gameId, Guid userId, Guid targetPlayerId)
    {
        var target = await ResolveAsync(gameId, userId, targetPlayerId);
        if (!await _db.PlayerBlocks.AnyAsync(x => x.UserId == userId && x.BlockedUserId == target.UserId))
        {
            _db.PlayerBlocks.Add(new PlayerBlockRecord { UserId = userId, BlockedUserId = target.UserId });
            await _db.SaveChangesAsync();
        }
        return Target(gameId, target.UserId);
    }

    public async Task ReportAsync(Guid gameId, Guid userId, Guid targetPlayerId, string? category, string? note)
    {
        var target = await ResolveAsync(gameId, userId, targetPlayerId);
        var cleanCategory = category?.Trim().ToLowerInvariant() ?? string.Empty;
        if (!Categories.Contains(cleanCategory)) throw new GameException("Choose a valid report reason.", "report_category_invalid");
        var cleanNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        if (cleanNote is { Length: > 500 }) throw new GameException("A report note can be at most 500 characters.", "report_note_too_long");
        if (await _db.PlayerReports.AnyAsync(x => x.ReporterUserId == userId && x.ReportedUserId == target.UserId && x.GameId == gameId))
            throw new GameException("You already reported this player for this game.", "report_already_sent");

        _db.PlayerReports.Add(new PlayerReportRecord
        {
            ReporterUserId = userId,
            ReportedUserId = target.UserId,
            GameId = gameId,
            Category = cleanCategory,
            Note = cleanNote,
        });
        await _db.SaveChangesAsync();
    }

    public async Task<bool> ConflictsWithRosterAsync(Guid gameId, Guid userId)
    {
        var rosterIds = (await _rosters.GetAsync(gameId)).Select(x => x.UserId).ToArray();
        if (rosterIds.Length == 0) return false;
        return await _db.PlayerBlocks.AnyAsync(x =>
            (x.UserId == userId && rosterIds.Contains(x.BlockedUserId)) ||
            (x.BlockedUserId == userId && rosterIds.Contains(x.UserId)));
    }

    private async Task<GameRosterEntry> ResolveAsync(Guid gameId, Guid userId, Guid targetPlayerId)
    {
        if (PlayerIdentity.DeriveId(gameId, userId) == targetPlayerId)
            throw new GameException("You cannot report or block yourself.", "safety_target_self");
        var target = (await _rosters.GetAsync(gameId)).FirstOrDefault(x => PlayerIdentity.DeriveId(gameId, x.UserId) == targetPlayerId);
        return target ?? throw new GameException("That player is not part of this game.", "safety_target_missing");
    }

    private static PlayerSafetyTargetDto Target(Guid gameId, Guid userId) =>
        new(PlayerIdentity.DeriveId(gameId, userId), Math.Max(1u, BitConverter.ToUInt32(userId.ToByteArray())));
}

public sealed record PlayerSafetyDto(IReadOnlyList<PlayerSafetyTargetDto> Players, IReadOnlyList<Guid> BlockedPlayerIds);
public sealed record PlayerSafetyTargetDto(Guid PlayerId, uint VoiceUid);
public sealed record PlayerReportRequest(string? Category, string? Note);
