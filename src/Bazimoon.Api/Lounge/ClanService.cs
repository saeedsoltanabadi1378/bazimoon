using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Bazimoon.Api.Games;
using Bazimoon.Domain;
using Bazimoon.Infrastructure;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Hub;
using Bazimoon.Infrastructure.Sessions;

namespace Bazimoon.Api.Lounge;

/// <summary>Clans (اکیپ): crews who play Mafia together. Owners and admins run the clan (members,
/// join requests, announcements, game nights); everyone chats, says whether they're coming to a
/// game night, sits at clan tables and shows up in the clan ranking.</summary>
public sealed class ClanService
{
    public const int MaxMembers = 50;
    public const int MaxUpcomingEvents = 6;
    public const int MaxOpenRequestsPerPlayer = 5;
    public const int MaxMessageLength = 400;
    /// <summary>A game night's table can be opened this long before it starts…</summary>
    public static readonly TimeSpan EventOpensBefore = TimeSpan.FromMinutes(15);
    /// <summary>…and until this long after; after that the night is over.</summary>
    public static readonly TimeSpan EventLasts = TimeSpan.FromHours(2);
    /// <summary>Members are told about a quick clan table at most this often.</summary>
    private static readonly TimeSpan TableNoticeGap = TimeSpan.FromMinutes(20);
    private static readonly TimeSpan TableListWindow = TimeSpan.FromHours(12);
    private static readonly TimeSpan ChatWindow = TimeSpan.FromSeconds(30);
    private const int ChatPerWindow = 8;
    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    /// <summary>Two members opening a game night's table at the same moment must land at one table.</summary>
    private static readonly SemaphoreSlim EventTableGate = new(1, 1);

    private readonly BazimoonDbContext _db;
    private readonly TimeProvider _clock;
    private readonly IPushNotifier _push;
    private readonly IGameSessionStore _sessions;
    private readonly GameService _games;

    public ClanService(BazimoonDbContext db, TimeProvider clock, IPushNotifier push, IGameSessionStore sessions, GameService games)
    {
        _db = db;
        _clock = clock;
        _push = push;
        _sessions = sessions;
        _games = games;
    }

    private DateTime Now => _clock.GetUtcNow().UtcDateTime;

    // ------------------------------------------------------------------ finding clans

    /// <summary>The player's clan (if any) for the Together tab, and the clans they asked to join.</summary>
    public async Task<ClanMeDto> GetMeAsync(Guid userId)
    {
        var requested = await _db.ClanJoinRequests.AsNoTracking().Where(r => r.UserId == userId).Select(r => r.ClanId).ToListAsync();
        var member = await _db.ClanMembers.AsNoTracking().FirstOrDefaultAsync(m => m.UserId == userId);
        if (member is null) return new ClanMeDto(null, requested);

        var clan = await _db.Clans.AsNoTracking().FirstAsync(c => c.Id == member.ClanId);
        int unread = await _db.ClanMessages.CountAsync(m => m.ClanId == clan.Id && m.Id > member.LastReadMessageId && m.UserId != userId);
        int requests = ClanRoles.CanManage(member.Role) ? await _db.ClanJoinRequests.CountAsync(r => r.ClanId == clan.Id) : 0;
        var cutoff = Now - EventLasts;
        var next = await _db.ClanEvents.AsNoTracking()
            .Where(e => e.ClanId == clan.Id && !e.Cancelled && e.StartsAt > cutoff)
            .OrderBy(e => e.StartsAt).FirstOrDefaultAsync();
        int members = await _db.ClanMembers.CountAsync(m => m.ClanId == clan.Id);
        return new ClanMeDto(new ClanBadgeDto(clan.Id, clan.Name, clan.Emblem, clan.Color, member.Role, members, unread, requests,
            next is null ? null : new ClanNextEventDto(next.Id, next.Title, next.StartsAt)), requested);
    }

    /// <summary>Listed clans, biggest first, optionally filtered by name.</summary>
    public async Task<IReadOnlyList<ClanSummaryDto>> SearchAsync(Guid userId, string? search)
    {
        var query = _db.Clans.AsNoTracking().Where(c => c.IsListed);
        string key = (search ?? string.Empty).Trim().ToLowerInvariant();
        if (key.Length > 0) query = query.Where(c => c.NameKey.Contains(key));
        var clans = await query.ToListAsync();
        var ids = clans.Select(c => c.Id).ToList();
        var counts = await _db.ClanMembers.AsNoTracking().Where(m => ids.Contains(m.ClanId))
            .GroupBy(m => m.ClanId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count);
        var requested = (await _db.ClanJoinRequests.AsNoTracking().Where(r => r.UserId == userId).Select(r => r.ClanId).ToListAsync()).ToHashSet();
        return clans
            .Select(c => Summary(c, counts.GetValueOrDefault(c.Id), requested.Contains(c.Id)))
            .OrderByDescending(c => c.Members < MaxMembers).ThenByDescending(c => c.Members).ThenBy(c => c.Name)
            .Take(30)
            .ToList();
    }

    /// <summary>The clan behind an invite code or link (<c>https://bazimoon.com/c/CODE</c>).</summary>
    public async Task<ClanInvitePreviewDto> PreviewCodeAsync(Guid userId, string code)
    {
        var clan = await ByCodeAsync(code);
        int members = await _db.ClanMembers.CountAsync(m => m.ClanId == clan.Id);
        var yours = await _db.ClanMembers.AsNoTracking().Where(m => m.UserId == userId).Select(m => (Guid?)m.ClanId).FirstOrDefaultAsync();
        bool banned = await _db.ClanBans.AnyAsync(b => b.ClanId == clan.Id && b.UserId == userId);
        return new ClanInvitePreviewDto(Summary(clan, members, false), yours == clan.Id, yours is not null && yours != clan.Id, banned);
    }

    // ------------------------------------------------------------------ creating and editing

