import type { HubConnection } from "@microsoft/signalr";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, type BazimoonApiClient } from "../api/client";
import { connectToGameHub } from "../api/signalr";
import type { GameView, GraveyardMessage, NightActionType, PlayerSafetyTarget } from "../api/types";
import { useSession } from "../app/session";
import { useLanguage } from "../i18n/LanguageContext";
import { haptic } from "../lib/haptics";
import { localizedGameError } from "./errorText";

export type GameStatus = "loading" | "ready" | "not-found" | "error";
export type LinkState = "connected" | "reconnecting" | "closed";

export interface GameContextValue {
  apiClient: BazimoonApiClient;
  gameId: string;
  status: GameStatus;
  link: LinkState;
  connectionRecovered: boolean;
  retryLive(): void;
  view: GameView | null;
  busy: boolean;
  actionError: string | null;
  clearActionError(): void;
  refresh(): Promise<void>;
  joinGame(): Promise<boolean>;
  leaveGame(): Promise<boolean>;
  startGame(): Promise<boolean>;
  submitNightAction(targetPlayerId: string, actionType: NightActionType): Promise<boolean>;
  resolveNight(): Promise<boolean>;
  submitVote(targetPlayerId: string | null): Promise<boolean>;
  resolveVoting(): Promise<boolean>;
  startVoting(): Promise<boolean>;
  startNight(): Promise<boolean>;
  requestChallenge(): Promise<boolean>;
  cancelChallenge(): Promise<boolean>;
  acceptChallenge(challengerId: string): Promise<boolean>;
  rejectChallenge(challengerId: string): Promise<boolean>;
  finishDiscussion(): Promise<boolean>;
  finishLastWords(): Promise<boolean>;
  revealMayor(): Promise<boolean>;
  callInquiry(): Promise<boolean>;
  setReady(ready: boolean): Promise<boolean>;
  stopWatching(): Promise<boolean>;
  setSpectatorMuted(spectatorId: string, muted: boolean): Promise<boolean>;
  /** Graveyard chat, for players who are out and spectators. */
  graveyard: GraveyardMessage[];
  graveyardUnread: number;
  markGraveyardRead(): void;
  sendGraveyard(text: string): Promise<boolean>;
  blockedPlayers: PlayerSafetyTarget[];
  safetyPlayers: PlayerSafetyTarget[];
  blockPlayer(playerId: string): Promise<boolean>;
  reportPlayer(playerId: string, category: string, note: string | null): Promise<boolean>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ gameId, children }: { gameId: string; children: ReactNode }) {
  const { api } = useSession();
  const { t } = useLanguage();
  const [status, setStatus] = useState<GameStatus>("loading");
  const [link, setLink] = useState<LinkState>("connected");
  const [connectionRecovered, setConnectionRecovered] = useState(false);
  const [liveAttempt, setLiveAttempt] = useState(0);
  const wasConnected = useRef(false);
  const recoveredTimer = useRef<number | null>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const hubRef = useRef<HubConnection | null>(null);
  const [graveyard, setGraveyard] = useState<GraveyardMessage[]>([]);
  const [graveyardSeen, setGraveyardSeen] = useState(0);
  const [hubVersion, setHubVersion] = useState(0);
  const [blockedPlayers, setBlockedPlayers] = useState<PlayerSafetyTarget[]>([]);
  const [safetyPlayers, setSafetyPlayers] = useState<PlayerSafetyTarget[]>([]);

  const addGraveyard = useCallback((message: GraveyardMessage) => {
    setGraveyard((list) => (list.some((m) => m.id === message.id) ? list : [...list, message].slice(-200)));
  }, []);

  const refresh = useCallback(async () => {
    try {
      setView(await api.getGame(gameId));
    } catch (err) {
      console.error("[Bazimoon] Failed to refresh game view", err);
    }
  }, [api, gameId]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    api.getGame(gameId)
      .then((initial) => {
        if (cancelled) return;
        setView(initial);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err instanceof ApiError && err.status === 404 ? "not-found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [api, gameId]);

  useEffect(() => {
    if (status !== "ready") return;
    api.getPlayerSafety(gameId).then((result) => {
      setSafetyPlayers(result.players);
      const blocked = new Set(result.blockedPlayerIds);
      setBlockedPlayers(result.players.filter((player) => blocked.has(player.playerId)));
    }).catch(() => undefined);
  }, [api, gameId, status]);

  // Live updates: the hub only pings "something changed"; we re-fetch our own filtered view.
  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    connectToGameHub(import.meta.env.VITE_API_BASE_URL, () => api.getToken() ?? "", gameId, () => void refresh(), (state) => {
      if (cancelled) return;
      if (state === "connected" && wasConnected.current) {
        setConnectionRecovered(true);
        if (recoveredTimer.current !== null) window.clearTimeout(recoveredTimer.current);
        recoveredTimer.current = window.setTimeout(() => setConnectionRecovered(false), 4000);
      }
      setLink(state);
    }, addGraveyard)
      .then(async (hub) => {
        if (cancelled) {
          await hub.stop();
          return;
        }
        hubRef.current = hub;
        setLink("connected");
        wasConnected.current = true;
        setHubVersion((v) => v + 1);
      })
      .catch((err) => {
        console.error("[Bazimoon] Failed to connect to the live update hub", err);
        if (!cancelled) setLink("closed");
      });
    return () => {
      cancelled = true;
      void hubRef.current?.stop();
      hubRef.current = null;
    };
  }, [api, gameId, status, refresh, addGraveyard, liveAttempt]);

  useEffect(() => () => {
    if (recoveredTimer.current !== null) window.clearTimeout(recoveredTimer.current);
  }, []);

  // Once you're out (or watching), join the graveyard group and load its history.
  const canGraveyard = Boolean(view?.youCanUseGraveyard);
  useEffect(() => {
    if (!canGraveyard) return;
    let cancelled = false;
    hubRef.current?.invoke("JoinGraveyard", gameId).catch((err) => console.warn("[Bazimoon] Failed to join the graveyard", err));
    api.getGraveyard(gameId)
      .then((history) => {
        if (!cancelled) setGraveyard((list) => [...history, ...list.filter((m) => !history.some((h) => h.id === m.id))].slice(-200));
      })
      .catch((err) => console.warn("[Bazimoon] Failed to load the graveyard", err));
    return () => {
      cancelled = true;
    };
  }, [api, gameId, canGraveyard, hubVersion, link]);

  const yourId = view?.yourPlayerId;
  const graveyardUnread = graveyard.slice(graveyardSeen).filter((m) => m.senderId !== yourId).length;

  // A dropped hub means we may have missed updates — poll until it's back.
  useEffect(() => {
    if (status !== "ready" || link === "connected") return;
    const id = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(id);
  }, [status, link, refresh]);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      haptic.tap();
      await refresh();
      return true;
    } catch (err) {
      haptic.warn();
      setActionError(err instanceof ApiError ? localizedGameError(err, t) : t("genericError"));
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh, t]);

  const value: GameContextValue = {
    apiClient: api,
    gameId,
    status,
    link,
    connectionRecovered,
    retryLive: () => {
      setLink("reconnecting");
      setLiveAttempt((value) => value + 1);
    },
    view,
    busy,
    actionError,
    clearActionError: () => setActionError(null),
    refresh,
    joinGame: () => run(() => api.joinGame(gameId)),
    leaveGame: () => run(() => api.leaveGame(gameId)),
    startGame: () => run(() => api.startGame(gameId)),
    submitNightAction: (target, type) => run(() => api.submitNightAction(gameId, target, type)),
    resolveNight: () => run(() => api.resolveNight(gameId)),
    submitVote: (target) => run(() => api.submitVote(gameId, target)),
    resolveVoting: () => run(() => api.resolveVoting(gameId)),
    startVoting: () => run(() => api.startVoting(gameId)),
    startNight: () => run(() => api.startNight(gameId)),
    requestChallenge: () => run(() => api.requestChallenge(gameId)),
    cancelChallenge: () => run(() => api.cancelChallenge(gameId)),
    acceptChallenge: (id) => run(() => api.acceptChallenge(gameId, id)),
    rejectChallenge: (id) => run(() => api.rejectChallenge(gameId, id)),
    finishDiscussion: () => run(() => api.finishDiscussion(gameId)),
    finishLastWords: () => run(() => api.finishLastWords(gameId)),
    revealMayor: () => run(() => api.revealMayor(gameId)),
    callInquiry: () => run(() => api.callInquiry(gameId)),
    setReady: (ready) => run(() => api.setReady(gameId, ready)),
    stopWatching: () => run(() => api.stopSpectating(gameId)),
    setSpectatorMuted: (id, muted) => run(() => api.setSpectatorMuted(gameId, id, muted)),
    graveyard,
    graveyardUnread,
    markGraveyardRead: () => setGraveyardSeen(graveyard.length),
    sendGraveyard: async (text) => {
      setActionError(null);
      try {
        addGraveyard(await api.sendGraveyard(gameId, text));
        return true;
      } catch (err) {
        haptic.warn();
        setActionError(err instanceof ApiError ? localizedGameError(err, t) : t("genericError"));
        return false;
      }
    },
    blockedPlayers,
    safetyPlayers,
    blockPlayer: async (playerId) => {
      const ok = await run(async () => {
        const target = await api.blockPlayer(gameId, playerId);
        setBlockedPlayers((current) => current.some((item) => item.playerId === target.playerId) ? current : [...current, target]);
      });
      return ok;
    },
    reportPlayer: (playerId, category, note) => run(() => api.reportPlayer(gameId, playerId, category, note)),
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used inside GameProvider");
  return context;
}
