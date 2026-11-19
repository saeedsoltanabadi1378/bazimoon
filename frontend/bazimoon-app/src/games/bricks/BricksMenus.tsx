import { useEffect, useMemo, useState } from "react";
import { useLanguage, type TranslationKey } from "../../i18n/LanguageContext";
import { useNavigation, type GameScreen } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { Screen } from "../../ui/components";
import { formatCountdown, msUntilNextPuzzle } from "../../lib/format";
import { LEVEL_COUNT, LEVELS_PER_WORLD, WORLDS, WORLD_COINS, WORLD_KEYS, WORLD_REWARD, WORLD_STYLE, levelDef, type LevelDef } from "./levels";
import { CHALLENGE_CATEGORIES, CHALLENGES_PER_CATEGORY, challengeDef, type ChallengeCategory } from "./challenges";
import { DAILY_COINS, DAILY_TRIES, dailyDef } from "./daily";
import {
  currentStreak, lastRun, loadRun, markTip, missionDef, refreshDay, runKey, starTotal, useBricksProfile, type RunMode,
} from "./progress";
import { boardThumb } from "./render";
import { playMusic, play, setVolumes, unlockAudio } from "./audio";
import { ACCENT, BricksHeader, CoinPill, GOLD, INK, NoticeToasts, STAR_PATH, Stars, Svg, Tabs } from "./ui";
import { todayDaily } from "./BricksPlay";

type Go = (screen: GameScreen, params?: Record<string, string | number | boolean | null>) => void;

export function useBricksNav() {
  const { push, replace, back } = useNavigation();
  const go: Go = (screen, params) => { play("transition"); push({ name: "game", game: "bricks", screen, params }); };
  const swap: Go = (screen, params) => replace({ name: "game", game: "bricks", screen, params });
  return { go, swap, back };
}

/** Starts (or resumes) a run; the very first endless run opens the tutorial first. */
export function usePlay() {
  const { go } = useBricksNav();
  const profile = useBricksProfile();
  return (mode: RunMode, ref = 0) => {
    unlockAudio();
    if (mode === "endless" && !profile.tips.tutorial && !loadRun("endless")) go("tutorial");
    else go("play", { mode, ref });
  };
}

export function useMenuMusic() {
  const profile = useBricksProfile();
  useEffect(() => {
    setVolumes(profile.settings.sound, profile.settings.music);
    if (profile.settings.music > 0) playMusic("menu");
  }, [profile.settings.sound, profile.settings.music]);
}

export function Thumb({ cells, width = 112 }: { cells: string[]; width?: number }) {
  return (
    <div dir="ltr" aria-hidden="true" style={{ width, flex: "none", padding: 6, borderRadius: 12, background: "#0D1024", display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 2, alignContent: "start", boxSizing: "border-box" }}>
      {cells.map((c, i) => <span key={i} style={{ aspectRatio: "1", borderRadius: 3, background: c }} />)}
    </div>
  );
}

const HERO: [number, number, number, number][] = [[0, 0, 3, 12], [1, 0, 4, 18], [3, 0, 2, 7], [5, 0, 6, 31], [6, 0, 5, 24], [0, 1, 1, 3], [2, 1, 3, 11], [3, 1, 4, 16], [6, 1, 2, 6], [1, 2, 0, 2], [4, 2, 1, 4], [5, 2, 3, 9], [2, 3, 0, 1], [6, 3, 1, 5]];
const HERO_COLORS = ["#5BD69A", "#4FC3F7", "#6E8BFF", "#FFD166", "#FF9A62", "#FF5C7A", "#B07CFF"];

// ------------------------------------------------------------------ game home

