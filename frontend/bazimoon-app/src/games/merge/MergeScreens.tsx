import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { Body, IconButton, Screen } from "../../ui/components";
import { Icon } from "../../ui/Icon";
import { haptic } from "../../lib/haptics";
import { formatClock } from "../../lib/format";
import { shareLink } from "../../lib/platform";
import { appLink } from "../../lib/links";
import { IntroScreen, PreviewGrid } from "../shared/IntroScreen";
import { XpCard } from "../shared/ResultScreen";
import { parseXp, useFinish, useSavedState, useStopwatch, type ResultParams } from "../shared/play";
import { canMove, move, newGame, tileStyle, type Dir, type MergeState } from "./logic";
import { readLocal, removeLocal, writeLocal } from "../../lib/storage";
import { MergeBoardView, SwipeHint, useMergeTiles } from "./MergeBoard";

/** Set once the player has made their first move, so the swipe hint shows only on the first game. */
const HINT_KEY = "bazimoon-merge-hint-seen";

const ACCENT = "#9C8CFF";
type MergeMode = "classic" | "big" | "timed";
const TIME_ATTACK_MS = 180_000;

export function MergeIntro() {
  const { t, n } = useLanguage();
  const { push } = useNavigation();
  const { api, profile } = useHub();
  const stats = useLoad(() => api.stats("merge"), [api]).data;
  const saved = readLocal<{ score: number; over: boolean } | null>("bazimoon-merge-classic", null);
  const inProgress = saved && !saved.over && saved.score > 0;
  const bigLocked = (profile?.level ?? 1) < 10;
  const preview = [2, 0, 4, 8, 0, 16, 32, 4, 64, 128, 8, 2, 1024, 512, 256, 16];

  return (
    <IntroScreen
      title={t("gameMerge")}
      tagline={t("mergeTagline")}
      accent={ACCENT}
      heroBg="#16143A"
      preview={<PreviewGrid cols={4} cells={preview.map((v) => ({ bg: tileStyle(v)[0], fg: tileStyle(v)[1], text: v ? <span style={{ fontSize: v >= 1000 ? 7 : 9 }}>{v}</span> : "" }))} />}
      badge={inProgress ? t("gameInProgress") : undefined}
      heroTitle={t("mergeHeroTitle")}
      heroSub={t("mergeHeroSub")}
      modes={[
        {
          key: "classic", label: t("mergeClassic"), desc: t("mergeClassicDesc"),
          play: inProgress ? t("continueScore", { score: n(saved!.score) }) : t("newGame"),
          onPlay: () => push({ name: "game", game: "merge", screen: "play", params: { mode: "classic" } }),
        },
        {
          key: "big", label: t("mergeBig"), desc: t("mergeBigDesc"),
          play: bigLocked ? t("unlocksAtLevel", { level: 10 }) : t("mergeNewBig"), disabled: bigLocked,
          onPlay: () => push({ name: "game", game: "merge", screen: "play", params: { mode: "big" } }),
        },
        {
          key: "timed", label: t("mergeTimed"), desc: t("mergeTimedDesc"), play: t("mergeStartTimed"),
          onPlay: () => push({ name: "game", game: "merge", screen: "play", params: { mode: "timed" } }),
        },
      ]}
      stats={[
        { value: stats?.played ?? "—", label: t("statGames") },
        { value: stats?.bestScore != null ? n(stats.bestScore) : "—", label: t("statBest") },
        { value: stats?.maxDetail ?? "—", label: t("topTile") },
        { value: stats?.solved ?? "—", label: t("count2048") },
      ]}
      steps={[
        { title: t("mergeStep1"), text: t("mergeStep1Text") },
        { title: t("mergeStep2"), text: t("mergeStep2Text") },
        { title: t("mergeStep3"), text: t("mergeStep3Text") },
        { title: t("mergeStep4"), text: t("mergeStep4Text") },
      ]}
      rewards={[t("mergeReward1"), t("mergeReward2"), t("mergeReward3")]}
    />
  );
}

type Saved = MergeState & { over: boolean; elapsed: number };

