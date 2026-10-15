// Mirrors Nightfall.Api.Lounge DTOs (camelCase JSON).
import type { NightfallApiClient } from "./client";
import type { GamePhase, Role } from "./types";

export interface Settings {
  language: "en" | "fa";
  reminderEnabled: boolean;
  reminderTime: string;
  highContrast: boolean;
  haptics: boolean;
}

export interface Profile {
  name: string;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  xp: number;
  division: string;
  tier: number;
  mafia: {
    rating: number;
    gamesThisSeason: number;
    games: number;
    winRate: number;
    bestRole: Role | null;
    asTown: { games: number; winRate: number };
    asMafia: { games: number; winRate: number };
  };
  puzzles: { streak: number; bestStreak: number; solved: number; bestZipMs: number | null; streakFreezes: number };
  badges: { key: string; earned: boolean }[];
  settings: Settings;
}

export interface DailyStatus {
  game: string;
  number: number;
  played: boolean;
  solved: boolean;
  timeMs: number | null;
  moves: number | null;
}

export interface Table {
  gameId: string;
  phase: GamePhase;
  seated: number;
  maxPlayers: number;
  minPlayers: number;
  createdAt: string;
  players: string[];
  youAreSeated: boolean;
}

export interface Home {
  streak: number;
  date: string;
  daily: DailyStatus[];
  mergeBest: number | null;
  league: { season: number; daysLeft: number; division: string; tier: number; rank: number | null; playerCount: number; zone: string | null };
  table: Table | null;
}

export interface LeagueRow {
  rank: number;
  name: string;
  isYou: boolean;
  score: number;
  delta: number;
  games: number;
  winRateOrStreak: number;
  zone: "promotion" | "safe" | "relegation";
}

export interface League {
  board: "mafia" | "puzzles";
  season: number;
  daysLeft: number;
  division: string;
  tier: number;
  playerCount: number;
  you: { rank: number | null; score: number; third: number; zone: string | null };
  qualification: { played: number; needed: number };
  rows: LeagueRow[];
}

export interface PuzzleSubmit {
  game: string;
  mode: string;
  puzzleNumber?: number | null;
  solved: boolean;
  timeMs?: number | null;
  score?: number | null;
  moves?: number | null;
  detail?: number | null;
  hints?: number;
}

export interface PuzzleResult {
  xpGained: number;
  points: number;
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  levelBefore: number;
  xpIntoLevelBefore: number;
  streak: number;
  streakExtended: boolean;
  newBest: boolean;
  countedAsDaily: boolean;
  puzzleNumber: number | null;
  percentile: number | null;
}

export interface GameStats {
  game: string;
  played: number;
  solved: number;
  winRate: number;
  bestTimeMs: number | null;
  averageTimeMs: number | null;
  bestScore: number | null;
  averageScore: number | null;
  bestMoves: number | null;
  averageMoves: number;
  maxDetail: number | null;
  sumDetail: number;
  dailyStreak: number;
  winStreak: number;
  todayNumber: number | null;
  today: DailyStatus | null;
  winsByMode: Record<string, number>;
  bestTimeByMode: Record<string, number>;
  solvedByMoves: Record<string, number>;
}

export interface BoardRow {
  rank: number | null;
  name: string;
  isYou: boolean;
  solved: boolean;
  timeMs: number | null;
  score: number | null;
  moves: number | null;
}

export interface Board {
  game: string;
  number: number | null;
  solvedCount: number;
  rows: BoardRow[];
}

export interface Weekly {
  game: string;
  division: string;
  tier: number;
  daysLeft: number;
  yourRank: number | null;
  rows: { rank: number; name: string; isYou: boolean; score: number }[];
}

export interface ArchiveDay {
  day: number;
  number: number | null;
  status: "solved" | "missed" | "today" | "future" | "unavailable";
  timeMs: number | null;
}

export interface Archive {
  game: string;
  year: number;
  month: number;
  firstWeekday: number;
  days: ArchiveDay[];
}

export const hubApi = (api: NightfallApiClient) => ({
  profile: () => api.request<Profile>("GET", "/api/me/profile"),
  saveSettings: (settings: Settings) => api.request<Settings>("PUT", "/api/me/settings", settings),
  home: () => api.request<Home>("GET", "/api/hub/home"),
  tables: () => api.request<Table[]>("GET", "/api/hub/tables"),
  quickMatch: () => api.request<{ gameId: string }>("POST", "/api/hub/quick-match"),
  league: (board: "mafia" | "puzzles") => api.request<League>("GET", `/api/hub/league?board=${board}`),
  submit: (result: PuzzleSubmit) => api.request<PuzzleResult>("POST", "/api/puzzles/results", { hints: 0, ...result }),
  stats: (game: string) => api.request<GameStats>("GET", `/api/puzzles/${game}/stats`),
  board: (game: string, number?: number | null) =>
    api.request<Board>("GET", `/api/puzzles/${game}/board${number ? `?number=${number}` : ""}`),
  weekly: (game: string) => api.request<Weekly>("GET", `/api/puzzles/${game}/weekly`),
  archive: (game: string, year: number, month: number) =>
    api.request<Archive>("GET", `/api/puzzles/${game}/archive?year=${year}&month=${month}`),
});
