import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { Body, IconButton, Screen } from "../../ui/components";
import { Icon } from "../../ui/Icon";
import { formatClock, puzzleToday } from "../../lib/format";
import { dailyNumber } from "../../lib/rng";
import { haptic } from "../../lib/haptics";
import { IntroScreen, PreviewGrid } from "../shared/IntroScreen";
import { ResultScreen } from "../shared/ResultScreen";
import { parseXp, useFinish, useStopwatch, type ResultParams } from "../shared/play";
import { blankState, chord, countAround, dailyState, modeConfig, numberColors, open, progress, toggleFlag, type MinesMode, type MinesState } from "./logic";

const ACCENT = "#F08A7A";
const UNLOCK_WINS = 5;

function useUnlocks() {
  const { api } = useHub();
  const stats = useLoad(() => api.stats("mines"), [api]).data;
  const wins = stats?.winsByMode ?? {};
  return {
    stats,
    easyWins: wins.easy ?? 0,
    mediumWins: wins.medium ?? 0,
    mediumOpen: (wins.easy ?? 0) >= UNLOCK_WINS,
    hardOpen: (wins.medium ?? 0) >= UNLOCK_WINS,
  };
}

export function MinesIntro() {
  const { t, language } = useLanguage();
  const { push } = useNavigation();
  const { stats, mediumOpen, hardOpen } = useUnlocks();
  const playedDaily = Boolean(stats?.today);
  const go = (mode: MinesMode) => () => push({ name: "game", game: "mines", screen: "play", params: { mode } });
  const preview = ["", "1", "h", "h", "h", "", "1", "F", "3", "h", "1", "2", "2", "F", "h", "F", "1", "1", "1", "1", "1", "1", "", "", ""];

  return (
    <IntroScreen
      title={t("gameMines")}
      tagline={t("minesTagline")}
      accent={ACCENT}
      accentInk="#1C0905"
      heroBg="#241418"
      preview={
        <PreviewGrid
          cols={5}
          cells={preview.map((c) =>
            c === "h" ? { bg: "#262A44" }
              : c === "F" ? { bg: "#262A44", fg: ACCENT, text: <Icon name="flag" size={10} /> }
                : { bg: "#0F1124", fg: numberColors[Number(c)] || "#EDEBF5", text: c })}
        />
      }
      heroTitle={t("minesHeroTitle")}
      heroSub={t("minesHeroSub")}
      initialMode={1}
      modes={[
        { key: "daily", label: t("modeDaily"), desc: t("minesDailyDesc"), play: playedDaily ? t("dailyPlayed") : t("minesPlayDaily"), disabled: playedDaily, onPlay: go("daily") },
        { key: "easy", label: t("minesEasy"), desc: t("minesEasyDesc"), play: t("minesPlayEasy"), onPlay: go("easy") },
        { key: "medium", label: t("minesMedium"), desc: t("minesMediumDesc"), play: mediumOpen ? t("minesPlayMedium") : t("minesUnlockAfter", { count: UNLOCK_WINS, mode: t("minesEasy") }), disabled: !mediumOpen, onPlay: go("medium") },
        { key: "hard", label: t("minesHard"), desc: t("minesHardDesc"), play: hardOpen ? t("minesPlayHard") : t("minesUnlockAfter", { count: UNLOCK_WINS, mode: t("minesMedium") }), disabled: !hardOpen, onPlay: go("hard") },
      ]}
      stats={[
        { value: stats?.played ?? "—", label: t("statPlayed") },
        { value: stats ? `${stats.winRate}%` : "—", label: t("statWinRate") },
        { value: formatClock(stats?.bestTimeByMode?.easy, language), label: t("minesBestEasy") },
        { value: stats?.winStreak ?? "—", label: t("winStreak") },
      ]}
      steps={[
        { title: t("minesStep1"), text: t("minesStep1Text") },
        { title: t("minesStep2"), text: t("minesStep2Text") },
        { title: t("minesStep3"), text: t("minesStep3Text") },
        { title: t("minesStep4"), text: t("minesStep4Text") },
      ]}
    />
  );
}

