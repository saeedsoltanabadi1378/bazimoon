import { useEffect, useState } from "react";
import { useLanguage, type TranslationKey } from "../../i18n/LanguageContext";
import { useHub, useLoad } from "../../hub/HubData";
import { Screen } from "../../ui/components";
import { shareLink } from "../../lib/platform";
import { appLink } from "../../lib/links";
import { roman } from "../../hub/HomeScreen";
import { XpCard } from "../shared/ResultScreen";
import { parseXp, type ResultParams } from "../shared/play";
import { LEVEL_COUNT, LEVELS_PER_WORLD, WORLD_KEYS, levelDef } from "./levels";
import { challengeDef } from "./challenges";
import { DAILY_TRIES } from "./daily";
import { ACHIEVEMENTS, getProfile, markTip, useBricksProfile } from "./progress";
import { play } from "./audio";
import { ACCENT, CoinIcon, GOLD, INK, STAR_PATH, Svg } from "./ui";
import { CloseButton, objectiveOf, useBricksNav, useMenuMusic } from "./BricksMenus";
import { BRICK_ICON } from "./ui";

/** Counts a number up from zero over about a second (straight to it with reduced motion). */
function useCountUp(target: number) {
  const reduced = getProfile().settings.reducedMotion;
  const [v, setV] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 1000);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return v;
}

/** The server's XP reply, only when it is complete enough to draw. */
function xpOf(params: ResultParams | undefined) {
  const xp = parseXp(params);
  return xp && typeof xp.xpGained === "number" && typeof xp.xpForNext === "number" ? xp : null;
}

const num = (v: unknown, d = 0) => (typeof v === "number" ? v : typeof v === "string" && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : d);

export function BricksResult({ params }: { params?: ResultParams }) {
  const mode = String(params?.mode ?? "endless");
  if (mode === "adventure") return <LevelEnd params={params} />;
  return <RunResult params={params} />;
}

function Confetti() {
  const colors = ["#FF9A62", "#FFD166", "#5BD69A", "#4FC3F7", "#B07CFF", "#FF5C7A"];
  if (getProfile().settings.reducedMotion) return null;
  return (
    <div aria-hidden="true" style={{ position: "absolute", insetInline: 0, top: 0, height: 260, pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} style={{ position: "absolute", left: `${(i * 53) % 96}%`, top: 150 + ((i * 37) % 90), width: 8, height: 12, borderRadius: 2, background: colors[i % 6], transform: `rotate(${(i * 47) % 180}deg)`, animation: `bricks-rise 2.6s ease-out ${(i % 7) * 0.35}s infinite` }} />
      ))}
    </div>
  );
}

