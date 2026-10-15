import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { VoiceSession } from "../lib/voiceSession";
import { useGame } from "./GameProvider";

export type VoiceChannel = "main" | "mafia";

interface VoiceState {
  channel: VoiceChannel | null;
  publishing: boolean;
  muted: boolean;
  connecting: boolean;
  failed: boolean;
  toggleMute(): Promise<void>;
  retry(): void;
}

const VoiceContext = createContext<VoiceState | null>(null);

const voicePhases = new Set(["NightZero", "Night", "Day", "Voting", "Results"]);

/**
 * Voice follows the game automatically: at night living Mafia talk in their private channel while
 * everyone else listens to the room; by day the room opens and the API decides who may speak
 * (only the player holding the floor during the timed discussion). The session re-joins whenever
 * the phase or the active speaker changes so the token's publish rights stay current.
 */
export function VoiceProvider({ children }: { children: ReactNode }) {
  const { view, apiClient } = useGame();
  const sessionRef = useRef(new VoiceSession());
  const versionRef = useRef(0);
  const [channel, setChannel] = useState<VoiceChannel | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const gameId = view?.gameId;
  const phase = view?.phase;
  const speaker = view?.discussion?.activePlayerId;
  const alive = view?.youAreAlive;
  const isNight = phase === "NightZero" || phase === "Night";
  const mafia = Boolean(isNight && alive && (view?.yourRole === "Mafia" || view?.yourRole === "Godfather"));
  const inVoicePhase = phase ? voicePhases.has(phase) : false;

  useEffect(() => {
    const session = sessionRef.current;
    return () => void session.leave();
  }, []);

  const join = useCallback(async (target: VoiceChannel) => {
    if (!gameId) return;
    const version = ++versionRef.current;
    setConnecting(true);
    setFailed(false);
    try {
      const token = await apiClient.getVoiceToken(gameId, target);
      const canPublish = token.role === "Publisher";
      await sessionRef.current.join(import.meta.env.VITE_AGORA_APP_ID, token.channel, token.token, token.uid, canPublish);
      if (version !== versionRef.current) return;
      setChannel(target);
      setPublishing(canPublish);
      setMuted(false);
    } catch (err) {
      console.warn("[Nightfall] Voice join failed", err);
      if (version !== versionRef.current) return;
      setChannel(null);
      setPublishing(false);
      setFailed(true);
    } finally {
      if (version === versionRef.current) setConnecting(false);
    }
  }, [apiClient, gameId]);

  useEffect(() => {
    if (!gameId) return;
    if (!inVoicePhase) {
      ++versionRef.current;
      void sessionRef.current.leave();
      setChannel(null);
      setPublishing(false);
      return;
    }
    void join(mafia ? "mafia" : "main");
  }, [gameId, inVoicePhase, phase, speaker, alive, mafia, join, attempt]);

  const toggleMute = useCallback(async () => {
    const next = !muted;
    await sessionRef.current.setMuted(next);
    setMuted(next);
  }, [muted]);

  const value: VoiceState = { channel, publishing, muted, connecting, failed, toggleMute, retry: () => setAttempt((a) => a + 1) };
  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice() {
  const voice = useContext(VoiceContext);
  if (!voice) throw new Error("useVoice must be used inside VoiceProvider");
  return voice;
}
