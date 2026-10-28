using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Bazimoon.Api.EsmFamil;
using Bazimoon.Api.Games;
using Bazimoon.Domain;
using Bazimoon.Infrastructure;
using Bazimoon.Infrastructure.Activity;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Hub;
using Bazimoon.Infrastructure.Sessions;

namespace Bazimoon.Api.Lounge;

/// <summary>Friends (added by code or link, or by request to someone you played with) and invites
/// from a friend into a Mafia table or an online Esm-Famil room.</summary>
public sealed class FriendService
{
    public const int MaxFriends = 200;
    public const int MaxInvitesPerHour = 60;
    public static readonly TimeSpan InviteLifetime = TimeSpan.FromMinutes(15);
    /// <summary>A player counts as online if the app checked in this recently (it polls invites while open).</summary>
    public static readonly TimeSpan OnlineWindow = TimeSpan.FromMinutes(3);
    private static readonly TimeSpan PlayedWithWindow = TimeSpan.FromDays(30);
    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    private readonly BazimoonDbContext _db;
    private readonly TimeProvider _clock;
    private readonly IPushNotifier _push;
    private readonly IActivityTracker _activity;
    private readonly IGameSessionStore _sessions;
    private readonly GameService _games;
    private readonly EsmFamilRoomService _rooms;

    public FriendService(BazimoonDbContext db, TimeProvider clock, IPushNotifier push, IActivityTracker activity,
        IGameSessionStore sessions, GameService games, EsmFamilRoomService rooms)
    {
        _db = db;
        _clock = clock;
        _push = push;
        _activity = activity;
        _sessions = sessions;
        _games = games;
        _rooms = rooms;
    }

    private DateTime Now => _clock.GetUtcNow().UtcDateTime;

    /// <summary>Everyone the player is friends with (accepted only).</summary>
    public static async Task<List<Guid>> FriendIdsAsync(BazimoonDbContext db, Guid userId) =>
        await db.Friendships.Where(f => f.Accepted && (f.RequesterId == userId || f.AddresseeId == userId))
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .ToListAsync();

    private Task<FriendshipRecord?> FindAsync(Guid a, Guid b) =>
        _db.Friendships.FirstOrDefaultAsync(f => (f.RequesterId == a && f.AddresseeId == b) || (f.RequesterId == b && f.AddresseeId == a));

    // ------------------------------------------------------------------ friends

    public async Task<FriendsDto> GetAsync(Guid userId, string username)
    {
        var me = await _db.GetOrCreateStatsAsync(userId, username);
        me.FriendCode ??= await NewCodeAsync();
        await _db.SaveChangesAsync();

        var links = await _db.Friendships.AsNoTracking().Where(f => f.RequesterId == userId || f.AddresseeId == userId).ToListAsync();
        var otherIds = links.Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId).ToList();
        var people = await PeopleAsync(otherIds);