    public async Task<ClanDetailDto> CreateAsync(Guid userId, string username, ClanEditRequest request)
    {
        if (await IsGuestAsync(userId))
            throw new ForbiddenGameActionException("Sign in with Google to start a clan.", "clan_guest_cannot_create");
        await EnsureNotInClanAsync(userId);
        var (name, key) = await CheckNameAsync(request.Name, null);
        await _db.GetOrCreateStatsAsync(userId, username);
        var clan = new ClanRecord
        {
            Id = Guid.NewGuid(),
            Name = name,
            NameKey = key,
            OwnerId = userId,
            InviteCode = await NewCodeAsync(),
            CreatedAt = Now,
        };
        Apply(clan, request);
        _db.Clans.Add(clan);
        _db.ClanMembers.Add(new ClanMemberRecord { ClanId = clan.Id, UserId = userId, Role = ClanRoles.Owner, JoinedAt = Now });
        _db.ClanJoinRequests.RemoveRange(await _db.ClanJoinRequests.Where(r => r.UserId == userId).ToListAsync());
        await _db.SaveChangesAsync();
        return await GetAsync(clan.Id, userId);
    }

    public async Task<ClanDetailDto> UpdateAsync(Guid clanId, Guid userId, ClanEditRequest request)
    {
        await RequireManagerAsync(clanId, userId);
        var clan = await _db.Clans.FirstAsync(c => c.Id == clanId);
        var (name, key) = await CheckNameAsync(request.Name, clanId);
        clan.Name = name;
        clan.NameKey = key;
        Apply(clan, request);
        await _db.SaveChangesAsync();
        return await GetAsync(clanId, userId);
    }

    private static void Apply(ClanRecord clan, ClanEditRequest request)
    {
        string? bio = request.Bio?.Trim();
        if (bio is { Length: > 140 }) bio = bio[..140];
        clan.Bio = string.IsNullOrEmpty(bio) ? null : bio;
        clan.Emblem = ClanEmblems.All.Contains(request.Emblem ?? "") ? request.Emblem! : ClanEmblems.Default;
        clan.Color = ClanColors.All.Contains(request.Color ?? "") ? request.Color! : ClanColors.Default;
        clan.IsListed = request.IsListed;
    }

    /// <summary>Deletes the clan with its chat and game nights. Its games stay in everyone's history.</summary>
    public async Task DeleteAsync(Guid clanId, Guid userId)
    {
        var me = await RequireMemberAsync(clanId, userId);
        if (me.Role != ClanRoles.Owner) throw new ForbiddenGameActionException("Only the owner can delete the clan.", "clan_owner_only");
        await RemoveClanAsync(clanId);
    }

    private async Task RemoveClanAsync(Guid clanId)
    {
        var events = await _db.ClanEvents.Where(e => e.ClanId == clanId).ToListAsync();
        var eventIds = events.Select(e => e.Id).ToList();
        _db.ClanRsvps.RemoveRange(await _db.ClanRsvps.Where(r => eventIds.Contains(r.EventId)).ToListAsync());
        _db.ClanEvents.RemoveRange(events);
        _db.ClanMessages.RemoveRange(await _db.ClanMessages.Where(m => m.ClanId == clanId).ToListAsync());
        _db.ClanJoinRequests.RemoveRange(await _db.ClanJoinRequests.Where(r => r.ClanId == clanId).ToListAsync());
        _db.ClanBans.RemoveRange(await _db.ClanBans.Where(b => b.ClanId == clanId).ToListAsync());
        _db.ClanMembers.RemoveRange(await _db.ClanMembers.Where(m => m.ClanId == clanId).ToListAsync());
        if (await _db.Clans.FindAsync(clanId) is { } clan) _db.Clans.Remove(clan);
        await _db.SaveChangesAsync();
    }

    public async Task<ClanDetailDto> ResetInviteCodeAsync(Guid clanId, Guid userId)
    {
        await RequireManagerAsync(clanId, userId);
        var clan = await _db.Clans.FirstAsync(c => c.Id == clanId);
        clan.InviteCode = await NewCodeAsync();
        await _db.SaveChangesAsync();
        return await GetAsync(clanId, userId);
    }

    // ------------------------------------------------------------------ the clan page

    public async Task<ClanDetailDto> GetAsync(Guid clanId, Guid userId)
    {
        var me = await RequireMemberAsync(clanId, userId);
        var clan = await _db.Clans.AsNoTracking().FirstAsync(c => c.Id == clanId);
        var members = await _db.ClanMembers.AsNoTracking().Where(m => m.ClanId == clanId).ToListAsync();
        bool manager = ClanRoles.CanManage(me.Role);
        var requests = manager
            ? await _db.ClanJoinRequests.AsNoTracking().Where(r => r.ClanId == clanId).OrderBy(r => r.CreatedAt).ToListAsync()
            : [];
        var announcement = await _db.ClanMessages.AsNoTracking()
            .Where(m => m.ClanId == clanId && m.IsAnnouncement).OrderByDescending(m => m.Id).FirstOrDefaultAsync();
        var events = await UpcomingEventsAsync(clanId);
        var eventIds = events.Select(e => e.Id).ToList();
        var rsvps = await _db.ClanRsvps.AsNoTracking().Where(r => eventIds.Contains(r.EventId)).OrderBy(r => r.UpdatedAt).ToListAsync();

        var people = await PeopleAsync(members.Select(m => m.UserId)
            .Concat(requests.Select(r => r.UserId))
            .Concat(announcement is null ? [] : [announcement.UserId])
            .Concat(events.Select(e => e.CreatedBy)));
        int unread = await _db.ClanMessages.CountAsync(m => m.ClanId == clanId && m.Id > me.LastReadMessageId && m.UserId != userId);

        var memberDtos = members
            .Select(m => { var p = people[m.UserId]; return new ClanMemberDto(m.UserId, p.Name, m.Role, p.Level, p.Online, p.IsGuest, m.JoinedAt); })
            .OrderBy(m => RoleOrder(m.Role)).ThenByDescending(m => m.Online).ThenBy(m => m.JoinedAt)
            .ToList();
        var memberIds = members.Select(m => m.UserId).ToHashSet();

        return new ClanDetailDto(
            clan.Id, clan.Name, clan.Bio, clan.Emblem, clan.Color, clan.IsListed, MaxMembers, clan.CreatedAt,
            me.Role, clan.InviteCode, memberDtos,
            requests.Select(r => { var p = people[r.UserId]; return new ClanRequestDto(r.UserId, p.Name, p.Level, r.CreatedAt); }).ToList(),
            announcement is null ? null : Message(announcement, people, userId),
            events.Select(e => EventDto(e, rsvps.Where(r => r.EventId == e.Id && memberIds.Contains(r.UserId)).ToList(), people, userId)).ToList(),
            await LiveTablesAsync(clanId, userId),
            unread);
    }

