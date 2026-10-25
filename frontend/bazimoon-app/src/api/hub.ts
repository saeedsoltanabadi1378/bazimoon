// Mirrors Bazimoon.Api.Lounge DTOs (camelCase JSON).
import type { BazimoonApiClient } from "./client";
import type { GamePhase, Role, RolePreset } from "./types";

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

export interface AchievementStatus {
  key: string;
  earnedAt: string | null;
  gameId: string | null;
  /** Counted achievements (Survivor): how far along you are. */
  progress: number | null;
  target: number | null;
}

export interface MafiaStats {
  games: number;
  byRole: { role: Role; games: number; winRate: number }[];
  /** Totals over the games that have a log (trackedGames); older games are left out. */
  skills: {
    trackedGames: number;
    checksMade: number;
    mafiaFound: number;
    doctorNights: number;
    killsBlocked: number;
    votesCast: number;
    votesOnMafia: number;
    nightsSurvived: number;
    mvpCount: number;
  };
  achievements: AchievementStatus[];
  recent: {
    gameId: string;
    role: Role | null;
    won: boolean;
    isMvp: boolean;
    endedAt: string;
    players: number;
    tableName: string | null;
    ratingDelta: number | null;
    hasRecap: boolean;
  }[];
}

export type GameEventKind = "Night" | "Vote" | "LastWords" | "Promoted" | "Left" | "Removed" | "MayorRevealed" | "Inquiry";

export interface GameEvent {
  kind: GameEventKind;
  round: number;
  playerId: string | null;
  killerId: string | null;
  killTarget: string | null;
  killed: string | null;
  doctorId: string | null;
  saved: string | null;
  detectiveId: string | null;
  checked: string | null;
  checkedIsMafia: boolean | null;
  voteRound: number;
  ballots: Record<string, string | null> | null;
  votedOut: string | null;
  tied: string[] | null;
  sniperId: string | null;
  shotTarget: string | null;
  shotOutcome: "Hit" | "Saved" | "Backfired" | null;
  silenced: string | null;
  dieHardSurvived: string | null;
}

export interface GameRecap {
  gameId: string;
  tableName: string | null;
  endedAt: string;
  result: "None" | "VillagersWin" | "MafiaWin" | "JokerWins";
  players: {
    playerId: string;
    name: string;
    role: Role | null;
    eliminatedBy: "Night" | "Vote" | "Left" | null;
    eliminatedRound: number | null;
    wasPromoted: boolean;
    isMvp: boolean;
    points: number | null;
  }[];
  events: GameEvent[];
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
  /** The table lets people without a seat watch. */
  allowSpectators: boolean;
  spectators: number;
  youAreWatching: boolean;
}

export interface TableInfo {
  gameId: string;
  name: string | null;
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
  /** Public lobbies with a free seat. */
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

/** Timers in seconds and rule switches for a new table. nightSeconds / votingSeconds of 0 mean the
 * creator moves that phase on by hand. */
export interface TableRules {
  speakerSeconds: number;
  challengeSeconds: number;
  defenceSeconds: number;
  lastWordsSeconds: number;
  nightSeconds: number;
  votingSeconds: number;
  lastWordsForNightKills: boolean;
  preset?: RolePreset;
  /** Custom only: Mafia-team players, including the Godfather and the Silencer. */
  mafiaCount?: number;
  /** Custom only: the optional roles that are on. */
  optionalRoles?: Role[];
  godfatherAppearsInnocent?: boolean;
  jokerWinEndsGame?: boolean;
  revealRolesOnDeath?: boolean;
  allowSpectators?: boolean;
}

export const hubApi = (api: BazimoonApiClient) => ({
  profile: () => api.request<Profile>("GET", "/api/me/profile"),
  mafiaStats: () => api.request<MafiaStats>("GET", "/api/me/mafia-stats"),
  recap: (gameId: string) => api.request<GameRecap>("GET", `/api/hub/games/${gameId}/recap`),
  saveSettings: (settings: Settings) => api.request<Settings>("PUT", "/api/me/settings", settings),
  /** Games an admin switched off; the app hides them. */
  config: () => api.request<{ disabledGames: string[] }>("GET", "/api/hub/config"),
  home: () => api.request<Home>("GET", "/api/hub/home"),
  /** "open": public tables; "mine": tables you host or have a seat at. */
  tables: (scope: "open" | "mine") => api.request<Table[]>("GET", `/api/tables?scope=${scope}`),
  /** isOpen: public (listed) or private (invite link or code only). */
  createTable: (body: { name: string | null; isOpen: boolean; seats: number; rules?: TableRules }) =>
    api.request<{ gameId: string }>("POST", "/api/tables", body),
  resolveTable: (code: string) => api.request<{ gameId: string }>("GET", `/api/tables/code/${encodeURIComponent(code)}`),
  tableInfo: (gameId: string) => api.request<TableInfo>("GET", `/api/tables/${gameId}`),
  setTableOpen: (gameId: string, isOpen: boolean) => api.request<TableInfo>("PUT", `/api/tables/${gameId}/open`, { isOpen }),
  quickMatch: () => api.request<{ gameId: string }>("POST", "/api/hub/quick-match"),
  league: (board: "mafia" | "puzzles") => api.request<League>("GET", `/api/hub/league?board=${board}`),
  submit: (result: PuzzleSubmit) => api.request<PuzzleResult>("POST", "/api/puzzles/results", { hints: 0, ...result }),
  stats: (game: string) => api.request<GameStats>("GET", `/api/puzzles/${game}/stats`),
  board: (game: string, number?: number | null, mode?: string) => {
    const query = [number ? `number=${number}` : "", mode ? `mode=${encodeURIComponent(mode)}` : ""].filter(Boolean).join("&");
    return api.request<Board>("GET", `/api/puzzles/${game}/board${query ? `?${query}` : ""}`);
  },
  weekly: (game: string) => api.request<Weekly>("GET", `/api/puzzles/${game}/weekly`),
  archive: (game: string, year: number, month: number) =>
    api.request<Archive>("GET", `/api/puzzles/${game}/archive?year=${year}&month=${month}`),
  /** Reports a funnel step the server has no other way to learn about; never throws. */
  trackEvent: (name: string, flow?: string, properties?: Record<string, unknown>) => api.trackEvent(name, flow, properties),
});
