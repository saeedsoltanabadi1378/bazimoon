using Bazimoon.Infrastructure.Admin;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Bazimoon.Domain;
using Bazimoon.Infrastructure.History;
using Bazimoon.Infrastructure.Hub;

namespace Bazimoon.Api.Lounge;

/// <summary>Couple Quiz: invites, daily answers, the reveal once both partners finish, nudges and leaving.</summary>
public sealed class CoupleService
{
    private const string TokenAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const int HistoryDays = 14;

    private readonly BazimoonDbContext _db;
    private readonly TimeProvider _clock;
    private readonly ITelegramNotifier _notifier;

    private readonly IBotSettingsService _settings;

    public CoupleService(BazimoonDbContext db, TimeProvider clock, ITelegramNotifier notifier, IBotSettingsService settings)
    {
        _settings = settings;
        _db = db;
        _clock = clock;
        _notifier = notifier;
    }

    private DateTime Now => _clock.GetUtcNow().UtcDateTime;
    private int Today => Progression.PuzzleDay(_clock.GetUtcNow());

    /// <summary>The user's active couple, or their own pending invite if it has not expired.</summary>
    private async Task<CoupleRecord?> FindAsync(Guid userId)
    {
        var active = await _db.Couples.FirstOrDefaultAsync(c => c.PartnerId != null && (c.InviterId == userId || c.PartnerId == userId));
        if (active is not null) return active;
        var now = Now;
        return await _db.Couples.FirstOrDefaultAsync(c => c.PartnerId == null && c.InviterId == userId && c.InviteExpiresAt > now);
    }

    private async Task<string> NameOfAsync(Guid userId) =>
        await _db.PlayerStats.Where(s => s.UserId == userId).Select(s => s.Username).FirstOrDefaultAsync() ?? "?";

    public async Task<CoupleStateDto> GetStateAsync(Guid userId, string username)
    {
        await _db.GetOrCreateStatsAsync(userId, username);
        await _db.SaveChangesAsync();
        var couple = await FindAsync(userId);
        if (couple is null) return new CoupleStateDto("none", null, null);
        if (couple.PartnerId is null) return new CoupleStateDto("pending", new CoupleInviteDto(couple.InviteToken, couple.InviteExpiresAt), null);
        return new CoupleStateDto("active", null, await BuildCoupleAsync(couple, userId));
    }

    private async Task<CoupleDto> BuildCoupleAsync(CoupleRecord couple, Guid userId)
    {
        Guid partnerId = couple.InviterId == userId ? couple.PartnerId!.Value : couple.InviterId;
        int today = Today;
        int start = couple.StartDay ?? today;
        int number = CoupleRules.DayNumber(start, today);
        var answers = await _db.CoupleAnswers.Where(a => a.CoupleId == couple.Id && a.Day > today - HistoryDays - 1).ToListAsync();
        bool youDone = answers.Any(a => a.Day == today && a.UserId == userId);
        bool partnerDone = answers.Any(a => a.Day == today && a.UserId == partnerId);
        int? nudgedDay = couple.InviterId == userId ? couple.InviterNudgedDay : couple.PartnerNudgedDay;

        var history = answers
            .GroupBy(a => a.Day)
            .Where(g => g.Count() == 2 && g.Key < today)
            .OrderByDescending(g => g.Key)
            .Select(g =>
            {
                var mine = CoupleRules.Parse(g.First(a => a.UserId == userId).Answers);
                var theirs = CoupleRules.Parse(g.First(a => a.UserId == partnerId).Answers);
                var matches = CoupleRules.Matches(mine, theirs);
                int n = CoupleRules.DayNumber(start, g.Key);
                return new CoupleHistoryDto(n, CoupleRules.SetForDay(n), Progression.DateOfDay(g.Key), matches.Count(m => m), matches);
            })
            .ToList();

        return new CoupleDto(
            partnerId,
            await NameOfAsync(partnerId),
            today - start + 1,
            CoupleRules.CurrentStreak(couple.Streak, couple.LastBothDay, today),
            couple.TotalQuestions == 0 ? 0 : (int)Math.Round(100.0 * couple.TotalMatches / couple.TotalQuestions),
            CoupleRules.Level(couple.TotalMatches),
            couple.ReminderTime,
            couple.Language,
            new CoupleTodayDto(number, CoupleRules.SetForDay(number), youDone, partnerDone, nudgedDay == today),
            history);
    }

    private async Task EnsureOnAsync()
    {
        if (!(await _settings.GetAsync()).IsGameOn("couple")) throw new GameException("Couple Quiz is switched off for now.");
    }