    private async Task<List<ClanEventRecord>> UpcomingEventsAsync(Guid clanId)
    {
        var cutoff = Now - EventLasts;
        return await _db.ClanEvents.AsNoTracking()
            .Where(e => e.ClanId == clanId && !e.Cancelled && e.StartsAt > cutoff)
            .OrderBy(e => e.StartsAt).Take(MaxUpcomingEvents).ToListAsync();
    }

    private ClanEventDto EventDto(ClanEventRecord e, List<ClanRsvpRecord> rsvps, IReadOnlyDictionary<Guid, Person> people, Guid userId)
    {
        var now = Now;
        ClanPersonDto P(Guid id) => new(id, people.TryGetValue(id, out var p) ? p.Name : "?");
        return new ClanEventDto(
            e.Id, e.Title, e.Note, e.StartsAt, e.Seats, e.RepeatWeekly,
            people.TryGetValue(e.CreatedBy, out var by) ? by.Name : null,
            rsvps.FirstOrDefault(r => r.UserId == userId)?.Answer,
            rsvps.Where(r => r.Answer == ClanRsvpAnswers.Yes).Select(r => P(r.UserId)).ToList(),
            rsvps.Where(r => r.Answer == ClanRsvpAnswers.Maybe).Select(r => P(r.UserId)).ToList(),
            rsvps.Count(r => r.Answer == ClanRsvpAnswers.No),
            now >= e.StartsAt - EventOpensBefore && now <= e.StartsAt + EventLasts,
            e.GameId);
    }

    /// <summary>Clan tables still in their lobby or being played.</summary>
    private async Task<List<ClanTableDto>> LiveTablesAsync(Guid clanId, Guid userId)
    {
        var since = Now - TableListWindow;
        var tables = await _db.MafiaTables.AsNoTracking().Where(t => t.ClanId == clanId && t.CreatedAt >= since)
            .OrderByDescending(t => t.CreatedAt).Take(10).ToListAsync();
        var hostIds = tables.Select(t => t.CreatorUserId).ToList();
        var hosts = await PeopleAsync(hostIds);
        var live = new List<ClanTableDto>();
        foreach (var t in tables)
        {
            if (await _sessions.GetAsync(t.GameId) is not { } game || game.CurrentPhase == GamePhase.Ended) continue;
            live.Add(new ClanTableDto(t.GameId, t.Name, hosts[t.CreatorUserId].Name, game.CurrentPhase == GamePhase.Lobby,
                game.Players.Count, game.Config.MaxPlayers, game.GetPlayer(PlayerIdentity.DeriveId(t.GameId, userId)) is not null));
        }
        return live;
    }

    // ------------------------------------------------------------------ joining and leaving

    /// <summary>Joins through an invite code. The link was shared by a member, so no approval is needed.</summary>
    public async Task<ClanDetailDto> JoinByCodeAsync(Guid userId, string username, string code)
    {
        var clan = await ByCodeAsync(code);
        if (await _db.ClanMembers.AnyAsync(m => m.ClanId == clan.Id && m.UserId == userId)) return await GetAsync(clan.Id, userId);
        if (await _db.ClanBans.AnyAsync(b => b.ClanId == clan.Id && b.UserId == userId))
            throw new ForbiddenGameActionException("You were removed from this clan.", "clan_banned");
        await EnsureNotInClanAsync(userId);
        await EnsureRoomAsync(clan.Id);
        await _db.GetOrCreateStatsAsync(userId, username);
        await AddMemberAsync(clan.Id, userId);
        return await GetAsync(clan.Id, userId);
    }

    /// <summary>Asks to join a listed clan; its owner and admins are told.</summary>
    public async Task RequestAsync(Guid clanId, Guid userId, string username)
    {
        var clan = await _db.Clans.AsNoTracking().FirstOrDefaultAsync(c => c.Id == clanId && c.IsListed)
            ?? throw new GameException("That clan is gone or takes members by invite only.", "clan_not_found");
        await EnsureNotInClanAsync(userId);
        if (await _db.ClanJoinRequests.AnyAsync(r => r.ClanId == clanId && r.UserId == userId)) return;
        if (await _db.ClanJoinRequests.CountAsync(r => r.UserId == userId) >= MaxOpenRequestsPerPlayer)
            throw new GameException("You have asked to join enough clans. Wait for an answer.", "clan_too_many_requests");
        await EnsureRoomAsync(clanId);
        await _db.GetOrCreateStatsAsync(userId, username);
        _db.ClanJoinRequests.Add(new ClanJoinRequestRecord { ClanId = clanId, UserId = userId, CreatedAt = Now });
        await _db.SaveChangesAsync();

        var text = new PushText($"{Clip(username)} asked to join {clan.Name}.", $"{Clip(username)} می‌خواهد به اکیپ {clan.Name} بپیوندد.");
        foreach (var id in await ManagerIdsAsync(clanId)) await _push.NotifyAsync(id, text, "/clan");
    }

    public async Task CancelRequestAsync(Guid clanId, Guid userId)
    {
        _db.ClanJoinRequests.RemoveRange(await _db.ClanJoinRequests.Where(r => r.ClanId == clanId && r.UserId == userId).ToListAsync());
        await _db.SaveChangesAsync();
    }

