import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { Body, Screen, Segmented } from "../../ui/components";
import { formatClock } from "../../lib/format";
import { randomSeed } from "../../lib/rng";
import { haptic } from "../../lib/haptics";
import { IntroScreen, PreviewGrid } from "../shared/IntroScreen";
import { ResultScreen } from "../shared/ResultScreen";
import { PlayHeader, parseXp, useFinish, useSavedState, useStopwatch, useTrackStarted, type ResultParams, type SavedState } from "../shared/play";
import { LevelLoading, rememberLevel, useLevelCopy, useLevelMode, useLevelState } from "../shared/levels";
import { blockedBy, conflicts, generateQueens, hint as hintFor, queensLevelSize, regionColors, type Mark } from "./logic";

const ACCENT = "#B79CF2";
const BOARD = 336;
const practiceSizes = [6, 7, 8, 9, 10];

export function QueensIntro() {
  const { t, language } = useLanguage();
  const { push } = useNavigation();
  const { api } = useHub();
  const stats = useLoad(() => api.stats("queens"), [api]).data;
  const levels = useLevelMode("queens", "level");
  const [size, setSize] = useState(8);
  const preview = useMemo(() => generateQueens(5, "queens-preview"), []);

  return (
    <IntroScreen
      game="queens"
      title={t("gameQueens")}
      tagline={levels.level === null ? t("queensTagline") : t("levelTagline", { n: levels.level })}
      accent={ACCENT}
      heroBg="#1C1530"
      preview={
        <PreviewGrid
          cols={5}
          cells={preview.regions.map((reg, i) => ({
            bg: regionColors[reg],
            fg: "#F4F2FF",
            text: preview.solution[Math.floor(i / 5)] === i % 5 ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 18h16l-2-10-4 4-2-6-2 6-4-4z" /></svg>
            ) : "",
          }))}
        />
      }
      badge={levels.badge}
      heroTitle={t("queensHeroTitle")}
      heroSub={t("queensHeroSub")}
      modes={[
        levels.mode,
        { key: "practice", label: t("modePractice"), desc: t("queensPracticeDesc"), play: t("startPracticeSize", { size }), onPlay: () => push({ name: "game", game: "queens", screen: "play", params: { mode: "practice", size } }) },
      ]}
      extra={(mode) =>
        mode === "practice" ? (
          <Segmented label={t("boardSize")} value={size} onChange={setSize} options={practiceSizes.map((s) => ({ value: s, label: `${s}×${s}` }))} />
        ) : null
      }
      stats={[
        { value: stats?.played ?? "—", label: t("statPlayed") },
        { value: stats?.dailyStreak ?? "—", label: t("streak") },
        { value: formatClock(stats?.bestTimeMs, language), label: t("statBest") },
        { value: formatClock(stats?.averageTimeMs, language), label: t("statAverage") },
      ]}
      steps={[
        { title: t("queensStep1"), text: t("queensStep1Text") },
        { title: t("queensStep2"), text: t("queensStep2Text") },
        { title: t("queensStep3"), text: t("queensStep3Text") },
        { title: t("queensStep4"), text: t("queensStep4Text") },
      ]}
      rewards={[t("rewardLevel30"), t("rewardNoMistakes"), t("rewardLeagueXp")]}
      secondary={levels.all}
    />
  );
}

interface Saved {
  marks: Mark[];
  history: Mark[][];
  ms: number;
  hints: number;
  auto: boolean;
}

const freshSave = (size: number) => (): Saved => ({ marks: new Array(size * size).fill(0), history: [], ms: 0, hints: 0, auto: false });

export function QueensPlay({ mode, level, size: sizeParam }: { mode: "level" | "practice"; level?: number; size?: number }) {
  const [seed] = useState(randomSeed);
  if (mode === "level" && level) return <QueensLevel level={level} />;
  return <QueensPractice size={sizeParam ?? 8} seed={seed} />;
}

function QueensLevel({ level }: { level: number }) {
  const size = queensLevelSize(level);
  // The server copy leaves out the undo history to stay small.
  const [saved, setSaved, clear, ready] = useLevelState<Saved>("queens", "level", level, freshSave(size), (s) => ({ marks: s.marks, ms: s.ms, hints: s.hints, auto: s.auto }));
  if (!ready) return <LevelLoading />;
  return <QueensBoard level={level} size={size} seedKey={`queens-L${level}`} state={[saved, setSaved, clear]} />;
}

function QueensPractice({ size, seed }: { size: number; seed: number }) {
  const seedKey = `queens-practice-${size}-${seed}`;
  const state = useSavedState<Saved>(`bazimoon-queens-${seedKey}`, freshSave(size));
  return <QueensBoard level={null} size={size} seedKey={seedKey} state={state} />;
}

