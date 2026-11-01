import type { BazimoonApiClient } from "./client";

export interface CoupleInvite {
  token: string;
  expiresAt: string;
}

export interface CoupleToday {
  number: number;
  setId: number;
  youDone: boolean;
  partnerDone: boolean;
  youNudged: boolean;
}

export interface CoupleHistoryDay {
  number: number;
  setId: number;
  date: string;
  score: number;
  matches: boolean[];
}

/** Points earned towards the next couple level and what it costs (both 0 at the top level). */
export interface CoupleLevel {
  level: number;
  maxLevel: number;
  points: number;
  cost: number;
}

/** Lifetime totals the app turns into couple badges. */
export interface CoupleStats {
  bestStreak: number;
  daysPlayed: number;
  totalMatches: number;
  perfectDays: number;
}

export interface Couple {
  partnerId: number;
  partnerName: string;
  togetherDays: number;
  streak: number;
  matchRate: number;
  level: number;
  reminderTime: string;
  language: "en" | "fa";
  today: CoupleToday;
  history: CoupleHistoryDay[];
  progress: CoupleLevel;
  stats: CoupleStats;
}

export interface CoupleState {
  status: "none" | "pending" | "active";
  invite: CoupleInvite | null;
  couple: Couple | null;
}

export interface CoupleInvitePreview {
  status: "open" | "own" | "joined" | "used" | "expired" | "invalid";
  inviterName: string | null;
}

/** One day's quiz: six option indexes per person (-1 = skipped), three about them then three guesses. */
export interface CoupleDay {
  number: number;
  setId: number;
  partnerName: string;
  revealed: boolean;
  youDone: boolean;
  partnerDone: boolean;
  yourAnswers: number[] | null;
  partnerAnswers: number[] | null;
  matches: boolean[] | null;
  streak: number;
  level: number;
  xpEach: number;
  youNudged: boolean;
  progress: CoupleLevel;
}

export const coupleApi = (api: BazimoonApiClient) => ({
  state: () => api.request<CoupleState>("GET", "/api/couple"),
  invite: () => api.request<CoupleState>("POST", "/api/couple/invite"),
  cancelInvite: () => api.request<void>("DELETE", "/api/couple/invite"),
  preview: (token: string) => api.request<CoupleInvitePreview>("GET", `/api/couple/invite/${encodeURIComponent(token)}`),
  accept: (token: string) => api.request<CoupleState>("POST", `/api/couple/invite/${encodeURIComponent(token)}/accept`),
  answer: (number: number, answers: number[]) => api.request<CoupleDay>("POST", "/api/couple/answers", { number, answers }),
  day: (number: number) => api.request<CoupleDay>("GET", `/api/couple/days/${number}`),
  nudge: () => api.request<void>("POST", "/api/couple/nudge"),
  leave: () => api.request<void>("POST", "/api/couple/leave"),
  settings: (settings: { reminderTime?: string; language?: "en" | "fa" }) => api.request<CoupleState>("PUT", "/api/couple/settings", settings),
});