export function BricksHome() {
  const { t, n, language } = useLanguage();
  const { go, back } = useBricksNav();
  const start = usePlay();
  const profile = useBricksProfile();
  useMenuMusic();
  const daily = todayDaily();
  useEffect(() => { refreshDay(daily); }, [daily]);
  const resume = lastRun();
  const stars = starTotal(profile);
  const nextWorld = Math.min(WORLDS, Math.floor(profile.stars.findIndex((s) => s === 0) / LEVELS_PER_WORLD) + 1 || WORLDS);
  const golds = profile.medals.filter((m) => m === 3).length;
  const triesLeft = Math.max(0, DAILY_TRIES - (profile.daily.number === daily ? profile.daily.tries : 0));
  const streak = currentStreak(profile);
  const missions = profile.missions.list;

  const playLabel = !resume ? t("bricksPlayEndless")
    : resume.mode === "endless" ? t("bricksContinueRound", { round: n(resume.run.round) })
      : resume.mode === "adventure" ? t("bricksContinueLevel", { world: n(Math.floor((resume.ref - 1) / LEVELS_PER_WORLD) + 1), level: n(((resume.ref - 1) % LEVELS_PER_WORLD) + 1) })
        : resume.mode === "daily" ? t("bricksContinueDaily") : t("bricksContinueChallenge");

  const modes: { key: string; name: string; sub: string; icon: string; bg: string; fg: string; badge?: string; badgeBg?: string; badgeFg?: string; onClick: () => void }[] = [
    { key: "endless", name: t("bricksModeEndless"), sub: profile.stats.bestRound ? t("bricksBestRound", { round: n(profile.stats.bestRound) }) : t("bricksEndlessSub"), icon: "M4 12c2.5-4 5.5-4 8 0s5.5 4 8 0", bg: "#2E1A12", fg: ACCENT, badge: loadRun("endless") ? t("bricksResume") : undefined, badgeBg: "#3A2A16", badgeFg: "#F0A83A", onClick: () => start("endless") },
    { key: "adventure", name: t("bricksModeAdventure"), sub: t("bricksAdventureSub", { world: n(nextWorld), stars: n(stars), total: n(LEVEL_COUNT * 3) }), icon: STAR_PATH, bg: "#2A2650", fg: "#C3B9FF", onClick: () => go("adventure") },
    { key: "daily", name: t("bricksModeDaily"), sub: triesLeft === 1 ? t("bricksDailySubOne", { number: n(daily) }) : t("bricksDailySub", { number: n(daily), tries: n(triesLeft) }), icon: "M5 5h14v15H5zM5 9h14M9 3v4M15 3v4", bg: "#173A36", fg: "#5FD0BE", badge: profile.daily.number === daily && profile.daily.tries > 0 ? undefined : t("bricksNew"), badgeBg: "#173A36", badgeFg: "#5FD0BE", onClick: () => go("daily") },
    { key: "challenges", name: t("bricksModeChallenges"), sub: t("bricksChallengesSub", { gold: n(golds), total: n(CHALLENGE_CATEGORIES.length * CHALLENGES_PER_CATEGORY) }), icon: "M8 4h8v5a4 4 0 0 1-8 0zM6 5H4a3 3 0 0 0 3 4M18 5h2a3 3 0 0 1-3 4M12 13v4M8 20h8", bg: "#3A2A16", fg: "#F0A83A", onClick: () => go("challenges") },
  ];
  const tools: { label: string; icon: string; onClick: () => void }[] = [
    { label: t("bricksCustomize"), icon: "M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5S14 15 15 15h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11a1 1 0 1 0 0-.01M10 7a1 1 0 1 0 0-.01M15 7.5a1 1 0 1 0 0-.01", onClick: () => go("shop") },
    { label: t("bricksTrophies"), icon: "M8 4h8v5a4 4 0 0 1-8 0zM6 5H4a3 3 0 0 0 3 4M18 5h2a3 3 0 0 1-3 4M12 13v4M8 20h8", onClick: () => go("trophies", { tab: "achievements" }) },
    { label: t("bricksStats"), icon: "M5 20V10M12 20V4M19 20v-7", onClick: () => go("trophies", { tab: "stats" }) },
    { label: t("bricksSettings"), icon: "M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4", onClick: () => go("settings") },
  ];

  return (
    <Screen theme="night">
      <BricksHeader title={t("gameBricks")} sub={t("bricksTagline")} onBack={back} backLabel={t("backToSolo")} right={<CoinPill coins={profile.coins} onClick={() => go("shop")} />} />
      <div className="screen__body bricks-body" style={{ paddingTop: 8, gap: 16 }}>
        <section style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14, padding: 16, borderRadius: 22, background: "linear-gradient(170deg, #2E1A12, #1A1020)", overflow: "hidden" }}>
          <div dir="ltr" aria-hidden="true" style={{ position: "relative", height: 128 }}>
            {HERO.map(([x, y, c, v], i) => (
              <span key={i} style={{ position: "absolute", left: `calc(${(x / 7) * 100}% + 2px)`, top: y * 32, width: "calc(100% / 7 - 4px)", height: 30, borderRadius: 8, background: HERO_COLORS[c], color: "#0B0D1A", font: "800 14px var(--font-display)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.18)" }}>{n(v)}</span>
            ))}
            {[[46, 112, 0], [50, 86, 0.3], [55, 60, 0.6], [61, 44, 0.9], [27, 104, 1.2]].map(([x, y, d], i) => (
              <span key={`b${i}`} style={{ position: "absolute", left: `${x}%`, top: y, width: 10, height: 10, borderRadius: 999, background: "#FFFFFF", boxShadow: "0 0 8px rgba(255,255,255,0.8)", animation: `bricks-float 2.4s ease-in-out ${d}s infinite` }} />
            ))}
            <span style={{ position: "absolute", left: "71%", top: 92, width: 24, height: 24, borderRadius: 999, border: "2.5px solid #B8F24A", color: "#B8F24A", font: "700 11px var(--font-body)", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>+1</span>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            {profile.stats.bestScore > 0 && (
              <span style={{ alignSelf: "flex-start", padding: "3px 10px", borderRadius: 999, background: "#0B0D1A", color: ACCENT, fontSize: 12, fontWeight: 600 }}>
                {t("bricksBestBadge", { score: n(profile.stats.bestScore), round: n(profile.stats.bestRound) })}
              </span>
            )}
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25 }}>{t("bricksHeroTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--text-2)" }}>{t("bricksHeroSub")}</div>
          </div>
          <button type="button" className="btn" style={{ background: ACCENT, color: INK, fontSize: 17, minHeight: 56, gap: 10 }}
            onClick={() => (resume ? start(resume.mode, resume.ref) : start("endless"))}>
            <svg className="flip-rtl" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" /></svg>
            <span>{playLabel}</span>
          </button>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {modes.map((m) => (
            <button key={m.key} type="button" onClick={m.onClick} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 20, background: "var(--surface)", border: "1px solid #1E2138", color: "var(--text)", textAlign: "start", cursor: "pointer", fontFamily: "inherit" }}>
              <span className="row row--between" style={{ width: "100%", alignItems: "flex-start" }}>
                <span style={{ width: 42, height: 42, borderRadius: 13, background: m.bg, color: m.fg, display: "flex", alignItems: "center", justifyContent: "center" }}><Svg d={m.icon} /></span>
                {m.badge && <span style={{ padding: "3px 8px", borderRadius: 999, background: m.badgeBg, color: m.badgeFg, fontSize: 11, fontWeight: 600 }}>{m.badge}</span>}
              </span>
              <span>
                <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{m.name}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{m.sub}</span>
              </span>
            </button>
          ))}
        </div>

        <section className="stack" style={{ gap: 12, padding: 14, borderRadius: 20, background: "var(--surface)" }}>
          <div className="row row--between row--baseline">
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t("bricksMissions")}</h2>
            <span className="tiny muted">{t("bricksMissionsNew", { time: formatCountdown(msUntilNextPuzzle(), language) })}</span>
          </div>
          {missions.map((m) => {
            const def = missionDef(m.id);
            return (
              <div key={m.id} className="row" style={{ gap: 10 }}>
                <div className="grow stack" style={{ gap: 6, minWidth: 0 }}>
                  <div className="row row--between" style={{ gap: 8, fontSize: 13 }}>
                    <span>{t(`bricksMission_${def.kind}` as TranslationKey, { count: def.target })}</span>
                    <span className="num muted">{m.done ? t("bricksDone") : `${n(m.progress)} / ${n(def.target)}`}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "#262A44", overflow: "hidden" }}>
                    <div style={{ width: `${Math.round((m.progress / def.target) * 100)}%`, height: 6, borderRadius: 999, background: m.done ? "#B8F24A" : ACCENT }} />
                  </div>
                </div>
                <span className="num" style={{ flex: "none", minWidth: 52, padding: "4px 8px", borderRadius: 999, background: m.done ? "#1F3314" : "#2A2113", color: m.done ? "#B8F24A" : GOLD, fontSize: 12, fontWeight: 700, textAlign: "center" }}>
                  {m.done ? "✓ " : "+"}{n(def.coins)}
                </span>
              </div>
            );
          })}
          <div className="row" style={{ gap: 10, paddingTop: 4, borderTop: "1px solid #1E2138" }}>
            <span className="grow" style={{ fontSize: 12, color: "var(--text-2)" }}>
              {streak ? (7 - (streak % 7) === 1 ? t("bricksStreakLineOne", { days: n(streak) }) : t("bricksStreakLine", { days: n(streak), left: n(7 - (streak % 7)) })) : t("bricksStreakStart")}
            </span>
            <div className="row" style={{ gap: 4 }} aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => {
                const done = i < (streak % 7 || (streak ? 7 : 0));
                return <span key={i} style={{ width: 14, height: 14, borderRadius: 4, boxSizing: "border-box", background: done ? ACCENT : "transparent", border: `1.5px solid ${done ? ACCENT : i === 6 ? GOLD : "#2E3252"}` }} />;
              })}
            </div>
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          {tools.map((o) => (
            <button key={o.label} type="button" onClick={o.onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 4px", borderRadius: 16, background: "var(--surface)", color: "var(--text)", border: 0, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <Svg d={o.icon} color={ACCENT} />
              <span>{o.label}</span>
            </button>
          ))}
        </div>

        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {[t("bricksRewardXp"), t("bricksRewardWeekly"), t("bricksRewardFree")].map((r) => (
            <span key={r} style={{ padding: "6px 12px", borderRadius: 999, background: "#2A2113", color: "#F0A83A", fontSize: 12, fontWeight: 600 }}>{r}</span>
          ))}
        </div>
      </div>
      <NoticeToasts top={80} />
    </Screen>
  );
}

