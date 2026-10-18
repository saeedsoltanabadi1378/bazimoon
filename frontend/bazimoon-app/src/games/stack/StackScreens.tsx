import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { Body, IconButton, Screen, Switch } from "../../ui/components";
import type { PuzzleResult } from "../../api/hub";
import { formatClock, puzzleToday } from "../../lib/format";
import { dailyNumber } from "../../lib/rng";
import { readLocal, writeLocal } from "../../lib/storage";
import { haptic } from "../../lib/haptics";
import { shareToTelegram } from "../../lib/telegram";
import { botLink } from "../../lib/links";
import { roman } from "../../hub/HomeScreen";
import { IntroScreen } from "../shared/IntroScreen";
import { XpCard } from "../shared/ResultScreen";
import { parseXp, type ResultParams } from "../shared/play";

const ACCENT = "#5FD0BE";
const INK = "#0B1F1B";
const BEST_KEY = "bazimoon-stack-best";
const SKIN_KEY = "bazimoon-stack-skin";
const SUNSET_AT = 50;
const dailyKey = (number: number) => `bazimoon-stack-daily-${number}`;

const PALETTES = {
  classic: ["#3FB8A6", "#5FD0BE", "#7FC8E8", "#8FA8FF", "#9C8CFF", "#B79CF2", "#D9A8E8", "#F2B8D0", "#F0A83A", "#E9D8A6"],
  sunset: ["#F6C377", "#F0A83A", "#E5604D", "#D9485F", "#B83A6B", "#8E3A80", "#B83A6B", "#D9485F", "#E5604D", "#F0A83A"],
};

type StackMode = "classic" | "daily" | "zen";

function palette(mode: StackMode, number: number) {
  const skin = readLocal<string>(SKIN_KEY, "classic") === "sunset" && readLocal<number>(BEST_KEY, 0) >= SUNSET_AT ? "sunset" : "classic";
  const base = PALETTES[skin];
  // The daily tower shares one colour order for everyone.
  if (mode !== "daily") return base;
  const shift = number % base.length;
  return [...base.slice(shift), ...base.slice(0, shift)];
}

function PauseIcon({ paused }: { paused: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={paused ? "M8 5v14l11-7z" : "M7 5h4v14H7zM13 5h4v14h-4z"} />
    </svg>
  );
}