export function MinesPlay({ mode }: { mode: MinesMode }) {
  const { t, language } = useLanguage();
  const { back } = useNavigation();
  const { api } = useHub();
  const finish = useFinish("mines");
  const number = mode === "daily" ? dailyNumber("mines", puzzleToday()) : null;
  const initial = () => (mode === "daily" && number ? dailyState(number) : blankState(mode));
  const [state, setState] = useState<MinesState>(initial);
  const [flagMode, setFlagMode] = useState(false);
  const started = state.mines !== null && state.revealed.some(Boolean);
  const [ms, setMs] = useStopwatch(started && state.status === "play");
  const best = useLoad(() => api.stats("mines"), [api]).data?.bestTimeByMode?.[mode];
  const press = useRef<{ cell: number; timer: number; long: boolean } | null>(null);
  const { size, mineCount } = state;
  const p = progress(state);

  useEffect(() => {
    if (state.status === "play") return;
    if (state.status === "won") haptic.success();
    else haptic.error();
  }, [state.status]);

  function tap(i: number) {
    if (state.status !== "play") return;
    if (state.revealed[i]) {
      const next = chord(state, i);
      if (next) {
        haptic.tap();
        setState(next);
      }
      return;
    }
    if (flagMode) {
      haptic.select();
      setState(toggleFlag(state, i));
      return;
    }
    if (state.flags[i]) return;
    haptic.tap();
    setState(open(state, [i]));
  }

  function seeResults() {
    const won = state.status === "won";
    void finish(
      { mode, puzzleNumber: number, solved: won, timeMs: Math.round(ms), score: p.pct, moves: p.flags },
      { mode, won, timeMs: Math.round(ms), flags: p.flags, pct: p.pct, safeLeft: p.safeLeft, previousBest: best ?? null },
    );
  }

  function restart() {
    setState(blankState(mode === "daily" ? "easy" : mode));
    setMs(0);
  }

  const boardWidth = 349;
  const gap = size > 12 ? 1 : 2;
  const cellPx = Math.max(size > 12 ? 30 : 0, (boardWidth - gap * (size - 1)) / size);
  const gridWidth = cellPx * size + gap * (size - 1);
  const ended = state.status !== "play";
  const won = state.status === "won";

  return (
    <Screen theme="night">
      <header className="topbar">
        <IconButton icon="back" label={t("backToGame", { game: t("gameMines") })} onClick={back} />
        <div className="topbar__text">
          <div className="display" style={{ fontSize: 24 }}>{t("gameMines")}</div>
          <div className="tiny muted">{t("minesSub", { mode: t(`mines_${mode}`), size, mines: mineCount })}</div>
        </div>
        <div className="num" style={{ minWidth: 44, padding: "8px 10px", borderRadius: 12, background: "var(--surface)", fontWeight: 600 }}>{formatClock(ms, language)}</div>
      </header>

      <Body tight>
        <div className="stat-grid">
          <div className="stat stat--center" style={{ padding: 10 }}>
            <div className="stat__label">{t("minesLeft")}</div>
            <div className="stat__value" style={{ color: ACCENT }}>{mineCount - p.flags}</div>
          </div>
          <div className="stat stat--center" style={{ padding: 10 }}>
            <div className="stat__label">{t("cleared")}</div>
            <div className="stat__value">{p.pct}%</div>
          </div>
          <div className="stat stat--center" style={{ padding: 10 }}>
            <div className="stat__label">{t("bestTime")}</div>
            <div className="stat__value">{formatClock(best, language)}</div>
          </div>
        </div>

        <div style={{ position: "relative", alignSelf: size > 12 ? "stretch" : "center", padding: 8, borderRadius: 18, background: "var(--surface)", overflow: "auto" }}>
          <div
            dir="ltr"
            role="grid"
            aria-label={t("minesBoard")}
            style={{ display: "grid", gridTemplateColumns: `repeat(${size}, ${cellPx}px)`, gap, width: gridWidth, margin: "0 auto" }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {state.revealed.map((rev, i) => {
              const mine = state.mines?.[i];
              const flag = state.flags[i] && !rev;
              const n = rev && !mine && state.mines ? countAround(state.mines, i, size) : 0;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={rev ? (mine ? t("mineCell") : n ? t("minesNearby", { count: n }) : t("emptyCell")) : flag ? t("flaggedCell") : t("hiddenCell")}
                  onPointerDown={() => {
                    if (state.status !== "play" || rev) return;
                    const timer = window.setTimeout(() => {
                      if (press.current) press.current.long = true;
                      haptic.select();
                      setState((s) => toggleFlag(s, i));
                    }, 420);
                    press.current = { cell: i, timer, long: false };
                  }}
                  onPointerUp={() => {
                    const pr = press.current;
                    press.current = null;
                    if (!pr) return tap(i);
                    window.clearTimeout(pr.timer);
                    if (!pr.long) tap(i);
                  }}
                  onPointerLeave={() => {
                    if (press.current) window.clearTimeout(press.current.timer);
                    press.current = null;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") tap(i);
                    if (e.key === "f" || e.key === "F") setState((s) => toggleFlag(s, i));
                  }}
                  style={{
                    height: cellPx, padding: 0, borderRadius: size > 12 ? 4 : 7, border: 0, cursor: "pointer",
                    background: rev ? (mine ? (state.boom === i ? "#E5604D" : ACCENT) : "#0F1124") : "#262A44",
                    color: numberColors[n] || "#EDEBF5", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: size > 12 ? 13 : 16,
                    display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation",
                  }}
                >
                  {flag && <svg width="16" height="16" viewBox="0 0 24 24" fill={ACCENT} stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 21V4M6 4h11l-3 4 3 4H6" /></svg>}
                  {rev && mine && <svg width="18" height="18" viewBox="0 0 24 24" fill="#1C0905" stroke="#1C0905" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="5" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" fill="none" /></svg>}
                  {n > 0 && n}
                </button>
              );
            })}
          </div>
          {ended && (
            <div style={{ position: "absolute", inset: 0, borderRadius: 18, background: "rgba(11,13,26,0.82)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center" }}>
              <div className="display" style={{ fontSize: 28, color: won ? "#5FD0BE" : ACCENT }}>{won ? t("boardCleared") : t("boom")}</div>
              <div style={{ fontSize: 15, color: "var(--text-2)" }}>{won ? t("clearedIn", { time: formatClock(ms, language) }) : t("hitAMine")}</div>
              {mode !== "daily" && <button type="button" className="btn btn--primary btn--pill" style={{ background: "#9C8CFF", color: "#120D2E" }} onClick={restart}>{t("newBoard")}</button>}
              <button type="button" className="btn btn--ghost btn--auto" style={{ color: "#9C8CFF", fontWeight: 600 }} onClick={seeResults}>{t("seeResults")}</button>
            </div>
          )}
        </div>
        <p className="small muted" style={{ textAlign: "center" }}>{t("minesHelp")}</p>
      </Body>

      <div className="screen__bar screen__bar--row" style={{ gap: 8 }}>
        <div role="group" aria-label={t("tapMode")} className="grow" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 4, padding: 4, borderRadius: 16, background: "var(--surface)" }}>
          <button type="button" aria-pressed={!flagMode} onClick={() => setFlagMode(false)} style={{ minHeight: 44, borderRadius: 12, border: 0, background: flagMode ? "transparent" : "#EDEBF5", color: flagMode ? "var(--text-2)" : "#0B0D1A", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>{t("dig")}</button>
          <button type="button" aria-pressed={flagMode} onClick={() => setFlagMode(true)} style={{ minHeight: 44, borderRadius: 12, border: 0, background: flagMode ? ACCENT : "transparent", color: flagMode ? "#1C0905" : "var(--text-2)", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>{t("flag")}</button>
        </div>
        {mode !== "daily" && (
          <button type="button" aria-label={t("newBoard")} onClick={restart} style={{ width: 52, height: 52, flex: "none", borderRadius: 16, border: "1.5px solid var(--edge)", background: "transparent", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Icon name="refresh" size={20} />
          </button>
        )}
      </div>
    </Screen>
  );
}

export function MinesResult({ params }: { params?: ResultParams }) {
  const { t, language, n } = useLanguage();
  const { replace } = useNavigation();
  const xp = parseXp(params);
  const { stats, easyWins, mediumWins, mediumOpen, hardOpen } = useUnlocks();
  const mode = String(params?.mode ?? "easy") as MinesMode;
  const won = Boolean(params?.won);
  const timeMs = Number(params?.timeMs ?? 0);
  const flags = Number(params?.flags ?? 0);
  const pct = Number(params?.pct ?? 0);
  const safeLeft = Number(params?.safeLeft ?? 0);
  const previousBest = typeof params?.previousBest === "number" ? params.previousBest : null;
  const newBest = won && (previousBest === null || timeMs < previousBest);
  const { size, mines } = modeConfig[mode];
  const time = formatClock(timeMs, language);
  const unlockTarget = mediumOpen ? (hardOpen ? null : { label: t("minesUnlockHard"), wins: mediumWins }) : { label: t("minesUnlockMedium"), wins: easyWins };
  const bests: [MinesMode, boolean][] = [["easy", true], ["medium", mediumOpen], ["hard", hardOpen]];

  return (
    <ResultScreen
      win={won}
      heroIcon={won ? "check" : "mine"}
      kicker={t("minesKicker", { mode: t(`mines_${mode}`), size })}
      title={won ? t("clearedIn", { time }) : t("boom")}
      sub={won ? (newBest ? t("newBestOn", { mode: t(`mines_${mode}`) }) : t("minesClearedSub", { mines })) : t("hitMineLeft", { count: safeLeft })}
      metrics={[
        { value: time, label: t("statTime"), color: won ? "#5FD0BE" : undefined },
        { value: n(flags), label: t("flags") },
        { value: `${n(pct)}%`, label: t("cleared"), color: won ? undefined : ACCENT },
      ]}
      xp={xp}
      accent={ACCENT}
      accentInk="#1C0905"
      primary={{ label: won ? t("playAgainGame") : t("tryAgainGame"), onClick: () => replace({ name: "game", game: "mines", screen: "play", params: { mode: mode === "daily" ? "easy" : mode } }) }}
      secondary={{ label: t("difficulty"), onClick: () => replace({ name: "game", game: "mines", screen: "intro" }) }}
    >
      {unlockTarget && (
        <section className="stack" style={{ gap: 10, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
          <div className="row row--between row--baseline">
            <span style={{ fontSize: 14, fontWeight: 600 }}>{unlockTarget.label}</span>
            <span className="small soft">{t("winsOf", { count: Math.min(UNLOCK_WINS, unlockTarget.wins), total: UNLOCK_WINS })}</span>
          </div>
          <div className="row" style={{ gap: 4 }} aria-hidden="true">
            {Array.from({ length: UNLOCK_WINS }, (_, i) => <span key={i} style={{ flex: 1, height: 8, borderRadius: 999, background: i < unlockTarget.wins ? ACCENT : "#262A44" }} />)}
          </div>
        </section>
      )}
      <section className="stack" style={{ gap: 10, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{t("yourBestTimes")}</span>
        {bests.map(([m, open]) => {
          const best = stats?.bestTimeByMode?.[m];
          const isNew = newBest && m === mode;
          return (
            <div key={m} className="row row--between" style={{ fontSize: 14 }}>
              <span className="soft">{t(`mines_${m}`)}</span>
              <span className="num strong" style={{ color: !open ? "#6B6E8C" : isNew ? "#5FD0BE" : undefined }}>
                {!open ? t("locked") : isNew ? t("newTag", { time }) : formatClock(best, language)}
              </span>
            </div>
          );
        })}
      </section>
    </ResultScreen>
  );
}