// ------------------------------------------------------------------ adventure

export function objectiveOf(t: (k: TranslationKey, v?: Record<string, string | number>) => string, def: LevelDef) {
  switch (def.objective) {
    case "clear": return [t("bricksGoalClear"), t("bricksGoalClearSub")];
    case "target": return [t("bricksGoalTarget"), t("bricksGoalTargetSub")];
    case "collect": return [t("bricksGoalCollect", { count: def.count ?? 0 }), t("bricksGoalCollectSub")];
    case "survive": return [t("bricksGoalSurvive", { rounds: def.count ?? 0 }), t("bricksGoalSurviveSub")];
    case "formation": return [t("bricksGoalFormation"), t("bricksGoalFormationSub")];
    case "shots": return [t("bricksGoalClearIn", { shots: def.count ?? 0 }), t("bricksGoalShotsSub")];
    case "combo": return [t("bricksGoalCombo", { count: def.count ?? 0, shots: def.setup.shotLimit ?? 0 }), t("bricksGoalComboSub")];
  }
}

export function worldOpen(stars: number[], w: number) {
  return w === 0 || stars[w * LEVELS_PER_WORLD - 1] > 0;
}
export function levelOpen(stars: number[], level: number) {
  const w = Math.floor((level - 1) / LEVELS_PER_WORLD);
  if (!worldOpen(stars, w)) return false;
  return (level - 1) % LEVELS_PER_WORLD === 0 || stars[level - 2] > 0;
}