        var friends = links.Where(f => f.Accepted)
            .Select(f => people[f.RequesterId == userId ? f.AddresseeId : f.RequesterId])
            .OrderByDescending(p => p.Online).ThenByDescending(p => p.LastSeenAt).ThenBy(p => p.Name)
            .ToList();
        var incoming = links.Where(f => !f.Accepted && f.AddresseeId == userId)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new FriendRequestDto(f.Id, people[f.RequesterId]))
            .ToList();
        var outgoing = links.Where(f => !f.Accepted && f.RequesterId == userId)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new FriendRequestDto(f.Id, people[f.AddresseeId]))
            .ToList();

        var known = otherIds.ToHashSet();
        var suggestions = (await PlayedWithAsync(userId)).Where(id => !known.Contains(id)).Take(10).ToList();
        var suggested = await PeopleAsync(suggestions);

        return new FriendsDto(me.FriendCode, friends, incoming, outgoing, suggestions.Select(id => suggested[id]).ToList());
    }

    /// <summary>Who owns a friend code, for the screen a friend link opens.</summary>
    public async Task<FriendCodePreviewDto> PreviewCodeAsync(Guid userId, string code)
    {
        var owner = await OwnerOfAsync(code);
        bool friends = owner.UserId != userId && await FindAsync(userId, owner.UserId) is { Accepted: true };
        return new FriendCodePreviewDto(owner.Username, Progression.Level(owner.Xp).Level, owner.UserId == userId, friends);
    }

    /// <summary>Adds the owner of a friend code. They shared it, so the friendship is accepted at once.</summary>
    public async Task<FriendDto> AddByCodeAsync(Guid userId, string username, string code)
    {
        var owner = await OwnerOfAsync(code);
        if (owner.UserId == userId) throw new GameException("That is your own friend code.");
        await _db.GetOrCreateStatsAsync(userId, username);
        var link = await FindAsync(userId, owner.UserId);
        if (link is null)
        {
            await EnsureRoomForFriendAsync(userId);
            await EnsureRoomForFriendAsync(owner.UserId);
            link = new FriendshipRecord { RequesterId = userId, AddresseeId = owner.UserId };
            _db.Friendships.Add(link);
        }
        if (!link.Accepted)
        {
            link.Accepted = true;
            link.AcceptedAt = Now;
            _activity.Track(userId, ActivityEvents.Friends, ActivityEvents.FriendAdded, new { via = "code" });
            await _db.SaveChangesAsync();
            await _push.NotifyAsync(owner.UserId, new PushText(
                $"{Clip(username)} added you as a friend on Bazimoon.",
                $"{Clip(username)} شما را در بازیمون به دوستانش اضافه کرد."), "/friends");
        }
        return (await PeopleAsync([owner.UserId]))[owner.UserId];
    }

    /// <summary>Asks someone you played with to be friends. If they already asked you, you are friends now.</summary>
    public async Task RequestAsync(Guid userId, string username, Guid otherId)
    {
        if (otherId == userId) throw new GameException("You can't add yourself.");
        var link = await FindAsync(userId, otherId);
        if (link is { Accepted: true }) return;
        if (link is not null && link.AddresseeId == userId)
        {
            await AcceptAsync(userId, username, link.Id);
            return;
        }
        if (link is not null) return; // already asked
        if (!(await PlayedWithAsync(userId)).Contains(otherId))
            throw new ForbiddenGameActionException("You can only send a request to someone you played with. Share your friend link instead.");
        await _db.GetOrCreateStatsAsync(userId, username);
        await EnsureRoomForFriendAsync(userId);
        _db.Friendships.Add(new FriendshipRecord { RequesterId = userId, AddresseeId = otherId });
        _activity.Track(userId, ActivityEvents.Friends, ActivityEvents.FriendRequestSent);
        await _db.SaveChangesAsync();
        await _push.NotifyAsync(otherId, new PushText(
            $"{Clip(username)} wants to be friends on Bazimoon.",
            $"{Clip(username)} می‌خواهد در بازیمون با شما دوست شود."), "/friends");
    }

    public async Task AcceptAsync(Guid userId, string username, long requestId)
    {
        var link = await _db.Friendships.FirstOrDefaultAsync(f => f.Id == requestId && f.AddresseeId == userId)
            ?? throw new GameException("That friend request is gone.");
        if (link.Accepted) return;
        await EnsureRoomForFriendAsync(userId);
        link.Accepted = true;
        link.AcceptedAt = Now;
        _activity.Track(userId, ActivityEvents.Friends, ActivityEvents.FriendAdded, new { via = "request" });
        await _db.SaveChangesAsync();
        await _push.NotifyAsync(link.RequesterId, new PushText(
            $"{Clip(username)} accepted your friend request.",
            $"{Clip(username)} درخواست دوستی شما را پذیرفت."), "/friends");
    }

    /// <summary>Declines a request sent to you, cancels one you sent, or removes a friend.</summary>
    public async Task RemoveAsync(Guid userId, Guid otherId)
    {
        if (await FindAsync(userId, otherId) is { } link)
        {
            _db.Friendships.Remove(link);
            _db.GameInvites.RemoveRange(await _db.GameInvites.Where(i => i.Status == GameInviteStatus.Pending
                && ((i.FromUserId == userId && i.ToUserId == otherId) || (i.FromUserId == otherId && i.ToUserId == userId))).ToListAsync());
            await _db.SaveChangesAsync();
        }
    }

    // ------------------------------------------------------------------ invites

    public async Task<int> InviteAsync(Guid userId, string username, InviteRequest request)
    {
        string target = await CheckOpenLobbyAsync(request.Kind, request.Target, userId)
            ?? throw new GameException("Friends can only be invited while the lobby is open and has a free seat.");
        var wanted = (request.FriendIds ?? []).Distinct().Take(20).ToHashSet();
        var friends = (await FriendIdsAsync(_db, userId)).Where(wanted.Contains).ToList();
        if (friends.Count == 0) return 0;

        var now = Now;
        var hourAgo = now.AddHours(-1);
        int sentLastHour = await _db.GameInvites.CountAsync(i => i.FromUserId == userId && i.CreatedAt > hourAgo);
        if (sentLastHour + friends.Count > MaxInvitesPerHour) throw new GameException("You sent a lot of invites. Try again in a while.");

        var existing = await _db.GameInvites
            .Where(i => i.FromUserId == userId && i.Kind == request.Kind && i.Target == target && friends.Contains(i.ToUserId))
            .ToListAsync();
        var sendTo = new List<Guid>();
        foreach (var friendId in friends)
        {
            var invite = existing.FirstOrDefault(i => i.ToUserId == friendId);
            if (invite is { Status: GameInviteStatus.Pending } && invite.ExpiresAt > now) continue; // still waiting
            if (invite is { Status: GameInviteStatus.Accepted }) continue;
            if (invite is null)
            {
                invite = new GameInviteRecord { FromUserId = userId, ToUserId = friendId, Kind = request.Kind, Target = target };
                _db.GameInvites.Add(invite);
            }
            invite.Status = GameInviteStatus.Pending;
            invite.CreatedAt = now;
            invite.ExpiresAt = now + InviteLifetime;
            sendTo.Add(friendId);
        }
        if (sendTo.Count == 0) return 0;
        _activity.Track(userId, ActivityEvents.Friends, ActivityEvents.GameInviteSent, new { kind = request.Kind, count = sendTo.Count });
        await _db.SaveChangesAsync();

        var text = request.Kind == GameInviteKinds.Mafia
            ? new PushText($"{Clip(username)} invited you to a Mafia game. Tap to join.", $"{Clip(username)} شما را به بازی مافیا دعوت کرد. برای پیوستن بزنید.")
            : new PushText($"{Clip(username)} invited you to play Esm-Famil. Tap to join.", $"{Clip(username)} شما را به بازی اسم‌فامیل دعوت کرد. برای پیوستن بزنید.");
        foreach (var friendId in sendTo) await _push.NotifyAsync(friendId, text, "/");
        return sendTo.Count;
    }

    /// <summary>Invites waiting for the player, only those whose lobby can still be joined. Also marks
    /// the player as online: the app polls this while it is open.</summary>
    public async Task<List<GameInviteDto>> GetInvitesAsync(Guid userId)
    {
        var now = Now;
        if (await _db.Users.FindAsync(userId) is { } user && now - user.LastSeenAt > TimeSpan.FromMinutes(1))
        {
            user.LastSeenAt = now;
            await _db.SaveChangesAsync();
        }

        var invites = await _db.GameInvites.AsNoTracking()
            .Where(i => i.ToUserId == userId && i.Status == GameInviteStatus.Pending && i.ExpiresAt > now)
            .OrderByDescending(i => i.CreatedAt)
            .Take(10)
            .ToListAsync();
        var names = await NamesAsync(invites.Select(i => i.FromUserId));
        var open = new List<GameInviteDto>();
        foreach (var i in invites)
        {
            if (await CheckOpenLobbyAsync(i.Kind, i.Target, null) is null) continue;
            open.Add(new GameInviteDto(i.Id, i.Kind, names.GetValueOrDefault(i.FromUserId, "?"), i.ExpiresAt));
        }
        return open;
    }

    /// <summary>Invites the player sent into one lobby, so the picker can show who was invited or said no.</summary>
    public async Task<List<SentInviteDto>> GetSentAsync(Guid userId, string kind, string target)
    {
        var now = Now;
        string key = kind == GameInviteKinds.EsmFamil ? EsmFamilRoomService.NormalizeCode(target) : target;
        return await _db.GameInvites.AsNoTracking()
            .Where(i => i.FromUserId == userId && i.Kind == kind && i.Target == key)
            .Select(i => new SentInviteDto(i.ToUserId, i.Status == GameInviteStatus.Pending && i.ExpiresAt <= now ? "expired" : i.Status))
            .ToListAsync();
    }

    public async Task<AcceptInviteDto> AcceptInviteAsync(Guid userId, string username, long inviteId)
    {
        var invite = await PendingInviteAsync(userId, inviteId);
        try
        {
            if (invite.Kind == GameInviteKinds.Mafia) await _games.JoinGameAsync(Guid.Parse(invite.Target), userId, username);
            else await _rooms.JoinAsync(invite.Target, userId, username);
        }
        catch (Exception ex) when (ex is GameException or GameNotFoundException)
        {
            invite.ExpiresAt = Now;
            await _db.SaveChangesAsync();
            throw new GameException("This game has already started or is full.");
        }
        invite.Status = GameInviteStatus.Accepted;
        _activity.Track(userId, ActivityEvents.Friends, ActivityEvents.GameInviteAccepted, new { kind = invite.Kind });
        await _db.SaveChangesAsync();
        return invite.Kind == GameInviteKinds.Mafia
            ? new AcceptInviteDto(invite.Kind, Guid.Parse(invite.Target), null)
            : new AcceptInviteDto(invite.Kind, null, invite.Target);
    }

    public async Task DeclineInviteAsync(Guid userId, long inviteId)
    {
        var invite = await PendingInviteAsync(userId, inviteId);
        invite.Status = GameInviteStatus.Declined;
        await _db.SaveChangesAsync();
    }

    private async Task<GameInviteRecord> PendingInviteAsync(Guid userId, long inviteId)
    {
        var now = Now;
        return await _db.GameInvites.FirstOrDefaultAsync(i => i.Id == inviteId && i.ToUserId == userId && i.Status == GameInviteStatus.Pending && i.ExpiresAt > now)
            ?? throw new GameException("This invite has expired.");
    }

    /// <summary>The invite target in its stored form if friends can still join it; with
    /// <paramref name="member"/>, only if that player is in the lobby too. Otherwise null.</summary>
    private async Task<string?> CheckOpenLobbyAsync(string kind, string target, Guid? member)
    {
        if (kind == GameInviteKinds.Mafia)
        {
            if (!Guid.TryParse(target, out var gameId) || await _sessions.GetAsync(gameId) is not { } game) return null;
            if (game.CurrentPhase != GamePhase.Lobby || game.Players.Count >= game.Config.MaxPlayers) return null;
            if (member is { } id && game.GetPlayer(PlayerIdentity.DeriveId(gameId, id)) is null) return null;
            return gameId.ToString();
        }
        if (kind == GameInviteKinds.EsmFamil)
        {
            if (string.IsNullOrWhiteSpace(target)) return null;
            string code = EsmFamilRoomService.NormalizeCode(target);
            return _rooms.IsOpenLobby(code, member) ? code : null;
        }
        throw new GameException("Unknown game.");
    }

    // ------------------------------------------------------------------ helpers

    /// <summary>People the player finished a Mafia game with in the last 30 days, most recent first.</summary>
    private async Task<List<Guid>> PlayedWithAsync(Guid userId)
    {
        var since = Now - PlayedWithWindow;
        var myGames = _db.GamePlayers.Where(p => p.UserId == userId && p.GameRecord.EndedAt >= since).Select(p => p.GameRecordId);
        var rows = await _db.GamePlayers
            .Where(p => myGames.Contains(p.GameRecordId) && p.UserId != null && p.UserId != userId)
            .Select(p => new { UserId = p.UserId!.Value, p.GameRecord.EndedAt })
            .ToListAsync();
        var bots = await _db.Users.Where(u => u.IsBot).Select(u => u.Id).ToListAsync();
        return rows.Where(r => !bots.Contains(r.UserId))
            .GroupBy(r => r.UserId)
            .OrderByDescending(g => g.Max(r => r.EndedAt))
            .Select(g => g.Key)
            .ToList();
    }

    private async Task<Dictionary<Guid, FriendDto>> PeopleAsync(IReadOnlyCollection<Guid> ids)
    {
        var stats = await _db.PlayerStats.AsNoTracking().Where(s => ids.Contains(s.UserId)).ToDictionaryAsync(s => s.UserId);
        var users = await _db.Users.AsNoTracking().Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id);
        var now = Now;
        return ids.Distinct().ToDictionary(id => id, id =>
        {
            var s = stats.GetValueOrDefault(id);
            var u = users.GetValueOrDefault(id);
            string name = s?.Username is { Length: > 0 } n ? n : u?.DisplayName ?? "?";
            var (division, tier) = Progression.Division(s?.Rating ?? Progression.StartingRating);
            DateTime? seen = u?.LastSeenAt;
            return new FriendDto(id, name, Progression.Level(s?.Xp ?? 0).Level, division, tier,
                seen is { } t && now - t <= OnlineWindow, seen);
        });
    }

    private async Task<Dictionary<Guid, string>> NamesAsync(IEnumerable<Guid> ids)
    {
        var list = ids.Distinct().ToList();
        return await _db.PlayerStats.AsNoTracking().Where(s => list.Contains(s.UserId)).ToDictionaryAsync(s => s.UserId, s => s.Username);
    }

    private async Task<PlayerStatsRecord> OwnerOfAsync(string code)
    {
        string key = (code ?? string.Empty).Trim().ToUpperInvariant();
        return await _db.PlayerStats.FirstOrDefaultAsync(s => s.FriendCode == key)
            ?? throw new GameException("No player has that friend code.");
    }

    private async Task EnsureRoomForFriendAsync(Guid userId)
    {
        if ((await FriendIdsAsync(_db, userId)).Count >= MaxFriends)
            throw new GameException($"A player can have up to {MaxFriends} friends.");
    }

    private async Task<string> NewCodeAsync()
    {
        while (true)
        {
            var code = string.Create(7, 0, (span, _) =>
            {
                for (int i = 0; i < span.Length; i++) span[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
            });
            if (!await _db.PlayerStats.AnyAsync(s => s.FriendCode == code)) return code;
        }
    }

    private static string Clip(string name) => string.IsNullOrWhiteSpace(name) ? "A friend" : name.Trim().Length > 24 ? name.Trim()[..24] : name.Trim();
}

public sealed record FriendDto(Guid UserId, string Name, int Level, string Division, int Tier, bool Online, DateTime? LastSeenAt);
public sealed record FriendRequestDto(long Id, FriendDto Player);
public sealed record FriendsDto(string Code, IReadOnlyList<FriendDto> Friends, IReadOnlyList<FriendRequestDto> Incoming, IReadOnlyList<FriendRequestDto> Outgoing, IReadOnlyList<FriendDto> Suggestions);
public sealed record FriendCodePreviewDto(string Name, int Level, bool IsYou, bool AlreadyFriends);
public sealed record FriendRequestBody(Guid UserId);
public sealed record InviteRequest(string Kind, string Target, IReadOnlyList<Guid>? FriendIds);
public sealed record InviteResultDto(int Sent);
public sealed record GameInviteDto(long Id, string Kind, string FromName, DateTime ExpiresAt);
public sealed record SentInviteDto(Guid UserId, string Status);
public sealed record AcceptInviteDto(string Kind, Guid? GameId, string? Code);
