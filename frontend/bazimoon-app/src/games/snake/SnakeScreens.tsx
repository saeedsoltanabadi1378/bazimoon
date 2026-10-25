import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { IconButton, Screen } from "../../ui/components";
import { Icon } from "../../ui/Icon";
import { formatClock, puzzleToday } from "../../lib/format";
import { dailyNumber, randomSeed } from "../../lib/rng";
import { readLocal, writeLocal } from "../../lib/storage";
import { haptic } from "../../lib/haptics";
import { IntroScreen } from "../shared/IntroScreen";
import { ResultScreen } from "../shared/ResultScreen";
import { parseXp, useFinish, useTrackStarted, type ResultParams } from "../shared/play";
import { canTurn, fruitSequence, SIZE, start, step, stepMs, type Dir, type SnakeMode, type SnakeState } from "./logic";

const ACCENT = "#9ED98C";
const INK = "#0F1F0B";
const BEST_KEY = "bazimoon-snake-best";
const dailyKey = (number: number) => `bazimoon-snake-daily-${number}`;

/** A little coiled snake for the intro and result heroes. */
function SnakeArt({ size = 120 }: { size?: number }) {
  const cells: [number, number][] = [[1, 1], [2, 1], [3, 1], [4, 1], [4, 2], [4, 3], [3, 3], [2, 3], [1, 3], [1, 4], [1, 5], [2, 5], [3, 5]];
  const c = size / 7;
  return (
    <div style={{ width: size, height: size, position: "relative", borderRadius: 14, background: "#0F1A12" }} dir="ltr">
      {cells.map(([x, y], i) => (
        <span key={i} style={{ position: "absolute", left: x * c + 1, top: y * c + 1, width: c - 2, height: c - 2, borderRadius: i === cells.length - 1 ? c / 2 : 4, background: i === cells.length - 1 ? "#C8F0B8" : "#6FBF5C" }} />
      ))}
      <span style={{ position: "absolute", left: 5 * c + c / 4, top: 5 * c + c / 4, width: c / 2, height: c / 2, borderRadius: 999, background: "#F08A7A" }} />
    </div>
  );
}

export function SnakeIntro() {
  const { t, n } = useLanguage();
  const { push, replace } = useNavigation();
  const { api } = useHub();
  const stats = useLoad(() => api.stats("snake"), [api]).data;
  const number = dailyNumber("snake", puzzleToday());
  const dailyDone = readLocal<ResultParams | null>(dailyKey(number), null);
  const best = Math.max(stats?.bestScore ?? 0, readLocal<number>(BEST_KEY, 0));
  const play = (mode: SnakeMode) => push({ name: "game", game: "snake", screen: "play", params: { mode } });

  return (
    <IntroScreen
      game="snake"
      title={t("gameSnake")}
      tagline={t("snakeTagline")}
      accent={ACCENT}
      accentInk={INK}
      heroBg="#0F1A12"
      preview={<SnakeArt />}
      badge={best > 0 ? t("snakeBestBadge", { score: n(best) }) : undefined}
      heroTitle={t("snakeHeroTitle")}
      heroSub={t("snakeHeroSub")}
      modes={[
        { key: "classic", label: t("snakeClassic"), desc: t("snakeClassicDesc"), play: t("snakeStart"), onPlay: () => play("classic") },
        {
          key: "daily", label: t("modeDaily"), desc: t("snakeDailyDesc", { number }),
          play: dailyDone ? t("stackSeeToday") : t("snakePlayDaily"),
          onPlay: () => (dailyDone ? replace({ name: "game", game: "snake", screen: "result", params: dailyDone }) : play("daily")),
        },
        { key: "wrap", label: t("snakeWrap"), desc: t("snakeWrapDesc"), play: t("snakeStart"), onPlay: () => play("wrap") },
      ]}
      stats={[
        { value: stats ? n(stats.played) : "—", label: t("statGames") },
        { value: best ? n(best) : "—", label: t("statBest") },
        { value: stats?.averageScore != null ? n(stats.averageScore) : "—", label: t("statAverage") },
        { value: stats?.maxDetail != null ? n(stats.maxDetail) : "—", label: t("snakeLongest") },
      ]}
      steps={[
        { title: t("snakeStep1"), text: t("snakeStep1Text") },
        { title: t("snakeStep2"), text: t("snakeStep2Text") },
        { title: t("snakeStep3"), text: t("snakeStep3Text") },
        { title: t("snakeStep4"), text: t("snakeStep4Text") },
      ]}
      rewards={[t("snakeRewardFruit"), t("snakeRewardGold"), t("stackRewardWeekly")]}
      secondary={{ label: t("stackHighScores"), onClick: () => push({ name: "league" }) }}
    />
  );
}

const KEYS: Record<string, Dir> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
};

