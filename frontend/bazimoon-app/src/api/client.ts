import type {
  GraveyardMessage,
  CreateGameResponse,
  GameView,
  MyGameResult,
  NightActionType,
  NightResult,
  AuthSession,
  VoiceTokenResponse,
  VotingResult,
  PlayerSafety,
  PlayerSafetyTarget,
} from "./types";
import type { AcquisitionAttribution } from "../lib/attribution";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export class BazimoonApiClient {
  private readonly baseUrl: string;
  private token: string | null = null;
  private refreshToken: string | null = null;
  private refreshing: Promise<boolean> | null = null;
  /** Called with every new token pair (or null when the session ended), so it can be saved. */
  onSessionChange: ((session: AuthSession | null) => void) | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  /** Uses a token pair from sign-in or refresh for every later request. */
  useSession(session: AuthSession | null) {
    this.token = session?.accessToken ?? null;
    this.refreshToken = session?.refreshToken ?? null;
    this.onSessionChange?.(session);
  }

  getToken() {
    return this.token;
  }

  get isAuthenticated() {
    return this.token !== null;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    try {
      return await this.send<T>(method, path, body);
    } catch (err) {
      // An expired access token is replaced once with the refresh token, then the call is retried.
      if (err instanceof ApiError && err.status === 401 && !path.startsWith("/api/auth/") && (await this.refresh())) {
        return this.send<T>(method, path, body);
      }
      throw err;
    }
  }

  /** Trades the refresh token for a new pair. Several 401s at once share one refresh. */
  refresh(): Promise<boolean> {
    if (!this.refreshToken) return Promise.resolve(false);
    this.refreshing ??= this.send<AuthSession>("POST", "/api/auth/refresh", { refreshToken: this.refreshToken })
      .then((session) => { this.useSession(session); return true; })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) this.useSession(null);
        return false;
      })
      .finally(() => { this.refreshing = null; });
    return this.refreshing;
  }

  private async send<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      // fetch only rejects when the request never reached the server (offline, DNS, CORS).
      throw new ApiError(0, "offline");
    }

    if (!response.ok) {
      let detail = response.statusText || `HTTP ${response.status}`;
      let code: string | null = null;
      try {
        const problem = await response.json();
        if (typeof problem?.detail === "string" && problem.detail.length > 0) {
          detail = problem.detail;
        }
        if (typeof problem?.code === "string" && problem.code.length > 0) code = problem.code;
      } catch {
        // no JSON body (e.g. a bare 401 from auth middleware) — fall back to statusText above.
      }
      throw new ApiError(response.status, detail, code);
    }

    if (response.status === 204) {
      return undefined as T;
    }
    const text = await response.text();
    return text.length > 0 ? (JSON.parse(text) as T) : (undefined as T);
  }

  signInAsGuest(language: string, attribution: AcquisitionAttribution) {
    return this.request<AuthSession>("POST", "/api/auth/guest", { language, attribution });
  }

  signInWithGoogle(idToken: string, nonce: string, language: string, attribution: AcquisitionAttribution) {
    return this.request<AuthSession>("POST", "/api/auth/google", { idToken, nonce, language, attribution });
  }

  linkGoogle(idToken: string, nonce: string) {
    return this.request<AuthSession>("POST", "/api/auth/link/google", { idToken, nonce });
  }

  pushKey() {
    return this.request<{ publicKey: string | null }>("GET", "/api/push/key");
  }

  /** Reports a funnel step the server has no other way to learn about (a screen was seen, a game was
   * started) — never throws, so a flaky connection never interrupts what the player is doing. */
  trackEvent(name: string, flow?: string, properties?: Record<string, unknown>) {
    this.request<void>("POST", "/api/events", { name, flow, properties }).catch(() => undefined);
  }

  subscribePush(endpoint: string, p256dh: string, auth: string) {
    return this.request<void>("POST", "/api/push/subscriptions", { endpoint, keys: { p256dh, auth } });
  }

  unsubscribePush(endpoint: string) {
    return this.request<void>("POST", "/api/push/subscriptions/remove", { endpoint });
  }

  logout() {
    const refreshToken = this.refreshToken;
    this.useSession(null);
    return refreshToken ? this.request<void>("POST", "/api/auth/logout", { refreshToken }) : Promise.resolve();
  }

  joinGame(gameId: string) {
    return this.request<void>("POST", `/api/games/${gameId}/players`);
  }

  rematch(gameId: string) {
    return this.request<CreateGameResponse>("POST", `/api/games/${gameId}/rematch`);
  }

  getMyGameResult(gameId: string) {
    return this.request<MyGameResult>("GET", `/api/me/games/${gameId}`);
  }

  leaveGame(gameId: string) {
    return this.request<void>("DELETE", `/api/games/${gameId}/players`);
  }

  startGame(gameId: string) {
    return this.request<void>("POST", `/api/games/${gameId}/start`);
  }

  getGame(gameId: string) {
    return this.request<GameView>("GET", `/api/games/${gameId}`);
  }


  submitNightAction(gameId: string, targetPlayerId: string, actionType: NightActionType) {
    return this.request<void>("POST", `/api/games/${gameId}/night-actions`, { targetPlayerId, actionType });
  }

  resolveNight(gameId: string) {
    return this.request<NightResult>("POST", `/api/games/${gameId}/resolve-night`);
  }

  submitVote(gameId: string, targetPlayerId: string | null) {
    return this.request<void>("POST", `/api/games/${gameId}/votes`, { targetPlayerId });
  }

  resolveVoting(gameId: string) {
    return this.request<VotingResult>("POST", `/api/games/${gameId}/resolve-voting`);
  }

  startVoting(gameId: string) {
    return this.request<void>("POST", `/api/games/${gameId}/start-voting`);
  }

  startNight(gameId: string) {
    return this.request<void>("POST", `/api/games/${gameId}/start-night`);
  }

  requestChallenge(gameId: string) { return this.request<void>("POST", `/api/games/${gameId}/discussion/challenges`); }
  cancelChallenge(gameId: string) { return this.request<void>("DELETE", `/api/games/${gameId}/discussion/challenges`); }
  acceptChallenge(gameId: string, challengerId: string) { return this.request<void>("POST", `/api/games/${gameId}/discussion/challenges/${challengerId}/accept`); }
  rejectChallenge(gameId: string, challengerId: string) { return this.request<void>("POST", `/api/games/${gameId}/discussion/challenges/${challengerId}/reject`); }
  finishDiscussion(gameId: string) { return this.request<void>("POST", `/api/games/${gameId}/discussion/finish`); }
  setReady(gameId: string, ready: boolean) { return this.request<void>("PUT", `/api/games/${gameId}/ready`, { ready }); }
  finishLastWords(gameId: string) { return this.request<void>("POST", `/api/games/${gameId}/last-words/finish`); }
  revealMayor(gameId: string) { return this.request<void>("POST", `/api/games/${gameId}/mayor/reveal`); }
  callInquiry(gameId: string) { return this.request<void>("POST", `/api/games/${gameId}/inquiry`); }

  spectate(gameId: string) { return this.request<void>("POST", `/api/games/${gameId}/spectate`); }

  stopSpectating(gameId: string) { return this.request<void>("DELETE", `/api/games/${gameId}/spectate`); }

  setSpectatorMuted(gameId: string, spectatorId: string, muted: boolean) {
    return this.request<void>("PUT", `/api/games/${gameId}/spectators/${spectatorId}/muted`, { muted });
  }

  getGraveyard(gameId: string) { return this.request<GraveyardMessage[]>("GET", `/api/games/${gameId}/graveyard/messages`); }

  sendGraveyard(gameId: string, text: string) {
    return this.request<GraveyardMessage>("POST", `/api/games/${gameId}/graveyard/messages`, { text });
  }

  getPlayerSafety(gameId: string) {
    return this.request<PlayerSafety>("GET", `/api/games/${gameId}/safety`);
  }

  blockPlayer(gameId: string, targetPlayerId: string) {
    return this.request<PlayerSafetyTarget>("POST", `/api/games/${gameId}/players/${targetPlayerId}/block`);
  }

  reportPlayer(gameId: string, targetPlayerId: string, category: string, note: string | null) {
    return this.request<void>("POST", `/api/games/${gameId}/players/${targetPlayerId}/reports`, { category, note });
  }

  getVoiceToken(gameId: string, channel: "main" | "mafia" | "graveyard") {
    return this.request<VoiceTokenResponse>("GET", `/api/games/${gameId}/voice-token?channel=${channel}`);
  }
}
