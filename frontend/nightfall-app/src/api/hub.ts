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
  name: string | null;
  chatTitle: string | null;
  host: string | null;
  isOpen: boolean;
  phase: GamePhase;
  round: number;
  seated: number;
  maxPlayers: number;
  minPlayers: number;
  createdAt: string;
  players: string[];
  youAreSeated: boolean;
}

/** A group you can start a table in. */
export interface TableGroup {
  telegramChatId: number;
  title: string | null;
  players: number;
  since: string | null;
  activeGameId: string | null;
}

export interface TableInfo {
  gameId: string;
  name: string | null;
  chatTitle: string | null;
  isOpen: boolean;
  isHost: boolean;
  /** Only the host gets the code. */
  inviteCode: string | null;
}

export interface Home {
  streak: number;
  date: string;
  daily: DailyStatus[];
  mergeBest: number | null;
  league: { season: number; daysLeft: number; division: string; tier: number; rank: number | null; playerCount: number; zone: string | null };
  table: Table | null;
  /** Open lobbies with a free seat, across all groups. */
  openTables: number;
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
  /** Solved games counted by their detail value (Ladder: steps over par). */
  solvedByDetail: Record<string, number>;
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
  tables: (scope: "open" | "groups") => api.request<Table[]>("GET", `/api/tables?scope=${scope}`),
  tableGroups: () => api.request<TableGroup[]>("GET", "/api/tables/groups"),
  createTable: (body: { telegramChatId: number; name: string | null; isOpen: boolean; seats: number }) =>
    api.request<{ gameId: string }>("POST", "/api/tables", body),
  resolveTable: (code: string) => api.request<{ gameId: string }>("GET", `/api/tables/code/${encodeURIComponent(code)}`),
  tableInfo: (gameId: string) => api.request<TableInfo>("GET", `/api/tables/${gameId}`),
  setTableOpen: (gameId: string, isOpen: boolean) => api.request<TableInfo>("PUT", `/api/tables/${gameId}/open`, { isOpen }),
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