export function SnakePlay({ mode }: { mode: SnakeMode }) {
  const { t, n, language } = useLanguage();
  const { back } = useNavigation();
  const finish = useFinish("snake");
  useTrackStarted("snake");
  const number = dailyNumber("snake", puzzleToday());
  const seq = useRef(fruitSequence(mode === "daily" ? `snake-daily-${number}` : `snake-${randomSeed()}`)).current;
  const [state, setState] = useState<SnakeState>(() => start(seq));
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const queue = useRef<Dir[]>([]);
  const elapsed = useRef(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const best = readLocal<number>(BEST_KEY, 0);

  const turn = useCallback((dir: Dir) => {
    if (paused) return;
    const q = queue.current;
    const last = q.length ? q[q.length - 1] : state.dir;
    if (!started) {
      if (dir === "left") return; // the snake faces right; it can't reverse into itself
      setStarted(true);
      queue.current = dir === "right" ? [] : [dir];
      haptic.tap();
      return;
    }
    if (q.length < 2 && canTurn(last, dir)) {
      q.push(dir);
      haptic.select();
    }
  }, [paused, started, state.dir]);

  // One game step per tick; the tick shortens as the snake eats.
  useEffect(() => {
    if (!started || paused || state.dead) return;
    const ms = stepMs(state.eaten, mode);
    const id = window.setTimeout(() => {
      const dir = queue.current.shift() ?? state.dir;
      const next = step(state, dir, mode, seq);
      elapsed.current += ms;
      if (next.eaten > state.eaten) haptic.tap();
      setState(next);
    }, ms);
    return () => window.clearTimeout(id);
  }, [started, paused, state, mode, seq]);

  useEffect(() => {
    if (!state.dead) return;
    haptic.error();
    if (state.score > readLocal<number>(BEST_KEY, 0)) writeLocal(BEST_KEY, state.score);
    const params: ResultParams = { mode, number, score: state.score, eaten: state.eaten, length: state.body.length, timeMs: Math.round(elapsed.current), previousBest: best };
    const id = window.setTimeout(() => {
      void finish(
        { mode, puzzleNumber: mode === "daily" ? number : null, solved: true, score: state.score, moves: state.eaten, detail: state.body.length, hints: 0 },
        params,
      );
    }, 900);
    if (mode === "daily") writeLocal(dailyKey(number), params);
    return () => window.clearTimeout(id);
    // Runs once, when the snake dies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.dead]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEYS[e.key];
      if (dir) {
        e.preventDefault();
        turn(dir);
      } else if (e.key === "Escape" || e.key === "p") setPaused((p) => started && !state.dead && !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn, started, state.dead]);

  useEffect(() => {
    const onHide = () => {
      if (document.hidden && started) setPaused(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [started]);

  function onPointerDown(e: PointerEvent) {
    swipe.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: PointerEvent) {
    const s = swipe.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    swipe.current = { x: e.clientX, y: e.clientY };
  }

  const cell = 100 / SIZE;
  const pad = (dir: Dir, rotate: number, label: string) => (
    <button type="button" className="icon-btn" aria-label={label} onClick={() => turn(dir)} style={{ width: 64, height: 52, borderRadius: 16 }}>
      <span style={{ display: "flex", transform: `rotate(${rotate}deg)` }}><Icon name="back" size={24} /></span>
    </button>
  );

  return (
    <Screen theme="night">
      <div className="row row--between" style={{ padding: "14px 16px 8px" }}>
        <IconButton icon="back" label={t("backToGame", { game: t("gameSnake") })} onClick={back} />
        <div style={{ textAlign: "center" }}>
          <div className="display num" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }} aria-live="polite">{n(state.score)}</div>
          <div className="tiny muted">
            {mode === "daily" ? t("snakeDailyN", { number }) : best ? t("snakeScoreBest", { best: n(best) }) : t("snakeScore")}
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={paused ? t("resumeGame") : t("pauseGame")}
          onClick={() => started && !state.dead && setPaused((p) => !p)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={paused ? "M8 5v14l11-7z" : "M7 5h4v14H7zM13 5h4v14h-4z"} /></svg>
        </button>
      </div>

      <div style={{ padding: "8px 16px 0", display: "flex", justifyContent: "center" }}>
        <div
          role="application"
          aria-label={t("snakeBoardLabel")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (swipe.current = null)}
          onPointerCancel={() => (swipe.current = null)}
          dir="ltr"
          style={{
            width: "min(100%, 440px, calc(100dvh - 330px))", aspectRatio: "1", position: "relative", borderRadius: 18, touchAction: "none",
            background: "#0F1A12", border: mode === "wrap" ? "2px dashed #2E4A2A" : "2px solid #2E4A2A", overflow: "hidden",
            backgroundImage: `linear-gradient(#14241A 1px, transparent 1px), linear-gradient(90deg, #14241A 1px, transparent 1px)`,
            backgroundSize: `${cell}% ${cell}%`,
          }}
        >
          <span
            style={{
              position: "absolute", left: `${state.food.x * cell}%`, top: `${state.food.y * cell}%`, width: `${cell}%`, height: `${cell}%`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <span className={state.gold ? "snake-gold" : undefined} style={{ width: "62%", height: "62%", borderRadius: 999, background: state.gold ? "#F6C377" : "#F08A7A", boxShadow: state.gold ? "0 0 10px #F0A83A" : undefined }} />
          </span>
          {state.body.map((c, i) => (
            <span
              key={i}
              style={{
                position: "absolute", left: `calc(${c.x * cell}% + 1px)`, top: `calc(${c.y * cell}% + 1px)`, width: `calc(${cell}% - 2px)`, height: `calc(${cell}% - 2px)`,
                borderRadius: i === 0 ? "40%" : "22%", background: state.dead && i === 0 ? "#F08A7A" : i === 0 ? "#C8F0B8" : i % 2 ? "#6FBF5C" : "#5FAE4E",
              }}
            />
          ))}
          {!started && (
            <div className="stack center" style={{ position: "absolute", inset: 0, justifyContent: "center", gap: 6, background: "rgba(11,13,26,0.55)", textAlign: "center", padding: 16 }}>
              <div className="display" style={{ fontSize: 24, fontWeight: 800 }}>{t("snakeSwipeToStart")}</div>
              <div className="small muted">{t("snakeSwipeHint")}</div>
            </div>
          )}
          {state.dead && (
            <div className="stack center" style={{ position: "absolute", inset: 0, justifyContent: "center", gap: 6, background: "rgba(11,13,26,0.75)" }}>
              <div className="display" style={{ fontSize: 30, fontWeight: 800 }}>{t("snakeCrashed")}</div>
              <div className="small" style={{ color: "var(--text-2)" }}>{t("snakePoints", { count: n(state.score) })}</div>
            </div>
          )}
          {paused && !state.dead && (
            <div className="stack center" style={{ position: "absolute", inset: 0, justifyContent: "center", gap: 12, background: "rgba(11,13,26,0.86)" }}>
              <div className="display" style={{ fontSize: 28, fontWeight: 800 }}>{t("pausedTitle")}</div>
              <button type="button" className="btn btn--auto" style={{ minHeight: 48, padding: "0 22px", background: ACCENT, color: INK, fontSize: 15 }} onClick={() => setPaused(false)}>
                {t("resumeGame")}
              </button>
              <button type="button" onClick={back} style={{ border: 0, background: "transparent", color: ACCENT, fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 40 }}>
                {t("quitToMenu")}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="row" style={{ justifyContent: "center", gap: 16, padding: "10px 16px 0" }}>
        <span className="tiny muted">{t("snakeLengthN", { count: n(state.body.length) })}</span>
        <span className="tiny muted">{formatClock(elapsed.current, language)}</span>
        {state.gold && <span className="tiny" style={{ color: "#F6C377", fontWeight: 600 }}>{t("snakeGoldNow")}</span>}
      </div>

      <div className="stack center" style={{ gap: 6, padding: "10px 16px calc(18px + env(safe-area-inset-bottom))", marginTop: "auto" }} dir="ltr">
        {pad("up", 90, t("snakeUp"))}
        <div className="row" style={{ gap: 6 }}>
          {pad("left", 0, t("snakeLeft"))}
          {pad("down", -90, t("snakeDown"))}
          {pad("right", 180, t("snakeRight"))}
        </div>
      </div>
    </Screen>
  );
}

export function SnakeResult({ params }: { params?: ResultParams }) {
  const { t, n, language } = useLanguage();
  const { replace } = useNavigation();
  const xp = parseXp(params);
  const mode = (params?.mode as SnakeMode) ?? "classic";
  const score = Number(params?.score ?? 0);
  const previousBest = Number(params?.previousBest ?? 0);
  const newBest = xp?.newBest ?? score > previousBest;
  const best = Math.max(previousBest, score);

  return (
    <ResultScreen
      win={newBest}
      hero={<div className="row" style={{ justifyContent: "center" }}><SnakeArt size={92} /></div>}
      heroColors={["#14241A", ACCENT]}
      kicker={mode === "daily" ? t("snakeDailyN", { number: Number(params?.number ?? 0) }) : newBest ? t("newPersonalBest") : t("snakeCrashed")}
      title={t("snakePoints", { count: n(score) })}
      sub={newBest && previousBest > 0 ? t("snakeBeatBy", { best: n(previousBest), by: n(score - previousBest) }) : newBest ? t("snakeFirstBest") : t("snakeBestStill", { best: n(best) })}
      metrics={[
        { value: n(Number(params?.eaten ?? 0)), label: t("snakeFruit"), color: "#F08A7A" },
        { value: n(Number(params?.length ?? 0)), label: t("snakeLength") },
        { value: formatClock(Number(params?.timeMs ?? 0), language), label: t("statTime") },
      ]}
      xp={xp}
      accent={ACCENT}
      accentInk={INK}
      share={{ text: t("snakeShare", { count: score }) }}
      onClose={() => replace({ name: "game", game: "snake", screen: "intro" })}
      primary={mode === "daily"
        ? { label: t("snakePlayClassic"), onClick: () => replace({ name: "game", game: "snake", screen: "play", params: { mode: "classic" } }) }
        : { label: t("playAgainGame"), onClick: () => replace({ name: "game", game: "snake", screen: "play", params: { mode, at: Date.now() } }) }}
      secondary={{ label: t("quitToMenu"), onClick: () => replace({ name: "game", game: "snake", screen: "intro" }) }}
    />
  );
}
