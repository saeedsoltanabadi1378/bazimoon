import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { Body, ProgressBar, Screen } from "../../ui/components";
import { TabBar } from "../../ui/TabBar";
import { useHub, useLoad } from "../../hub/HubData";
import { formatClock, formatShortDate, puzzleToday } from "../../lib/format";
import { dailyNumber, dateOfDaily, randomSeed } from "../../lib/rng";
import { haptic } from "../../lib/haptics";
import { generateZip, hint as hintFor, visit, type ZipMessage } from "./logic";
import { GroupBoard } from "../shared/ResultScreen";
import { PlayHeader, useFinish, useSavedState, useStopwatch } from "../shared/play";

const BOARD = 300;

interface Saved {
  path: number[];
  ms: number;
  hints: number;
  cleared: number[] | null;
}

export function ZipPlay({ mode, number: archived, seed: seedParam, size: sizeParam }: { mode: "daily" | "practice" | "archive"; number?: number; seed?: number; size?: number }) {
  const { t, language } = useLanguage();
  const { back } = useNavigation();
  const { api } = useHub();
  const finish = useFinish("zip");

  const today = puzzleToday();
  const number = mode === "daily" ? dailyNumber("zip", today) : mode === "archive" ? archived ?? dailyNumber("zip", today) : null;
  const [practice] = useState(() => ({ seed: seedParam ?? randomSeed(), size: sizeParam ?? 5 + Math.floor(Math.random() * 4) }));
  const size = number !== null ? (number % 5 === 0 ? 7 : 6) : practice.size;
  const seedKey = number !== null ? `zip-daily-${number}` : `zip-practice-${practice.seed}`;
  const puzzle = useMemo(() => generateZip(size, seedKey), [size, seedKey]);
  const saveKey = `bazimoon-zip-${seedKey}`;

  const [saved, setSaved, clearSaved] = useSavedState<Saved>(saveKey, () => ({ path: [], ms: 0, hints: 0, cleared: null }));
  const [message, setMessage] = useState<{ key: ZipMessage | "hintOffTrack" | "hintAdded" | "boardCleared" | "pathRestored"; values?: Record<string, number>; error: boolean } | null>(null);
  const solved = saved.path.length === size * size && puzzle.checkpoints[saved.path[saved.path.length - 1]] === puzzle.count;
  const [ms] = useStopwatch(!solved, saved.ms);
  const dragging = useRef(false);
  const board = useLoad(() => (number !== null && mode === "daily" ? api.board("zip", number) : Promise.resolve(null)), [api, number, mode]);

  // Persist the clock with the path so leaving and coming back resumes the same attempt.
  useEffect(() => {
    if (!solved) setSaved((s) => ({ ...s, ms }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(ms / 1000)]);

  useEffect(() => {
    if (!solved) return;
    clearSaved();
    const timeMs = Math.round(ms);
    void finish(
      { mode, puzzleNumber: number, solved: true, timeMs, hints: saved.hints },
      { mode, number, timeMs, hints: saved.hints, size, solved: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  const cell = BOARD / size;
  const reached = saved.path.filter((i) => puzzle.checkpoints[i]).length;

  function tapCell(index: number) {
    if (solved) return;
    const result = visit(puzzle, saved.path, index);
    if (!result.ok) {
      haptic.warn();
      setMessage({ key: result.message, values: result.values, error: true });
      return;
    }
    if ("unchanged" in result) return;
    if (result.path.length > saved.path.length) haptic.tap();
    setSaved((s) => ({ ...s, path: result.path, cleared: null }));
    setMessage(null);
  }

  function cellAt(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    let c = Math.floor((e.clientX - rect.left) / (rect.width / size));
    const r = Math.floor((e.clientY - rect.top) / (rect.height / size));
    if (getComputedStyle(e.currentTarget).direction === "rtl") c = size - 1 - c;
    if (c < 0 || c >= size || r < 0 || r >= size) return -1;
    return r * size + c;
  }

  const points = saved.path.map((i) => `${(i % size) * cell + cell / 2},${Math.floor(i / size) * cell + cell / 2}`).join(" ");
  const head = saved.path[saved.path.length - 1];
  const msgText = message
    ? t(`zipMsg_${message.key}`, message.values)
    : t("zipMsg_default", { count: puzzle.count });
  const subtitle = number !== null
    ? `${formatShortDate(mode === "daily" ? today : dateOfDaily("zip", number), language)} · ${size}×${size}`
    : `${t("practice")} · ${size}×${size}`;

  return (
    <Screen theme="hub">
      <Body style={{ padding: "16px 16px 20px", gap: 14 }}>
        <PlayHeader
          title={number !== null ? `${t("gameZip")} #${number}` : t("gameZip")}
          sub={subtitle}
          clockMs={ms}
          onBack={back}
          backLabel={t("backToGame", { game: t("gameZip") })}
        />

        <p role="status" style={{ minHeight: 20, fontSize: 14, textAlign: "center", color: message?.error ? "#F08A7A" : message ? "#5FD0BE" : "#C5CAD6" }}>{msgText}</p>

        <div style={{ alignSelf: "center", padding: 8, borderRadius: 20, background: "var(--surface)" }}>
          <div
            dir="ltr"
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              const i = cellAt(e);
              if (i >= 0) tapCell(i);
            }}
            onPointerMove={(e) => {
              if (!dragging.current) return;
              const i = cellAt(e);
              if (i >= 0 && i !== saved.path[saved.path.length - 1]) tapCell(i);
            }}
            onPointerUp={() => (dragging.current = false)}
            onPointerCancel={() => (dragging.current = false)}
            style={{ position: "relative", width: BOARD, height: BOARD, touchAction: "none", userSelect: "none" }}
          >
            <div role="grid" aria-label={t("zipBoard")} style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: `repeat(${size}, 1fr)` }}>
              {Array.from({ length: size * size }, (_, i) => {
                const on = saved.path.includes(i);
                const n = puzzle.checkpoints[i];
                return (
                  <button
                    key={i}
                    type="button"
                    tabIndex={-1}
                    aria-label={t("zipCellLabel", { row: Math.floor(i / size) + 1, col: (i % size) + 1 }) + (n ? `, ${t("numberN", { n })}` : "") + (on ? `, ${t("onPath")}` : "")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") tapCell(i);
                    }}
                    style={{ height: cell, padding: 0, border: "1px solid #262A36", background: on ? "#173A36" : "#151820", cursor: "pointer" }}
                  />
                );
              })}
            </div>
            <svg width={BOARD} height={BOARD} viewBox={`0 0 ${BOARD} ${BOARD}`} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {saved.path.length > 1 && (
                <polyline points={points} fill="none" stroke="#3FB8A6" strokeWidth={cell * 0.36} strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
            {Object.entries(puzzle.checkpoints).map(([index, n]) => {
              const i = Number(index);
              const mark = cell * 0.68;
              return (
                <div
                  key={index}
                  aria-hidden="true"
                  style={{
                    position: "absolute", left: (i % size) * cell + (cell - mark) / 2, top: Math.floor(i / size) * cell + (cell - mark) / 2,
                    width: mark, height: mark, borderRadius: 999, border: `3px solid ${n <= reached ? "#3FB8A6" : "#4A5066"}`,
                    background: "#101218", color: "#F2EEE6", display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: Math.max(11, cell * 0.3), pointerEvents: "none",
                  }}
                >
                  {n}
                </div>
              );
            })}
            {head !== undefined && !solved && (
              <div aria-hidden="true" style={{ position: "absolute", left: (head % size) * cell + cell / 2 - 7, top: Math.floor(head / size) * cell + cell / 2 - 7, width: 14, height: 14, borderRadius: 999, background: "#F2EEE6", boxShadow: "0 0 0 5px rgba(242,238,230,0.25)", pointerEvents: "none" }} />
            )}
            {solved && (
              <div style={{ position: "absolute", inset: 0, borderRadius: 6, background: "rgba(16,18,24,0.84)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center" }}>
                <div className="display" style={{ fontSize: 30, color: "#5FD0BE" }}>{t("solvedLabel")}</div>
                <div style={{ fontSize: 15, color: "#C5CAD6" }}>{formatClock(ms, language)}</div>
              </div>
            )}
          </div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <div className="grow"><ProgressBar value={(saved.path.length / (size * size)) * 100} color="#3FB8A6" track="#2B3042" /></div>
          <span className="small muted num">{t("cellsProgress", { done: saved.path.length, total: size * size })}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <button
            type="button" className="btn btn--outline btn--md"
            onClick={() => {
              if (solved) return;
              if (saved.cleared) {
                setSaved((s) => ({ ...s, path: s.cleared!, cleared: null }));
                setMessage({ key: "pathRestored", error: false });
              } else if (saved.path.length > 1) {
                setSaved((s) => ({ ...s, path: s.path.slice(0, -1) }));
                setMessage(null);
              }
            }}
          >
            {t("undo")}
          </button>
          <button
            type="button" className="btn btn--outline btn--md"
            onClick={() => {
              if (solved) return;
              const h = hintFor(puzzle, saved.path);
              setSaved((s) => ({ ...s, path: h.path, hints: s.hints + 1, cleared: null }));
              setMessage({ key: h.kind === "offTrack" ? "hintOffTrack" : "hintAdded", error: false });
            }}
          >
            {t("hint")}
          </button>
          <button
            type="button" className="btn btn--outline btn--md"
            onClick={() => {
              if (solved || saved.path.length <= 1) return;
              setSaved((s) => ({ ...s, cleared: s.path, path: [puzzle.solution[0]] }));
              setMessage({ key: "boardCleared", error: false });
            }}
          >
            {t("clear")}
          </button>
        </div>

        {mode === "daily" && board.data && (
          <GroupBoard
            title={t("yourGroupToday")}
            rows={board.data.rows.filter((r) => r.solved).slice(0, 5).map((r) => ({ rank: r.rank ?? "—", name: r.name, value: formatClock(r.timeMs, language), isYou: r.isYou }))}
            empty={t("beFirstInGroup")}
          />
        )}
      </Body>
      <TabBar />
    </Screen>
  );
}