    public async Task AcceptRequestAsync(Guid clanId, Guid userId, Guid requesterId)
    {
        await RequireManagerAsync(clanId, userId);
        var request = await _db.ClanJoinRequests.FirstOrDefaultAsync(r => r.ClanId == clanId && r.UserId == requesterId)
            ?? throw new GameException("That request is gone.", "clan_request_gone");
        if (await _db.ClanMembers.AnyAsync(m => m.UserId == requesterId))
        {
            _db.ClanJoinRequests.Remove(request);
            await _db.SaveChangesAsync();
            throw new GameException("That player has joined another clan.", "clan_request_gone");
        }
        await EnsureRoomAsync(clanId);
        // Letting someone back in lifts an earlier removal.
        _db.ClanBans.RemoveRange(await _db.ClanBans.Where(b => b.ClanId == clanId && b.UserId == requesterId).ToListAsync());
        await AddMemberAsync(clanId, requesterId);

        var name = (await _db.Clans.AsNoTracking().FirstAsync(c => c.Id == clanId)).Name;
        await _push.NotifyAsync(requesterId, new PushText($"You're in! {name} accepted you.", $"به اکیپ {name} پیوستی!"), "/clan");
    }

    public async Task DeclineRequestAsync(Guid clanId, Guid userId, Guid requesterId)
    {
        await RequireManagerAsync(clanId, userId);
        _db.ClanJoinRequests.RemoveRange(await _db.ClanJoinRequests.Where(r => r.ClanId == clanId && r.UserId == requesterId).ToListAsync());
        await _db.SaveChangesAsync();
    }

    private async Task AddMemberAsync(Guid clanId, Guid userId)
    {
        long lastMessage = await _db.ClanMessages.Where(m => m.ClanId == clanId).MaxAsync(m => (long?)m.Id) ?? 0;
        _db.ClanMembers.Add(new ClanMemberRecord { ClanId = clanId, UserId = userId, Role = ClanRoles.Member, JoinedAt = Now, LastReadMessageId = lastMessage });
        // One clan per player: any other requests are no longer needed.
        _db.ClanJoinRequests.RemoveRange(await _db.ClanJoinRequests.Where(r => r.UserId == userId).ToListAsync());
        await _db.SaveChangesAsync();
    }

    /// <summary>Leaves the clan. An owner hands it to someone first, unless they're the last member,
    /// in which case the clan closes.</summary>
    public async Task LeaveAsync(Guid clanId, Guid userId)
    {
        var me = await RequireMemberAsync(clanId, userId);
        if (me.Role == ClanRoles.Owner)
        {
            if (await _db.ClanMembers.CountAsync(m => m.ClanId == clanId) > 1)
                throw new GameException("Make someone else the owner before you leave.", "clan_owner_must_transfer");
            await RemoveClanAsync(clanId);
            return;
        }
        await RemoveMemberAsync(clanId, userId);
    }

    /// <summary>Removes a member. Admins can remove members; the owner can also remove admins.
    /// The removed player can't come back through the invite link.</summary>
    public async Task KickAsync(Guid clanId, Guid userId, Guid targetId)
    {
        var me = await RequireManagerAsync(clanId, userId);
        var target = await _db.ClanMembers.AsNoTracking().FirstOrDefaultAsync(m => m.ClanId == clanId && m.UserId == targetId)
            ?? throw new GameException("That player isn't in the clan.", "clan_not_member");
        if (RoleOrder(target.Role) <= RoleOrder(me.Role))
            throw new ForbiddenGameActionException("You can't remove that player.", "clan_forbidden");
        if (!await _db.ClanBans.AnyAsync(b => b.ClanId == clanId && b.UserId == targetId))
            _db.ClanBans.Add(new ClanBanRecord { ClanId = clanId, UserId = targetId, CreatedAt = Now });
        await RemoveMemberAsync(clanId, targetId);
    }

    private async Task RemoveMemberAsync(Guid clanId, Guid userId)
    {
        var cutoff = Now - EventLasts;
        var eventIds = await _db.ClanEvents.Where(e => e.ClanId == clanId && e.StartsAt > cutoff).Select(e => e.Id).ToListAsync();
        _db.ClanRsvps.RemoveRange(await _db.ClanRsvps.Where(r => r.UserId == userId && eventIds.Contains(r.EventId)).ToListAsync());
        _db.ClanMembers.RemoveRange(await _db.ClanMembers.Where(m => m.ClanId == clanId && m.UserId == userId).ToListAsync());
        await _db.SaveChangesAsync();
    }

    /// <summary>The owner makes a member an admin, or an admin a member again.</summary>
    public async Task SetRoleAsync(Guid clanId, Guid userId, Guid targetId, string role)
    {
        var me = await RequireMemberAsync(clanId, userId);
        if (me.Role != ClanRoles.Owner) throw new ForbiddenGameActionException("Only the owner can choose admins.", "clan_owner_only");
        if (role is not (ClanRoles.Admin or ClanRoles.Member)) throw new GameException("Unknown role.", "clan_forbidden");
        var target = await _db.ClanMembers.FirstOrDefaultAsync(m => m.ClanId == clanId && m.UserId == targetId && m.Role != ClanRoles.Owner)
            ?? throw new GameException("That player isn't in the clan.", "clan_not_member");
        if (role == ClanRoles.Admin && await IsGuestAsync(targetId))
            throw new GameException("A guest has to sign in before they can be an admin.", "clan_guest_cannot_admin");
        target.Role = role;
        await _db.SaveChangesAsync();
    }

    /// <summary>Hands the clan to another member; the old owner stays on as an admin.</summary>
    public async Task TransferAsync(Guid clanId, Guid userId, Guid targetId)
    {
        var me = await _db.ClanMembers.FirstOrDefaultAsync(m => m.ClanId == clanId && m.UserId == userId);
        if (me?.Role != ClanRoles.Owner) throw new ForbiddenGameActionException("Only the owner can hand over the clan.", "clan_owner_only");
        var target = await _db.ClanMembers.FirstOrDefaultAsync(m => m.ClanId == clanId && m.UserId == targetId && m.UserId != userId)
            ?? throw new GameException("That player isn't in the clan.", "clan_not_member");
        if (await IsGuestAsync(targetId))
            throw new GameException("A guest has to sign in before they can own a clan.", "clan_guest_cannot_admin");
        me.Role = ClanRoles.Admin;
        target.Role = ClanRoles.Owner;
        (await _db.Clans.FirstAsync(c => c.Id == clanId)).OwnerId = targetId;
        await _db.SaveChangesAsync();
    }