    public async Task<CoupleStateDto> CreateInviteAsync(Guid userId, string username)
    {
        await EnsureOnAsync();
        await _db.GetOrCreateStatsAsync(userId, username);
        var existing = await FindAsync(userId);
        if (existing?.PartnerId is not null) throw new GameException("You are already in a couple space.");
        // Any older invite of yours (expired or not) is replaced by the new one.
        _db.Couples.RemoveRange(await _db.Couples.Where(c => c.InviterId == userId && c.PartnerId == null).ToListAsync());
        var couple = new CoupleRecord { InviterId = userId, InviteToken = NewToken(), InviteExpiresAt = Now + CoupleRules.InviteLifetime };
        _db.Couples.Add(couple);
        await _db.SaveChangesAsync();
        return new CoupleStateDto("pending", new CoupleInviteDto(couple.InviteToken, couple.InviteExpiresAt), null);
    }

    public async Task CancelInviteAsync(Guid userId)
    {
        _db.Couples.RemoveRange(await _db.Couples.Where(c => c.InviterId == userId && c.PartnerId == null).ToListAsync());
        await _db.SaveChangesAsync();
    }

    public async Task<CoupleInvitePreviewDto> GetInvitePreviewAsync(Guid userId, string token)
    {
        var couple = await _db.Couples.FirstOrDefaultAsync(c => c.InviteToken == token);
        if (couple is null) return new CoupleInvitePreviewDto("invalid", null);
        string inviter = await NameOfAsync(couple.InviterId);
        if (couple.InviterId == userId) return new CoupleInvitePreviewDto("own", inviter);
        if (couple.PartnerId is not null) return new CoupleInvitePreviewDto(couple.PartnerId == userId ? "joined" : "used", inviter);
        if (couple.InviteExpiresAt <= Now) return new CoupleInvitePreviewDto("expired", inviter);
        return new CoupleInvitePreviewDto("open", inviter);
    }

    public async Task<CoupleStateDto> AcceptAsync(Guid userId, string username, string token)
    {
        await EnsureOnAsync();
        await _db.GetOrCreateStatsAsync(userId, username);
        var couple = await _db.Couples.FirstOrDefaultAsync(c => c.InviteToken == token)
            ?? throw new GameException("This invite link is not valid.");
        if (couple.PartnerId == userId) return await GetStateAsync(userId, username);
        if (couple.InviterId == userId) throw new GameException("You cannot accept your own invite.");
        if (couple.PartnerId is not null) throw new GameException("This invite has already been used.");
        if (couple.InviteExpiresAt <= Now) throw new GameException("This invite has expired.");
        var mine = await FindAsync(userId);
        if (mine?.PartnerId is not null) throw new GameException("You are already in a couple space.");
        if (await _db.Couples.AnyAsync(c => c.PartnerId != null && (c.InviterId == couple.InviterId || c.PartnerId == couple.InviterId)))
            throw new GameException("Your partner is already in a couple space.");

        // Accepting someone's invite drops your own pending one.
        _db.Couples.RemoveRange(await _db.Couples.Where(c => c.InviterId == userId && c.PartnerId == null).ToListAsync());
        couple.PartnerId = userId;
        couple.AcceptedAt = Now;
        couple.StartDay = Today;
        couple.Language = (await _db.PlayerStats.FindAsync(couple.InviterId))?.Language ?? "en";
        await _db.SaveChangesAsync();
        await _notifier.NotifyAsync(couple.InviterId, $"{username} accepted your Couple Quiz invite. Today's questions are ready.", "couple");
        return await GetStateAsync(userId, username);
    }

    public async Task<CoupleDayDto> SubmitAnswersAsync(Guid userId, CoupleAnswersRequest request)
    {
        var couple = await RequireActiveAsync(userId);
        int today = Today;
        int number = CoupleRules.DayNumber(couple.StartDay!.Value, today);
        if (request.Number != number) throw new GameException("These questions are no longer open.");
        if (!CoupleRules.IsValid(request.Answers)) throw new GameException("Send six answers between -1 and 3.");
        if (await _db.CoupleAnswers.AnyAsync(a => a.CoupleId == couple.Id && a.Day == today && a.UserId == userId))
            throw new GameException("Your answers for today are already locked in.");

        _db.CoupleAnswers.Add(new CoupleAnswerRecord { CoupleId = couple.Id, Day = today, UserId = userId, Answers = CoupleRules.Format(request.Answers!) });
        Guid partnerId = couple.InviterId == userId ? couple.PartnerId!.Value : couple.InviterId;
        var partner = await _db.CoupleAnswers.FirstOrDefaultAsync(a => a.CoupleId == couple.Id && a.Day == today && a.UserId == partnerId);
        if (partner is not null)
        {
            // Second to finish: today's reveal opens for both, with the streak, totals and XP.
            var matches = CoupleRules.Matches(request.Answers!.ToArray(), CoupleRules.Parse(partner.Answers));
            couple.Streak = couple.LastBothDay == today - 1 ? couple.Streak + 1 : 1;
            couple.BestStreak = Math.Max(couple.BestStreak, couple.Streak);
            couple.LastBothDay = today;
            couple.TotalMatches += matches.Count(m => m);
            couple.TotalQuestions += matches.Length;
            foreach (var id in new[] { userId, partnerId })
            {
                if (await _db.PlayerStats.FindAsync(id) is { } stats)
                {
                    stats.Xp += CoupleRules.XpEach;
                    stats.UpdatedAt = Now;
                }
            }
        }
        await _db.SaveChangesAsync();
        if (partner is not null)
            await _notifier.NotifyAsync(partnerId, $"{await NameOfAsync(userId)} finished today's Couple Quiz. Your reveal is ready.", "couple");
        return await GetDayAsync(userId, number);
    }

