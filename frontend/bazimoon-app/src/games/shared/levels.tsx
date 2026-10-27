import { useCallback, useEffect, useRef, useState } from "react";
import type { LevelProgress, PuzzleResult } from "../../api/hub";
import { useNavigation } from "../../app/router";
import { useHub } from "../../hub/HubData";
import { useLanguage, type TranslationKey } from "../../i18n/LanguageContext";
import { readLocal, writeLocal } from "../../lib/storage";
import { Body, Screen, TopBar } from "../../ui/components";
import { Icon } from "../../ui/Icon";
import { useSavedState } from "./play";

// Zip, Queens, Sudoku, Word and Ladder are played level by level: level 1 first, then as many as the
// player likes, any day. The server keeps the level reached and the current level's unfinished board.

export type LevelGame = "zip" | "queens" | "sudoku" | "word" | "ladder";
export type LevelTrack = "level" | "level-fa";

/** Longest board JSON the server keeps (Progression.MaxSavedStateLength). */
const MAX_SAVED_STATE = 8000;

/** Word and Ladder have separate English and Persian levels. */
export function levelTrack(game: LevelGame, lang: "en" | "fa"): LevelTrack {
  return (game === "word" || game === "ladder") && lang === "fa" ? "level-fa" : "level";
}

const progressKey = (game: LevelGame, track: LevelTrack) => `bazimoon-levels-${game}-${track}`;

let cleaned = false;

/** Unfinished daily boards from before levels; they can never be finished now. */
function removeOldDailySaves() {
  if (cleaned) return;
  cleaned = true;
  try {
    const old = /^bazimoon-(zip-zip-(daily|archive)-|queens-queens-daily-|sudoku-sudoku-daily-|word-(en|fa)-\d+$|ladder-(en|fa)-daily-)/;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && old.test(key)) localStorage.removeItem(key);
    }
  } catch {
    // storage blocked
  }
}