    // ------------------------------------------------------------------ chat and announcements

    /// <summary>The newest messages, or with <paramref name="after"/> only newer ones (the app polls
    /// while the chat is open). Reading marks them as seen. Messages from players you blocked are hidden.</summary>
    public async Task<IReadOnlyList<ClanMessageDto>> GetMessagesAsync(Guid clanId, Guid userId, long? after)
    {
        var me = await _db.ClanMembers.FirstOrDefaultAsync(m => m.ClanId == clanId && m.UserId == userId)
            ?? throw new ForbiddenGameActionException("You're not in this clan.", "clan_not_member");
        var blocked = await _db.PlayerBlocks.AsNoTracking().Where(b => b.UserId == userId).Select(b => b.BlockedUserId).ToListAsync();
        var query = _db.ClanMessages.AsNoTracking().Where(m => m.ClanId == clanId && !blocked.Contains(m.UserId));
        var messages = after is { } a
            ? await query.Where(m => m.Id > a).OrderBy(m => m.Id).Take(100).ToListAsync()
            : (await query.OrderByDescending(m => m.Id).Take(60).ToListAsync()).OrderBy(m => m.Id).ToList();
        if (messages.Count > 0 && messages[^1].Id > me.LastReadMessageId)
        {
            me.LastReadMessageId = messages[^1].Id;
            await _db.SaveChangesAsync();
        }
        var people = await PeopleAsync(messages.Select(m => m.UserId));
        return messages.Select(m => Message(m, people, userId)).ToList();
    }

    public async Task<ClanMessageDto> PostAsync(Guid clanId, Guid userId, string username, ClanPostRequest request)
    {
        var me = await RequireMemberAsync(clanId, userId);
        string text = (request.Text ?? string.Empty).Trim();
        if (text.Length == 0) throw new GameException("Write something first.", "clan_message_empty");
        if (text.Length > MaxMessageLength) text = text[..MaxMessageLength];
        if (request.Announce && !ClanRoles.CanManage(me.Role))
            throw new ForbiddenGameActionException("Only the owner and admins can post announcements.", "clan_forbidden");
        var since = Now - ChatWindow;
        if (await _db.ClanMessages.CountAsync(m => m.ClanId == clanId && m.UserId == userId && m.CreatedAt > since) >= ChatPerWindow)
            throw new GameException("You're sending messages too fast.", "clan_slow_down");

        var message = new ClanMessageRecord { ClanId = clanId, UserId = userId, Text = text, IsAnnouncement = request.Announce, CreatedAt = Now };
        _db.ClanMessages.Add(message);
        await _db.SaveChangesAsync();
        var tracked = await _db.ClanMembers.FirstAsync(m => m.ClanId == clanId && m.UserId == userId);
        tracked.LastReadMessageId = message.Id;
        await _db.SaveChangesAsync();

        if (request.Announce)
        {
            var clan = await _db.Clans.AsNoTracking().FirstAsync(c => c.Id == clanId);
            string preview = text.Length > 90 ? text[..90] + "…" : text;
            var push = new PushText($"{clan.Name}: {preview}", $"{clan.Name}: {preview}");
            foreach (var id in await MemberIdsAsync(clanId, except: userId)) await _push.NotifyAsync(id, push, "/clan");
        }
        return Message(message, await PeopleAsync([userId]), userId);
    }

    /// <summary>Deletes a message: your own, or anyone's if you run the clan.</summary>
    public async Task DeleteMessageAsync(Guid clanId, Guid userId, long messageId)
    {
        var me = await RequireMemberAsync(clanId, userId);
        var message = await _db.ClanMessages.FirstOrDefaultAsync(m => m.ClanId == clanId && m.Id == messageId);
        if (message is null) return;
        if (message.UserId != userId && !ClanRoles.CanManage(me.Role))
            throw new ForbiddenGameActionException("You can only delete your own messages.", "clan_forbidden");
        _db.ClanMessages.Remove(message);
        await _db.SaveChangesAsync();
    }

    // ------------------------------------------------------------------ game nights

    public async Task<ClanDetailDto> CreateEventAsync(Guid clanId, Guid userId, ClanEventRequest request)
    {
        await RequireManagerAsync(clanId, userId);
        string title = (request.Title ?? string.Empty).Trim();
        if (title.Length == 0) throw new GameException("Give the game night a name.", "clan_event_invalid");
        if (title.Length > 40) title = title[..40];
        string? note = request.Note?.Trim();
        if (note is { Length: > 200 }) note = note[..200];
        var startsAt = request.StartsAt.UtcDateTime;
        var now = Now;
        if (startsAt < now.AddMinutes(5) || startsAt > now.AddDays(30))
            throw new GameException("Pick a time between 5 minutes and 30 days from now.", "clan_event_invalid_time");
        var cutoff = now - EventLasts;
        if (await _db.ClanEvents.CountAsync(e => e.ClanId == clanId && !e.Cancelled && e.StartsAt > cutoff) >= MaxUpcomingEvents)
            throw new GameException("The clan already has enough game nights planned.", "clan_event_too_many");

        var ev = new ClanEventRecord
        {
            ClanId = clanId, CreatedBy = userId, Title = title, Note = string.IsNullOrEmpty(note) ? null : note,
            StartsAt = startsAt, Seats = Math.Clamp(request.Seats, 4, 20), RepeatWeekly = request.RepeatWeekly, CreatedAt = now,
            // A night planned less than an hour ahead gets no "in an hour" reminder.
            HourReminderSent = startsAt - now <= TimeSpan.FromHours(1),
        };
        _db.ClanEvents.Add(ev);
        await _db.SaveChangesAsync();
        // Whoever planned it is coming.
        _db.ClanRsvps.Add(new ClanRsvpRecord { EventId = ev.Id, UserId = userId, Answer = ClanRsvpAnswers.Yes, UpdatedAt = now });
        await _db.SaveChangesAsync();

        var clan = await _db.Clans.AsNoTracking().FirstAsync(c => c.Id == clanId);
        var text = new PushText($"{clan.Name} planned a game night: {title}. Are you coming?", $"اکیپ {clan.Name} یک شب بازی گذاشت: {title}. می‌آیی؟");
        foreach (var id in await MemberIdsAsync(clanId, except: userId)) await _push.NotifyAsync(id, text, "/clan");
        return await GetAsync(clanId, userId);
    }

