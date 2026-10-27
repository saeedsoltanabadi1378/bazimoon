const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
let csrf = "";

export class AdminApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}/api/admin${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}), ...init.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new AdminApiError(response.status, body.detail ?? `Request failed (${response.status})`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : (undefined as T);
}

export const adminApi = {
  login: (username: string, password: string) => request<{ username: string }>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  session: () => request<{ authenticated: boolean; username: string }>("/auth/session"),
  csrf: async () => { const r = await request<{ token: string }>("/auth/csrf"); csrf = r.token; },
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  get: <T>(path: string) => request<T>(path),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
};

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  /** Players list only: how many are in the other tab (bots, or real players). */
  otherTotal?: number | null;
}

export interface PlayerInGame {
  name: string;
  role: string | null;
  alive: boolean;
  eliminatedBy: string | null;
  eliminatedRound: number | null;
  ratingDelta: number | null;
  won: boolean | null;
}

export interface LiveGame {
  id: string;
  /** The table's name, when the host gave it one. */
  title: string | null;
  phase: string;
  round: number;
  alive: number;
  seated: number;
  maxPlayers: number;
  startedAt: string;
  nightActionsDone: number;
  nightActionsRequired: number;
  votesCast: number;
  voters: number;
  speaker: string | null;
  players: PlayerInGame[];
}

export interface PastGame {
  id: string;
  title: string | null;
  status: string;
  result: string;
  startedAt: string;
  endedAt: string;
  cancellationReason: string | null;
  rounds: number;
  players: PlayerInGame[];
}

export interface ServiceStatus {
  key: "api" | "database" | "redis" | "voice" | "reminders";
  status: "healthy" | "degraded" | "down";
  latencyMs: number | null;
  secondsAgo: number | null;
  sent: number | null;
  failed: number | null;
  lastRunAt: string | null;
}

export interface AdminEvent {
  id: number;
  at: string;
  level: "warning" | "audit" | "info";
  category: string;
  message: string;
  targetType: string | null;
  targetId: string | null;
  actor: string | null;
  reason: string | null;
}

export interface Overview {
  rangeDays: number;
  liveGames: number;
  nightGames: number;
  activePlayers: number;
  activePlayersBefore: number;
  dailySolves: number;
  topDailyGame: string | null;
  activeCouples: number;
  couplesBothToday: number;
  activity: { date: string; mafia: number; puzzles: number }[];
  services: ServiceStatus[];
  live: LiveGame[];
  events: AdminEvent[];
}

export interface PlayerRow {
  id: string;
  name: string;
  level: number;
  rating: number;
  division: string;
  tier: number;
  streak: number;
  language: string;
  lastSeen: string;
  isBot: boolean;
  source: string;
  medium: string;
  campaign: string | null;
}

export interface AcquisitionSummary {
  total: number;
  sources: { value: string; players: number }[];
  campaigns: { value: string; players: number }[];
}

export interface PlayerAcquisition {
  source: string;
  medium: string;
  campaign: string | null;
  term: string | null;
  content: string | null;
  referrer: string | null;
  landingPath: string | null;
  gclid: string | null;
  firstSeenAt: string;
}

export interface ActivityItem {
  kind: "mafia" | "puzzle" | "admin";
  at: string;
  game: string | null;
  number: number | null;
  won: boolean | null;
  role: string | null;
  ratingDelta: number | null;
  timeMs: number | null;
  score: number | null;
  /** "admin" kind only: what the admin audit log recorded. */
  message: string | null;
  /** "admin" kind only: who made the change, or null for the system. */
  actor: string | null;
}

export interface PlayerDetail {
  id: string;
  name: string;
  joined: string;
  level: number;
  xp: number;
  rating: number;
  division: string;
  tier: number;
  mafiaGames: number;
  mafiaWinRate: number;
  puzzlesSolved: number;
  streak: number;
  bestStreak: number;
  freezes: number;
  language: string;
  couple: { status: "none" | "pending" | "active"; partnerName: string | null; since: string | null };
  mafiaByRole: { role: string; games: number; winRate: number }[] | null;
  /** Totals over the games that have a log; older games are left out. */
  isBot: boolean;
  /** "crawler" (the system saw a crawler or script at sign-up) or "admin". */
  botReason: "crawler" | "admin" | null;
  botMarkedAt: string | null;
  botMarkedBy: string | null;
  mafiaSkills: { trackedGames: number; checksMade: number; mafiaFound: number; killsBlocked: number; votesCast: number; votesOnMafia: number } | null;
  acquisition: PlayerAcquisition | null;
}

export interface FunnelStep {
  name: string;
  users: number;
  pctOfFirst: number;
  pctOfPrevious: number;
}

export interface Funnel {
  flow: string;
  days: number;
  steps: FunnelStep[];
}

export interface ActivityFeedItem {
  id: number;
  at: string;
  flow: string;
  name: string;
  userId: string | null;
  userName: string | null;
  /** Extra detail for this step (game, score, round, …), as a raw JSON object string, or null. */
  propertiesJson: string | null;
}

/** The four tracked flows, in the order the Activity page's funnel tabs show them. */
export const FUNNEL_FLOWS = ["signup", "mafia", "puzzle", "couple"] as const;
export type FunnelFlow = (typeof FUNNEL_FLOWS)[number];

/** Every flow the activity feed can show, including "navigation" (every screen view — not a funnel,
 * just the raw log) which the feed filters by but the funnel tabs above don't cover. */
export const FEED_FLOWS = [...FUNNEL_FLOWS, "navigation"] as const;
export type FeedFlow = (typeof FEED_FLOWS)[number];

export interface Daily {
  game: string;
  mode: string;
  number: number;
  players: number;
  solved: number;
  medianTimeMs: number | null;
  medianMoves: number | null;
  medianScore: number | null;
}

export interface Puzzles {
  date: string;
  dailies: Daily[];
  season: { number: number; day: number; length: number; endsOn: string };
  divisions: { name: string; count: number }[];
  leaders: { rank: number; name: string; points: number }[];
  couples: { active: number; bothToday: number; averageMatch: number; invitesWaiting: number; skipped: { setId: number; question: number; rate: number }[] };
}

export interface AppSettings {
  version: number;
  minPlayers: number;
  maxPlayers: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  maintenanceMessageFa: string;
  reminderMessage: string;
  reminderMessageFa: string;
  tableStartMessage: string;
  tableStartMessageFa: string;
  coupleTurnMessage: string;
  coupleTurnMessageFa: string;
  updatedAt?: string;
  /** Games switched off for everyone. */
  disabledGames?: string[];
}

/** Every game an admin can switch off, in the order the Games section lists them. */
export const ALL_GAMES = ["mafia", "couple", "zip", "queens", "sudoku", "word", "ladder", "mines", "merge", "blocks", "stack", "memory", "snake", "dooz", "spy", "esmfamil"] as const;