function QueensBoard({ level, size, seedKey, state }: { level: number | null; size: number; seedKey: string; state: SavedState<Saved> }) {
  const { t } = useLanguage();
  const { back } = useNavigation();
  const copy = useLevelCopy();
  const finish = useFinish("queens");
  useTrackStarted("queens");
  const mode = level !== null ? "level" : "practice";
  const puzzle = useMemo(() => generateQueens(size, seedKey), [size, seedKey]);
  const [saved, setSaved, clearSaved] = state;
  const [message, setMessage] = useState<string | null>(null);
  const conf = conflicts(puzzle, saved.marks);
  const solved = conf.count === size && conf.bad.size === 0;
  const [ms] = useStopwatch(!solved, saved.ms);
  const cell = BOARD / size;

  useEffect(() => {
    if (!solved) setSaved((s) => ({ ...s, ms }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(ms / 1000)]);

  useEffect(() => {
    if (!solved) return;
    clearSaved();
    if (level !== null) rememberLevel("queens", "level", level + 1);
    const timeMs = Math.round(ms);
    void finish({ mode, puzzleNumber: level, solved: true, timeMs, hints: saved.hints }, { mode, level, timeMs, hints: saved.hints, size, seedKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  function update(marks: Mark[], extra: Partial<Saved> = {}) {
    setSaved((s) => ({ ...s, ...extra, marks, history: [...s.history, s.marks].slice(-200) }));
  }

  function tap(i: number) {
    if (solved) return;
    const marks = [...saved.marks];
    marks[i] = ((marks[i] + 1) % 3) as Mark;
    if (marks[i] === 2) {
      haptic.tap();
      if (saved.auto) for (const j of blockedBy(puzzle, i)) if (marks[j] !== 2) marks[j] = 1;
      const after = conflicts(puzzle, marks);
      if (after.bad.has(i)) haptic.warn();
    } else {
      haptic.select();
    }
    setMessage(null);
    update(marks);
  }

  const regions = puzzle.regions;
  const line = (different: boolean) => (different ? "2px solid #0B0D1A" : "0.5px solid rgba(11,13,26,0.45)");
  const msg = message ?? (conf.bad.size ? t("queensConflict") : "");

  return (
    <Screen theme="night">
      <div style={{ padding: "14px 16px 8px" }}>
        <PlayHeader
          title={level !== null ? copy.title("gameQueens", level) : t("gameQueens")}
          sub={level !== null ? `${size}×${size}` : `${t("practice")} · ${size}×${size}`}
          clockMs={ms}
          onBack={back}
          backLabel={t("backToGame", { game: t("gameQueens") })}
        />
      </div>
      <Body tight>
        <div className="row" style={{ gap: 10 }}>
          <div className="grow row" style={{ gap: 4 }} aria-hidden="true">
            {Array.from({ length: size }, (_, p) => (
              <span key={p} style={{ flex: 1, height: 6, borderRadius: 999, background: p < conf.count ? (conf.bad.size ? "#F08A7A" : ACCENT) : "#262A44" }} />
            ))}
          </div>
          <span className="small muted">{t("queensPlaced", { count: conf.count, total: size })}</span>
        </div>

        <div style={{ position: "relative", alignSelf: "center", padding: 6, borderRadius: 16, background: "#0B0D1A", border: "2px solid #262A44" }}>
          <div dir="ltr" role="grid" aria-label={t("queensBoard")} style={{ display: "grid", gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, width: BOARD }}>
            {saved.marks.map((k, i) => {
              const r = Math.floor(i / size), c = i % size;
              const bad = conf.bad.has(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => tap(i)}
                  aria-label={t("zipCellLabel", { row: r + 1, col: c + 1 }) + (k === 2 ? `, ${t("queen")}` : k === 1 ? `, ${t("markedX")}` : "") + (bad ? `, ${t("conflict")}` : "")}
                  style={{
                    height: cell, padding: 0, border: 0,
                    borderTop: line(r === 0 || regions[i - size] !== regions[i]),
                    borderBottom: line(r === size - 1 || regions[i + size] !== regions[i]),
                    borderLeft: line(c === 0 || regions[i - 1] !== regions[i]),
                    borderRight: line(c === size - 1 || regions[i + 1] !== regions[i]),
                    background: bad ? "#7A2E2A" : regionColors[regions[i]],
                    color: bad ? "#FFD9D3" : k === 1 ? "rgba(244,242,255,0.55)" : "#F4F2FF",
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  }}
                >
                  {k === 2 && (
                    <svg width={cell * 0.57} height={cell * 0.57} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 18h16l-2-10-4 4-2-6-2 6-4-4z" /><rect x="4" y="19.5" width="16" height="2" rx="1" /></svg>
                  )}
                  {k === 1 && (
                    <svg width={cell * 0.33} height={cell * 0.33} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  )}
                </button>
              );
            })}
          </div>
          {solved && (
            <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: "rgba(11,13,26,0.84)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
              <div className="display" style={{ fontSize: 30, color: ACCENT }}>{t("solvedLabel")}</div>
              <div style={{ fontSize: 15, color: "var(--text-2)" }}>{t("allQueensPlaced", { count: size })}</div>
            </div>
          )}
        </div>

        <div role="status" style={{ minHeight: 22, fontSize: 13, textAlign: "center", color: message ? ACCENT : "#F08A7A" }}>{msg}</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          <button type="button" className="btn btn--outline btn--md" style={{ fontSize: 14 }} onClick={() => {
            if (!saved.history.length || solved) return;
            setSaved((s) => ({ ...s, marks: s.history[s.history.length - 1], history: s.history.slice(0, -1) }));
            setMessage(null);
          }}>{t("undo")}</button>
          <button
            type="button"
            className="btn btn--outline btn--md"
            aria-pressed={saved.auto}
            style={{ fontSize: 14, borderColor: saved.auto ? ACCENT : undefined, background: saved.auto ? "#2E2340" : "transparent" }}
            onClick={() => setSaved((s) => ({ ...s, auto: !s.auto }))}
          >
            {t("autoX")}
          </button>
          <button type="button" className="btn btn--outline btn--md" style={{ fontSize: 14 }} onClick={() => {
            if (solved) return;
            const h = hintFor(puzzle, saved.marks);
            if (!h) return;
            const marks = [...saved.marks];
            if (h.kind === "wrongQueen") {
              marks[h.cell] = 0;
              setMessage(t("queensHintWrong"));
            } else {
              marks[h.cell] = 2;
              if (saved.auto) for (const j of blockedBy(puzzle, h.cell)) if (marks[j] !== 2) marks[j] = 1;
              setMessage(t("queensHintPlace"));
            }
            update(marks, { hints: saved.hints + 1 });
          }}>{t("hint")}</button>
          <button type="button" className="btn btn--outline btn--md" style={{ fontSize: 14 }} onClick={() => {
            if (solved) return;
            update(new Array(size * size).fill(0));
            setMessage(t("queensCleared"));
          }}>{t("clear")}</button>
        </div>
        <p className="tiny muted" style={{ textAlign: "center" }}>{t("queensTapHelp")}</p>
      </Body>
    </Screen>
  );
}

export function QueensResult({ params }: { params?: ResultParams }) {
  const { t, language, n } = useLanguage();
  const { replace, reset } = useNavigation();
  const copy = useLevelCopy();
  const xp = parseXp(params);
  const level = typeof params?.level === "number" ? params.level : null;
  const timeMs = Number(params?.timeMs ?? 0);
  const hints = Number(params?.hints ?? 0);
  const size = Number(params?.size ?? 8);
  const seedKey = String(params?.seedKey ?? "");
  const puzzle = useMemo(() => (seedKey ? generateQueens(size, seedKey) : null), [size, seedKey]);
  const time = formatClock(timeMs, language);
  const streak = xp?.streak ?? 0;
  const title = level !== null ? copy.title("gameQueens", level) : t("gameQueens");
  const next = copy.nextLevel(xp, level);
  const sub = level === null ? t("practiceNoStreak") : copy.next(xp, true, level);

  return (
    <ResultScreen
      win
      heroIcon="godfather"
      kicker={title}
      title={t("crownedIn", { time })}
      sub={sub}
      metrics={[
        { value: time, label: t("statTime") },
        { value: n(streak), label: t("streak"), color: "#F0A83A" },
        { value: n(hints), label: t("statHints"), color: hints ? "#F0A83A" : undefined },
      ]}
      xp={xp}
      xpNote={hints ? t("queensHintCost") : xp?.percentile != null ? t("fasterThanLevel", { pct: xp.percentile }) : undefined}
      accent={ACCENT}
      share={{ text: `${title} · ${time}${hints ? ` · ${t("hintsUsed", { count: hints })}` : ` · ${t("flawless")}`}${level !== null ? `\n${t("streakDays", { count: streak })}` : ""}` }}
      primary={level !== null
        ? { label: t("playLevelN", { n: next }), onClick: () => replace({ name: "game", game: "queens", screen: "play", params: { mode: "level", level: next } }) }
        : { label: t("practiceSize", { size: 10 }), onClick: () => replace({ name: "game", game: "queens", screen: "play", params: { mode: "practice", size: 10 } }) }}
      secondary={{ label: t("backToHome"), onClick: () => reset({ name: "home" }) }}
    >
      {puzzle && (
        <div className="row" style={{ gap: 14, padding: 14, borderRadius: 18, border: "1.5px dashed #2E3252" }}>
          <div style={{ width: 66, flex: "none" }} aria-hidden="true">
            <PreviewGrid cols={size} gap={1} radius={1} cells={puzzle.regions.map((reg) => ({ bg: regionColors[reg] }))} />
          </div>
          <div className="small" style={{ color: "var(--text-2)", whiteSpace: "pre-line" }}>
            {`${title} · ${time}\n${hints ? t("hintsUsed", { count: hints }) : t("flawless")}`}
          </div>
        </div>
      )}
    </ResultScreen>
  );
}