export function BricksAdventure() {
  const { t, n } = useLanguage();
  const { back } = useBricksNav();
  const start = usePlay();
  const profile = useBricksProfile();
  useMenuMusic();
  const firstOpen = profile.stars.findIndex((s, i) => s === 0 && levelOpen(profile.stars, i + 1));
  const [world, setWorld] = useState(() => Math.max(0, Math.floor(Math.max(0, firstOpen) / LEVELS_PER_WORLD)));
  const [level, setLevel] = useState<number | null>(null);
  const intro = !profile.tips.adventure;
  const key = WORLD_KEYS[world];
  const style = WORLD_STYLE[key];
  const open = worldOpen(profile.stars, world);
  const wStars = profile.stars.slice(world * LEVELS_PER_WORLD, (world + 1) * LEVELS_PER_WORLD);
  const cleared = wStars.filter((s) => s > 0).length;
  const pct = Math.round((cleared / LEVELS_PER_WORLD) * 100);
  const total = starTotal(profile);
  const def = level ? levelDef(level) : null;
  const rewardItems = WORLD_REWARD[key].map((i) => t(`bricksItem_${i.replace(":", "_")}` as TranslationKey)).join(" + ");

  return (
    <Screen theme="night">
      <BricksHeader title={t("bricksModeAdventure")} sub={t("bricksAdventureTagline", { worlds: n(WORLDS), levels: n(LEVEL_COUNT) })} onBack={back} backLabel={t("backToGame", { game: t("gameBricks") })}
        right={<div className="row num" style={{ gap: 6, minHeight: 40, padding: "0 12px", borderRadius: 14, background: "#2A2113", color: GOLD, fontWeight: 700, fontSize: 14 }} aria-label={t("bricksStarsAria", { stars: n(total), total: n(LEVEL_COUNT * 3) })}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d={STAR_PATH} fill={GOLD} /></svg>{n(total)} / {n(LEVEL_COUNT * 3)}
        </div>} />
      <div role="tablist" aria-label={t("bricksWorlds")} style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 16px 10px", flex: "none" }}>
        {WORLD_KEYS.map((k, i) => {
          const sel = i === world, locked = !worldOpen(profile.stars, i);
          return (
            <button key={k} type="button" role="tab" aria-selected={sel} onClick={() => { play("button"); setWorld(i); setLevel(null); }}
              aria-label={`${t("bricksWorldN", { world: n(i + 1) })} · ${t(`bricksWorld_${k}` as TranslationKey)}${locked ? ` · ${t("bricksLocked")}` : ""}`}
              style={{ flex: "none", width: 52, height: 52, borderRadius: 16, border: `2px solid ${sel ? WORLD_STYLE[k].accent : "#1E2138"}`, background: sel ? "#1E2138" : "var(--surface)", color: locked ? "#5A5E7A" : WORLD_STYLE[k].accent, font: "800 17px var(--font-display)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {locked ? <Svg d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" size={18} /> : n(i + 1)}
            </button>
          );
        })}
      </div>
      <div className="screen__body bricks-body" style={{ paddingTop: 0, gap: 14 }}>
        <section className="stack" style={{ gap: 10, padding: 16, borderRadius: 22, background: `linear-gradient(160deg, ${style.bg[0]}, ${style.bg[1]})` }}>
          <div className="row row--between" style={{ alignItems: "flex-start", gap: 10 }}>
            <div>
              <div className="kicker" style={{ color: style.accent }}>{t("bricksWorldKicker", { world: n(world + 1), stars: n(wStars.reduce((a, b) => a + b, 0)), total: n(LEVELS_PER_WORLD * 3) })}</div>
              <h2 className="display" style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 800 }}>{t(`bricksWorld_${key}` as TranslationKey)}</h2>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>{t(`bricksWorldDesc_${key}` as TranslationKey)}</div>
            </div>
            <div style={{ flex: "none", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: style.accent }}>{t("bricksPercent", { pct: n(pct) })}</div>
              <div className="tiny" style={{ color: "var(--text-2)" }}>{t("bricksDoneShort")}</div>
            </div>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: 6, background: style.accent }} />
          </div>
          <div className="row" style={{ gap: 8, fontSize: 12 }}>
            <Svg d="M4 10h16v10H4zM12 10v10M4 10l2-4h12l2 4M9 6c0-2 3-3 3 0 0-3 3-2 3 0" size={16} color={style.accent} />
            <span>{profile.worldsRewarded.includes(world) ? t("bricksWorldEarned", { items: rewardItems, coins: n(WORLD_COINS) }) : t("bricksWorldReward", { items: rewardItems, coins: n(WORLD_COINS) })}</span>
          </div>
        </section>

        {!open ? (
          <div className="stack center" style={{ padding: "28px 16px", borderRadius: 20, background: "var(--surface)", textAlign: "center", gap: 6 }}>
            <Svg d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" size={30} color="var(--muted)" />
            <div style={{ fontSize: 15, fontWeight: 600 }}>{t("bricksWorldLocked")}</div>
            <div className="small muted">{t("bricksWorldLockedHint", { world: n(world) })}</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px 10px" }}>
            {Array.from({ length: LEVELS_PER_WORLD }, (_, i) => {
              const lv = world * LEVELS_PER_WORLD + i + 1;
              const s = profile.stars[lv - 1], done = s > 0, can = levelOpen(profile.stars, lv), current = can && !done, boss = i === LEVELS_PER_WORLD - 1;
              return (
                <button key={lv} type="button" disabled={!can} onClick={() => { play("button"); setLevel(lv); }}
                  aria-label={`${t("bricksLevelN", { level: n(i + 1) })}${boss ? ` · ${t("bricksFinalChallenge")}` : ""} · ${done ? (s === 1 ? t("bricksStarsNOne") : t("bricksStarsN", { stars: n(s) })) : can ? t("bricksNext") : t("bricksLocked")}`}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 0, border: 0, background: "transparent", color: "var(--text)", cursor: can ? "pointer" : "default", fontFamily: "inherit" }}>
                  <span style={{ width: boss ? 60 : 52, height: boss ? 60 : 52, borderRadius: boss ? 18 : 999, border: `2.5px solid ${current ? ACCENT : done ? style.accent : "#262A44"}`, background: current ? "#2E1A12" : done ? "#1E2138" : "var(--surface)", color: can ? "var(--text)" : "#5A5E7A", font: "800 18px var(--font-display)", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", animation: current ? "bricks-ring 1.6s ease-in-out infinite" : "none" }}>
                    {can ? n(i + 1) : <Svg d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" size={16} />}
                  </span>
                  <Stars count={s} size={12} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {def && (
        <Sheet onClose={() => setLevel(null)} label={t("bricksLevelTitle", { world: n(world + 1), level: n(def.index + 1) })}>
          <div className="row row--between">
            <div>
              <div className="tiny" style={{ fontWeight: 600, color: style.accent }}>{t(`bricksWorld_${key}` as TranslationKey)}</div>
              <h2 className="display" style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
                {t("bricksLevelTitle", { world: n(world + 1), level: n(def.index + 1) })}{def.index === LEVELS_PER_WORLD - 1 ? ` · ${t("bricksFinalChallenge")}` : ""}
              </h2>
            </div>
            <CloseButton onClick={() => setLevel(null)} />
          </div>
          <div className="row" style={{ gap: 14, alignItems: "stretch" }}>
            <Thumb cells={boardThumb(def.setup.bricks)} />
            <div className="stack grow" style={{ gap: 6 }}>
              <div className="tiny" style={{ fontWeight: 600, color: "var(--muted)" }}>{t("bricksObjective")}</div>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{objectiveOf(t, def)[0]}</div>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>{objectiveOf(t, def)[1]}</div>
              <div className="tiny muted">{t("bricksStartBalls", { balls: n(def.setup.balls) })}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
            {(def.scoreStars
              ? [[3, t("bricksScoreAtLeast", { score: n(def.scoreStars[1]) })], [2, t("bricksScoreAtLeast", { score: n(def.scoreStars[0]) })], [1, t("bricksSurviveIt")]]
              : [[3, def.par === 1 ? t("bricksInOneShot") : t("bricksInShots", { shots: n(def.par) })], [2, t("bricksInShots", { shots: n(def.par + 3) })], [1, t("bricksFinish")]]
            ).map(([stars, label]) => (
              <div key={String(stars)} style={{ padding: "8px 6px", borderRadius: 12, background: profile.stars[def.number - 1] >= Number(stars) ? "#2A2113" : "#10122A", textAlign: "center" }}>
                <Stars count={Number(stars)} size={13} />
                <div style={{ fontSize: 12, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
          <div className="row row--between" style={{ fontSize: 13, color: "var(--text-2)" }}>
            <span>{profile.stars[def.number - 1] ? (profile.stars[def.number - 1] === 1 ? t("bricksBestStarsOne") : t("bricksBestStars", { stars: n(profile.stars[def.number - 1]) })) : t("bricksNotPlayed")}</span>
            <span style={{ color: GOLD, fontWeight: 600 }}>
              {profile.stars[def.number - 1] ? t("bricksNewStarCoins", { coins: n((3 - profile.stars[def.number - 1]) * 5) }) : t("bricksLevelCoins")}
            </span>
          </div>
          <button type="button" className="btn" style={{ background: ACCENT, color: INK, fontSize: 16 }} onClick={() => start("adventure", def.number)}>
            {loadRun(runKey("adventure", def.number)) ? t("bricksContinue") : profile.stars[def.number - 1] ? t("bricksReplay") : t("bricksPlay")}
          </button>
        </Sheet>
      )}

      {intro && (
        <Sheet onClose={() => markTip("adventure")} label={t("bricksAdventureIntro")}>
          <h2 className="display" style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{t("bricksAdventureIntro")}</h2>
          {([
            [STAR_PATH, t("bricksIntroStars"), t("bricksIntroStarsText")],
            ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11.5v1", t("bricksIntroGoals"), t("bricksIntroGoalsText")],
            ["M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z", t("bricksIntroMap"), t("bricksIntroMapText")],
          ] as const).map(([icon, title, text]) => (
            <div key={title} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 32, height: 32, flex: "none", borderRadius: 10, background: "#2E1A12", color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}><Svg d={icon} size={18} /></span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: 13, lineHeight: 1.45, color: "var(--text-2)" }}>{text}</div>
              </div>
            </div>
          ))}
          <button type="button" className="btn" style={{ background: ACCENT, color: INK, fontSize: 16 }} onClick={() => markTip("adventure")}>{t("gotIt")}</button>
        </Sheet>
      )}
    </Screen>
  );
}

export function Sheet({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(6,7,16,0.72)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={label} className="stack" style={{ gap: 14, padding: "18px 16px calc(24px + env(safe-area-inset-bottom))", borderRadius: "26px 26px 0 0", background: "#151829", maxWidth: 520, width: "100%", margin: "0 auto", boxSizing: "border-box", maxHeight: "88vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  const { t } = useLanguage();
  return (
    <button type="button" className="icon-btn" aria-label={t("close")} onClick={onClick}>
      <Svg d="M6 6l12 12M18 6 6 18" size={18} />
    </button>
  );
}

// ------------------------------------------------------------------ daily

export function BricksDaily() {
  const { t, n, language } = useLanguage();
  const { back } = useBricksNav();
  const start = usePlay();
  const { api } = useHub();
  const profile = useBricksProfile();
  useMenuMusic();
  const number = todayDaily();
  useEffect(() => { refreshDay(number); }, [number]);
  const def = useMemo(() => dailyDef(number), [number]);
  const [tab, setTab] = useState<"today" | "history">("today");
  const board = useLoad(() => api.board("bricks", number), [api, number]).data;
  const tries = profile.daily.number === number ? profile.daily.tries : 0;
  const saved = loadRun(runKey("daily", number));
  const left = Math.max(0, DAILY_TRIES - tries);
  const streak = currentStreak(profile);
  const goal = dailyGoal(t, def);
  const rows = (Array.isArray(board?.rows) ? board.rows : []).filter((r) => r.score !== null);
  // One row per player: their best try.
  const best = new Map<string, (typeof rows)[number]>();
  for (const r of rows) { const k = r.name + (r.isYou ? "*" : ""); if (!best.has(k) || (best.get(k)!.score ?? 0) < (r.score ?? 0)) best.set(k, r); }
  const ranked = [...best.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 10);

  return (
    <Screen theme="night">
      <BricksHeader title={t("bricksModeDaily")} sub={t("bricksDailyTitleSub", { number: n(number) })} onBack={back} backLabel={t("backToGame", { game: t("gameBricks") })} />
      <div className="screen__body bricks-body" style={{ paddingTop: 8, gap: 14 }}>
        <section className="row" style={{ gap: 14, padding: 16, borderRadius: 22, background: "linear-gradient(160deg, #1F4F48, #14302D)", alignItems: "flex-start" }}>
          <Thumb cells={boardThumb(def.setup.bricks)} />
          <div className="stack grow" style={{ gap: 6 }}>
            <span style={{ alignSelf: "flex-start", padding: "3px 10px", borderRadius: 999, background: "#0B0D1A", color: "#5FD0BE", fontSize: 12, fontWeight: 600 }}>{t("bricksNextDaily", { time: formatCountdown(msUntilNextPuzzle(), language) })}</span>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#A8E6DA" }}>{t("bricksTodayObjective")}</div>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{goal}</div>
            <div style={{ fontSize: 12, color: "#C9E8E2" }}>{def.setup.shotLimit ? t("bricksDailyScoreRule", { balls: n(def.setup.balls) }) : t("bricksDailyScoreRuleNoLimit", { balls: n(def.setup.balls) })}</div>
          </div>
        </section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          <div className="stack center" style={{ padding: "12px 6px", borderRadius: 16, background: "var(--surface)", gap: 6 }}>
            <div className="row" style={{ gap: 4 }} role="img" aria-label={t("bricksTriesAria", { left: n(left), tries: n(DAILY_TRIES) })}>
              {Array.from({ length: DAILY_TRIES }, (_, i) => <span key={i} style={{ width: 14, height: 14, borderRadius: 999, border: "2px solid #5FD0BE", background: i < left ? "#5FD0BE" : "transparent", boxSizing: "border-box" }} />)}
            </div>
            <div className="tiny muted">{t("bricksTriesLeft")}</div>
          </div>
          <div style={{ padding: "12px 6px", borderRadius: 16, background: "var(--surface)", textAlign: "center" }}>
            <div className="num" style={{ fontSize: 18, fontWeight: 700 }}>{profile.daily.number === number && profile.daily.best !== null ? n(profile.daily.best) : "—"}</div>
            <div className="tiny muted">{t("bricksBestToday")}</div>
          </div>
          <div style={{ padding: "12px 6px", borderRadius: 16, background: "#2A2113", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: GOLD }}>{profile.daily.number === number && profile.daily.done ? "✓" : `+${n(DAILY_COINS)}`}</div>
            <div className="tiny" style={{ color: "#E9D9B0" }}>{profile.daily.number === number && profile.daily.done ? t("bricksRewardTaken") : t("bricksReward")}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 12, padding: "12px 14px", borderRadius: 18, background: "var(--surface)" }}>
          <Svg d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2.5-5 .5 1.5 1.5 2 2.5 2 0-2.5-1-4.5 0-7z" color={ACCENT} />
          <div className="grow">
            <div style={{ fontSize: 14, fontWeight: 600 }}>{streak ? t("bricksStreakDays", { days: n(streak) }) : t("bricksStreakStart")}</div>
            <div className="tiny muted">{t("bricksStreakRule")}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 10, padding: "10px 14px", borderRadius: 14, border: "1.5px dashed #2E3252", fontSize: 13, color: "var(--text-2)" }}>
          <Svg d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8 12h8" size={18} color="var(--muted)" />
          <span>{t("bricksDailyFair")}</span>
        </div>
        <Tabs label={t("bricksRankings")} value={tab} onChange={setTab} options={[{ value: "today", label: t("bricksToday") }, { value: "history", label: t("bricksMyHistory") }]} />
        <div className="stack" style={{ gap: 6 }}>
          {tab === "today" && (ranked.length ? ranked.map((r, i) => (
            <div key={`${r.name}-${i}`} className="row" style={{ gap: 10, padding: "10px 12px", borderRadius: 14, background: r.isYou ? "#1E2138" : "var(--surface)" }}>
              <span className="num" style={{ width: 36, fontSize: 13, color: "var(--muted)" }}>#{n(i + 1)}</span>
              <span className="grow" style={{ fontSize: 14 }}>{r.isYou ? t("youName", { name: r.name }) : r.name}</span>
              <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>{n(r.score ?? 0)}</span>
            </div>
          )) : <div className="small muted" style={{ padding: 12 }}>{board ? t("bricksNoRankingsYet") : t("bricksRankingsOffline")}</div>)}
          {tab === "history" && (profile.dailyHistory.length ? profile.dailyHistory.slice(0, 14).map((h) => (
            <div key={h.number} className="row" style={{ gap: 10, padding: "10px 12px", borderRadius: 14, background: "var(--surface)" }}>
              <span className="num" style={{ width: 48, fontSize: 13, color: "var(--muted)" }}>#{n(h.number)}</span>
              <span className="grow" style={{ fontSize: 14 }}>{h.best === null ? t("bricksMissed") : h.done ? t("bricksObjectiveMet") : t("bricksObjectiveNotMet")}</span>
              <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>{h.best === null ? "—" : n(h.best)}</span>
            </div>
          )) : <div className="small muted" style={{ padding: 12 }}>{t("bricksNoHistory")}</div>)}
        </div>
      </div>
      <div className="screen__bar">
        <button type="button" className="btn" disabled={!saved && left <= 0} style={{ background: "#5FD0BE", color: "#0B1F1C", fontSize: 16 }} onClick={() => start("daily", number)}>
          {saved ? t("bricksContinueTry") : left > 0 ? t("bricksStartTry", { tryNo: n(tries + 1), tries: n(DAILY_TRIES) }) : t("bricksNoTriesLeft")}
        </button>
      </div>
    </Screen>
  );
}

export function dailyGoal(t: (k: TranslationKey, v?: Record<string, string | number>) => string, def: ReturnType<typeof dailyDef>) {
  switch (def.kind) {
    case "clear": return t("bricksGoalClearIn", { shots: def.count ?? 8 });
    case "target": return t("bricksGoalTarget");
    case "collect": return t("bricksGoalCollect", { count: def.count ?? 5 });
    case "survive": return t("bricksGoalSurvive", { rounds: def.count ?? 15 });
    case "combo": return t("bricksGoalCombo", { count: def.count ?? 8, shots: def.setup.shotLimit ?? 6 });
    case "formation": return t("bricksGoalFormation");
  }
}

// ------------------------------------------------------------------ challenges

const CATEGORY_ICON: Record<ChallengeCategory, [string, string, string]> = {
  precision: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11.5v1", "#2E1A12", ACCENT],
  survival: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "#173A36", "#5FD0BE"],
  limited: ["M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM5 5l14 14", "#1E2138", "#C3B9FF"],
  combo: ["M13 2 4 14h7l-1 8 9-12h-7z", "#2A2650", "#9C8CFF"],
  clear: ["M4 6h7v5H4zM13 6h7v5h-7zM8 13h8v5H8zM3 21h18", "#14241A", "#5BD69A"],
  power: ["M12 3l1.8 4.6L18.4 6l-1.6 4.6L21 12l-4.2 1.4 1.6 4.6-4.6-1.6L12 21l-1.8-4.6L5.6 18l1.6-4.6L3 12l4.2-1.4L5.6 6l4.6 1.6z", "#3A2A16", "#F0A83A"],
};
const MEDAL = ["#2E3252", "#D9905A", "#C9D2E3", GOLD];
const DIFF: [TranslationKey, string][] = [["bricksDiffEasy", "#5BD69A"], ["bricksDiffMedium", "#4FC3F7"], ["bricksDiffHard", "#FFD166"], ["bricksDiffExpert", "#FF9A62"], ["bricksDiffMaster", "#FF5C7A"]];

export function BricksChallenges() {
  const { t, n } = useLanguage();
  const { back } = useBricksNav();
  const start = usePlay();
  const { api } = useHub();
  const profile = useBricksProfile();
  useMenuMusic();
  const [open, setOpen] = useState<number>(0);
  const tally = [3, 2, 1].map((m) => profile.medals.filter((x) => x >= m).length);
  const total = CHALLENGE_CATEGORIES.length * CHALLENGES_PER_CATEGORY;
  // Your rank among friends for each challenge of the open category.
  const ranks = useLoad(async () => {
    if (open < 0) return [] as (number | null)[];
    const ids = Array.from({ length: CHALLENGES_PER_CATEGORY }, (_, i) => open * CHALLENGES_PER_CATEGORY + i + 1);
    return Promise.all(ids.map((id) => api.board("bricks", id, "challenge").then((b) => b.rows?.find((r) => r.isYou)?.rank ?? null).catch(() => null)));
  }, [api, open]).data;

  return (
    <Screen theme="night">
      <BricksHeader title={t("bricksModeChallenges")} sub={t("bricksChallengesTagline", { categories: n(CHALLENGE_CATEGORIES.length), total: n(total) })} onBack={back} backLabel={t("backToGame", { game: t("gameBricks") })} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, padding: "4px 16px 12px" }}>
        {[[GOLD, tally[0], t("bricksGold")], ["#C9D2E3", tally[1], t("bricksSilver")], ["#D9905A", tally[2], t("bricksBronze")]].map(([c, v, l]) => (
          <div key={String(l)} className="row" style={{ justifyContent: "center", gap: 8, padding: "10px 6px", borderRadius: 14, background: "var(--surface)" }}>
            <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 999, background: String(c), boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.25)" }} />
            <span className="num" style={{ fontSize: 15, fontWeight: 700 }}>{n(Number(v))} / {n(total)}</span>
            <span className="visually-hidden">{l}</span>
          </div>
        ))}
      </div>
      <div className="screen__body bricks-body" style={{ paddingTop: 0, gap: 10 }}>
        {CHALLENGE_CATEGORIES.map((cat, ci) => {
          const isOpen = open === ci;
          const [icon, bg, fg] = CATEGORY_ICON[cat];
          const medals = profile.medals.slice(ci * CHALLENGES_PER_CATEGORY, (ci + 1) * CHALLENGES_PER_CATEGORY);
          return (
            <section key={cat} style={{ borderRadius: 20, background: "var(--surface)", border: `1.5px solid ${isOpen ? "#2E3252" : "transparent"}`, overflow: "hidden" }}>
              <button type="button" aria-expanded={isOpen} onClick={() => { play("button"); setOpen(isOpen ? -1 : ci); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: 14, border: 0, background: "transparent", color: "var(--text)", textAlign: "start", cursor: "pointer", fontFamily: "inherit" }}>
                <span style={{ width: 42, height: 42, flex: "none", borderRadius: 13, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center" }}><Svg d={icon} /></span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{t(`bricksCh_${cat}` as TranslationKey)}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{t(`bricksChDesc_${cat}` as TranslationKey)}</span>
                </span>
                <span className="row" style={{ gap: 3 }} aria-label={t("bricksGoldOf", { gold: n(medals.filter((m) => m === 3).length), total: n(CHALLENGES_PER_CATEGORY) })}>
                  {medals.map((m, i) => <span key={i} style={{ width: 9, height: 9, borderRadius: 999, background: MEDAL[m] }} />)}
                </span>
              </button>
              {isOpen && (
                <div className="stack" style={{ gap: 8, padding: "0 14px 14px" }}>
                  {medals.map((m, k) => {
                    const id = ci * CHALLENGES_PER_CATEGORY + k + 1;
                    const def = challengeDef(id);
                    const best = profile.challengeBest[id - 1];
                    const unit = t(`bricksUnit_${def.metric}` as TranslationKey);
                    const sign = def.metric === "shots" ? "≤" : "≥";
                    const rank = ranks?.[k];
                    return (
                      <div key={id} className="stack" style={{ gap: 8, padding: 12, borderRadius: 14, background: "#10122A" }}>
                        <div className="row row--between row--baseline" style={{ gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{t(`bricksCh_${cat}` as TranslationKey)} {n(k + 1)}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: DIFF[k][1] }}>{t(DIFF[k][0])}</span>
                        </div>
                        <div className="tiny muted">{challengeGoal(t, def)}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4 }}>
                          {[3, 2, 1].map((medal, j) => (
                            <div key={medal} className="row" style={{ gap: 5, padding: "5px 6px", borderRadius: 9, background: m >= medal ? "#1E2138" : "transparent", fontSize: 11, color: m >= medal ? "var(--text)" : "var(--muted)" }}>
                              <span aria-hidden="true" style={{ width: 10, height: 10, flex: "none", borderRadius: 999, background: MEDAL[medal] }} />
                              <span className="num" dir="ltr">{sign} {n(def.medals[j])} · +{n(def.coins[j])}</span>
                            </div>
                          ))}
                        </div>
                        <div className="row row--between" style={{ gap: 8 }}>
                          <span className="tiny muted">
                            {best !== null ? t("bricksChBest", { value: n(best), unit }) : t("bricksNotTried")}
                            {rank ? ` · ${t("bricksRank", { rank: n(rank) })}` : ""}
                          </span>
                          <button type="button" className="btn" onClick={() => start("challenge", id)}
                            style={{ width: "auto", minHeight: 40, padding: "0 14px", fontSize: 13, background: m === 3 ? "#1E2138" : "#F0A83A", color: m === 3 ? "var(--text)" : "#1A1206" }}>
                            {loadRun(runKey("challenge", id)) ? t("bricksContinue") : m === 3 ? t("bricksReplay") : t("bricksPlay")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </Screen>
  );
}

export function challengeGoal(t: (k: TranslationKey, v?: Record<string, string | number>) => string, def: ReturnType<typeof challengeDef>) {
  switch (def.category) {
    case "precision": return t("bricksChGoal_precision", { balls: def.setup.balls });
    case "survival": return t("bricksChGoal_survival", { rounds: def.medals[0] });
    case "limited": return t("bricksChGoal_limited", { balls: def.setup.balls });
    case "combo": return t("bricksChGoal_combo", { shots: def.setup.shotLimit ?? 5 });
    case "clear": return t("bricksChGoal_clear", { balls: def.setup.balls });
    case "power": return t("bricksChGoal_power");
  }
}
