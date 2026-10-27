import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { Body, Screen } from "../../ui/components";
import { formatClock } from "../../lib/format";
import { randomSeed } from "../../lib/rng";
import { haptic } from "../../lib/haptics";
import { IntroScreen, PreviewGrid } from "../shared/IntroScreen";
import { ResultScreen } from "../shared/ResultScreen";
import { PlayHeader, parseXp, useFinish, useSavedState, useStopwatch, useTrackStarted, type ResultParams, type SavedState } from "../shared/play";
import { LevelLoading, rememberLevel, useLevelCopy, useLevelMode, useLevelState } from "../shared/levels";
import { LEVEL_GIVENS, PEERS, UNITS, clashes, completeUnits, generateSudoku, sudokuLevelDifficulty, type SudokuLevel, type SudokuPuzzle } from "./logic";

const ACCENT = "#7CC4FA";
const LEVELS: SudokuLevel[] = ["easy", "medium", "hard", "expert"];
const levelKey = (l: SudokuLevel) => (`sudoku${l[0].toUpperCase()}${l.slice(1)}` as "sudokuEasy");

export function SudokuIntro() {
  const { t, n, language } = useLanguage();
  const { push } = useNavigation();
  const { api } = useHub();
  const stats = useLoad(() => api.stats("sudoku"), [api]).data;
  const levels = useLevelMode("sudoku", "level");
  const [level, setLevel] = useState<SudokuLevel>("medium");
  const preview = useMemo(() => generateSudoku("sudoku-preview", "easy"), []);

  return (
    <IntroScreen
      game="sudoku"
      title={t("gameSudoku")}
      tagline={levels.level === null ? t("subSudoku") : t("sudokuLevelTagline", { n: levels.level, level: t(levelKey(sudokuLevelDifficulty(levels.level))) })}
      accent={ACCENT}
      heroBg="#0F2233"
      preview={
        <div dir="ltr" style={{ padding: 2, borderRadius: 8, background: "#3A3F5E" }}>
          <PreviewGrid cols={9} gap={1} radius={0} cells={preview.givens.map((v) => ({ bg: v ? "#16304A" : "#0F1224", fg: "#EDEBF5", text: v ? <span style={{ fontSize: 8, fontWeight: 700 }}>{n(v)}</span> : "" }))} />
        </div>
      }
      badge={levels.badge}
      heroTitle={t("sudokuHeroTitle")}
      heroSub={t("sudokuHeroSub")}
      modes={[
        { ...levels.mode, desc: t("sudokuLevelsDesc") },
        { key: "classic", label: t("modeClassic"), desc: t("sudokuClassicDesc"), play: t("sudokuStartLevel", { level: t(levelKey(level)) }), onPlay: () => push({ name: "game", game: "sudoku", screen: "play", params: { mode: "classic", level } }) },
      ]}
      extra={(mode) =>
        mode === "classic" ? (
          <div role="radiogroup" aria-label={t("sudokuDifficulty")} style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
            {LEVELS.map((l) => {
              const on = l === level;
              return (
                <button key={l} type="button" role="radio" aria-checked={on} onClick={() => setLevel(l)} style={{ minHeight: 56, padding: "0 4px", borderRadius: 12, border: `1.5px solid ${on ? ACCENT : "#262A44"}`, background: on ? "#12304A" : "var(--surface)", color: "var(--text)", fontFamily: "inherit", fontSize: 13, fontWeight: 600, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer" }}>
                  {t(levelKey(l))}
                  <span className="tiny muted" style={{ fontWeight: 400 }}>{l === "easy" ? t("sudokuGivensPlus", { count: 36 }) : t("sudokuGivens", { count: LEVEL_GIVENS[l] })}</span>
                </button>
              );
            })}
          </div>
        ) : null
      }
      stats={[
        { value: stats?.played ?? "—", label: t("statPlayed") },
        { value: stats?.dailyStreak ?? "—", label: t("streak") },
        { value: formatClock(stats?.bestTimeMs, language), label: t("statBest") },
        { value: formatClock(stats?.averageTimeMs, language), label: t("statAverage") },
      ]}
      steps={[
        { title: t("sudokuStep1"), text: t("sudokuStep1Text") },
        { title: t("sudokuStep2"), text: t("sudokuStep2Text") },
        { title: t("sudokuStep3"), text: t("sudokuStep3Text") },
        { title: t("sudokuStep4"), text: t("sudokuStep4Text") },
      ]}
      rewards={[t("rewardLevel30"), t("rewardNoHints10"), t("rewardLeagueXp")]}
      secondary={levels.all}
    />
  );
}

interface Saved {
  /** The player's digits (0 = empty); givens are never stored here. */
  entries: number[];
  notes: number[][];
  history: { entries: number[]; notes: number[][] }[];
  ms: number;
  hints: number;
  sel: number;
  notesMode: boolean;
  /** Boxes (0–8) in the order they were finished, for the share card. */
  boxOrder: number[];
}

const fresh = (): Saved => ({ entries: new Array(81).fill(0), notes: Array.from({ length: 81 }, () => []), history: [], ms: 0, hints: 0, sel: -1, notesMode: false, boxOrder: [] });

/** Level mode plays numbered levels (`number`); classic plays a fresh grid at the chosen difficulty. */
export function SudokuPlay({ mode, number: levelNumber, difficulty }: { mode: "level" | "classic"; number?: number; difficulty?: SudokuLevel }) {
  const { t } = useLanguage();
  const { back } = useNavigation();
  const copy = useLevelCopy();
  const number = mode === "level" && levelNumber ? levelNumber : null;
  const level: SudokuLevel = number !== null ? sudokuLevelDifficulty(number) : difficulty ?? "medium";
  const [seed] = useState(randomSeed);
  const seedKey = number !== null ? `sudoku-L${number}` : `sudoku-${level}-${seed}`;
  // Hard grids can take a moment to make, so build after the first paint.
  const [puzzle, setPuzzle] = useState<SudokuPuzzle | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setPuzzle(generateSudoku(seedKey, level)), 30);
    return () => window.clearTimeout(id);
  }, [seedKey, level]);

  if (puzzle && number !== null) return <SudokuLevelBoard puzzle={puzzle} number={number} level={level} />;
  if (puzzle) return <SudokuPracticeBoard puzzle={puzzle} seedKey={seedKey} level={level} />;
  return (
    <Screen theme="night">
      <div style={{ padding: "14px 16px 8px" }}>
        <PlayHeader
          title={number !== null ? copy.title("gameSudoku", number) : t("gameSudoku")}
          sub={number !== null ? t(levelKey(level)) : t("sudokuClassicSub", { level: t(levelKey(level)) })}
          clockMs={0}
          onBack={back}
          backLabel={t("backToGame", { game: t("gameSudoku") })}
        />
      </div>
      <Body tight>
        <div role="status" className="skeleton" style={{ alignSelf: "center", width: 348, maxWidth: "100%", aspectRatio: "1", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
          {t("sudokuGenerating")}
        </div>
      </Body>
    </Screen>
  );
}

function SudokuLevelBoard({ puzzle, number, level }: { puzzle: SudokuPuzzle; number: number; level: SudokuLevel }) {
  // The server copy leaves out the undo history to stay small.
  const [saved, setSaved, clear, ready] = useLevelState<Saved>("sudoku", "level", number, fresh, (s) => ({ entries: s.entries, notes: s.notes, ms: s.ms, hints: s.hints, boxOrder: s.boxOrder }));
  if (!ready) return <LevelLoading />;
  return <SudokuBoard puzzle={puzzle} number={number} level={level} state={[saved, setSaved, clear]} />;
}

function SudokuPracticeBoard({ puzzle, seedKey, level }: { puzzle: SudokuPuzzle; seedKey: string; level: SudokuLevel }) {
  const state = useSavedState<Saved>(`bazimoon-sudoku-${seedKey}`, fresh);
  return <SudokuBoard puzzle={puzzle} number={null} level={level} state={state} />;
}

function SudokuBoard({ puzzle, number, level, state }: { puzzle: SudokuPuzzle; number: number | null; level: SudokuLevel; state: SavedState<Saved> }) {
  const { t, n, language } = useLanguage();
  const { back } = useNavigation();
  const copy = useLevelCopy();
  const finish = useFinish("sudoku");
  useTrackStarted("sudoku");
  const mode = number !== null ? "level" : "classic";
  const [saved, setSaved, clearSaved] = state;
  const [message, setMessage] = useState<{ text: string; tone: "hint" | "bad" } | null>(null);
  const [pop, setPop] = useState<{ cell: number; key: number } | null>(null);
  const [flash, setFlash] = useState<Set<number>>(new Set());

  const values = useMemo(() => puzzle.givens.map((g, i) => g || saved.entries[i]), [puzzle, saved.entries]);
  const bad = useMemo(() => clashes(values), [values]);
  const solved = values.every((v, i) => v === puzzle.solution[i]);
  const [ms] = useStopwatch(!solved, saved.ms);
  const filled = values.filter(Boolean).length;
  const sel = saved.sel;
  const selVal = sel >= 0 ? values[sel] : 0;
  const peers = useMemo(() => new Set(sel >= 0 ? PEERS[sel] : []), [sel]);

  useEffect(() => {
    if (!solved) setSaved((s) => ({ ...s, ms }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(ms / 1000)]);

  useEffect(() => {
    if (!flash.size) return;
    const id = window.setTimeout(() => setFlash(new Set()), 650);
    return () => window.clearTimeout(id);
  }, [flash]);

  useEffect(() => {
    if (!solved) return;
    haptic.success();
    clearSaved();
    if (number !== null) rememberLevel("sudoku", "level", number + 1);
    const timeMs = Math.round(ms);
    const order = [...saved.boxOrder, ...Array.from({ length: 9 }, (_, b) => b).filter((b) => !saved.boxOrder.includes(b))];
    void finish(
      { mode: mode === "level" ? "level" : level, puzzleNumber: number, solved: true, timeMs, hints: saved.hints },
      { mode, level, number, timeMs, hints: saved.hints, boxOrder: order.join(",") },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  /** Writes a digit into the selected cell and works out what just got finished. */
  function commit(cell: number, digit: number, extra: Partial<Saved> = {}) {
    const entries = [...saved.entries];
    entries[cell] = digit;
    const notes = saved.notes.map((list, i) => (i === cell ? [] : digit && PEERS[cell].includes(i) ? list.filter((d) => d !== digit) : list));
    const after = puzzle.givens.map((g, i) => g || entries[i]);
    const before = completeUnits(values, puzzle.solution);
    const done = completeUnits(after, puzzle.solution);
    const fresh = [...done].filter((u) => !before.has(u));
    const boxOrder = [...saved.boxOrder];
    for (const u of fresh) if (u >= 18 && !boxOrder.includes(u - 18)) boxOrder.push(u - 18);
    if (fresh.length) {
      haptic.success();
      setFlash(new Set(fresh.flatMap((u) => UNITS[u])));
    } else if (digit && PEERS[cell].some((p) => after[p] === digit)) {
      haptic.warn();
    } else {
      haptic.tap();
    }
    if (digit) setPop({ cell, key: Date.now() });
    setSaved((s) => ({ ...s, ...extra, entries, notes, boxOrder, history: [...s.history, { entries: s.entries, notes: s.notes }].slice(-200) }));
  }

  function press(digit: number) {
    if (solved) return;
    if (sel < 0) { setMessage({ text: t("sudokuPickCell"), tone: "bad" }); haptic.warn(); return; }
    if (puzzle.givens[sel]) { setMessage({ text: t("sudokuGivenCell"), tone: "bad" }); haptic.warn(); return; }
    setMessage(null);
    if (saved.notesMode) {
      if (saved.entries[sel]) return;
      haptic.select();
      setSaved((s) => {
        const notes = [...s.notes];
        notes[sel] = notes[sel].includes(digit) ? notes[sel].filter((d) => d !== digit) : [...notes[sel], digit].sort();
        return { ...s, notes, history: [...s.history, { entries: s.entries, notes: s.notes }].slice(-200) };
      });
      return;
    }
    commit(sel, saved.entries[sel] === digit ? 0 : digit);
  }

  function erase() {
    if (solved || sel < 0 || puzzle.givens[sel]) return;
    setMessage(null);
    setSaved((s) => {
      const entries = [...s.entries];
      const notes = [...s.notes];
      entries[sel] = 0;
      notes[sel] = [];
      return { ...s, entries, notes, history: [...s.history, { entries: s.entries, notes: s.notes }].slice(-200) };
    });
  }

  function undo() {
    if (solved || !saved.history.length) return;
    setMessage(null);
    setSaved((s) => {
      const last = s.history[s.history.length - 1];
      return { ...s, entries: last.entries, notes: last.notes, history: s.history.slice(0, -1) };
    });
  }

  function hint() {
    if (solved) return;
    // Fill the selected cell if it is open or wrong, otherwise the first wrong or empty cell.
    let cell = sel >= 0 && !puzzle.givens[sel] && values[sel] !== puzzle.solution[sel] ? sel : values.findIndex((v, i) => v !== puzzle.solution[i]);
    if (cell < 0) return;
    if (puzzle.givens[cell]) cell = values.findIndex((v, i) => !puzzle.givens[i] && v !== puzzle.solution[i]);
    if (cell < 0) return;
    setMessage({ text: t("sudokuHintUsed"), tone: "hint" });
    commit(cell, puzzle.solution[cell], { hints: saved.hints + 1, sel: cell });
  }

  const select = (i: number) => {
    if (solved) return;
    haptic.select();
    setMessage(null);
    setSaved((s) => ({ ...s, sel: i }));
  };

  // Keyboard: digits, arrows, Backspace, N for notes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const persian = "۱۲۳۴۵۶۷۸۹".indexOf(e.key);
      const digit = persian >= 0 ? persian + 1 : Number(e.key);
      if (digit >= 1 && digit <= 9) { e.preventDefault(); press(digit); return; }
      const move: Record<string, number> = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
      if (e.key in move) {
        e.preventDefault();
        const from = sel < 0 ? 40 : sel;
        const step = move[e.key];
        const next = from + step;
        if (next >= 0 && next < 81 && (Math.abs(step) === 9 || Math.floor(next / 9) === Math.floor(from / 9))) select(next);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); erase(); return; }
      if (e.key === "n" || e.key === "N") setSaved((s) => ({ ...s, notesMode: !s.notesMode }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const selBad = sel >= 0 && !puzzle.givens[sel] && bad.has(sel);
  const msg = message ?? (selBad ? { text: t("sudokuClash"), tone: "bad" as const } : null);
  const counts = Array.from({ length: 10 }, (_, d) => values.filter((v) => v === d).length);
  const cellPx = 38;

  const tools: { label: string; icon: string; onClick(): void; pressed?: boolean }[] = [
    { label: t("undo"), icon: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3", onClick: undo },
    { label: t("sudokuErase"), icon: "M20 20H8l-4-4 10-10 6 6-6 6M9 11l6 6", onClick: erase },
    { label: t("sudokuNotes"), icon: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4", onClick: () => setSaved((s) => ({ ...s, notesMode: !s.notesMode })), pressed: saved.notesMode },
    { label: t("hint"), icon: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.5 1 2.5h6c0-1 .4-1.9 1-2.5A6 6 0 0 0 12 3z", onClick: hint },
  ];

  return (
    <Screen theme="night">
      <div style={{ padding: "14px 16px 8px" }}>
        <PlayHeader
          title={number !== null ? copy.title("gameSudoku", number) : t("gameSudoku")}
          sub={number !== null ? t(levelKey(level)) : t("sudokuClassicSub", { level: t(levelKey(level)) })}
          clockMs={ms}
          onBack={back}
          backLabel={t("backToGame", { game: t("gameSudoku") })}
        />
      </div>
      <Body tight>
        <div className="row" style={{ gap: 10 }}>
          <div className="grow" style={{ height: 6, borderRadius: 999, background: "#1E2138", overflow: "hidden" }} aria-hidden="true">
            <div style={{ width: `${Math.round((filled / 81) * 100)}%`, height: 6, borderRadius: 999, background: ACCENT, transition: "width 200ms ease" }} />
          </div>
          <span className="small muted">{t("sudokuFilled", { count: filled })}</span>
        </div>

        {/* The board is always left-to-right; Persian only changes the digits. */}
        <div dir="ltr" style={{ position: "relative", alignSelf: "center", padding: 3, borderRadius: 14, background: "#3A3F5E" }}>
          <div role="grid" aria-label={t("sudokuBoard")} style={{ display: "grid", gridTemplateColumns: `repeat(9, ${cellPx}px)`, gridAutoRows: cellPx, gap: 1, borderRadius: 11, overflow: "hidden", background: "#262A44" }}>
            {values.map((v, i) => {
              const r = Math.floor(i / 9), c = i % 9;
              const given = !!puzzle.givens[i];
              const isSel = i === sel;
              const same = !!selVal && v === selVal;
              const isBad = bad.has(i);
              let bg = isSel ? "#1F4A66" : same ? "#173548" : peers.has(i) ? "#141A30" : "#0F1224";
              if (isBad && given) bg = isSel ? "#4A2228" : "#2A1418";
              const notes = !v ? saved.notes[i] : [];
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => select(i)}
                  aria-label={`${t("sudokuCell", { row: r + 1, col: c + 1 })}, ${v ? `${n(v)}${given ? ` (${t("sudokuGiven")})` : ""}` : notes.length ? t("sudokuNotesFor", { list: notes.map((d) => n(d)).join(" ") }) : t("sudokuEmpty")}`}
                  aria-selected={isSel}
                  className={flash.has(i) ? "unit-done" : undefined}
                  style={{
                    position: "relative", padding: 0, border: 0,
                    marginRight: c === 2 || c === 5 ? 2 : 0, marginBottom: r === 2 || r === 5 ? 2 : 0,
                    background: bg, color: isBad && !given ? "#F08A7A" : given ? "#EDEBF5" : ACCENT,
                    boxShadow: isSel ? `inset 0 0 0 2px ${ACCENT}` : "none",
                    fontFamily: "inherit", fontSize: 20, fontWeight: given ? 700 : 600,
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  }}
                >
                  {notes.length > 0 && (
                    <span aria-hidden="true" style={{ position: "absolute", inset: 2, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(3, 1fr)" }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                        <span key={d} style={{ fontSize: 9, lineHeight: 1, fontWeight: 600, color: selVal === d ? ACCENT : "#9A9CB8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {notes.includes(d) ? n(d) : ""}
                        </span>
                      ))}
                    </span>
                  )}
                  {v ? <span key={pop?.cell === i ? pop.key : 0} className={pop?.cell === i ? "cell-pop" : undefined}>{n(v)}</span> : null}
                </button>
              );
            })}
          </div>
          {solved && (
            <div style={{ position: "absolute", inset: 0, borderRadius: 14, background: "rgba(11,13,26,0.84)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center" }}>
              <div className="display" style={{ fontSize: 30, color: ACCENT }}>{t("solvedLabel")}</div>
              <div style={{ fontSize: 15, color: "var(--text-2)" }}>{formatClock(ms, language)}</div>
            </div>
          )}
        </div>

        <div role="status" style={{ minHeight: 20, fontSize: 13, textAlign: "center", color: msg?.tone === "hint" ? "#F0A83A" : "#F08A7A" }}>{msg?.text ?? ""}</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          {tools.map((tool) => (
            <button
              key={tool.label}
              type="button"
              onClick={tool.onClick}
              aria-pressed={tool.pressed}
              style={{ minHeight: 56, borderRadius: 14, border: `1.5px solid ${tool.pressed ? ACCENT : "#2E3252"}`, background: tool.pressed ? "#12304A" : "transparent", color: tool.pressed ? ACCENT : "var(--text)", fontFamily: "inherit", fontSize: 12, fontWeight: 600, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={tool.icon} /></svg>
              {tool.label}
            </button>
          ))}
        </div>

        <div dir="ltr" role="group" aria-label={t("sudokuNumbers")} style={{ display: "grid", gridTemplateColumns: "repeat(9, minmax(0, 1fr))", gap: 5 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
            const left = Math.max(0, 9 - counts[d]);
            const on = selVal === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => press(d)}
                disabled={left === 0}
                aria-label={left ? `${n(d)}, ${t("sudokuLeft", { count: left })}` : n(d)}
                style={{ minHeight: 60, padding: 0, borderRadius: 12, border: 0, background: on ? "#1F4A66" : "var(--surface)", color: saved.notesMode ? "var(--text-2)" : "var(--text)", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, cursor: "pointer", opacity: left === 0 ? 0.35 : 1, transition: "opacity 200ms" }}
              >
                <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{n(d)}</span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>{left ? t("sudokuLeft", { count: left }) : ""}</span>
              </button>
            );
          })}
        </div>
        <p className="visually-hidden">{t("sudokuKeyboardHelp")}</p>
      </Body>
    </Screen>
  );
}

export function SudokuResult({ params }: { params?: ResultParams }) {
  const { t, language, n } = useLanguage();
  const { replace, reset } = useNavigation();
  const copy = useLevelCopy();
  const xp = parseXp(params);
  const level = String(params?.level ?? "medium") as SudokuLevel;
  const number = typeof params?.number === "number" ? params.number : null;
  const timeMs = Number(params?.timeMs ?? 0);
  const hints = Number(params?.hints ?? 0);
  const order = String(params?.boxOrder ?? "0,1,2,3,4,5,6,7,8").split(",").map(Number);
  const time = formatClock(timeMs, language);
  const streak = xp?.streak ?? 0;
  const title = number !== null ? copy.title("gameSudoku", number) : t("gameSudoku");
  const kicker = `${title} · ${t(levelKey(level))}`;
  const next = copy.nextLevel(xp, number);
  const sub = number === null ? t("practiceNoStreak") : copy.next(xp, true, number);
  // Share card: the nine boxes shaded by when they were finished (first = brightest).
  const shade = (box: number) => {
    const rank = Math.max(0, order.indexOf(box));
    return `rgba(124,196,250,${(1 - (rank / 9) * 0.65).toFixed(2)})`;
  };

  return (
    <ResultScreen
      win
      heroIcon="grid"
      heroColors={["#12304A", ACCENT]}
      kicker={kicker}
      title={t("sudokuSolvedIn", { time })}
      sub={sub}
      metrics={[
        { value: time, label: t("statTime") },
        { value: n(streak), label: t("streak"), color: "#F0A83A" },
        { value: n(hints), label: t("statHints"), color: hints ? "#F0A83A" : undefined },
      ]}
      xp={xp}
      xpNote={hints ? t("sudokuHintCost") : xp?.percentile != null ? t("fasterThanLevel", { pct: xp.percentile }) : undefined}
      accent={ACCENT}
      share={{ text: `${title} · ${time}${hints ? ` · ${t("hintsUsed", { count: hints })}` : ` · ${t("flawless")}`}${number !== null ? `\n${t("streakDays", { count: streak })}` : ""}` }}
      primary={number !== null
        ? { label: t("playLevelN", { n: next }), onClick: () => replace({ name: "game", game: "sudoku", screen: "play", params: { mode: "level", level: next } }) }
        : { label: t("sudokuPlayHard"), onClick: () => replace({ name: "game", game: "sudoku", screen: "play", params: { mode: "classic", level: "hard" } }) }}
      secondary={{ label: t("backToHome"), onClick: () => reset({ name: "home" }) }}
    >
      <div className="row" style={{ gap: 14, padding: 14, borderRadius: 18, border: "1.5px dashed #2E3252" }}>
        <div dir="ltr" style={{ width: 66, flex: "none", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }} aria-hidden="true">
          {Array.from({ length: 9 }, (_, b) => <span key={b} style={{ aspectRatio: "1", borderRadius: 4, background: shade(b) }} />)}
        </div>
        <div className="small" style={{ color: "var(--text-2)", whiteSpace: "pre-line" }}>
          {`${title} · ${time}\n${hints ? t("hintsUsed", { count: hints }) : t("flawless")}`}
        </div>
      </div>
    </ResultScreen>
  );
}
