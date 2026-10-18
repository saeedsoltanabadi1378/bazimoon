import type { Language } from "../i18n/LanguageContext";

const locale = (language: Language) => (language === "fa" ? "fa-IR" : "en-GB");

/** 42_000 → "0:42", 130_000 → "2:10". Digits follow the language. */
export function formatClock(ms: number | null | undefined, language: Language = "en") {
  if (ms === null || ms === undefined) return "—";
  const total = Math.max(0, Math.floor(ms / 1000));
  const text = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  return language === "fa" ? toPersianDigits(text) : text;
}

export function toPersianDigits(text: string) {
  return text.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/** "Tue 13 Oct" from an ISO date (yyyy-mm-dd). */
export function formatShortDate(iso: string, language: Language) {
  const date = new Date(`${iso}T12:00:00Z`);
  return date.toLocaleDateString(locale(language), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function formatMonth(year: number, month: number, language: Language) {
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString(locale(language), { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatTimeOfDay(iso: string, language: Language) {
  return new Date(iso).toLocaleTimeString(locale(language), { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Today's date in puzzle time (Tehran, UTC+03:30) — matches the server's daily rollover. */
export function puzzleToday(now = new Date()) {
  const shifted = new Date(now.getTime() + 210 * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** Milliseconds until the next daily puzzle (midnight Tehran time). */
export function msUntilNextPuzzle(now = new Date()) {
  const shifted = now.getTime() + 210 * 60_000;
  const nextMidnight = Math.floor(shifted / 86_400_000) * 86_400_000 + 86_400_000;
  return nextMidnight - shifted;
}

export function formatCountdown(ms: number, language: Language) {
  const minutes = Math.floor(ms / 60_000);
  const text = `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
  return language === "fa" ? toPersianDigits(text) : text;
}