function RunResult({ params }: { params?: ResultParams }) {
  const { t, n } = useLanguage();
  const { swap } = useBricksNav();
  const { api } = useHub();
  useMenuMusic();
  const profile = useBricksProfile();
  const xp = xpOf(params);
  const mode = String(params?.mode ?? "endless") as "endless" | "daily" | "challenge";
  const ref = num(params?.ref);
  const won = Boolean(params?.won);
  const score = mode === "daily" ? num(params?.dailyScore) : num(params?.score);
  const prevBest = num(params?.prevBest);
  const newBest = mode === "endless" ? (xp?.newBest ?? score > prevBest) && score > 0 : mode === "daily" ? score > prevBest : false;
  const shown = useCountUp(score);
  useEffect(() => { if (newBest) play("highScore"); }, [newBest]);
  const unlocked = String(params?.unlocked ?? "").split(",").filter(Boolean);
  const weeklyData = useLoad(() => (mode === "endless" && profile.settings.ranked ? api.weekly("bricks") : Promise.resolve(null)), [api, mode]).data;
  const weekly = weeklyData && Array.isArray(weeklyData.rows) ? weeklyData : null;
  const boardData = useLoad(() => (mode === "daily" ? api.board("bricks", ref) : mode === "challenge" ? api.board("bricks", ref, "challenge") : Promise.resolve(null)), [api, mode, ref]).data;
  const board = boardData && Array.isArray(boardData.rows) ? boardData : null;
  const chDef = mode === "challenge" ? challengeDef(ref) : null;
  const medal = num(params?.medal);
  const coins = num(params?.coinsEarned);

  const kicker = mode === "endless" ? (newBest ? t("newPersonalBest") : t("bricksOverTitle"))
    : mode === "daily" ? (won ? t("bricksDailyMet") : t("bricksDailyNotMet"))
      : medal ? t(medal === 3 ? "bricksMedalGold" : medal === 2 ? "bricksMedalSilver" : "bricksMedalBronze") : t("bricksNoMedal");
  const kickerColor = newBest || won || medal ? GOLD : "#FF5C7A";
  const sub = mode === "endless"
    ? newBest && prevBest > 0 ? t("bricksBeatBy", { best: n(prevBest), by: n(score - prevBest) }) : newBest ? t("firstScoreOnBoard") : t("bestStill", { best: n(Math.max(prevBest, score)) })
    : mode === "daily" ? (DAILY_TRIES - num(params?.tries) === 1 ? t("bricksDailyTriesLeftOne") : t("bricksDailyTriesLeft", { left: n(Math.max(0, DAILY_TRIES - num(params?.tries))) }))
      : chDef ? t("bricksChResult", { value: n(num(params?.value)), unit: t(`bricksUnit_${chDef.metric}` as TranslationKey) }) : "";

  const metrics: [string, string, string, string][] = mode === "endless" ? [
    [n(num(params?.round)), t("bricksRoundsSurvived"), "M4 12c2.5-4 5.5-4 8 0s5.5 4 8 0", ACCENT],
    [n(num(params?.broken)), t("bricksBricksBroken"), "M4 6h7v5H4zM13 6h7v5h-7zM8 13h8v5H8z", "#5BD69A"],
    [n(num(params?.balls)), t("bricksBallsAtEnd"), "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z", "#EDEBF5"],
    [n(num(params?.bestShot)), t("bricksMostInShot"), "M13 2 4 14h7l-1 8 9-12h-7z", "#C3B9FF"],
  ] : [
    [n(num(params?.score)), t("bricksPoints"), "M4 12c2.5-4 5.5-4 8 0s5.5 4 8 0", ACCENT],
    [n(num(params?.shots)), t("bricksShotsUsed"), "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z", "#EDEBF5"],
    [n(num(params?.broken)), t("bricksBricksBroken"), "M4 6h7v5H4zM13 6h7v5h-7zM8 13h8v5H8z", "#5BD69A"],
    [n(num(params?.bestShot)), t("bricksMostInShot"), "M13 2 4 14h7l-1 8 9-12h-7z", "#C3B9FF"],
  ];
  const again = () => {
    play("button");
    if (mode === "endless") swap("play", { mode: "endless", fresh: true, at: Date.now() });
    else if (mode === "daily") swap("daily");
    else swap("play", { mode: "challenge", ref, fresh: true, at: Date.now() });
  };

  return (
    <Screen theme="night">
      {(newBest || medal === 3) && <Confetti />}
      <div className="row" style={{ justifyContent: "flex-end", padding: "14px 16px 0" }}>
        <CloseButton onClick={() => swap(mode === "challenge" ? "challenges" : mode === "daily" ? "daily" : "intro")} />
      </div>
      <div className="screen__body bricks-body" style={{ paddingTop: 0, gap: 16 }}>
        <section className="stack center" style={{ gap: 6, textAlign: "center" }}>
          <div className="kicker" style={{ color: kickerColor }}>{kicker}</div>
          <h1 className="display num" style={{ fontSize: 56, lineHeight: 1, margin: 0 }}>{n(shown)}</h1>
          <p style={{ fontSize: 15, color: "var(--text-2)", margin: 0 }}>{sub}</p>
        </section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {metrics.map(([v, l, icon, c]) => (
            <div key={l} className="row" style={{ gap: 10, padding: 12, borderRadius: 16, background: "var(--surface)" }}>
              <span style={{ width: 36, height: 36, flex: "none", borderRadius: 11, background: "#1E2138", color: c, display: "flex", alignItems: "center", justifyContent: "center" }}><Svg d={icon} size={18} width={2.2} /></span>
              <div style={{ minWidth: 0 }}>
                <div className="num" style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>
                <div className="tiny muted">{l}</div>
              </div>
            </div>
          ))}
        </div>
        <CoinsCard coins={coins} why={mode === "endless" ? t("bricksCoinsWhyEndless") : mode === "daily" ? (num(params?.dailyCoins) ? t("bricksCoinsWhyDaily") : t("bricksCoinsWhyNone")) : num(params?.challengeCoins) ? t("bricksCoinsWhyMedal") : t("bricksCoinsWhyNone")} onShop={() => swap("shop")} />
        {unlocked.map((id) => {
          const a = ACHIEVEMENTS.find((x) => x.id === id);
          if (!a) return null;
          return (
            <div key={id} className="row" style={{ gap: 12, padding: "12px 14px", borderRadius: 18, background: "var(--surface)", border: "1.5px solid #3A2E16" }}>
              <Svg d="M8 4h8v5a4 4 0 0 1-8 0zM6 5H4a3 3 0 0 0 3 4M18 5h2a3 3 0 0 1-3 4M12 13v4M8 20h8" size={26} color="#F0A83A" />
              <div className="grow">
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t("bricksAchievementName", { name: t(`bricksAch_${id}` as TranslationKey) })}</div>
                <div className="tiny muted">{t(`bricksAchDesc_${id}` as TranslationKey, { count: n(a.target) })}</div>
              </div>
              <span className="num" style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>+{n(a.coins)}</span>
            </div>
          );
        })}
        {xp ? <XpCard xp={xp} /> : <div className="card small muted">{t("resultSavedLater")}</div>}
        {weekly && (
          <section className="stack" style={{ gap: 10, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
            <div className="row row--between">
              <span style={{ fontSize: 14, fontWeight: 600 }}>{t("bricksWeekly", { division: `${t(`division${weekly.division}` as "divisionGold")} ${roman(weekly.tier)}` })}</span>
              <span className="tiny muted">{t("daysLeft", { count: weekly.daysLeft })}</span>
            </div>
            {weekly.rows.length === 0 && <div className="small muted">{t("boardEmpty")}</div>}
            {weekly.rows.slice(0, 5).map((r) => (
              <div key={`${r.rank}-${r.name}`} className="row" style={{ gap: 10, padding: "4px 6px", borderRadius: 10, background: r.isYou ? "#1E2138" : "transparent" }}>
                <span className="num" style={{ width: 26, fontSize: 13, color: "var(--muted)" }}>#{n(r.rank)}</span>
                <span className="grow" style={{ fontSize: 14 }}>{r.isYou ? t("youName", { name: r.name }) : r.name}</span>
                <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>{n(r.score)}</span>
              </div>
            ))}
          </section>
        )}
        {board && board.rows.length > 0 && (
          <section className="stack" style={{ gap: 10, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{mode === "daily" ? t("bricksDailyRanking", { number: n(ref) }) : t("bricksChallengeRanking")}</span>
            {board.rows.slice(0, 5).map((r, i) => (
              <div key={`${r.name}-${i}`} className="row" style={{ gap: 10, padding: "4px 6px", borderRadius: 10, background: r.isYou ? "#1E2138" : "transparent" }}>
                <span className="num" style={{ width: 26, fontSize: 13, color: "var(--muted)" }}>#{n(i + 1)}</span>
                <span className="grow" style={{ fontSize: 14 }}>{r.isYou ? t("youName", { name: r.name }) : r.name}</span>
                <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>{mode === "challenge" && chDef ? `${n(r.moves ?? 0)} ${t(`bricksUnit_${chDef.metric}` as TranslationKey)}` : n(r.score ?? 0)}</span>
              </div>
            ))}
          </section>
        )}
      </div>
      <div className="screen__bar screen__bar--row" style={{ gap: 8 }}>
        {mode === "endless" ? (
          <button type="button" className="btn btn--outline" style={{ flex: 1, fontSize: 15 }} onClick={() => void shareLink(appLink(), t("bricksShare", { score: n(score) }))}>{t("shareScore")}</button>
        ) : (
          <button type="button" className="btn btn--outline" style={{ flex: 1, fontSize: 15 }} onClick={() => swap("intro")}>{t("bricksGameMenu")}</button>
        )}
        <button type="button" className="btn" style={{ flex: 1.3, fontSize: 16, background: ACCENT, color: INK }} onClick={again}>
          {mode === "daily" ? t("bricksSeeDaily") : t("playAgainGame")}
        </button>
      </div>
    </Screen>
  );
}

function CoinsCard({ coins, why, onShop }: { coins: number; why: string; onShop: () => void }) {
  const { t, n } = useLanguage();
  return (
    <div className="row" style={{ gap: 12, padding: 14, borderRadius: 18, background: "#2A2113" }}>
      <CoinIcon size={30} />
      <div className="grow">
        <div style={{ fontSize: 16, fontWeight: 700, color: GOLD }}>{t("bricksCoinsPlus", { coins: n(coins) })}</div>
        <div className="tiny" style={{ color: "#E9D9B0" }}>{why}</div>
      </div>
      <button type="button" className="btn" onClick={onShop} style={{ width: "auto", minHeight: 40, padding: "0 12px", borderRadius: 12, background: "#3A2E16", color: GOLD, fontSize: 13 }}>{t("bricksShop")}</button>
    </div>
  );
}

function LevelEnd({ params }: { params?: ResultParams }) {
  const { t, n } = useLanguage();
  const { swap } = useBricksNav();
  useMenuMusic();
  const level = Math.max(1, Math.min(LEVEL_COUNT, num(params?.ref, 1)));
  const def = levelDef(level);
  const won = Boolean(params?.won);
  const stars = num(params?.stars);
  const xp = xpOf(params);
  const world = Math.floor((level - 1) / LEVELS_PER_WORLD);
  const worldDone = num(params?.worldDone, -1);
  const [goal] = objectiveOf(t, def);
  const shots = num(params?.shots);
  const next = level < LEVEL_COUNT ? level + 1 : null;
  const nextOpen = next !== null && (getProfile().stars[level - 1] > 0);
  const starNote = !won ? "" : stars === 3 ? t("bricksAllStars") : def.scoreStars ? t("bricksScoreForStar", { score: n(def.scoreStars[stars === 2 ? 1 : 0]) }) : (stars === 2 ? def.par : def.par + 3) === 1 ? t("bricksShotsForStarOne") : t("bricksShotsForStar", { shots: n(stars === 2 ? def.par : def.par + 3) });
  const tip = !won ? failTip(t, def) : null;
  const coinsLevel = num(params?.levelCoins);

  return (
    <Screen theme="night">
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: won ? "radial-gradient(90% 50% at 50% 12%, #2E2242 0%, transparent 70%)" : "none" }} aria-hidden="true" />
      {won && stars === 3 && <Confetti />}
      <div className="row" style={{ justifyContent: "flex-end", padding: "14px 16px 0", position: "relative" }}>
        <CloseButton onClick={() => swap("adventure")} />
      </div>
      <div className="screen__body bricks-body" style={{ paddingTop: 0, gap: 18, position: "relative" }}>
        <section className="stack center" style={{ gap: 8, textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{t(`bricksWorld_${WORLD_KEYS[world]}` as TranslationKey)} · {t("bricksLevelTitle", { world: n(world + 1), level: n(def.index + 1) })}</div>
          <h1 className="display" style={{ margin: 0, fontSize: 34, fontWeight: 800 }}>{won ? t("bricksLevelComplete") : t("bricksNotThisTime")}</h1>
          {won ? (
            <>
              <div className="row" style={{ alignItems: "flex-end", gap: 10, paddingTop: 8 }} role="img" aria-label={t("bricksStarsOf3", { stars: n(stars) })}>
                {[0, 1, 2].map((i) => (
                  <svg key={i} width={i === 1 ? 64 : 50} height={i === 1 ? 64 : 50} viewBox="0 0 24 24" aria-hidden="true" style={{ animation: `bricks-star 0.6s ease-out ${0.15 + i * 0.25}s both` }}>
                    <path d={STAR_PATH} fill={i < stars ? GOLD : "transparent"} stroke={i < stars ? GOLD : "#3A3E5C"} strokeWidth="1.2" />
                  </svg>
                ))}
              </div>
              <div style={{ fontSize: 14, color: "var(--text-2)" }}>{starNote}</div>
            </>
          ) : (
            <>
              <div style={{ width: 72, height: 72, borderRadius: 22, background: "#3A1420", color: "#FF5C7A", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 6 }}>
                <Svg d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 11.5v1" size={36} />
              </div>
              <div style={{ fontSize: 15, color: "var(--text-2)" }}>{t("bricksObjectiveNotDone")}</div>
            </>
          )}
        </section>
        <section className="stack" style={{ gap: 8, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
          <div className="tiny" style={{ fontWeight: 600, color: "var(--muted)" }}>{t("bricksObjective")}</div>
          <div className="row row--between row--baseline" style={{ gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{goal}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: won ? "#5BD69A" : ACCENT }}>{won ? t("bricksDone") : t("bricksNotYet")}</span>
          </div>
        </section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {[[n(num(params?.score)), t("bricksPoints"), "var(--text)"], [def.scoreStars ? n(num(params?.round) - (def.setup.round ?? 1)) : n(shots), def.scoreStars ? t("bricksRoundsSurvived") : t("bricksShotsTarget", { par: n(def.par) }), won ? GOLD : "#FF5C7A"], [n(num(params?.broken)), t("bricksBricksBroken"), "var(--text)"]].map(([v, l, c]) => (
            <div key={l} style={{ padding: "12px 6px", borderRadius: 16, background: "var(--surface)", textAlign: "center" }}>
              <div className="num" style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
              <div className="tiny muted">{l}</div>
            </div>
          ))}
        </div>
        {won && (
          <section className="stack" style={{ gap: 8, padding: 14, borderRadius: 18, background: "#2A2113" }}>
            <div className="row" style={{ gap: 10 }}>
              <CoinIcon size={26} />
              <span className="grow" style={{ fontSize: 16, fontWeight: 700, color: GOLD }}>{t("bricksCoinsPlus", { coins: n(coinsLevel) })}</span>
            </div>
            {coinsLevel === 0 && <div className="tiny" style={{ color: "#E9D9B0" }}>{t("bricksNoNewStars")}</div>}
            {num(params?.beforeStars) === 0 && <div className="row row--between tiny" style={{ color: "#E9D9B0" }}><span>{t("bricksLevelDoneCoins")}</span><span className="num">+{n(10)}</span></div>}
            {num(params?.newStars) > 0 && <div className="row row--between tiny" style={{ color: "#E9D9B0" }}><span>{num(params?.newStars) === 1 ? t("bricksNewStarsNOne") : t("bricksNewStarsN", { stars: n(num(params?.newStars)) })}</span><span className="num">+{n(num(params?.newStars) * 5)}</span></div>}
          </section>
        )}
        {worldDone >= 0 && (
          <div className="row" style={{ gap: 12, padding: "12px 14px", borderRadius: 18, background: "var(--surface)", border: "1.5px solid #3A2E16" }}>
            <Svg d="M4 10h16v10H4zM12 10v10M4 10l2-4h12l2 4M9 6c0-2 3-3 3 0 0-3 3-2 3 0" size={26} color="#F0A83A" />
            <div className="grow">
              <div style={{ fontSize: 14, fontWeight: 600 }}>{t("bricksWorldCleared", { world: t(`bricksWorld_${WORLD_KEYS[worldDone]}` as TranslationKey) })}</div>
              <div className="tiny muted">{t("bricksWorldClearedSub")}</div>
            </div>
          </div>
        )}
        {tip && <div className="card small" style={{ lineHeight: 1.5, color: "var(--text-2)" }}>{tip}</div>}
        {xp && <XpCard xp={xp} />}
      </div>
      <div className="screen__bar">
        <button type="button" className="btn" style={{ background: ACCENT, color: INK, fontSize: 16 }}
          onClick={() => { play("button"); swap("play", won && nextOpen && next ? { mode: "adventure", ref: next } : { mode: "adventure", ref: level, fresh: true, at: Date.now() }); }}>
          {won && nextOpen ? t("bricksNextLevel") : t("bricksRetry")}
        </button>
        <div className="row" style={{ gap: 8 }}>
          {won && <button type="button" className="btn btn--outline" style={{ flex: 1, fontSize: 15 }} onClick={() => swap("play", { mode: "adventure", ref: level, fresh: true, at: Date.now() })}>{t("bricksReplay")}</button>}
          <button type="button" className="btn btn--outline" style={{ flex: 1, fontSize: 15 }} onClick={() => swap("adventure")}>{t("bricksLevelMap")}</button>
        </div>
      </div>
    </Screen>
  );
}

function failTip(t: (k: TranslationKey, v?: Record<string, string | number>) => string, def: ReturnType<typeof levelDef>) {
  switch (def.objective) {
    case "target": return t("bricksTipTarget");
    case "collect": return t("bricksTipCollect");
    case "survive": return t("bricksTipSurvive");
    case "shots": return t("bricksTipShots");
    case "combo": return t("bricksTipCombo");
    case "formation": return t("bricksTipFormation");
    default: return t("bricksTipClear");
  }
}

// ------------------------------------------------------------------ first-play tutorial

const TUT_BASE: [number, number, number][] = [[0, 1, 3], [2, 1, 2], [3, 2, 4], [5, 1, 1], [1, 2, 2], [6, 2, 3]];

export function BricksTutorial() {
  const { t, n } = useLanguage();
  const { swap } = useBricksNav();
  useMenuMusic();
  const [step, setStep] = useState(0);
  const steps: { title: TranslationKey; body: TranslationKey; badge?: TranslationKey }[] = [
    { title: "bricksTut1", body: "bricksTut1Text" }, { title: "bricksTut2", body: "bricksTut2Text" }, { title: "bricksTut3", body: "bricksTut3Text" },
    { title: "bricksTut4", body: "bricksTut4Text" }, { title: "bricksTut5", body: "bricksTut5Text" },
    { title: "bricksBrick_bomb", body: "bricksBrickTip_bomb", badge: "bricksNewBrick" }, { title: "bricksPower_hlaser", body: "bricksPowerTip_hlaser", badge: "bricksPowerTip" },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;
  const done = () => { markTip("tutorial"); swap("play", { mode: "endless", fresh: true, at: Date.now() }); };
  const shift = step >= 4 ? 1 : 0;
  const hits = step >= 2 ? 1 : 0;
  const bricks = TUT_BASE.map(([c, r, hp], i) => ({ c, r: r + shift, hp: Math.max(0, hp - (i === 2 || i === 4 ? hits * 2 : hits)), icon: "" }));
  if (step >= 4) [[1, 2], [3, 5], [4, 4]].forEach(([c, hp]) => bricks.push({ c, r: 1, hp, icon: "" }));
  if (step >= 5) bricks.push({ c: 3, r: 3, hp: 6, icon: BRICK_ICON.bomb });
  const balls = step === 1 ? [[215, 320], [196, 352], [175, 385]] : step === 2 ? [[300, 120], [250, 260], [205, 335]] : step === 3 ? [[92, 210], [140, 280]] : [[175, 385]];
  const colors = ["#5BD69A", "#4FC3F7"];
  return (
    <Screen theme="night">
      <div className="row row--between" style={{ padding: "14px 16px 8px" }}>
        <div className="row" style={{ gap: 5 }} role="img" aria-label={t("bricksStepOf", { step: n(step + 1), total: n(steps.length) })}>
          {steps.map((_, i) => <span key={i} style={{ width: i === step ? 22 : 8, height: 6, borderRadius: 999, background: i <= step ? ACCENT : "#2E3252", transition: "width 200ms" }} />)}
        </div>
        <button type="button" className="btn btn--outline" style={{ width: "auto", minHeight: 44, padding: "0 14px", fontSize: 14 }} onClick={done}>{t("bricksSkip")}</button>
      </div>
      <div dir="ltr" aria-hidden="true" style={{ position: "relative", alignSelf: "center", width: "min(350px, calc(100vw - 32px))", aspectRatio: "350 / 420", marginTop: 6, borderRadius: 18, overflow: "hidden", background: "radial-gradient(120% 80% at 50% 0%, #161A36 0%, #0D1024 70%)", flex: "none" }}>
        {bricks.filter((b) => b.hp > 0).map((b, i) => (
          <div key={i} style={{ position: "absolute", left: `calc(${(b.c / 7) * 100}% + 2px)`, top: `calc(${((b.r * 50 - 28) / 420) * 100}%)`, width: "calc(100% / 7 - 4px)", aspectRatio: "1", borderRadius: 10, background: colors[b.hp > 4 ? 1 : 0], color: "#0B0D1A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: b.icon ? "0 0 0 3px #FF9A62, 0 0 18px rgba(255,154,98,0.6)" : "inset 0 -4px 0 rgba(0,0,0,0.18)", transition: "top 300ms" }}>
            <span style={{ font: "800 18px var(--font-display)", lineHeight: 1 }}>{n(b.hp)}</span>
            {b.icon && <Svg d={b.icon} size={14} color="#0B0D1A" width={2.6} />}
          </div>
        ))}
        {(step === 3 || step === 4) && <span style={{ position: "absolute", left: "25%", top: `${((step === 4 ? 230 : 180) / 420) * 100}%`, width: 24, height: 24, borderRadius: 999, border: "3px solid #B8F24A", color: "#B8F24A", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", font: "700 10px var(--font-body)", boxShadow: step === 3 ? "0 0 16px rgba(184,242,74,0.7)" : "none" }}>+1</span>}
        {step === 0 && Array.from({ length: 13 }, (_, i) => {
          const d = (i + 1) * 18;
          let x = 175 + 0.5 * d;
          if (x > 345) x = 690 - x;
          return <span key={i} style={{ position: "absolute", left: `${((x - 2.5) / 350) * 100}%`, top: `${((390 - 0.87 * d) / 420) * 100}%`, width: 5, height: 5, borderRadius: 999, background: "#FFFFFF" }} />;
        })}
        {balls.map(([x, y], i) => <span key={i} style={{ position: "absolute", left: `${((x - 5) / 350) * 100}%`, top: `${((y - 5) / 420) * 100}%`, width: 10, height: 10, borderRadius: 999, background: "#FFFFFF", boxShadow: "0 0 6px rgba(255,255,255,0.8)" }} />)}
        {step === 6 && <span style={{ position: "absolute", left: 0, top: `${(70 / 420) * 100}%`, width: "100%", height: 14, borderRadius: 999, background: "#FFF3B0", boxShadow: "0 0 18px #FFD166, 0 0 40px #FF9A62" }} />}
        {step === 4 && <div className="row" style={{ position: "absolute", insetInline: 0, top: "40%", justifyContent: "center", gap: 36, color: ACCENT }}>{[0, 1, 2].map((i) => <Svg key={i} d="M12 4v16M6 14l6 6 6-6" size={22} width={2.4} />)}</div>}
        <div style={{ position: "absolute", insetInline: 0, top: `${(360 / 420) * 100}%`, borderTop: "2px dashed #3A3E5C" }} />
        {step <= 1 && (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="#EDEBF5" stroke="#0B0D1A" strokeWidth="1.2" style={{ position: "absolute", left: "49%", top: "78%", animation: step === 0 ? "bricks-hand 2s ease-in-out infinite" : "none" }}>
            <path d="M9 11V5a1.5 1.5 0 0 1 3 0v5l.5-2.5a1.5 1.5 0 0 1 3 .3V11l.4-1.4a1.5 1.5 0 0 1 2.9.6L17.5 16a5 5 0 0 1-5 4h-1a5 5 0 0 1-4.3-2.5L5 13.6a1.5 1.5 0 0 1 2.6-1.5z" />
          </svg>
        )}
        <span className="num" style={{ position: "absolute", left: "46%", top: "94.5%", padding: "1px 7px", borderRadius: 999, background: "#0B0D1A", color: "#EDEBF5", font: "700 12px var(--font-body)" }}>×{n(step >= 4 ? 2 : 1)}</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 12, padding: "14px 16px calc(22px + env(safe-area-inset-bottom))" }}>
        <section role="status" className="stack" style={{ gap: 8, padding: 16, borderRadius: 20, background: "var(--surface)", border: `1.5px solid ${s.badge ? "#3A2416" : "transparent"}` }}>
          <div className="row" style={{ gap: 10 }}>
            {s.badge && <span style={{ padding: "3px 10px", borderRadius: 999, background: "#2E1A12", color: ACCENT, fontSize: 11, fontWeight: 700 }}>{t(s.badge)}</span>}
            <h1 className="display" style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{t(s.title)}</h1>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-2)" }}>{t(s.body)}</div>
        </section>
        <div className="row" style={{ gap: 8 }}>
          {step > 0 && <button type="button" className="btn btn--outline" style={{ flex: 1 }} onClick={() => { play("button"); setStep(step - 1); }}>{t("bricksBack")}</button>}
          <button type="button" className="btn" style={{ flex: 1.6, background: ACCENT, color: INK, fontSize: 16 }} onClick={() => { play("button"); if (last) done(); else setStep(step + 1); }}>
            {last ? t("bricksStartPlaying") : t("bricksNextStep")}
          </button>
        </div>
      </div>
    </Screen>
  );
}
