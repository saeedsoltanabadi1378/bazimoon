import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLanguage, type TranslationKey } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub } from "../../hub/HubData";
import { Screen } from "../../ui/components";
import { haptic } from "../../lib/haptics";
import { dailyNumber, randomSeed } from "../../lib/rng";
import { puzzleToday } from "../../lib/format";
import { useTrackStarted, type ResultParams } from "../shared/play";
import {
  W, aimAt, aimFromAngle, angleOf, cellAt, cloneRun, createRun, endShot, goalProgress, guide, inDanger, startShot, stepShot, firePower,
  type Aim, type BrickType, type GameEvent, type PowerKey, type RunState, type Setup, type Shot, type ShotSummary,
} from "./engine";
import { LEVELS_PER_WORLD, levelDef, starsFor } from "./levels";
import { better, challengeDef, medalFor } from "./challenges";
import { DAILY_TRIES, dailyDef, dailyScore } from "./daily";
import {
  clearRun, getProfile, loadRun, markBrickTips, recordChallenge, recordDaily, recordEndlessEnd, recordLevel, recordPower, recordRound, recordShot,
  refreshDay, runKey, saveRun, setSettings, startDailyTry, useBricksProfile, type RunMode, type SavedRun,
} from "./progress";
import { BoardRenderer, type Look } from "./render";
import { play, playMusic, setVolumes, unlockAudio } from "./audio";
import { ACCENT, BRICK_ICON, GOLD, INK, NoticeToasts, POWER_ICON, Svg } from "./ui";

export interface Session {
  mode: RunMode;
  ref: number;
  setup: Setup;
  initial: { bricks: number; marked: number };
}

export function sessionFor(mode: RunMode, ref: number): Session {
  if (mode === "adventure") {
    const def = levelDef(ref);
    return { mode, ref: def.number, setup: def.setup, initial: def.initial };
  }
  if (mode === "daily") {
    const def = dailyDef(ref);
    return { mode, ref, setup: def.setup, initial: def.initial };
  }
  if (mode === "challenge") {
    const def = challengeDef(ref);
    return { mode, ref: def.id, setup: def.setup, initial: { bricks: def.setup.bricks.length, marked: 0 } };
  }
  return {
    mode: "endless", ref: 0, initial: { bricks: 0, marked: 0 },
    setup: { seed: randomSeed(), balls: 1, bricks: [], rings: [], flow: "endless", goal: { kind: "endless" }, shotLimit: null, powerups: true },
  };
}

export const todayDaily = () => dailyNumber("bricks", puzzleToday());

const POWERS: PowerKey[] = ["hlaser", "vlaser", "bomb", "double", "shield"];
const COMBO_KEY: Record<string, TranslationKey> = {
  nice: "bricksComboNice", great: "bricksComboGreat", amazing: "bricksComboAmazing", incredible: "bricksComboIncredible", legendary: "bricksComboLegendary",
};