export function StackIntro() {
  const { t, n } = useLanguage();
  const { push, replace } = useNavigation();
  const { api } = useHub();
  const stats = useLoad(() => api.stats("stack"), [api]).data;
  const number = dailyNumber("stack", puzzleToday());
  const dailyDone = readLocal<ResultParams | null>(dailyKey(number), null);
  const best = Math.max(stats?.bestScore ?? 0, readLocal<number>(BEST_KEY, 0));
  const [skin, setSkin] = useState(readLocal<string>(SKIN_KEY, "classic"));
  const colors = PALETTES.classic;
  const preview = [[10, 100], [14, 92], [14, 88], [20, 80], [22, 76], [22, 72], [26, 66]];
  const play = (mode: StackMode) => push({ name: "game", game: "stack", screen: "play", params: { mode } });

  return (
    <IntroScreen
      title={t("gameStack")}
      tagline={t("stackTagline")}
      accent={ACCENT}
      accentInk={INK}
      heroBg="#0F2420"
      preview={
        <div style={{ width: 120, height: 120, position: "relative" }} dir="ltr">
          {preview.map(([x, w], i) => (
            <div key={i} style={{ position: "absolute", left: x, bottom: i * 16, width: w, height: 14, borderRadius: 3, background: colors[i] }} />
          ))}
        </div>
      }
      badge={best > 0 ? t("stackBestFloors", { count: n(best) }) : undefined}
      heroTitle={t("stackHeroTitle")}
      heroSub={t("stackHeroSub")}
      modes={[
        { key: "classic", label: t("stackClassic"), desc: t("stackClassicDesc"), play: t("stackStart"), onPlay: () => play("classic") },
        {
          key: "daily", label: t("modeDaily"), desc: t("stackDailyDesc"),
          play: dailyDone ? t("stackSeeToday") : t("stackPlayDaily"),
          onPlay: () => (dailyDone ? replace({ name: "game", game: "stack", screen: "result", params: dailyDone }) : play("daily")),
        },
        { key: "zen", label: t("stackZen"), desc: t("stackZenDesc"), play: t("stackStartZen"), onPlay: () => play("zen") },
      ]}
      stats={[
        { value: stats ? n(stats.played) : "—", label: t("statGames") },
        { value: best ? n(best) : "—", label: t("statBest") },
        { value: stats?.averageScore != null ? n(stats.averageScore) : "—", label: t("statAverage") },
        { value: stats?.maxDetail != null ? n(stats.maxDetail) : "—", label: t("stackPerfectStreak") },
      ]}
      steps={[
        { title: t("stackStep1"), text: t("stackStep1Text") },
        { title: t("stackStep2"), text: t("stackStep2Text") },
        { title: t("stackStep3"), text: t("stackStep3Text") },
        { title: t("stackStep4"), text: t("stackStep4Text") },
      ]}
      rewards={[t("stackRewardFloor"), t("stackRewardPerfect"), t("stackRewardWeekly")]}
      extra={() => (
        <div className="row" style={{ gap: 12, padding: 14, borderRadius: 18, border: "1.5px dashed #2E3252" }}>
          <div className="stack" style={{ gap: 2, flex: "none" }} aria-hidden="true">
            {["#F6C377", "#F0A83A", "#E5604D"].map((c) => <span key={c} style={{ width: 40, height: 8, borderRadius: 2, background: c }} />)}
          </div>
          <div className="grow">
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t("stackSunset")}</div>
            <div className="tiny muted">{best >= SUNSET_AT ? t("stackSunsetOn") : t("stackSunsetLocked", { count: SUNSET_AT })}</div>
          </div>
          {best >= SUNSET_AT && (
            <button
              type="button"
              role="switch"
              aria-checked={skin === "sunset"}
              aria-label={t("stackSunset")}
              style={{ border: 0, background: "transparent", minHeight: 44, cursor: "pointer" }}
              onClick={() => {
                const next = skin === "sunset" ? "classic" : "sunset";
                setSkin(next);
                writeLocal(SKIN_KEY, next);
              }}
            >
              <Switch on={skin === "sunset"} />
            </button>
          )}
        </div>
      )}
      secondary={{ label: t("stackHighScores"), onClick: () => push({ name: "league" }) }}
    />
  );
}

interface Block {
  x: number;
  w: number;
}

const BLOCK_H = 22;
const FLOOR = 24;
const BASE_H = 14;