export function MergePlay({ mode }: { mode: MergeMode }) {
  const { t, n, language } = useLanguage();
  const { back } = useNavigation();
  const { api } = useHub();
  const finish = useFinish("merge");
  const size = mode === "big" ? 5 : 4;
  const fresh = (): Saved => ({ ...newGame(size, mode === "timed" ? 0 : 3), over: false, elapsed: 0 });
  // Time attack always starts fresh; classic and big board resume where you left off.
  useState(() => {
    if (mode === "timed") removeLocal("bazimoon-merge-timed");
  });
  const [state, setState, clearSaved] = useSavedState<Saved>(`bazimoon-merge-${mode}`, fresh);
  const [confirmNew, setConfirmNew] = useState(false);
  const best = useLoad(() => api.stats("merge"), [api]).data?.bestScore ?? 0;
  const stuck = !canMove(state.grid, size);
  const [elapsed] = useStopwatch(mode === "timed" && !state.over && !stuck, state.elapsed);
  const timeLeft = Math.max(0, TIME_ATTACK_MS - elapsed);
  const timeUp = mode === "timed" && timeLeft <= 0;
  const wonPause = state.won && !state.keepGoing;
  const over = stuck || timeUp;
  const start = useRef<{ x: number; y: number } | null>(null);
  const { tiles, animate } = useMergeTiles(state.grid);
  const [shake, setShake] = useState(0);
  const [gain, setGain] = useState<{ value: number; key: number } | null>(null);
  const [hint, setHint] = useState(() => !readLocal<boolean>(HINT_KEY, false));

  useEffect(() => {
    if (over !== state.over) setState((s) => ({ ...s, over, elapsed }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  useEffect(() => {
    if (mode === "timed") setState((s) => ({ ...s, elapsed }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(elapsed / 1000)]);

  function doMove(dir: Dir) {
    if (over || wonPause) return;
    const next = move(state, dir);
    if (!next) {
      haptic.warn();
      setShake((k) => k + 1);
      return;
    }
    haptic.tap();
    animate(state.grid, next.grid, size, dir);
    if (next.score > state.score) setGain({ value: next.score - state.score, key: next.moves });
    if (hint) {
      setHint(false);
      writeLocal(HINT_KEY, true);
    }
    setConfirmNew(false);
    setState({ ...next, over: false, elapsed });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = ({ ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" } as Record<string, Dir>)[e.key];
      if (dir) {
        e.preventDefault();
        doMove(dir);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const top = Math.max(...state.grid);
  const nextGoal = [64, 128, 256, 512, 1024, 2048].find((g) => top < g) ?? 2048;
  const xp = Math.floor(state.score / 50);

  async function seeResults() {
    clearSaved();
    await finish(
      { mode, solved: top >= 2048, score: state.score, moves: state.moves, detail: top },
      { mode, score: state.score, moves: state.moves, top, undosUsed: state.undosUsed, grid: JSON.stringify(state.grid), size, previousBest: best },
    );
  }

  function restart() {
    setState(fresh());
    setConfirmNew(false);
  }

  const boardPx = Math.min(340, (typeof window !== "undefined" ? window.innerWidth : 390) - 32);

  return (
    <Screen theme="night">
      <header className="topbar">
        <IconButton icon="back" label={t("backToGame", { game: t("gameMerge") })} onClick={back} />
        <div className="topbar__text">
          <div className="display" style={{ fontSize: 24 }}>{t("mergeShort")}</div>
          <div className="tiny muted">{mode === "timed" ? t("mergeTimedSub") : mode === "big" ? t("mergeBigSub") : t("mergeClassicSub")}</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {[[t("score"), state.score], [t("statBest"), Math.max(best, state.score)]].map(([label, value]) => (
            <div key={String(label)} style={{ position: "relative", minWidth: 64, padding: "6px 10px", borderRadius: 12, background: "var(--surface)", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: "var(--muted)" }}>{label}</div>
              <div className="num" style={{ fontSize: 17, fontWeight: 700 }}>{n(Number(value))}</div>
              {label === t("score") && gain && (
                <span key={gain.key} className="score-gain num" aria-hidden="true" style={{ position: "absolute", insetInline: 0, top: -14, color: ACCENT, fontSize: 15, fontWeight: 800, pointerEvents: "none" }}>
                  +{n(gain.value)}
                </span>
              )}
            </div>
          ))}
        </div>
      </header>

      <Body tight>
        <div className="row" style={{ gap: 10, padding: "10px 12px", borderRadius: 14, background: "var(--surface)" }}>
          <span className="grow" style={{ fontSize: 13, color: "var(--text-2)" }}>
            {mode === "timed"
              ? t("timeLeft", { time: formatClock(timeLeft, language) })
              : top >= 2048 ? t("mergeReached2048") : t("mergeGoal", { top, next: nextGoal })}
          </span>
          <span style={{ padding: "4px 10px", borderRadius: 999, background: "#2A2113", color: "#F0A83A", fontSize: 12, fontWeight: 600 }}>{t("xpGained", { xp })}</span>
        </div>

        <div
          dir="ltr"
          role="application"
          aria-label={t("mergeBoardLabel")}
          onPointerDown={(e) => (start.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={(e) => {
            const s = start.current;
            start.current = null;
            if (!s) return;
            const dx = e.clientX - s.x, dy = e.clientY - s.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
            if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? "right" : "left");
            else doMove(dy > 0 ? "down" : "up");
          }}
          style={{ alignSelf: "center", touchAction: "none", userSelect: "none" }}
        >
          <MergeBoardView tiles={tiles} size={size} boardPx={boardPx} shake={shake}>
          {hint && !over && <SwipeHint label={t("mergeSwipeHint")} />}
          {(over || wonPause) && (
            <div style={{ position: "absolute", inset: 0, borderRadius: 22, background: "rgba(11,13,26,0.86)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
              <div className="display" style={{ fontSize: 28 }}>{wonPause && !over ? t("youMade2048") : timeUp ? t("timesUp") : t("noMovesLeft")}</div>
              <div style={{ fontSize: 15, color: "var(--text-2)" }}>{t("scoreXp", { score: n(state.score), xp })}</div>
              {wonPause && !over ? (
                <button type="button" className="btn btn--primary btn--pill" onClick={() => setState((s) => ({ ...s, keepGoing: true }))}>{t("keepPlaying")}</button>
              ) : null}
              <button type="button" className={wonPause && !over ? "btn btn--ghost btn--auto" : "btn btn--primary btn--pill"} style={wonPause && !over ? { color: ACCENT, fontWeight: 600 } : undefined} onClick={() => void seeResults()}>
                {t("seeResults")}
              </button>
            </div>
          )}
          </MergeBoardView>
        </div>
      </Body>

      <div className="screen__bar screen__bar--row" style={{ gap: 8 }}>
        {mode !== "timed" && (
          <button
            type="button"
            className="btn btn--outline grow"
            style={{ fontSize: 15, minHeight: 50, color: state.prev && state.undos ? "var(--text)" : "#5A5D7C" }}
            disabled={!state.prev || !state.undos || over}
            onClick={() => {
              if (!state.prev || !state.undos) return;
              setState((s) => ({ ...s, grid: s.prev!.grid, score: s.prev!.score, prev: null, undos: s.undos - 1, undosUsed: s.undosUsed + 1 }));
            }}
          >
            {t("undoLeft", { count: state.undos })}
          </button>
        )}
        <button
          type="button"
          className="btn grow"
          style={{ fontSize: 15, minHeight: 50, background: confirmNew ? "#E5604D" : ACCENT, color: confirmNew ? "#1C0905" : "#120D2E" }}
          onClick={() => {
            if (state.score > 0 && !over && !confirmNew) {
              haptic.warn();
              setConfirmNew(true);
              return;
            }
            restart();
          }}
        >
          {confirmNew ? t("tapToDiscard", { score: n(state.score) }) : t("newGame")}
        </button>
      </div>
    </Screen>
  );
}

export function MergeResult({ params }: { params?: ResultParams }) {
  const { t, n } = useLanguage();
  const { replace, reset } = useNavigation();
  const { api } = useHub();
  const xp = parseXp(params);
  const mode = String(params?.mode ?? "classic") as MergeMode;
  const score = Number(params?.score ?? 0);
  const moves = Number(params?.moves ?? 0);
  const top = Number(params?.top ?? 0);
  const undosUsed = Number(params?.undosUsed ?? 0);
  const previousBest = Number(params?.previousBest ?? 0);
  const size = Number(params?.size ?? 4);
  const grid: number[] = (() => {
    try {
      return JSON.parse(String(params?.grid ?? "[]"));
    } catch {
      return [];
    }
  })();
  const weekly = useLoad(() => api.weekly("merge"), [api]).data;
  const newBest = xp?.newBest ?? score > previousBest;
  const made2048 = top >= 2048;
  const kicker = made2048 ? t("youMade2048") : newBest ? t("newPersonalBest") : t("noMovesLeft");
  const kickerColor = made2048 ? "#F6C377" : newBest ? "#F0A83A" : "#F08A7A";
  const sub = newBest && previousBest > 0
    ? t("beatBestBy", { best: n(previousBest), by: n(score - previousBest) })
    : newBest ? t("firstScoreOnBoard") : t("bestStill", { best: n(Math.max(previousBest, score)) });

  return (
    <Screen theme="night">
      <div className="row" style={{ justifyContent: "flex-end", padding: "14px 16px 0" }}>
        <IconButton icon="close" label={t("close")} onClick={() => reset({ name: "home" })} />
      </div>
      <Body style={{ paddingTop: 0, paddingBottom: 20 }}>
        <section className="stack center" style={{ gap: 6, textAlign: "center" }}>
          <div className="kicker" style={{ color: kickerColor }}>{kicker}</div>
          <h1 className="display num" style={{ fontSize: 48, lineHeight: 1 }}>{n(score)}</h1>
          <p style={{ fontSize: 15, color: "var(--text-2)" }}>{sub}</p>
        </section>
        {grid.length > 0 && (
          <div style={{ alignSelf: "center", padding: 8, borderRadius: 16, background: "var(--surface)" }}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gap: 6, width: 184 }} dir="ltr">
              {grid.map((v, i) => {
                const [bg, fg] = tileStyle(v);
                return (
                  <div key={i} className="display" style={{ height: (184 - 6 * (size - 1)) / size, borderRadius: 8, background: bg, color: fg, fontSize: v >= 1024 ? 13 : v >= 128 ? 15 : 17, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: v >= 1024 ? `0 0 12px ${bg}88` : "none" }}>
                    {v || ""}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="stat-grid stat-grid--4">
          {[
            [String(top), t("topTile")],
            [n(moves), t("movesLabel")],
            [n(undosUsed), t("undosUsed")],
            [weekly?.yourRank ? `#${n(weekly.yourRank)}` : "—", t("thisWeekShort")],
          ].map(([v, l], i) => (
            <div key={String(l)} className="stat stat--center" style={{ padding: "10px 6px" }}>
              <div className="stat__value" style={{ fontSize: 17, color: i === 3 && weekly?.yourRank && weekly.yourRank <= 3 ? "#5FD0BE" : undefined }}>{v}</div>
              <div className="stat__label">{l}</div>
            </div>
          ))}
        </div>
        {xp && <XpCard xp={xp} />}
        {weekly && (
          <section className="stack" style={{ gap: 10, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
            <div className="row row--between">
              <span style={{ fontSize: 14, fontWeight: 600 }}>{t("weeklyHighScores", { division: t(`division${weekly.division}` as "divisionGold") })}</span>
              <span className="tiny muted">{t("daysLeft", { count: weekly.daysLeft })}</span>
            </div>
            {weekly.rows.length === 0 && <div className="small muted">{t("boardEmpty")}</div>}
            {weekly.rows.map((r) => (
              <div key={`${r.rank}-${r.name}`} className="row" style={{ gap: 10, padding: "4px 6px", borderRadius: 10, background: r.isYou ? "#1E2138" : "transparent" }}>
                <span style={{ width: 22, fontSize: 13, fontWeight: 600, color: r.rank <= 3 ? "#5FD0BE" : "var(--muted)" }}>#{n(r.rank)}</span>
                <span className="grow" style={{ fontSize: 14 }}>{r.isYou ? t("youName", { name: r.name }) : r.name}</span>
                <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>{n(r.score)}</span>
              </div>
            ))}
          </section>
        )}
      </Body>
      <div className="screen__bar screen__bar--row" style={{ gap: 8 }}>
        <button type="button" className="btn btn--outline" style={{ flex: 1, fontSize: 15 }} onClick={() => void shareLink(appLink(), t("mergeShare", { score: n(score), top }))}>
          <Icon name="share" size={18} />
          {t("shareScore")}
        </button>
        <button type="button" className="btn" style={{ flex: 1.3, fontSize: 15, background: ACCENT, color: "#0B0D1A" }} onClick={() => replace({ name: "game", game: "merge", screen: "play", params: { mode } })}>
          {made2048 ? t("playAgainGame") : newBest ? t("playAgainGame") : t("tryAgainGame")}
        </button>
      </div>
    </Screen>
  );
}