export function BricksPlay({ mode, refNumber, fresh }: { mode: RunMode; refNumber: number; fresh: boolean }) {
  const { t, n } = useLanguage();
  const { back, replace } = useNavigation();
  const { submitResult } = useHub();
  useTrackStarted("bricks");
  const profile = useBricksProfile();
  const settings = profile.settings;
  const key = runKey(mode, refNumber);

  // ------------------------------------------------------------------ the run
  const session = useMemo(() => sessionFor(mode, refNumber), [mode, refNumber]);
  const startedWith = useRef({ coins: getProfile().stats.coinsEarned, achievements: Object.keys(getProfile().achievements) });
  const [blocked, setBlocked] = useState(false);
  const initial = useMemo((): { run: RunState; pending: SavedRun["pending"]; timeMs: number } => {
    if (mode === "daily") refreshDay(todayDaily());
    const saved = fresh ? null : loadRun(key);
    if (saved) return { run: saved.run, pending: saved.pending, timeMs: saved.timeMs };
    return { run: createRun(session.setup), pending: null, timeMs: 0 };
    // Built once per mount; a restart builds a new run itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const runRef = useRef<RunState>(initial.run);
  const shotRef = useRef<Shot | null>(null);
  const snapshotRef = useRef<RunState>(cloneRun(initial.run));
  const timeRef = useRef(initial.timeMs);
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick((x) => x + 1), []);
  const run = runRef.current;

  // A daily try starts when its board is first shown; three a day.
  useEffect(() => {
    if (mode !== "daily" || loadRun(key)) return;
    const p = getProfile();
    if (p.daily.tries >= DAILY_TRIES) { setBlocked(true); return; }
    startDailyTry();
    // Saved at once, so the try is counted once and can be continued if the game is left.
    saveRun({ key, mode, ref: refNumber, run: runRef.current, pending: null, timeMs: 0, savedAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------ view state
  const [aim, setAimState] = useState<Aim | null>(null);
  // The latest aim, readable at once: a quick tap can lift the finger before React re-renders.
  const aimRef = useRef<Aim | null>(null);
  const setAim = useCallback((a: Aim | null) => { aimRef.current = a; setAimState(a); }, []);
  const dragging = useRef(false);
  const [targeting, setTargeting] = useState<"hlaser" | "vlaser" | "bomb" | null>(null);
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const [doubleArmed, setDoubleArmed] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [combo, setCombo] = useState<{ word: string; key: number; legendary: boolean } | null>(null);
  const [tip, setTip] = useState<{ kind: "brick"; type: Exclude<BrickType, "std"> } | { kind: "power"; type: PowerKey } | null>(null);
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ResultParams | null>(null);
  const shooting = shotRef.current !== null;
  const over = run.over !== null;

  // ------------------------------------------------------------------ canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<BoardRenderer | null>(null);
  const [boardWidth, setBoardWidth] = useState(330);
  const look: Look = useMemo(() => ({
    ball: profile.equipped.ball, trail: profile.equipped.trail, theme: profile.equipped.theme, colorblind: settings.colorblind,
    particles: settings.reducedMotion ? Math.min(1, settings.particles) : settings.particles, trailLevel: settings.trail,
    reducedMotion: settings.reducedMotion, guide: settings.guide,
  }), [profile.equipped, settings]);
  const lookRef = useRef(look);
  lookRef.current = look;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      // The wrapper has 16px of padding each side and the board's frame 4px more.
      const w = Math.floor(Math.min(el.clientWidth - 40, ((el.clientHeight - 8) * W) / 510, 430));
      setBoardWidth(Math.max(200, w));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    rendererRef.current ??= new BoardRenderer(canvasRef.current);
    rendererRef.current.resize(boardWidth);
  }, [boardWidth]);

  // ------------------------------------------------------------------ sound
  useEffect(() => {
    setVolumes(settings.sound, settings.music);
  }, [settings.sound, settings.music]);
  const musicOn = settings.music > 0;
  useEffect(() => {
    if (musicOn) playMusic(mode === "adventure" ? `world${Math.floor((refNumber - 1) / LEVELS_PER_WORLD)}` : "play");
  }, [mode, refNumber, musicOn]);
  const buzz = useCallback((kind: "tap" | "select" | "warn" | "success" | "error") => {
    if (getProfile().settings.vibration) haptic[kind]();
  }, []);

  // ------------------------------------------------------------------ saving
  const persist = useCallback((pending: SavedRun["pending"]) => {
    if (runRef.current.over) return;
    saveRun({ key, mode, ref: refNumber, run: pending ? snapshotRef.current : runRef.current, pending, timeMs: timeRef.current, savedAt: Date.now() });
  }, [key, mode, refNumber]);

  // ------------------------------------------------------------------ powers
  const powerCount = (kind: PowerKey) => (run.given[kind] ?? 0) + (run.powerups ? profile.inv[kind] : 0);
  const spend = (kind: PowerKey, broken: number) => {
    const given = run.given[kind] ?? 0;
    if (given > 0) {
      run.given[kind] = given - 1;
      recordPower(kind, false, broken);
    } else recordPower(kind, true, broken);
  };

  // ------------------------------------------------------------------ finishing
  const finishedRef = useRef(false);
  const finishRun = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const s = runRef.current;
    const won = s.over === "won";
    const ranked = getProfile().settings.ranked;
    clearRun(key);
    const base: ResultParams = {
      mode, ref: refNumber, won, score: s.score, round: s.round, broken: s.broken, balls: s.balls, bestShot: s.bestShot, shots: s.shots,
      timeMs: Math.round(timeRef.current),
    };
    let submit: Parameters<typeof submitResult>[0];
    if (mode === "endless") {
      base.prevBest = getProfile().stats.bestScore;
      recordEndlessEnd(s, timeRef.current);
      submit = { game: "bricks", mode: ranked ? "endless" : "endless-solo", solved: true, score: s.score, moves: s.shots, detail: s.round };
    } else if (mode === "adventure") {
      const def = levelDef(refNumber);
      const stars = won ? starsFor(def, s.shots, s.score) : 0;
      const before = getProfile().stars[refNumber - 1];
      const r = recordLevel(refNumber, stars, won, timeRef.current);
      Object.assign(base, { stars, beforeStars: before, levelCoins: r.coins, newStars: r.newStars, worldDone: r.world !== null ? r.world : -1 });
      submit = { game: "bricks", mode: "adventure", puzzleNumber: refNumber, solved: won, score: s.score, moves: s.shots, detail: stars };
    } else if (mode === "daily") {
      const score = dailyScore(s);
      const prev = getProfile().daily.best;
      const coins = recordDaily(score, won, timeRef.current);
      Object.assign(base, { dailyScore: score, prevBest: prev ?? 0, dailyCoins: coins, tries: getProfile().daily.tries });
      submit = { game: "bricks", mode: ranked ? "daily" : "daily-solo", puzzleNumber: refNumber, solved: won, score, moves: s.shots, detail: s.bestShot };
    } else {
      const def = challengeDef(refNumber);
      const value = def.metric === "shots" ? s.shots : def.metric === "rounds" ? s.round - s.startRound : s.bestShot;
      const finished = def.metric === "shots" ? won : true;
      const medal = medalFor(def, value, finished);
      const prevBest = getProfile().challengeBest[refNumber - 1];
      const counts = finished && (def.metric !== "shots" || won);
      const coins = recordChallenge(refNumber, medal, counts ? value : null, counts && better(def, value, prevBest), timeRef.current);
      Object.assign(base, { medal, value, challengeCoins: coins, prevValue: prevBest ?? -1 });
      const points = def.metric === "shots" ? (won ? 10000 - value * 100 : 0) : value * 100;
      submit = { game: "bricks", mode: ranked ? "challenge" : "challenge-solo", puzzleNumber: refNumber, solved: medal > 0, score: points, moves: value, detail: medal };
    }
    base.coinsEarned = getProfile().stats.coinsEarned - startedWith.current.coins;
    base.unlocked = Object.keys(getProfile().achievements).filter((id) => !startedWith.current.achievements.includes(id)).join(",");
    if (won) play(mode === "endless" ? "highScore" : "levelComplete");
    else play(mode === "endless" ? "gameOver" : "levelFailed");
    playMusic(won ? "victory" : "gameover");
    buzz(won ? "success" : "error");
    if (!won) rendererRef.current?.flashLine();
    const started = Date.now();
    void submitResult(submit).then((saved) => {
      const params = { ...base, xp: saved ? JSON.stringify(saved) : null };
      setResult(params);
      // Levels, dailies and challenges go straight to their result; an endless run waits on its overlay.
      if (mode !== "endless") window.setTimeout(() => replace({ name: "game", game: "bricks", screen: "result", params }), Math.max(0, 1100 - (Date.now() - started)));
    });
  }, [buzz, key, mode, refNumber, replace, submitResult]);

  const afterShot = useCallback((summary: ShotSummary) => {
    const s = runRef.current;
    if (summary.shieldUsed) {
      recordPower("shield", true, 0);
      play("shield");
      setFlashMsg(t("bricksShieldUsed"));
    }
    recordShot({ broken: summary.broken, collected: summary.collected, coins: summary.coins, milestone: summary.milestone });
    if (s.flow === "endless" && s.goal.kind === "endless") recordRound(s.round);
    if (summary.comboWord) {
      setCombo({ word: t(COMBO_KEY[summary.comboWord]), key: Date.now(), legendary: summary.comboWord === "legendary" });
      play("combo", ["nice", "great", "amazing", "incredible", "legendary"].indexOf(summary.comboWord) + 1);
    }
    if (summary.collected) play("ring");
    const newTypes = summary.newTypes.filter((x) => x !== "std" && !getProfile().tips.bricks.includes(x));
    if (newTypes.length) setTip({ kind: "brick", type: newTypes[0] as Exclude<BrickType, "std"> });
    if (!s.over && inDanger(s)) { play("danger"); buzz("warn"); }
    if (s.over) finishRun();
    else {
      snapshotRef.current = cloneRun(s);
      persist(null);
    }
    refresh();
  }, [buzz, finishRun, persist, refresh, t]);

  // ------------------------------------------------------------------ shooting
  const shoot = useCallback((a: Aim, double: boolean) => {
    const s = runRef.current;
    if (s.over || shotRef.current) return;
    snapshotRef.current = cloneRun(s);
    shotRef.current = startShot(s, a, double);
    persist({ dx: a.dx, dy: a.dy, double });
    setAim(null);
    setSpeed(1);
    buzz("tap");
    refresh();
  }, [buzz, persist, refresh]);

  const fire = useCallback(() => {
    const a = aimRef.current;
    if (!a || shotRef.current || runRef.current.over) return;
    let double = false;
    if (doubleArmed && powerCount("double") > 0) {
      double = true;
      spend("double", 0);
      play("power");
    }
    setDoubleArmed(false);
    shoot(a, double);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doubleArmed, shoot]);

  // Resume a shot that was under way when the game was left: the same aim, from the same board.
  useEffect(() => {
    if (!initial.pending || blocked) return;
    const p = initial.pending;
    const id = window.setTimeout(() => shoot({ dx: p.dx, dy: p.dy }, p.double), 450);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------ the loop
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const viewRef = useRef({ aim, targeting, hover });
  viewRef.current = { aim, targeting, hover };
  const digits = useCallback((v: number) => n(v), [n]);
  const scoreShown = useRef(run.score);

  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0, lastDraw = 0, lastHud = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(100, now - last);
      last = now;
      const s = runRef.current;
      const r = rendererRef.current;
      if (!r) return;
      if (!pausedRef.current && !document.hidden) timeRef.current += dt;
      const shot = shotRef.current;
      if (shot && !pausedRef.current) {
        acc += (dt / 16.67) * speedRef.current;
        const events: GameEvent[] = [];
        let steps = 0, done = false;
        while (acc >= 1 && steps < 16 && !done) {
          done = stepShot(s, shot, events);
          acc -= 1;
          steps++;
        }
        if (events.length) {
          r.feed(events, s, lookRef.current, { x: s.lx, y: 500 });
          let hits = 0, breaks = 0;
          for (const e of events) {
            if (e.type === "hit") { hits++; if (hits < 3) play("hit", Math.min(6, Math.floor(Math.log2(e.hp + 1)))); }
            else if (e.type === "wall") play("wall");
            else if (e.type === "break") { breaks++; if (breaks < 3) play("break", e.color); }
            else if (e.type === "explode") play("explode");
            else if (e.type === "beamH" || e.type === "beamV") play("laser");
            else if (e.type === "ring") play("ring");
            else if (e.type === "mystery") play(e.reward === "coins" ? "coin" : "unlock");
            else if (e.type === "launch" && shot.launched < 4) play("launch");
          }
          if (breaks) buzz("select");
        }
        if (done) {
          shotRef.current = null;
          acc = 0;
          afterShotRef.current(endShot(s, shot, s.powerups && getProfile().inv.shield > 0));
        }
        if (now - lastHud > 120) {
          lastHud = now;
          if (scoreShown.current !== s.score) { scoreShown.current = s.score; setTick((x) => x + 1); }
        }
      }
      const busy = !!shotRef.current || dragging.current || r.animating(s) || viewRef.current.targeting !== null;
      if (!busy && now - lastDraw < 33) return;
      lastDraw = now;
      const v = viewRef.current;
      const g = v.aim && !shotRef.current && !s.over ? guide(s, v.aim) : null;
      r.draw(s, shotRef.current, { aim: v.aim, guide: g, targeting: v.targeting, hover: v.hover, danger: inDanger(s), over: !!s.over, digits, showCount: !s.over }, lookRef.current, dt);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [buzz, digits]);
  const afterShotRef = useRef(afterShot);
  afterShotRef.current = afterShot;

  // Leaving the tab pauses; the run is already saved.
  useEffect(() => {
    const onHide = () => { if (document.hidden && !runRef.current.over) setPaused(true); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  // ------------------------------------------------------------------ input
  function onDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    unlockAudio();
    const s = runRef.current;
    if (paused || s.over || shotRef.current || blocked) return;
    const r = rendererRef.current;
    if (!r) return;
    const p = r.toBoard(e.clientX, e.clientY);
    if (targeting) {
      const cell = cellAt(p.x, p.y);
      if (!cell) return;
      const events: GameEvent[] = [];
      const before = s.broken;
      firePower(s, targeting, cell.row, cell.col, events);
      r.feed(events, s, look, { x: s.lx, y: 500 });
      play(targeting === "bomb" ? "explode" : "laser");
      buzz("success");
      spend(targeting, s.broken - before);
      setTargeting(null);
      setHover(null);
      setTip(null);
      if (s.over) finishRun();
      else { snapshotRef.current = cloneRun(s); persist(null); }
      refresh();
      return;
    }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    dragging.current = true;
    setAim(aimAt(s, p.x, p.y));
  }
  function onMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const r = rendererRef.current;
    if (!r) return;
    const p = r.toBoard(e.clientX, e.clientY);
    if (targeting) { setHover(cellAt(p.x, p.y)); return; }
    if (!dragging.current) return;
    setAim(aimAt(runRef.current, p.x, p.y));
  }
  function onUp() {
    if (!dragging.current) return;
    dragging.current = false;
    if (aimRef.current) fire();
  }

  // Keyboard: arrows turn the aim, Enter or Space shoots, Escape pauses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Escape") { setPaused((p) => !p); return; }
      if (paused || shotRef.current || runRef.current.over || targeting) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 6 : 2;
        const cur = aim ? angleOf(aim) : 90;
        setAim(aimFromAngle(cur + (e.key === "ArrowLeft" ? step : -step)));
      } else if ((e.key === "Enter" || e.key === " ") && aim) {
        e.preventDefault();
        fire();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function pickPower(kind: PowerKey) {
    unlockAudio();
    if (shotRef.current || run.over || kind === "shield") return;
    if (powerCount(kind) <= 0) { buzz("warn"); setFlashMsg(t("bricksPowerNone")); return; }
    play("button");
    if (!profile.tips.powers.includes(kind)) setTip({ kind: "power", type: kind });
    if (kind === "double") { setDoubleArmed((v) => !v); return; }
    setTargeting((cur) => (cur === kind ? null : kind));
    setAim(null);
  }

  function restart() {
    if (settings.confirm && !confirmRestart) { setConfirmRestart(true); return; }
    clearRun(key);
    if (mode === "daily" && getProfile().daily.tries >= DAILY_TRIES) { setBlocked(true); setPaused(false); return; }
    replace({ name: "game", game: "bricks", screen: "play", params: { mode, ref: refNumber, fresh: true, at: Date.now() } });
  }

  useEffect(() => {
    if (!flashMsg) return;
    const id = window.setTimeout(() => setFlashMsg(null), 2200);
    return () => window.clearTimeout(id);
  }, [flashMsg]);

  // ------------------------------------------------------------------ labels
  const best = Math.max(profile.stats.bestScore, 0);
  const progress = goalProgress(run, session.initial);
  const goalText = objectiveText(t, run);
  const danger = inDanger(run) && !shooting;
  let status = t("bricksHintAim"), statusColor = "var(--text-2)";
  if (flashMsg) { status = flashMsg; statusColor = GOLD; }
  else if (targeting === "hlaser") { status = t("bricksTargetRow"); statusColor = ACCENT; }
  else if (targeting === "vlaser") { status = t("bricksTargetCol"); statusColor = ACCENT; }
  else if (targeting === "bomb") { status = t("bricksTargetBomb"); statusColor = ACCENT; }
  else if (danger) { status = t("bricksDanger"); statusColor = "#FF5C7A"; }
  else if (shooting) status = t("bricksHintShooting");
  else if (doubleArmed) { status = t("bricksDoubleArmed"); statusColor = GOLD; }
  else if (aim && dragging.current) { status = t("bricksHintRelease"); statusColor = "var(--text)"; }

  const subLabel = mode === "endless" ? (best ? t("bricksBestShort", { score: n(best) }) : t("bricksPoints"))
    : mode === "adventure" ? t("bricksLevelLabel", { world: n(Math.floor((refNumber - 1) / LEVELS_PER_WORLD) + 1), level: n(((refNumber - 1) % LEVELS_PER_WORLD) + 1) })
      : mode === "daily" ? t("bricksDailyTry", { number: n(refNumber), tryNo: n(Math.min(DAILY_TRIES, profile.daily.tries)), tries: n(DAILY_TRIES) })
        : t(`bricksCh_${challengeDef(refNumber).category}` as TranslationKey) + ` ${n(((refNumber - 1) % 5) + 1)}`;
  const traysOff = !run.powerups && !Object.values(run.given).some((v) => (v ?? 0) > 0);

  if (blocked) {
    return (
      <Screen theme="night">
        <div className="stack center" style={{ flex: 1, justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
          <div className="display" style={{ fontSize: 24, fontWeight: 800 }}>{t("bricksDailyNoTries")}</div>
          <div className="muted" style={{ fontSize: 14 }}>{t("bricksDailyNoTriesSub")}</div>
          <button type="button" className="btn" style={{ background: ACCENT, color: INK, maxWidth: 260 }} onClick={() => replace({ name: "game", game: "bricks", screen: "daily" })}>{t("bricksSeeDaily")}</button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen theme="night">
      <div className="row row--between" style={{ padding: "14px 16px 4px", gap: 8 }}>
        <button type="button" className="icon-btn" aria-label={t("bricksPause")} onClick={() => { play("button"); setPaused(true); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5" /><rect x="14" y="5" width="4" height="14" rx="1.5" /></svg>
        </button>
        <div style={{ textAlign: "center", minWidth: 0 }}>
          <div className="display num" style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{n(run.score)}</div>
          <div className="tiny muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subLabel}</div>
        </div>
        <div style={{ minWidth: 64, padding: "6px 10px", borderRadius: 12, background: "var(--surface)", textAlign: "center" }}>
          <div className="tiny muted">{run.flow === "endless" ? t("bricksRound") : t("bricksShots")}</div>
          <div className="num" style={{ fontSize: 17, fontWeight: 700 }}>
            {run.flow === "endless" ? n(run.round) : run.shotLimit ? `${n(run.shots)}/${n(run.shotLimit)}` : n(run.shots)}
          </div>
        </div>
      </div>

      {goalText && (
        <div className="row row--between" style={{ margin: "2px 16px 0", padding: "7px 12px", borderRadius: 12, background: "var(--surface)", fontSize: 13, gap: 8 }}>
          <span style={{ minWidth: 0 }}>{goalText}</span>
          <span className="num" style={{ fontWeight: 700, color: progress[0] >= progress[1] && progress[1] > 0 ? "#5BD69A" : ACCENT, flex: "none" }}>{n(progress[0])}/{n(progress[1])}</span>
        </div>
      )}

      <div role="status" aria-live="polite" style={{ minHeight: 26, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", textAlign: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: statusColor }}>{status}</span>
      </div>

      <div ref={wrapRef} style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
        <div dir="ltr" style={{ position: "relative", padding: 4, borderRadius: 18, background: "var(--surface)" }}>
          <canvas
            ref={canvasRef}
            tabIndex={0}
            aria-label={t("bricksBoardAria", { balls: n(run.balls), bricks: n(run.bricks.length) })}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => { dragging.current = false; setAim(null); }}
            onPointerLeave={() => setHover(null)}
            style={{ display: "block", borderRadius: 14, touchAction: "none", cursor: targeting ? "pointer" : "crosshair", width: boardWidth }}
          />
          {combo && (
            <span key={combo.key} className="bricks-combo" aria-hidden="true" style={{ color: combo.legendary ? "#B07CFF" : GOLD }} onAnimationEnd={() => setCombo(null)}>{combo.word}</span>
          )}
          {over && mode === "endless" && (
            <div className="stack center" style={{ position: "absolute", inset: 0, borderRadius: 18, background: "rgba(11,13,26,0.88)", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
              <Svg d="M12 4 2.5 20h19zM12 10v4M12 17v.5" size={40} color="#FF5C7A" />
              <div className="display" style={{ fontSize: 26, fontWeight: 800 }}>{t("bricksOverTitle")}</div>
              <div style={{ fontSize: 15, color: "var(--text-2)" }}>{t("bricksOverSub", { score: n(run.score), round: n(run.round) })}</div>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn" style={{ minHeight: 48, padding: "0 20px", width: "auto", background: ACCENT, color: INK, fontSize: 15 }}
                  onClick={() => replace({ name: "game", game: "bricks", screen: "play", params: { mode: "endless", fresh: true, at: Date.now() } })}>
                  {t("playAgainGame")}
                </button>
                <button type="button" className="btn btn--outline" disabled={!result} style={{ minHeight: 48, padding: "0 18px", width: "auto", fontSize: 15 }}
                  onClick={() => result && replace({ name: "game", game: "bricks", screen: "result", params: result })}>
                  {t("seeResults")}
                </button>
              </div>
            </div>
          )}
          {over && mode !== "endless" && (
            <div className="stack center" style={{ position: "absolute", inset: 0, borderRadius: 18, background: "rgba(11,13,26,0.7)", justifyContent: "center", textAlign: "center" }}>
              <div className="display" style={{ fontSize: 28, fontWeight: 800, color: run.over === "won" ? GOLD : "#FF5C7A" }}>{run.over === "won" ? t("bricksWonFlash") : t("bricksLostFlash")}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "8px 16px calc(14px + env(safe-area-inset-bottom))" }}>
        <div className="row row--between" style={{ minHeight: 36, marginBottom: 6 }}>
          <span className="tiny" style={{ fontWeight: 600, color: "var(--muted)" }}>{traysOff ? t("bricksPowersOff") : t("bricksPowerups")}</span>
          {shooting && (
            <button type="button" aria-label={t("bricksSpeedAria", { speed: n(speed) })} onClick={() => { play("button"); setSpeed((v) => (v === 1 ? 2 : v === 2 ? 4 : 1)); }}
              style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 36, padding: "0 12px", borderRadius: 12, border: 0, background: speed > 1 ? ACCENT : "#1E2138", color: speed > 1 ? INK : "var(--text)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              <svg className="flip-rtl" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5v14l9-7zM12 5v14l9-7z" /></svg>
              <span className="num">×{n(speed)}</span>
            </button>
          )}
        </div>
        {!traysOff && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
            {POWERS.map((kind) => {
              const count = kind === "shield" ? (run.powerups ? profile.inv.shield : 0) : powerCount(kind);
              const on = targeting === kind || (kind === "double" && doubleArmed);
              const passive = kind === "shield";
              const disabled = !passive && (shooting || over || count <= 0) && !on;
              return (
                <button key={kind} type="button" onClick={() => pickPower(kind)} aria-pressed={on} disabled={disabled}
                  aria-label={`${t(`bricksPower_${kind}` as TranslationKey)} · ${n(count)}${passive ? ` · ${t("bricksAuto")}` : ""}`}
                  style={{
                    position: "relative", height: 60, padding: "6px 2px 4px", borderRadius: 16, border: `2px solid ${on ? ACCENT : passive && count > 0 ? "#2F4A22" : "#1E2138"}`,
                    background: on ? "#2E1A12" : "var(--surface)", color: on ? ACCENT : passive ? "#B8F24A" : count > 0 ? "var(--text)" : "#5A5E7A",
                    opacity: disabled ? 0.5 : 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: passive ? "default" : "pointer", fontFamily: "inherit",
                  }}>
                  <Svg d={POWER_ICON[kind]} size={22} width={2.2} />
                  <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.1, color: "var(--text-2)" }}>{passive ? t("bricksAuto") : t(`bricksPowerShort_${kind}` as TranslationKey)}</span>
                  <span className="num" style={{ position: "absolute", top: -6, insetInlineEnd: -4, minWidth: 20, height: 20, padding: "0 4px", boxSizing: "border-box", borderRadius: 999, background: count > 0 ? (passive ? "#B8F24A" : GOLD) : "#3A3E5C", color: "#0B0D1A", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{n(count)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {tip && !paused && !over && (
        <div role="dialog" aria-label={tip.kind === "brick" ? t(`bricksBrick_${tip.type}` as TranslationKey) : t(`bricksPower_${tip.type}` as TranslationKey)}
          style={{ position: "fixed", insetInline: 16, bottom: "calc(110px + env(safe-area-inset-bottom))", zIndex: 30, display: "flex", gap: 12, alignItems: "flex-start", padding: 14, borderRadius: 18, background: "#151829", border: "1.5px solid #3A2416", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
          <span style={{ width: 36, height: 36, flex: "none", borderRadius: 11, background: "#2E1A12", color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Svg d={tip.kind === "brick" ? BRICK_ICON[tip.type] : POWER_ICON[tip.type]} size={20} />
          </span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="tiny" style={{ color: ACCENT, fontWeight: 700 }}>{tip.kind === "brick" ? t("bricksNewBrick") : t("bricksPowerTip")}</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{tip.kind === "brick" ? t(`bricksBrick_${tip.type}` as TranslationKey) : t(`bricksPower_${tip.type}` as TranslationKey)}</div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: "var(--text-2)" }}>{tip.kind === "brick" ? t(`bricksBrickTip_${tip.type}` as TranslationKey) : t(`bricksPowerTip_${tip.type}` as TranslationKey)}</div>
          </div>
          <button type="button" className="btn btn--outline" style={{ width: "auto", minHeight: 40, padding: "0 12px", fontSize: 13 }}
            onClick={() => { if (tip.kind === "brick") markBrickTips([tip.type]); setTip(null); }}>
            {t("gotIt")}
          </button>
        </div>
      )}

      {paused && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(6,7,16,0.72)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div role="dialog" aria-label={t("bricksPaused")} className="stack" style={{ gap: 14, padding: "20px 16px calc(26px + env(safe-area-inset-bottom))", borderRadius: "26px 26px 0 0", background: "#151829", maxWidth: 520, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
            <div className="row row--between row--baseline">
              <h2 className="display" style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{t("bricksPaused")}</h2>
              <span className="tiny muted">{over ? "" : t("bricksRunSaved")}</span>
            </div>
            <button type="button" className="btn" style={{ background: ACCENT, color: INK, fontSize: 16 }} onClick={() => { unlockAudio(); play("button"); setPaused(false); setConfirmRestart(false); }}>{t("bricksResume")}</button>
            <div className="stack" style={{ gap: 12, padding: "12px 14px", borderRadius: 16, background: "#10122A" }}>
              <VolumeRow label={t("bricksSound")} value={settings.sound} onChange={(v) => setSettingsAndVolume({ sound: v })} />
              <VolumeRow label={t("bricksMusic")} value={settings.music} onChange={(v) => setSettingsAndVolume({ music: v })} />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn--outline" style={{ flex: 1, fontSize: 15, borderColor: confirmRestart ? "#FF5C7A" : undefined, color: confirmRestart ? "#FF5C7A" : undefined }} onClick={restart}>
                {confirmRestart ? t("bricksRestartConfirm") : t("bricksRestart")}
              </button>
              <button type="button" className="btn btn--outline" style={{ flex: 1, fontSize: 15 }} onClick={() => { play("transition"); back(); }}>{t("bricksMenu")}</button>
            </div>
          </div>
        </div>
      )}
      <NoticeToasts top={118} />
    </Screen>
  );
}

function VolumeRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const { n } = useLanguage();
  return (
    <label className="row" style={{ gap: 12, fontSize: 14 }}>
      <span style={{ width: 70 }}>{label}</span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1, accentColor: ACCENT }} />
      <span className="num muted" style={{ width: 32, textAlign: "end" }}>{n(value)}</span>
    </label>
  );
}

function setSettingsAndVolume(patch: { sound?: number; music?: number }) {
  setSettings(patch);
  const s = getProfile().settings;
  setVolumes(s.sound, s.music);
}

/** The objective line above the board, for every mode but endless. */
export function objectiveText(t: (k: TranslationKey, v?: Record<string, string | number>) => string, s: RunState): string | null {
  const g = s.goal;
  switch (g.kind) {
    case "endless": return null;
    case "clear": return s.shotLimit ? t("bricksGoalClearIn", { shots: s.shotLimit }) : t("bricksGoalClear");
    case "target": return t("bricksGoalTarget");
    case "formation": return t("bricksGoalFormation");
    case "collect": return t("bricksGoalCollect", { count: g.count });
    case "survive": return t("bricksGoalSurvive", { rounds: g.rounds });
    case "combo": return t("bricksGoalCombo", { count: g.count, shots: s.shotLimit ?? 0 });
  }
}