    public async Task CancelEventAsync(Guid clanId, Guid userId, long eventId)
    {
        await RequireManagerAsync(clanId, userId);
        var ev = await _db.ClanEvents.FirstOrDefaultAsync(e => e.Id == eventId && e.ClanId == clanId && !e.Cancelled)
            ?? throw new GameException("That game night is gone.", "clan_event_gone");
        ev.Cancelled = true;
        await _db.SaveChangesAsync();
        bool upcoming = ev.StartsAt > Now;
        if (!upcoming) return;
        var coming = await _db.ClanRsvps.Where(r => r.EventId == eventId && r.Answer != ClanRsvpAnswers.No && r.UserId != userId).Select(r => r.UserId).ToListAsync();
        var text = new PushText($"Game night cancelled: {ev.Title}.", $"شب بازی «{ev.Title}» لغو شد.");
        foreach (var id in coming) await _push.NotifyAsync(id, text, "/clan");
    }

    public async Task RsvpAsync(Guid clanId, Guid userId, long eventId, string? answer)
    {
        await RequireMemberAsync(clanId, userId);
        if (!ClanRsvpAnswers.IsValid(answer)) throw new GameException("Unknown answer.", "clan_event_invalid");
        var ev = await _db.ClanEvents.AsNoTracking().FirstOrDefaultAsync(e => e.Id == eventId && e.ClanId == clanId && !e.Cancelled)
            ?? throw new GameException("That game night is gone.", "clan_event_gone");
        if (ev.StartsAt + EventLasts < Now) throw new GameException("That game night is over.", "clan_event_closed");
        var rsvp = await _db.ClanRsvps.FirstOrDefaultAsync(r => r.EventId == eventId && r.UserId == userId);
        if (rsvp is null) _db.ClanRsvps.Add(new ClanRsvpRecord { EventId = eventId, UserId = userId, Answer = answer!, UpdatedAt = Now });
        else if (rsvp.Answer != answer)
        {
            rsvp.Answer = answer!;
            // Changing your answer puts you at the back of the line for a seat.
            rsvp.UpdatedAt = Now;
        }
        await _db.SaveChangesAsync();
    }

    /// <summary>Takes a seat at a game night's table. The first member to arrive opens the table and
    /// hosts it; everyone after joins the same one.</summary>
    public async Task<Guid> TakeEventSeatAsync(Guid clanId, Guid userId, string username, long eventId)
    {
        await RequireMemberAsync(clanId, userId);
        await EventTableGate.WaitAsync();
        try
        {
            var ev = await _db.ClanEvents.FirstOrDefaultAsync(e => e.Id == eventId && e.ClanId == clanId && !e.Cancelled)
                ?? throw new GameException("That game night is gone.", "clan_event_gone");
            var now = Now;
            if (now < ev.StartsAt - EventOpensBefore) throw new GameException("The table opens 15 minutes before the start.", "clan_event_not_yet");
            if (now > ev.StartsAt + EventLasts) throw new GameException("That game night is over.", "clan_event_closed");

            if (ev.GameId is { } existing && await _sessions.GetAsync(existing) is { } game && game.CurrentPhase != GamePhase.Ended)
            {
                bool seated = game.GetPlayer(PlayerIdentity.DeriveId(existing, userId)) is not null;
                if (seated) return existing;
                if (game.CurrentPhase != GamePhase.Lobby) throw new GameException("The game already started.", "clan_event_started");
                await _games.JoinGameAsync(existing, userId, username);
                return existing;
            }

            var gameId = await _games.CreateGameAsync(userId, username, new TableOptions(ev.Title, false, ev.Seats, null, clanId));
            ev.GameId = gameId;
            await _db.SaveChangesAsync();
            return gameId;
        }
        finally
        {
            EventTableGate.Release();
        }
    }

    /// <summary>Opens a clan table right now. Members are told, at most once every 20 minutes.</summary>
    public async Task<Guid> OpenTableAsync(Guid clanId, Guid userId, string username, ClanTableRequest request)
    {
        await RequireMemberAsync(clanId, userId);
        var clan = await _db.Clans.FirstAsync(c => c.Id == clanId);
        string? name = string.IsNullOrWhiteSpace(request.Name) ? clan.Name : request.Name.Trim();
        var gameId = await _games.CreateGameAsync(userId, username, new TableOptions(name, false, request.Seats, request.Rules, clanId));

        var now = Now;
        if (clan.LastTableNoticeAt is null || now - clan.LastTableNoticeAt >= TableNoticeGap)
        {
            clan.LastTableNoticeAt = now;
            await _db.SaveChangesAsync();
            var text = new PushText($"{Clip(username)} opened a {clan.Name} table. Tap to sit down.",
                $"{Clip(username)} یک میز برای اکیپ {clan.Name} باز کرد. برای نشستن بزنید.");
            foreach (var id in await MemberIdsAsync(clanId, except: userId)) await _push.NotifyAsync(id, text, $"/g/{gameId}");
        }
        return gameId;
    }

    // ------------------------------------------------------------------ ranking

