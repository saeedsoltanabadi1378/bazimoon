using Bazimoon.Api.Auth;

namespace Bazimoon.Api.Lounge;

public static class CoupleEndpoints
{
    public static void MapCoupleEndpoints(this IEndpointRouteBuilder app)
    {
        var couple = app.MapGroup("/api/couple").RequireAuthorization();

        couple.MapGet("", (CoupleService service, HttpContext http) =>
            service.GetStateAsync(http.User.GetTelegramUserId(), http.User.GetTelegramUsername())).WithName("GetCouple");

        couple.MapPost("/invite", (CoupleService service, HttpContext http) =>
            service.CreateInviteAsync(http.User.GetTelegramUserId(), http.User.GetTelegramUsername())).WithName("CreateCoupleInvite");

        couple.MapDelete("/invite", async (CoupleService service, HttpContext http) =>
        {
            await service.CancelInviteAsync(http.User.GetTelegramUserId());
            return Results.NoContent();
        }).WithName("CancelCoupleInvite");

        couple.MapGet("/invite/{token}", (string token, CoupleService service, HttpContext http) =>
            service.GetInvitePreviewAsync(http.User.GetTelegramUserId(), token)).WithName("PreviewCoupleInvite");

        couple.MapPost("/invite/{token}/accept", (string token, CoupleService service, HttpContext http) =>
            service.AcceptAsync(http.User.GetTelegramUserId(), http.User.GetTelegramUsername(), token)).WithName("AcceptCoupleInvite");

        couple.MapPost("/answers", (CoupleAnswersRequest request, CoupleService service, HttpContext http) =>
            service.SubmitAnswersAsync(http.User.GetTelegramUserId(), request)).WithName("SubmitCoupleAnswers");

        couple.MapGet("/days/{number:int}", (int number, CoupleService service, HttpContext http) =>
            service.GetDayAsync(http.User.GetTelegramUserId(), number)).WithName("GetCoupleDay");

        couple.MapPost("/nudge", async (CoupleService service, HttpContext http) =>
        {
            await service.NudgeAsync(http.User.GetTelegramUserId());
            return Results.NoContent();
        }).WithName("NudgeCouplePartner");

        couple.MapPost("/leave", async (CoupleService service, HttpContext http) =>
        {
            await service.LeaveAsync(http.User.GetTelegramUserId());
            return Results.NoContent();
        }).WithName("LeaveCouple");

        couple.MapPut("/settings", (CoupleSettingsRequest request, CoupleService service, HttpContext http) =>
            service.UpdateSettingsAsync(http.User.GetTelegramUserId(), http.User.GetTelegramUsername(), request)).WithName("UpdateCoupleSettings");
    }
}

/// <summary>status is none, pending (your invite is out) or active.</summary>
public sealed record CoupleStateDto(string Status, CoupleInviteDto? Invite, CoupleDto? Couple);
public sealed record CoupleInviteDto(string Token, DateTime ExpiresAt);
/// <summary>status is open, own, joined, used, expired or invalid.</summary>
public sealed record CoupleInvitePreviewDto(string Status, string? InviterName);
public sealed record CoupleDto(
    long PartnerId, string PartnerName, int TogetherDays, int Streak, int MatchRate, int Level,
    string ReminderTime, string Language, CoupleTodayDto Today, IReadOnlyList<CoupleHistoryDto> History);
public sealed record CoupleTodayDto(int Number, int SetId, bool YouDone, bool PartnerDone, bool YouNudged);
public sealed record CoupleHistoryDto(int Number, int SetId, DateOnly Date, int Score, IReadOnlyList<bool> Matches);
/// <summary>One day's quiz. Partner answers and matches are only filled in once both have finished.
/// Answers are six option indexes (-1 = skipped): three about the person, then three guesses.</summary>
public sealed record CoupleDayDto(
    int Number, int SetId, string PartnerName, bool Revealed, bool YouDone, bool PartnerDone,
    IReadOnlyList<int>? YourAnswers, IReadOnlyList<int>? PartnerAnswers, IReadOnlyList<bool>? Matches,
    int Streak, int Level, int XpEach, bool YouNudged);
public sealed record CoupleAnswersRequest(int Number, IReadOnlyList<int>? Answers);
public sealed record CoupleSettingsRequest(string? ReminderTime, string? Language);