    public async Task<CoupleDayDto> GetDayAsync(Guid userId, int number)
    {
        var couple = await RequireActiveAsync(userId);
        int start = couple.StartDay!.Value;
        int day = start + number - 1;
        if (number < 1 || day > Today) throw new GameException("That day has not happened yet.");
        Guid partnerId = couple.InviterId == userId ? couple.PartnerId!.Value : couple.InviterId;
        var rows = await _db.CoupleAnswers.Where(a => a.CoupleId == couple.Id && a.Day == day).ToListAsync();
        var mine = rows.FirstOrDefault(a => a.UserId == userId);
        var theirs = rows.FirstOrDefault(a => a.UserId == partnerId);
        int? nudgedDay = couple.InviterId == userId ? couple.InviterNudgedDay : couple.PartnerNudgedDay;
        int streak = CoupleRules.CurrentStreak(couple.Streak, couple.LastBothDay, Today);
        string partnerName = await NameOfAsync(partnerId);
        if (mine is null || theirs is null)
        {
            // Nobody peeks: the partner's answers stay hidden until both have finished.
            return new CoupleDayDto(number, CoupleRules.SetForDay(number), partnerName, false, mine is not null, theirs is not null,
                mine is null ? null : CoupleRules.Parse(mine.Answers), null, null, streak, CoupleRules.Level(couple.TotalMatches), CoupleRules.XpEach, nudgedDay == Today);
        }
        var a = CoupleRules.Parse(mine.Answers);
        var b = CoupleRules.Parse(theirs.Answers);
        return new CoupleDayDto(number, CoupleRules.SetForDay(number), partnerName, true, true, true, a, b, CoupleRules.Matches(a, b),
            streak, CoupleRules.Level(couple.TotalMatches), CoupleRules.XpEach, nudgedDay == Today);
    }

    public async Task NudgeAsync(Guid userId)
    {
        var couple = await RequireActiveAsync(userId);
        int today = Today;
        bool inviter = couple.InviterId == userId;
        Guid partnerId = inviter ? couple.PartnerId!.Value : couple.InviterId;
        if ((inviter ? couple.InviterNudgedDay : couple.PartnerNudgedDay) == today) throw new GameException("You already sent a reminder today.");
        if (await _db.CoupleAnswers.AnyAsync(a => a.CoupleId == couple.Id && a.Day == today && a.UserId == partnerId))
            throw new GameException("Your partner has already played today.");
        if (inviter) couple.InviterNudgedDay = today;
        else couple.PartnerNudgedDay = today;
        await _db.SaveChangesAsync();
        await _notifier.NotifyAsync(partnerId, $"{await NameOfAsync(userId)} played today's Couple Quiz and is waiting for you.", "couple");
    }

    public async Task LeaveAsync(Guid userId)
    {
        var couple = await FindAsync(userId);
        if (couple is null) return;
        Guid? partnerId = couple.PartnerId is null ? null : couple.InviterId == userId ? couple.PartnerId : couple.InviterId;
        _db.CoupleAnswers.RemoveRange(await _db.CoupleAnswers.Where(a => a.CoupleId == couple.Id).ToListAsync());
        _db.Couples.Remove(couple);
        await _db.SaveChangesAsync();
        if (partnerId is { } other)
            await _notifier.NotifyAsync(other, $"{await NameOfAsync(userId)} left your Couple Quiz space. Your shared history has been deleted.");
    }

    public async Task<CoupleStateDto> UpdateSettingsAsync(Guid userId, string username, CoupleSettingsRequest request)
    {
        var couple = await RequireActiveAsync(userId);
        if (request.ReminderTime is { } time)
        {
            if (!TimeOnly.TryParseExact(time, "HH:mm", out _)) throw new GameException("Reminder time must look like 21:00.");
            couple.ReminderTime = time;
        }
        if (request.Language is { } language)
        {
            if (language is not ("en" or "fa")) throw new GameException("Question language must be en or fa.");
            couple.Language = language;
        }
        await _db.SaveChangesAsync();
        return await GetStateAsync(userId, username);
    }

    private async Task<CoupleRecord> RequireActiveAsync(Guid userId)
    {
        var couple = await FindAsync(userId);
        if (couple?.PartnerId is null || couple.StartDay is null) throw new GameException("You are not in a couple space yet.");
        return couple;
    }

    private static string NewToken()
    {
        Span<char> chars = stackalloc char[10];
        for (int i = 0; i < chars.Length; i++) chars[i] = TokenAlphabet[RandomNumberGenerator.GetInt32(TokenAlphabet.Length)];
        return new string(chars);
    }
}