/** The player's next level in a game. Offline, the last level seen on this device is used. */
export function useLevelProgress(game: LevelGame, track: LevelTrack) {
  const { api } = useHub();
  const [progress, setProgress] = useState<LevelProgress | null>(() => readLocal<LevelProgress | null>(progressKey(game, track), null));
  useEffect(() => {
    removeOldDailySaves();
    let alive = true;
    api.progress(game, track).then((p) => {
      if (!alive) return;
      setProgress(p);
      writeLocal(progressKey(game, track), { ...p, savedState: null });
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api, game, track]);
  return progress;
}

/** Remembers the level reached on this device, so the next screen is right before the server answers. */
export function rememberLevel(game: LevelGame, track: LevelTrack, level: number) {
  const known = readLocal<LevelProgress | null>(progressKey(game, track), null);
  if (!known || known.level < level) writeLocal(progressKey(game, track), { game, track, level, savedState: null });
}

/**
 * A level's board, kept on the device and, for the current level, on the server too, so the player can
 * carry on from another phone. `slim` trims what the server copy needs (undo history and the like).
 * A board saved on the server is used when this device has none of its own.
 */
export function useLevelState<T>(game: LevelGame, track: LevelTrack, level: number, initial: () => T, slim: (state: T) => Partial<T> = (s) => s) {
  const { api } = useHub();
  const key = `bazimoon-${game}-${track}-L${level}`;
  const [hadLocal] = useState(() => readLocal<unknown>(key, null) !== null);
  // With no board on this device, wait for the server's before play starts (clocks start from it).
  const [ready, setReady] = useState(hadLocal);
  const [state, setState, clearLocal] = useSavedState<T>(key, initial);
  const current = useRef<number | null>(null);
  const dirty = useRef(false);
  const done = useRef(false);
  const latest = useRef(state);
  const slimRef = useRef(slim);
  slimRef.current = slim;

  useEffect(() => {
    latest.current = state;
    dirty.current = true;
  }, [state]);

  useEffect(() => {
    let alive = true;
    api.progress(game, track).then((p) => {
      if (!alive) return;
      current.current = p.level;
      if (p.level === level && p.savedState && !hadLocal) {
        try {
          const remote = JSON.parse(p.savedState) as Partial<T>;
          setState((s) => ({ ...s, ...remote }));
        } catch {
          // an unreadable save is ignored
        }
      }
      setReady(true);
    }).catch(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const send = useCallback(() => {
    if (done.current || !dirty.current || current.current !== level) return;
    const json = JSON.stringify(slimRef.current(latest.current));
    if (json.length > MAX_SAVED_STATE) return;
    dirty.current = false;
    api.saveLevelState(game, { track, level, state: json }).catch(() => {
      dirty.current = true;
    });
  }, [api, game, track, level]);

  useEffect(() => {
    const id = window.setInterval(send, 10_000);
    const onHide = () => {
      if (document.visibilityState === "hidden") send();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      send();
    };
  }, [send]);

  /** The level is finished: the server drops its copy when the result arrives. */
  const clear = useCallback(() => {
    done.current = true;
    clearLocal();
  }, [clearLocal]);

  return [state, setState, clear, ready] as const;
}

/** Shown while a level's saved board is fetched. */
export function LevelLoading() {
  const { t } = useLanguage();
  return (
    <Screen theme="night">
      <div className="stack center" style={{ flex: 1, justifyContent: "center" }}>
        <span className="muted small">{t("loading")}</span>
      </div>
    </Screen>
  );
}

/** The labels a level game shows on its play and result screens. */
export function useLevelCopy() {
  const { t } = useLanguage();
  /** The level to offer next. Offline (no server answer) a finished level is taken to open the next one. */
  const nextLevel = (xp: PuzzleResult | null, level: number | null) => xp?.nextLevel ?? (level ?? 0) + 1;
  return {
    title: (name: TranslationKey, level: number) => `${t(name)} · ${t("levelN", { n: level })}`,
    nextLevel,
    /** Result screen line: what this attempt did to the player's progress. */
    next: (xp: PuzzleResult | null, solved: boolean, level: number) => {
      const counted = xp ? xp.countedAsDaily : true;
      const next = nextLevel(xp, level);
      if (!counted) return t("levelReplaySub", { n: next });
      return solved ? t("levelDoneSub", { level, next }) : t("levelFailedSub", { level, next });
    },
  };
}

/** Intro mode for a level game: continue at the player's level. */
export function useLevelMode(game: LevelGame, track: LevelTrack, opts: { desc?: string; params?: Record<string, string> } = {}) {
  const { t } = useLanguage();
  const { push } = useNavigation();
  const progress = useLevelProgress(game, track);
  const level = progress?.level ?? null;
  return {
    level,
    mode: {
      key: "levels",
      label: t("modeLevels"),
      desc: opts.desc ?? t("levelsDesc"),
      play: level === null ? t("loading") : level > 1 ? t("continueLevel", { n: level }) : t("startLevel1"),
      disabled: level === null,
      onPlay: () => {
        if (level !== null) push({ name: "game", game, screen: "play", params: { ...opts.params, mode: "level", level } });
      },
    },
    badge: level === null ? undefined : t("levelN", { n: level }),
    all: { label: t("allLevels"), onClick: () => push({ name: "game", game, screen: "levels", params: opts.params }) },
  };
}

/** Every level so far: finished ones to replay, the current one, and a few locked ones ahead. */
export function LevelsScreen({ game, track, name, accent, accentInk = "#0B0D1A", maxLevel, params }: {
  game: LevelGame;
  track: LevelTrack;
  name: TranslationKey;
  accent: string;
  accentInk?: string;
  /** Word has a fixed list of answers; the other games go on for ever. */
  maxLevel?: number;
  params?: Record<string, string>;
}) {
  const { t, n } = useLanguage();
  const { back, push } = useNavigation();
  const progress = useLevelProgress(game, track);
  const current = progress?.level ?? 1;
  const finished = maxLevel !== undefined && current > maxLevel;
  const shown = Math.min(maxLevel ?? Infinity, Math.max(20, Math.ceil((current + 8) / 5) * 5));
  const play = (level: number) => push({ name: "game", game, screen: "play", params: { ...params, mode: "level", level } });

  return (
    <Screen theme="night">
      <TopBar
        onBack={back}
        backLabel={t("backToGame", { game: t(name) })}
        title={t("levelsTitle", { game: t(name) })}
        subtitle={progress ? t("levelsSummary", { done: current - 1 }) : t("loading")}
        titleSize={24}
      />
      <Body style={{ paddingBottom: 20 }}>
        {finished && <p className="small" style={{ color: accent }}>{t("allLevelsDone")}</p>}
        <div role="list" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
          {Array.from({ length: shown }, (_, i) => {
            const level = i + 1;
            const solved = level < current;
            const isCurrent = level === current;
            const locked = level > current;
            return (
              <div role="listitem" key={level}>
                <button
                  type="button"
                  disabled={locked || !progress}
                  onClick={() => play(level)}
                  aria-label={`${t("levelN", { n: level })}${solved ? `, ${t("solvedLabel")}` : isCurrent ? `, ${t("levelCurrent")}` : `, ${t("levelLocked")}`}`}
                  aria-current={isCurrent ? "step" : undefined}
                  style={{
                    width: "100%", height: 52, padding: 0, borderRadius: 12,
                    border: `2px solid ${isCurrent ? accent : "transparent"}`,
                    background: solved ? "#1E2138" : isCurrent ? "var(--surface)" : "#14172A",
                    color: locked ? "#4A4E70" : "var(--text)", fontSize: 15, fontWeight: 700,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                    cursor: locked ? "default" : "pointer",
                  }}
                >
                  <span className="num">{n(level)}</span>
                  {solved && <Icon name="check" size={12} strokeWidth={3} color={accent} />}
                  {locked && <Icon name="lock" size={12} />}
                </button>
              </div>
            );
          })}
        </div>
      </Body>
      {!finished && (
        <div className="screen__bar">
          <button type="button" className="btn" disabled={!progress} style={{ background: accent, color: accentInk }} onClick={() => play(current)}>
            {current > 1 ? t("continueLevel", { n: current }) : t("startLevel1")}
          </button>
        </div>
      )}
    </Screen>
  );
}
