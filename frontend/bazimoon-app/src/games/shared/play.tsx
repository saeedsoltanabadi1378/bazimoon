import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { PuzzleResult, PuzzleSubmit } from "../../api/hub";
import { useNavigation, type GameKey } from "../../app/router";
import { useHub } from "../../hub/HubData";
import { useLanguage } from "../../i18n/LanguageContext";
import { IconButton } from "../../ui/components";
import { haptic } from "../../lib/haptics";
import { formatClock } from "../../lib/format";

/** Seconds counter that pauses while `running` is false and the tab is hidden. */
export function useStopwatch(running: boolean, initialMs = 0) {
  const [ms, setMs] = useState(initialMs);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!running) {
      last.current = null;
      return;
    }
    last.current = performance.now();
    const id = window.setInterval(() => {
      if (document.hidden) {
        last.current = performance.now();
        return;
      }
      const now = performance.now();
      const delta = now - (last.current ?? now);
      last.current = now;
      setMs((v) => v + delta);
    }, 250);
    return () => window.clearInterval(id);
  }, [running]);
  return [ms, setMs] as const;
}

/** Reports that a solo game's Play screen was reached (the step between its intro and a finished
 * result), for the puzzle funnel. Call once from the top of each game's Play component. */
export function useTrackStarted(game: GameKey) {
  const { api } = useHub();
  useEffect(() => {
    api.trackEvent("puzzle_started", "puzzle", { game });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);
}

export type ResultParams = Record<string, string | number | boolean | null>;

/**
 * Submits a finished game and moves to its result screen. Anything the result screen needs to
 * describe the game goes in `params`; the server's XP/streak response is attached as `xp`.
 */
export function useFinish(game: GameKey) {
  const { submitResult } = useHub();
  const { replace } = useNavigation();
  const done = useRef(false);
  return useCallback(async (submit: Omit<PuzzleSubmit, "game">, params: ResultParams) => {
    if (done.current) return;
    done.current = true;
    if (submit.solved) haptic.success();
    else haptic.error();
    const saved = await submitResult({ game, ...submit });
    replace({ name: "game", game, screen: "result", params: { ...params, xp: saved ? JSON.stringify(saved) : null } });
  }, [game, replace, submitResult]);
}

export function parseXp(params: ResultParams | undefined): PuzzleResult | null {
  const raw = params?.xp;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as PuzzleResult;
  } catch {
    return null;
  }
}

/** Back button, centered title and optional clock pill used at the top of puzzle boards. */
export function PlayHeader({ title, sub, clockMs, right, onBack, backLabel }: {
  title: ReactNode;
  sub?: ReactNode;
  clockMs?: number;
  right?: ReactNode;
  onBack: () => void;
  backLabel: string;
}) {
  const { language } = useLanguage();
  return (
    <div className="row row--between">
      <IconButton icon="back" label={backLabel} onClick={onBack} />
      <div style={{ textAlign: "center", minWidth: 0 }}>
        <div className="display" style={{ fontSize: 22, fontWeight: 700 }}>{title}</div>
        {sub && <div className="tiny muted">{sub}</div>}
      </div>
      {right ?? (
        <div className="num" style={{ minWidth: 44, padding: "8px 10px", borderRadius: 12, background: "var(--surface)", fontWeight: 600, textAlign: "center" }} aria-label="timer">
          {clockMs === undefined ? "" : formatClock(clockMs, language)}
        </div>
      )}
    </div>
  );
}

/** Keeps a serializable game state in localStorage under `key` (null clears it). */
export function useSavedState<T>(key: string, initial: () => T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      // ignore unreadable saves
    }
    return initial();
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // storage full or blocked
    }
  }, [key, state]);
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, [key]);
  return [state, setState, clear] as const;
}
