import type { HubConnection } from "@microsoft/signalr";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, type BazimoonApiClient } from "../api/client";
import { connectToGameHub } from "../api/signalr";
import type { AccoladeKind, GameView, GraveyardMessage, NightActionType, PlayerSafetyTarget, TableChatMessage } from "../api/types";
import { useSession } from "../app/session";
import { useLanguage } from "../i18n/LanguageContext";
import { haptic } from "../lib/haptics";
import { localizedGameError } from "./errorText";

import { reactionKinds, type MafiaReaction, type ReactionKind } from "./reactionTypes";

export type GameStatus = "loading" | "ready" | "not-found" | "error";
export type LinkState = "connected" | "reconnecting" | "closed";
export type PanelTab = "events" | "chat";

/** A chat message that has just arrived, shown for a moment at its sender's seat. */
export interface SeatLine {
  id: string;
  senderId: string;
  text: string;
  at: number;
}

/** How long a reaction or a chat line stays at a seat. */
const SEAT_BUBBLE_MS = 4500;
const REACTION_COOLDOWN_MS = 3000;

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
  submitSuspicion(targetPlayerId: string): Promise<boolean>;
  passNight(): Promise<boolean>;
  addBot(): Promise<boolean>;
  removeBot(botId: string): Promise<boolean>;
  submitAccolade(kind: AccoladeKind, targetPlayerId: string): Promise<boolean>;
  submitVote(targetPlayerId: string | null): Promise<boolean>;
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
  /** Table chat, written by living players while the town is awake. */
  tableChat: TableChatMessage[];
  tableChatUnread: number;
  markTableChatRead(): void;
  sendTableChat(text: string): Promise<boolean>;
  /** Chat lines that have just arrived, newest per sender, for the bubbles at the seats. */
  seatLines: SeatLine[];
  /** Which side of the phase panel is open; kept across phases. */
  panelTab: PanelTab;
  setPanelTab(tab: PanelTab): void;
  reactions: MafiaReaction[];
  /** True for a few seconds after you react: the table allows one reaction at a time. */
  reactionCooling: boolean;
  /** Sends a reaction to the table, aimed at another player when `targetPlayerId` is given. */
  sendReaction(kind: ReactionKind, targetPlayerId?: string): Promise<boolean>;
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

  const [reactions, setReactions] = useState<MafiaReaction[]>([]);
  const addReaction = useCallback((reaction: MafiaReaction) => {
    if (!reactionKinds.includes(reaction.kind)) return;
    // One bubble per seat: a player's newer reaction replaces their last one.
    setReactions(list => [...list.filter(item => item.id !== reaction.id && item.senderId !== reaction.senderId && Date.now() - item.receivedAt < SEAT_BUBBLE_MS), { ...reaction, receivedAt: Date.now() }].slice(-12));
  }, []);
  const [reactionCooling, setReactionCooling] = useState(false);
  const coolingTimer = useRef<number | null>(null);
  const [seatLines, setSeatLines] = useState<SeatLine[]>([]);
  const [panelTab, setPanelTab] = useState<PanelTab>("events");
  useEffect(() => {
    const timer = window.setInterval(() => {
      const fresh = <T extends { at?: number; receivedAt?: number }>(list: T[]) => {
        if (!list.length) return list;
        const kept = list.filter(item => Date.now() - (item.at ?? item.receivedAt ?? 0) < SEAT_BUBBLE_MS);
        return kept.length === list.length ? list : kept;
      };
      setReactions(fresh);
      setSeatLines(fresh);
    }, 500);
    return () => {
      window.clearInterval(timer);
      if (coolingTimer.current !== null) window.clearTimeout(coolingTimer.current);
    };
  }, []);

  const addGraveyard = useCallback((message: GraveyardMessage) => {
    setGraveyard((list) => (list.some((m) => m.id === message.id) ? list : [...list, message].slice(-200)));
  }, []);

  const [tableChat, setTableChat] = useState<TableChatMessage[]>([]);
  const [tableChatSeen, setTableChatSeen] = useState(0);
  const addTableChat = useCallback((message: TableChatMessage) => {
    setTableChat((list) => (list.some((m) => m.id === message.id) ? list : [...list, message].slice(-200)));
    // Only messages that arrive live pop up at a seat; the history loaded on arrival does not.
    setSeatLines((list) => (list.some((line) => line.id === message.id) ? list
      : [...list.filter((line) => line.senderId !== message.senderId), { id: message.id, senderId: message.senderId, text: message.text, at: Date.now() }]));
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
    }, addGraveyard, addReaction, addTableChat)
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
  }, [api, gameId, status, refresh, addGraveyard, addReaction, addTableChat, liveAttempt]);

  // The table chat so far, loaded once the game starts and again after a reconnect. What was already
  // there when you arrived counts as read.
  const inGame = Boolean(view && view.phase !== "Lobby" && view.phase !== "RoleAssignment" && view.phase !== "Ended");
  useEffect(() => {
    if (status !== "ready" || !inGame) return;
    let cancelled = false;
    api.getTableChat(gameId)
      .then((history) => {
        if (cancelled || !Array.isArray(history)) return;
        setTableChat((list) => {
          const merged = [...history, ...list.filter((m) => !history.some((h) => h.id === m.id))].slice(-200);
          setTableChatSeen((seen) => (list.length === 0 ? merged.length : seen));
          return merged;
        });
      })
      .catch((err) => console.warn("[Bazimoon] Failed to load the table chat", err));
    return () => {
      cancelled = true;
    };
  }, [api, gameId, status, inGame, hubVersion]);

  useEffect(() => () => {
    if (recoveredTimer.current !== null) window.clearTimeout(recoveredTimer.current);
  }, []);

  // The chat is closed at night, and the night's prompt is on the events side.
  const phase = view?.phase;
  useEffect(() => {
    if (phase === "Night" || phase === "NightZero") setPanelTab("events");
  }, [phase]);

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
  const tableChatUnread = tableChat.slice(tableChatSeen).filter((m) => m.senderId !== yourId).length;

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
    submitSuspicion: (target) => run(() => api.submitSuspicion(gameId, target)),
    passNight: () => run(() => api.passNight(gameId)),
    addBot: () => run(() => api.addBot(gameId)),
    removeBot: (botId) => run(() => api.removeBot(gameId, botId)),
    submitAccolade: (kind, target) => run(() => api.submitAccolade(gameId, kind, target)),
    submitVote: (target) => run(() => api.submitVote(gameId, target)),
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
    tableChat,
    tableChatUnread,
    markTableChatRead: () => setTableChatSeen(tableChat.length),
    sendTableChat: async (text) => {
      setActionError(null);
      try {
        addTableChat(await api.sendTableChat(gameId, text));
        return true;
      } catch (err) {
        haptic.warn();
        setActionError(err instanceof ApiError ? localizedGameError(err, t) : t("genericError"));
        return false;
      }
    },
    seatLines,
    panelTab,
    setPanelTab,
    reactions,
    reactionCooling,
    sendReaction: async (kind, targetPlayerId) => {
      if (!hubRef.current || link !== "connected" || reactionCooling) return false;
      setReactionCooling(true);
      if (coolingTimer.current !== null) window.clearTimeout(coolingTimer.current);
      coolingTimer.current = window.setTimeout(() => setReactionCooling(false), REACTION_COOLDOWN_MS);
      try {
        if (targetPlayerId) await hubRef.current.invoke("SendAimedReaction", gameId, kind, targetPlayerId);
        else await hubRef.current.invoke("SendReaction", gameId, kind);
        haptic.tap();
        return true;
      } catch { return false; }
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