    /// <summary>Members ranked on the Mafia games they finished at this clan's tables: 3 points a
    /// win, 1 for every game played, 2 more for each MVP. <paramref name="period"/> "month" counts
    /// the last 30 days; anything else counts every clan game.</summary>
    public async Task<ClanRankingDto> GetRankingAsync(Guid clanId, Guid userId, string? period)
    {
        await RequireMemberAsync(clanId, userId);
        bool month = period == "month";
        var since = month ? Now.AddDays(-30) : DateTime.MinValue;
        var members = await _db.ClanMembers.AsNoTracking().Where(m => m.ClanId == clanId).Select(m => m.UserId).ToListAsync();
        var clanGames = _db.MafiaTables.Where(t => t.ClanId == clanId).Select(t => t.GameId);
        var rows = await _db.GamePlayers.AsNoTracking()
            .Where(p => p.UserId != null && members.Contains(p.UserId.Value) && clanGames.Contains(p.GameRecordId)
                && p.GameRecord.Status != "Cancelled" && p.GameRecord.EndedAt >= since)
            .Select(p => new { UserId = p.UserId!.Value, p.Won, p.IsMvp })
            .ToListAsync();
        int gamesPlayed = await _db.Games.CountAsync(g => clanGames.Contains(g.Id) && g.Status != "Cancelled" && g.EndedAt >= since);

        var people = await PeopleAsync(members);
        var ranked = rows.GroupBy(r => r.UserId)
            .Select(g =>
            {
                int games = g.Count(), wins = g.Count(r => r.Won == true), mvps = g.Count(r => r.IsMvp);
                return new { g.Key, Games = games, Wins = wins, Mvps = mvps, Points = wins * 3 + games + mvps * 2 };
            })
            .OrderByDescending(r => r.Points).ThenByDescending(r => r.Wins).ThenBy(r => r.Games).ThenBy(r => people[r.Key].Name)
            .ToList();

        var result = new List<ClanRankRowDto>();
        int rank = 0, previousPoints = -1;
        for (int i = 0; i < ranked.Count; i++)
        {
            var r = ranked[i];
            if (r.Points != previousPoints) rank = i + 1;
            previousPoints = r.Points;
            result.Add(new ClanRankRowDto(rank, r.Key, people[r.Key].Name, r.Games, r.Wins, r.Mvps, r.Points, r.Key == userId));
        }
        return new ClanRankingDto(month ? "month" : "all", gamesPlayed, result, members.Count - result.Count);
    }

    // ------------------------------------------------------------------ admin console

    public async Task<IReadOnlyList<AdminClanDto>> AdminListAsync(string? search)
    {
        var query = _db.Clans.AsNoTracking();
        string key = (search ?? string.Empty).Trim().ToLowerInvariant();
        if (key.Length > 0) query = query.Where(c => c.NameKey.Contains(key));
        var clans = await query.OrderByDescending(c => c.CreatedAt).Take(200).ToListAsync();
        var ids = clans.Select(c => c.Id).ToList();
        var counts = await _db.ClanMembers.AsNoTracking().Where(m => ids.Contains(m.ClanId))
            .GroupBy(m => m.ClanId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count);
        var gameCounts = await _db.MafiaTables.AsNoTracking().Where(t => t.ClanId != null && ids.Contains(t.ClanId.Value))
            .GroupBy(t => t.ClanId!.Value).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count);
        var owners = await PeopleAsync(clans.Select(c => c.OwnerId));
        return clans.Select(c => new AdminClanDto(c.Id, c.Name, c.Bio, c.Emblem, c.Color, c.IsListed, owners[c.OwnerId].Name, c.OwnerId,
            counts.GetValueOrDefault(c.Id), gameCounts.GetValueOrDefault(c.Id), c.CreatedAt)).ToList();
    }

    public async Task<bool> AdminDeleteAsync(Guid clanId)
    {
        if (!await _db.Clans.AnyAsync(c => c.Id == clanId)) return false;
        await RemoveClanAsync(clanId);
        return true;
    }

    // ------------------------------------------------------------------ helpers

    private async Task<ClanMemberRecord> RequireMemberAsync(Guid clanId, Guid userId) =>
        await _db.ClanMembers.AsNoTracking().FirstOrDefaultAsync(m => m.ClanId == clanId && m.UserId == userId)
            ?? throw new ForbiddenGameActionException("You're not in this clan.", "clan_not_member");

    private async Task<ClanMemberRecord> RequireManagerAsync(Guid clanId, Guid userId)
    {
        var me = await RequireMemberAsync(clanId, userId);
        if (!ClanRoles.CanManage(me.Role)) throw new ForbiddenGameActionException("Only the owner and admins can do that.", "clan_forbidden");
        return me;
    }

    private async Task EnsureNotInClanAsync(Guid userId)
    {
        if (await _db.ClanMembers.AnyAsync(m => m.UserId == userId))
            throw new GameException("Leave your clan before joining another one.", "clan_already_in_clan");
    }

    private async Task EnsureRoomAsync(Guid clanId)
    {
        if (await _db.ClanMembers.CountAsync(m => m.ClanId == clanId) >= MaxMembers)
            throw new GameException($"A clan can have up to {MaxMembers} members.", "clan_full");
    }

    private async Task<(string Name, string Key)> CheckNameAsync(string? raw, Guid? clanId)
    {
        string name = string.Join(' ', (raw ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries));
        if (name.Length is < 3 or > 24) throw new GameException("A clan name needs 3 to 24 characters.", "clan_name_invalid");
        string key = name.ToLowerInvariant();
        if (await _db.Clans.AnyAsync(c => c.NameKey == key && c.Id != clanId))
            throw new GameException("Another clan already has that name.", "clan_name_taken");
        return (name, key);
    }

    private async Task<ClanRecord> ByCodeAsync(string code)
    {
        string key = NormalizeCode(code);
        return await _db.Clans.AsNoTracking().FirstOrDefaultAsync(c => c.InviteCode == key && key != "")
            ?? throw new GameException("That clan invite doesn't work any more.", "clan_invite_invalid");
    }

    public static string NormalizeCode(string input)
    {
        string s = Uri.UnescapeDataString(input ?? string.Empty).Trim();
        int at = s.IndexOf("/c/", StringComparison.OrdinalIgnoreCase);
        if (at >= 0) s = s[(at + "/c/".Length)..].Split('/', '?', '#')[0];
        s = s.ToUpperInvariant();
        return s.Length is >= 4 and <= 8 && s.All(char.IsLetterOrDigit) ? s : string.Empty;
    }

    private async Task<bool> IsGuestAsync(Guid userId) =>
        await _db.Users.AsNoTracking().Where(u => u.Id == userId).Select(u => (bool?)u.IsGuest).FirstOrDefaultAsync() ?? true;

    private Task<List<Guid>> MemberIdsAsync(Guid clanId, Guid except) =>
        _db.ClanMembers.Where(m => m.ClanId == clanId && m.UserId != except).Select(m => m.UserId).ToListAsync();

    private Task<List<Guid>> ManagerIdsAsync(Guid clanId) =>
        _db.ClanMembers.Where(m => m.ClanId == clanId && (m.Role == ClanRoles.Owner || m.Role == ClanRoles.Admin)).Select(m => m.UserId).ToListAsync();

    private static int RoleOrder(string role) => role switch { ClanRoles.Owner => 0, ClanRoles.Admin => 1, _ => 2 };

    private sealed record Person(string Name, int Level, bool Online, bool IsGuest);

    private async Task<Dictionary<Guid, Person>> PeopleAsync(IEnumerable<Guid> ids)
    {
        var list = ids.Distinct().ToList();
        var stats = await _db.PlayerStats.AsNoTracking().Where(s => list.Contains(s.UserId)).ToDictionaryAsync(s => s.UserId);
        var users = await _db.Users.AsNoTracking().Where(u => list.Contains(u.Id)).ToDictionaryAsync(u => u.Id);
        var now = Now;
        return list.ToDictionary(id => id, id =>
        {
            var s = stats.GetValueOrDefault(id);
            var u = users.GetValueOrDefault(id);
            string name = s?.Username is { Length: > 0 } n ? n : u?.DisplayName ?? "?";
            return new Person(name, Progression.Level(s?.Xp ?? 0).Level, u is not null && now - u.LastSeenAt <= FriendService.OnlineWindow, u?.IsGuest ?? true);
        });
    }

    private static ClanMessageDto Message(ClanMessageRecord m, IReadOnlyDictionary<Guid, Person> people, Guid userId) =>
        new(m.Id, m.UserId, people.TryGetValue(m.UserId, out var p) ? p.Name : "?", m.Text, m.IsAnnouncement, m.CreatedAt, m.UserId == userId);

    private static ClanSummaryDto Summary(ClanRecord c, int members, bool requested) =>
        new(c.Id, c.Name, c.Bio, c.Emblem, c.Color, c.IsListed, members, MaxMembers, requested);

    private async Task<string> NewCodeAsync()
    {
        while (true)
        {
            var code = string.Create(6, 0, (span, _) =>
            {
                for (int i = 0; i < span.Length; i++) span[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
            });
            if (!await _db.Clans.AnyAsync(c => c.InviteCode == code)) return code;
        }
    }

    private static string Clip(string name) => string.IsNullOrWhiteSpace(name) ? "A member" : name.Trim().Length > 24 ? name.Trim()[..24] : name.Trim();
}

