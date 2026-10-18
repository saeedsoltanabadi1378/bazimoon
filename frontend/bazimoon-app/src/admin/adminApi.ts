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
  return response.status === 204 ? (undefined as T) : response.json();
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
  chatId: number;
  chatTitle: string | null;
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
  chatId: number;
  chatTitle: string | null;
  status: string;
  result: string;
  startedAt: string;
  endedAt: string;
  cancellationReason: string | null;
  rounds: number;
  players: PlayerInGame[];
}

export interface ServiceStatus {
  key: "api" | "database" | "redis" | "bot" | "voice" | "reminders";
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
  id: number;
  name: string;
  level: number;
  rating: number;
  division: string;
  tier: number;
  streak: number;
  language: string;
  lastSeen: string;
}

export interface ActivityItem {
  kind: "mafia" | "puzzle";
  at: string;
  game: string | null;
  number: number | null;
  won: boolean | null;
  role: string | null;
  ratingDelta: number | null;
  timeMs: number | null;
  score: number | null;
}

export interface PlayerDetail {
  id: number;
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
  recent: ActivityItem[];
  couple: { status: "none" | "pending" | "active"; partnerName: string | null; since: string | null };
  mafiaByRole: { role: string; games: number; winRate: number }[] | null;
  /** Totals over the games that have a log; older games are left out. */
  mafiaSkills: { trackedGames: number; checksMade: number; mafiaFound: number; killsBlocked: number; votesCast: number; votesOnMafia: number } | null;
}

export interface ChatRow {
  id: number;
  title: string | null;
  members: number;
  games: number;
  livePhase: string | null;
  lastGame: string | null;
}

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

export interface BotSettings {
  version: number;
  minPlayers: number;
  maxPlayers: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  enabledCommands: string[];
  soloTestEnabled: boolean;
  miniAppBaseUrl: string;
  helpMessage: string;
  welcomeMessage: string;
  updatedAt: string;
  maintenanceMessageFa: string;
  helpMessageFa: string;
  welcomeMessageFa: string;
  reminderMessage: string;
  reminderMessageFa: string;
  /** Games switched off for everyone (missing on servers older than the game switches). */
  disabledGames?: string[];
}

/** Every game an admin can switch off, in the order the Games section lists them. */
export const ALL_GAMES = ["mafia", "couple", "zip", "queens", "sudoku", "word", "ladder", "mines", "merge", "blocks", "stack", "memory", "nard", "snake", "dooz", "spy", "esmfamil"] as const;

export const ALL_COMMANDS = ["newgame", "join", "startgame", "myrole", "startnight", "resolvenight", "startvoting", "resolvevoting", "help", "start", "solotest", "solonext"] as const;