export function StackPlay({ mode }: { mode: StackMode }) {
  const { t, n, language } = useLanguage();
  const { back, replace } = useNavigation();
  const { api, submitResult } = useHub();
  const stats = useLoad(() => api.stats("stack"), [api]).data;
  const number = dailyNumber("stack", puzzleToday());
  const colors = useRef(palette(mode, number)).current;
  const areaRef = useRef<HTMLDivElement>(null);
  const movingRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(358);
  const [height, setHeight] = useState(500);
  const [stack, setStack] = useState<Block[] | null>(null);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [perfects, setPerfects] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [flash, setFlash] = useState(0);
  const [xp, setXp] = useState<PuzzleResult | null>(null);
  const [resultParams, setResultParams] = useState<ResultParams | null>(null);
  const motion = useRef({ x: 0, dir: 1, last: 0 });
  const elapsed = useRef(0);
  const best = Math.max(stats?.bestScore ?? 0, readLocal<number>(BEST_KEY, 0));
  const zen = mode === "zen";

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth);
      setHeight(el.clientHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The first block spans most of the area; start once the width is known.
  useEffect(() => {
    if (stack === null && width > 0) {
      const w = Math.round(width * 0.56);
      setStack([{ x: Math.round((width - w) / 2), w }]);
      motion.current = { x: 0, dir: 1, last: 0 };
    }
  }, [stack, width]);

  const floors = stack ? stack.length - 1 : 0;
  const scale = width / 358;
  const speed = (zen ? 120 : Math.min(350, 120 + Math.floor(floors / 10) * 30)) * scale;
  const shift = Math.max(0, BASE_H + (floors + 2) * FLOOR - (height - 40));

  // Slides the moving block with requestAnimationFrame, writing its position straight to the DOM.
  useEffect(() => {
    if (!stack || over || paused) return;
    const top = stack[stack.length - 1];
    let raf = 0;
    const step = (now: number) => {
      const m = motion.current;
      const dt = m.last ? Math.min(50, now - m.last) : 0;
      m.last = now;
      if (!document.hidden) elapsed.current += dt;
      let x = m.x + m.dir * speed * (dt / 1000);
      if (x + top.w > width) {
        x = width - top.w;
        m.dir = -1;
      }
      if (x < 0) {
        x = 0;
        m.dir = 1;
      }
      m.x = x;
      if (movingRef.current) movingRef.current.style.transform = `translateX(${x}px)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      motion.current.last = 0;
    };
  }, [stack, over, paused, speed, width]);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(0), 800);
    return () => window.clearTimeout(id);
  }, [flash]);

  useEffect(() => {
    const onHide = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const end = useCallback((finalStack: Block[], perfectCount: number, longest: number) => {
    setOver(true);
    haptic.error();
    if (zen) return;
    const total = finalStack.length - 1;
    const previousBest = best;
    if (total > readLocal<number>(BEST_KEY, 0)) writeLocal(BEST_KEY, total);
    const tower = finalStack.slice(-14).map((b) => [Math.round((b.x / width) * 100), Math.round((b.w / width) * 100)]);
    const params: ResultParams = { mode, number, floors: total, perfects: perfectCount, bestStreak: longest, timeMs: Math.round(elapsed.current), previousBest, tower: JSON.stringify(tower) };
    setResultParams(params);
    void submitResult({
      game: "stack", mode, puzzleNumber: mode === "daily" ? number : null, solved: true,
      timeMs: Math.round(elapsed.current), score: total, moves: perfectCount, detail: longest, hints: 0,
    }).then((saved) => {
      setXp(saved);
      const withXp = { ...params, xp: saved ? JSON.stringify(saved) : null };
      setResultParams(withXp);
      if (mode === "daily") writeLocal(dailyKey(number), withXp);
    });
    if (mode === "daily") writeLocal(dailyKey(number), params);
  }, [zen, best, width, mode, number, submitResult]);

  const drop = useCallback(() => {
    if (!stack || over || paused) return;
    const top = stack[stack.length - 1];
    const mx = motion.current.x;
    const left = Math.max(mx, top.x);
    const right = Math.min(mx + top.w, top.x + top.w);
    const overlap = right - left;
    if (overlap <= 0) {
      end(stack, perfects, bestStreak);
      return;
    }
    let block: Block;
    if (Math.abs(mx - top.x) <= 4 * scale) {
      block = { x: top.x, w: top.w };
      const s = streak + 1;
      setPerfects((p) => p + 1);
      setStreak(s);
      setBestStreak((b) => Math.max(b, s));
      setFlash(Date.now());
      haptic.success();
    } else {
      block = { x: left, w: overlap };
      setStreak(0);
      haptic.tap();
    }
    const next = [...stack, block];
    // Alternate the side each new block slides in from.
    motion.current = { x: next.length % 2 ? 0 : width - block.w, dir: next.length % 2 ? 1 : -1, last: 0 };
    setStack(next);
  }, [stack, over, paused, scale, streak, width, end, perfects, bestStreak]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        drop();
      } else if (e.key === "Escape" || e.key === "p") setPaused((p) => !over && !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drop, over]);

  function restart() {
    setStack(null);
    setOver(false);
    setPerfects(0);
    setStreak(0);
    setBestStreak(0);
    setXp(null);
    setResultParams(null);
    elapsed.current = 0;
  }

  const top = stack?.[stack.length - 1];
  const movingY = BASE_H + (stack?.length ?? 0) * FLOOR - shift;

  return (
    <Screen theme="night">
      <div className="row row--between" style={{ padding: "14px 16px 8px" }}>
        <IconButton icon="back" label={t("backToGame", { game: t("gameStack") })} onClick={back} />
        <div style={{ textAlign: "center" }}>
          <div className="display num" style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }} aria-live="polite">{zen ? "—" : n(floors)}</div>
          <div className="tiny muted">{zen ? t("stackZen") : best ? t("stackFloorsBest", { best: n(best) }) : t("stackFloors")}</div>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={paused ? t("resumeGame") : t("pauseGame")}
          onClick={() => !over && setPaused((p) => !p)}
          style={{ width: 44, height: 44, borderRadius: 14, border: 0, background: "var(--surface)", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <PauseIcon paused={paused} />
        </button>
      </div>

      <div style={{ minHeight: 28, display: "flex", justifyContent: "center", alignItems: "center" }} role="status">
        {flash > 0 && <span style={{ padding: "4px 12px", borderRadius: 999, background: "#F0A83A", color: "#1A1206", fontSize: 13, fontWeight: 700 }}>{t("stackPerfect", { count: n(streak) })}</span>}
      </div>

      <div style={{ flex: 1, minHeight: 0, position: "relative", margin: "0 16px 16px" }}>
        <button
          type="button"
          onClick={drop}
          aria-label={t("stackDrop")}
          style={{ position: "absolute", inset: 0, padding: 0, border: 0, borderRadius: 22, background: "#10122A", overflow: "hidden", cursor: "pointer" }}
          dir="ltr"
        >
          <div ref={areaRef} style={{ position: "absolute", inset: 0 }}>
            {stack?.map((b, i) => {
              const y = BASE_H + i * FLOOR - shift;
              if (y < -FLOOR || y > height) return null;
              return (
                <span key={i} style={{ position: "absolute", left: b.x, bottom: y, width: b.w, height: BLOCK_H, borderRadius: 4, background: i === 0 ? "#3A3F5E" : colors[i % colors.length], boxShadow: "inset 0 -4px 0 rgba(0,0,0,0.18)", transition: "bottom 200ms ease" }} />
              );
            })}
            {top && !over && (
              <span
                ref={movingRef}
                style={{ position: "absolute", left: 0, bottom: movingY, width: top.w, height: BLOCK_H, borderRadius: 4, background: colors[stack!.length % colors.length], boxShadow: "0 0 0 2px rgba(237,235,245,0.5)", transform: `translateX(${motion.current.x}px)` }}
              />
            )}
            <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: BASE_H, background: "#1E2138" }} />
          </div>
        </button>

        {over && (
          <div className="stack center" style={{ position: "absolute", inset: 0, borderRadius: 22, background: "rgba(11,13,26,0.86)", justifyContent: "center", gap: 12, textAlign: "center" }}>
            <div className="display" style={{ fontSize: 30, fontWeight: 800 }}>{t("stackFell")}</div>
            {!zen && (
              <div style={{ fontSize: 15, color: "var(--text-2)" }}>
                {t("stackFloorsCount", { count: n(floors) })}{xp ? ` · +${n(xp.xpGained)} XP` : ""}
              </div>
            )}
            <div className="row" style={{ gap: 8 }}>
              {mode !== "daily" && (
                <button type="button" className="btn" style={{ minHeight: 48, padding: "0 20px", width: "auto", background: ACCENT, color: INK, fontSize: 15 }} onClick={restart}>
                  {t("playAgainGame")}
                </button>
              )}
              {!zen && resultParams && (
                <button type="button" className="btn btn--outline" style={{ minHeight: 48, padding: "0 18px", width: "auto", fontSize: 15 }} onClick={() => replace({ name: "game", game: "stack", screen: "result", params: resultParams })}>
                  {t("seeResults")}
                </button>
              )}
            </div>
          </div>
        )}
        {paused && !over && (
          <div className="stack center" style={{ position: "absolute", inset: 0, borderRadius: 22, background: "rgba(11,13,26,0.86)", justifyContent: "center", gap: 12 }}>
            <div className="display" style={{ fontSize: 28, fontWeight: 800 }}>{t("pausedTitle")}</div>
            <button type="button" className="btn" style={{ minHeight: 48, padding: "0 22px", width: "auto", background: ACCENT, color: INK, fontSize: 15 }} onClick={() => setPaused(false)}>
              {t("resumeGame")}
            </button>
            <button type="button" onClick={back} style={{ border: 0, background: "transparent", color: ACCENT, fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 40 }}>
              {t("quitToMenu")}
            </button>
          </div>
        )}
      </div>

      <div className="small muted" style={{ padding: "0 16px calc(22px + env(safe-area-inset-bottom))", textAlign: "center" }}>
        {t("stackTapHint")}
        <span className="visually-hidden">{formatClock(elapsed.current, language)}</span>
      </div>
    </Screen>
  );
}

export function StackResult({ params }: { params?: ResultParams }) {
  const { t, n, language } = useLanguage();
  const { replace } = useNavigation();
  const { api } = useHub();
  const xp = parseXp(params);
  const mode = (params?.mode as StackMode) ?? "classic";
  const floors = Number(params?.floors ?? 0);
  const perfects = Number(params?.perfects ?? 0);
  const bestStreak = Number(params?.bestStreak ?? 0);
  const timeMs = Number(params?.timeMs ?? 0);
  const previousBest = Number(params?.previousBest ?? 0);
  const weekly = useLoad(() => api.weekly("stack"), [api]).data;
  const newBest = xp?.newBest ?? floors > previousBest;
  const best = Math.max(previousBest, floors);
  const colors = palette(mode, Number(params?.number ?? 0));
  const tower: [number, number][] = (() => {
    try {
      return JSON.parse(String(params?.tower ?? "[]"));
    } catch {
      return [];
    }
  })();
  const sub = newBest && previousBest > 0
    ? t("stackBeatBy", { best: n(previousBest), by: n(floors - previousBest) })
    : newBest ? t("stackFirstBest") : t("stackBestStill", { best: n(best) });
  const unlocked = best >= SUNSET_AT;

  return (
    <Screen theme="night">
      <div className="row" style={{ justifyContent: "flex-end", padding: "14px 16px 0" }}>
        <IconButton icon="close" label={t("close")} onClick={() => replace({ name: "game", game: "stack", screen: "intro" })} />
      </div>
      <Body style={{ paddingTop: 0, paddingBottom: 20 }}>
        <section className="row" style={{ alignItems: "flex-end", gap: 18, padding: 16, borderRadius: 22, background: "#0F2420" }}>
          <div style={{ width: 110, height: 150, flex: "none", position: "relative" }} aria-hidden="true" dir="ltr">
            {tower.map(([x, w], i) => (
              <span key={i} style={{ position: "absolute", left: `${x}%`, bottom: i * 10, width: `${w}%`, height: 9, borderRadius: 2, background: colors[(floors - tower.length + 1 + i + colors.length * 10) % colors.length] }} />
            ))}
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <span className="kicker" style={{ color: newBest ? "#F0A83A" : "#F08A7A" }}>
              {mode === "daily" ? t("stackDailyKicker", { number: Number(params?.number ?? 0) }) : newBest ? t("newPersonalBest") : t("stackFell")}
            </span>
            <span className="display num" style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}>{n(floors)}</span>
            <span style={{ fontSize: 14, color: "var(--text-2)" }}>{sub}</span>
          </div>
        </section>

        <div className="stat-grid">
          {[
            [n(perfects), t("stackPerfectDrops"), "#F0A83A"],
            [n(bestStreak), t("bestStreak"), undefined],
            [formatClock(timeMs, language), t("statTime"), undefined],
          ].map(([v, l, c]) => (
            <div key={l} className="stat stat--center">
              <div className="stat__value" style={{ color: c }}>{v}</div>
              <div className="stat__label">{l}</div>
            </div>
          ))}
        </div>

        {xp ? <XpCard xp={xp} /> : <div className="card small muted">{t("resultSavedLater")}</div>}

        {weekly && (
          <section className="stack" style={{ gap: 10, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
            <div className="row row--between">
              <span style={{ fontSize: 14, fontWeight: 600 }}>{t("stackTallestWeek", { division: `${t(`division${weekly.division}` as "divisionGold")} ${roman(weekly.tier)}` })}</span>
              <span className="tiny muted">{t("daysLeft", { count: weekly.daysLeft })}</span>
            </div>
            {weekly.rows.length === 0 && <div className="small muted">{t("boardEmpty")}</div>}
            {weekly.rows.slice(0, 5).map((r) => (
              <div key={`${r.rank}-${r.name}`} className="row" style={{ gap: 10, padding: "4px 6px", borderRadius: 10, background: r.isYou ? "#1E2138" : "transparent" }}>
                <span style={{ width: 22, fontSize: 13, color: "var(--muted)" }}>#{n(r.rank)}</span>
                <span className="grow" style={{ fontSize: 14 }}>{r.isYou ? t("youName", { name: r.name }) : r.name}</span>
                <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>{n(r.score)}</span>
              </div>
            ))}
          </section>
        )}

        <div className="row" style={{ gap: 12, padding: 14, borderRadius: 18, border: "1.5px dashed #2E3252" }}>
          <div className="stack" style={{ gap: 2, flex: "none" }} aria-hidden="true">
            {["#F6C377", "#F0A83A", "#E5604D"].map((c) => <span key={c} style={{ width: 40, height: 8, borderRadius: 2, background: c }} />)}
          </div>
          <div className="grow">
            <div style={{ fontSize: 14, fontWeight: 600 }}>{unlocked ? t("stackSunsetUnlocked") : t("stackSunsetAt", { count: SUNSET_AT })}</div>
            <div className="tiny muted">{unlocked ? t("stackSunsetPick") : t("stackSunsetToGo", { best: n(best), count: n(SUNSET_AT - best) })}</div>
          </div>
        </div>
      </Body>
      <div className="screen__bar screen__bar--row" style={{ gap: 8 }}>
        <button type="button" className="btn btn--outline" style={{ flex: 1, fontSize: 15 }} onClick={() => shareToTelegram(botLink(), t("stackShare", { count: floors }))}>
          {t("share")}
        </button>
        {mode !== "daily" && (
          <button type="button" className="btn" style={{ flex: 1.3, fontSize: 15, background: ACCENT, color: INK }} onClick={() => replace({ name: "game", game: "stack", screen: "play", params: { mode, at: Date.now() } })}>
            {t("playAgainGame")}
          </button>
        )}
        {mode === "daily" && (
          <button type="button" className="btn" style={{ flex: 1.3, fontSize: 15, background: ACCENT, color: INK }} onClick={() => replace({ name: "game", game: "stack", screen: "play", params: { mode: "classic" } })}>
            {t("stackPlayClassic")}
          </button>
        )}
      </div>
    </Screen>
  );
}