public sealed record ClanEditRequest(string? Name, string? Bio, string? Emblem, string? Color, bool IsListed);
public sealed record ClanPostRequest(string? Text, bool Announce);
public sealed record ClanEventRequest(string? Title, string? Note, DateTimeOffset StartsAt, int Seats, bool RepeatWeekly);
public sealed record ClanRsvpRequest(string? Answer);
public sealed record ClanRoleRequest(string Role);
public sealed record ClanTableRequest(string? Name, int? Seats, TableRules? Rules = null);
public sealed record ClanGameDto(Guid GameId);

public sealed record ClanNextEventDto(long Id, string Title, DateTime StartsAt);
public sealed record ClanBadgeDto(Guid Id, string Name, string Emblem, string Color, string Role, int Members, int Unread, int Requests, ClanNextEventDto? NextEvent);
public sealed record ClanMeDto(ClanBadgeDto? Clan, IReadOnlyList<Guid> RequestedClanIds);
public sealed record ClanSummaryDto(Guid Id, string Name, string? Bio, string Emblem, string Color, bool IsListed, int Members, int MaxMembers, bool Requested);
public sealed record ClanInvitePreviewDto(ClanSummaryDto Clan, bool IsMember, bool InAnotherClan, bool Banned);
public sealed record ClanMemberDto(Guid UserId, string Name, string Role, int Level, bool Online, bool IsGuest, DateTime JoinedAt);
public sealed record ClanRequestDto(Guid UserId, string Name, int Level, DateTime CreatedAt);
public sealed record ClanMessageDto(long Id, Guid UserId, string Name, string Text, bool IsAnnouncement, DateTime CreatedAt, bool Mine);
public sealed record ClanPersonDto(Guid UserId, string Name);
public sealed record ClanEventDto(long Id, string Title, string? Note, DateTime StartsAt, int Seats, bool RepeatWeekly, string? CreatedBy,
    string? YourAnswer, IReadOnlyList<ClanPersonDto> Going, IReadOnlyList<ClanPersonDto> Maybe, int NotComing, bool TableOpen, Guid? GameId);
public sealed record ClanTableDto(Guid GameId, string? Name, string Host, bool InLobby, int Seated, int MaxPlayers, bool YouAreSeated);
public sealed record ClanDetailDto(Guid Id, string Name, string? Bio, string Emblem, string Color, bool IsListed, int MaxMembers, DateTime CreatedAt,
    string YourRole, string InviteCode, IReadOnlyList<ClanMemberDto> Members, IReadOnlyList<ClanRequestDto> Requests,
    ClanMessageDto? Announcement, IReadOnlyList<ClanEventDto> Events, IReadOnlyList<ClanTableDto> Tables, int Unread);
public sealed record ClanRankRowDto(int Rank, Guid UserId, string Name, int Games, int Wins, int Mvps, int Points, bool IsYou);
/// <summary><paramref name="Unranked"/>: members with no clan games in the period yet.</summary>
public sealed record ClanRankingDto(string Period, int ClanGames, IReadOnlyList<ClanRankRowDto> Rows, int Unranked);
public sealed record AdminClanDto(Guid Id, string Name, string? Bio, string Emblem, string Color, bool IsListed, string Owner, Guid OwnerId, int Members, int Tables, DateTime CreatedAt);
