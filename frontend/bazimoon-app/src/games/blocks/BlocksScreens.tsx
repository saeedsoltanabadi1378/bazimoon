import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { Body, IconButton, Screen } from "../../ui/components";
import type { PuzzleResult } from "../../api/hub";
import { puzzleToday } from "../../lib/format";
import { dailyNumber, randomSeed } from "../../lib/rng";
import { readLocal, removeLocal, writeLocal } from "../../lib/storage";
import { haptic } from "../../lib/haptics";
import { shareLink } from "../../lib/platform";
import { appLink } from "../../lib/links";
import { roman } from "../../hub/HomeScreen";
import { IntroScreen, PreviewGrid } from "../shared/IntroScreen";
import { XpCard } from "../shared/ResultScreen";
import { parseXp, useSavedState, useTrackStarted, type ResultParams } from "../shared/play";
import {
  ADVENTURE_LEVELS, SHAPES, SIZE, adventureLevel, anyFit, dealTray, emptyGrid, fits, place, shapeSize, trayRng,
  type Grid, type Piece,
} from "./logic";

const ACCENT = "#F2B8D0";
const INK = "#2A0F1C";
const EMPTY = "#1E2138";
const BEST_KEY = "bazimoon-blocks-best";
const ADVENTURE_KEY = "bazimoon-blocks-adventure";
const ADVENTURE_MIN_LEVEL = 8;

type BlocksMode = "classic" | "daily" | "adventure";

interface Saved {
  seedKey: string;
  grid: Grid;
  tray: (Piece | null)[];
  trayIndex: number;
  sel: number;
  score: number;
  combo: number;
  bestCombo: number;
  lines: number;
  cols: number;
  multi: number;
  pieces: number;
  over: boolean;
}

function fresh(mode: BlocksMode, number: number, level: number): Saved {
  const seedKey = mode === "daily" ? `blocks-daily-${number}` : mode === "adventure" ? `blocks-adventure-${level}` : `blocks-${randomSeed()}`;
  return {
    seedKey,
    grid: mode === "adventure" ? adventureLevel(level).grid : emptyGrid(),
    tray: dealTray(trayRng(seedKey, 0)),
    trayIndex: 0,
    sel: 0,
    score: 0,
    combo: 1,
    bestCombo: 1,
    lines: 0,
    cols: 0,
    multi: 0,
    pieces: 0,
    over: false,
  };
}

const adventureCleared = () => readLocal<number>(ADVENTURE_KEY, 0);

function goalProgress(s: Saved, level: number) {
  const lvl = adventureLevel(level);
  const value = lvl.goal === "lines" ? s.lines : lvl.goal === "columns" ? s.cols : s.score;
  return { lvl, value: Math.min(value, lvl.target), done: value >= lvl.target, piecesLeft: lvl.pieces - s.pieces };
}

export function BlocksIntro() {
  const { t, n } = useLanguage();
  const { push } = useNavigation();
  const { api, profile } = useHub();
  const stats = useLoad(() => api.stats("blocks"), [api]).data;
  const best = Math.max(stats?.bestScore ?? 0, readLocal<number>(BEST_KEY, 0));
  const cleared = adventureCleared();
  const next = Math.min(ADVENTURE_LEVELS, cleared + 1);
  const unlocked = (profile?.level ?? 0) >= ADVENTURE_MIN_LEVEL;
  const E = EMPTY, P = "#F2B8D0", B = "#8FA8FF", T = "#5FD0BE", A = "#F0A83A";
  const preview = [E, E, P, P, E, E, E, B, P, P, E, T, E, B, E, E, E, T, A, A, A, A, A, A, B, E, T, T, E, E, B, B, T, E, E, E];
  const play = (mode: BlocksMode, level?: number) => push({ name: "game", game: "blocks", screen: "play", params: level ? { mode, level } : { mode } });

  return (
    <IntroScreen
      game="blocks"
      title={t("gameBlocks")}
      tagline={t("blocksTagline")}
      accent={ACCENT}
      accentInk={INK}
      heroBg="#2A1420"
      preview={<PreviewGrid cols={6} cells={preview.map((bg) => ({ bg }))} gap={3} radius={3} />}
      badge={best ? t("blocksBest", { score: n(best) }) : undefined}
      heroTitle={t("blocksHeroTitle")}
      heroSub={t("blocksHeroSub")}
      modes={[
        { key: "classic", label: t("stackClassic"), desc: t("blocksClassicDesc"), play: t("blocksStartClassic"), onPlay: () => play("classic") },
        { key: "daily", label: t("modeDaily"), desc: t("blocksDailyDesc"), play: t("blocksPlayDaily"), onPlay: () => play("daily") },
        {
          key: "adventure", label: t("blocksAdventure"), desc: t("blocksAdventureDesc", { count: ADVENTURE_LEVELS, level: ADVENTURE_MIN_LEVEL }),
          play: unlocked ? t("blocksPlayLevel", { level: next }) : t("blocksUnlocksAt", { level: ADVENTURE_MIN_LEVEL }),
          disabled: !unlocked,
          onPlay: () => play("adventure", next),
        },
      ]}
      extra={(mode) => mode === "adventure" && unlocked ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))", gap: 4 }} dir="ltr">
          {Array.from({ length: ADVENTURE_LEVELS }, (_, i) => {
            const level = i + 1;
            const done = level <= cleared;
            const open = level <= next;
            return (
              <button
                key={level}
                type="button"
                disabled={!open}
                onClick={() => play("adventure", level)}
                aria-label={t("blocksLevelN", { level }) + (done ? ` · ${t("blocksLevelDone")}` : "")}
                style={{ aspectRatio: "1", padding: 0, borderRadius: 7, border: level === next && !done ? `1.5px solid ${ACCENT}` : 0, background: done ? ACCENT : open ? "var(--surface)" : "#10122A", color: done ? INK : open ? "var(--text)" : "var(--faint)", fontSize: 11, fontWeight: 700, cursor: open ? "pointer" : "default" }}
              >
                {n(level)}
              </button>
            );
          })}
        </div>
      ) : null}
      stats={[
        { value: stats ? n(stats.played) : "—", label: t("statGames") },
        { value: best ? n(best) : "—", label: t("statBest") },
        { value: stats?.averageScore != null ? n(stats.averageScore) : "—", label: t("statAverage") },
        { value: stats?.maxDetail ? `×${n(stats.maxDetail)}` : "—", label: t("blocksBestCombo") },
      ]}
      steps={[
        { title: t("blocksStep1"), text: t("blocksStep1Text") },
        { title: t("blocksStep2"), text: t("blocksStep2Text") },
        { title: t("blocksStep3"), text: t("blocksStep3Text") },
        { title: t("blocksStep4"), text: t("blocksStep4Text") },
      ]}
      rewards={[t("blocksRewardXp"), t("blocksRewardCombo"), t("blocksRewardWeekly")]}
      secondary={{ label: t("stackHighScores"), onClick: () => push({ name: "league" }) }}
    />
  );
}

export function BlocksPlay({ mode, level = 1 }: { mode: BlocksMode; level?: number }) {
  const { t, n } = useLanguage();
  const { back, replace } = useNavigation();
  const { api, submitResult } = useHub();
  useTrackStarted("blocks");
  const stats = useLoad(() => api.stats("blocks"), [api]).data;
  const number = dailyNumber("blocks", puzzleToday());
  const storageKey = mode === "daily" ? `bazimoon-blocks-daily-${number}` : mode === "adventure" ? `bazimoon-blocks-adventure-${level}` : "bazimoon-blocks-classic";
  // A finished board is never resumed: drop it before the saved state loads.
  useState(() => {
    if (readLocal<Saved | null>(storageKey, null)?.over) removeLocal(storageKey);
    return null;
  });
  const [s, setS] = useSavedState<Saved>(storageKey, () => fresh(mode, number, level));
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [flashCells, setFlashCells] = useState<number[]>([]);
  const [xp, setXp] = useState<PuzzleResult | null>(null);
  const [resultParams, setResultParams] = useState<ResultParams | null>(null);
  const best = Math.max(stats?.bestScore ?? 0, readLocal<number>(BEST_KEY, 0));
  const adventure = mode === "adventure";
  const goal = adventure ? goalProgress(s, level) : null;
  const won = goal?.done ?? false;

  useEffect(() => {
    if (!flashCells.length) return;
    const id = window.setTimeout(() => setFlashCells([]), 260);
    return () => window.clearTimeout(id);
  }, [flashCells]);

  const finish = useCallback((final: Saved, didWin: boolean) => {
    const previousBest = best;
    if (!adventure && final.score > readLocal<number>(BEST_KEY, 0)) writeLocal(BEST_KEY, final.score);
    if (adventure && didWin && level > adventureCleared()) writeLocal(ADVENTURE_KEY, level);
    const params: ResultParams = {
      mode, number, level, won: didWin, score: final.score, lines: final.lines, bestCombo: final.bestCombo, multi: final.multi,
      pieces: final.pieces, previousBest, grid: JSON.stringify(final.grid.map((c) => c ?? "")),
    };
    setResultParams(params);
    void submitResult({
      game: "blocks", mode, puzzleNumber: mode === "daily" ? number : adventure ? level : null, solved: adventure ? didWin : true,
      score: final.score, moves: final.pieces, detail: final.bestCombo, hints: 0,
    }).then((saved) => {
      setXp(saved);
      setResultParams({ ...params, xp: saved ? JSON.stringify(saved) : null });
    });
  }, [best, adventure, level, mode, number, submitResult]);

  function tap(i: number) {
    placeAt(s.sel, i);
  }

  /** Places the tray piece in `slot` with its top-left block on cell `i`. */
  function placeAt(slot: number, i: number) {
    if (s.over) return;
    const piece = s.tray[slot];
    if (!piece) {
      haptic.warn();
      setMsg({ text: t("blocksPickFirst"), err: true });
      return;
    }
    const row = Math.floor(i / SIZE);
    const col = i % SIZE;
    if (!fits(s.grid, piece.shape, row, col)) {
      haptic.warn();
      setMsg({ text: t("blocksNoFit"), err: true });
      return;
    }
    const result = place(s.grid, piece, row, col, s.combo);
    const lines = result.rows + result.cols;
    let tray = [...s.tray];
    tray[slot] = null;
    let trayIndex = s.trayIndex;
    if (!tray.some(Boolean)) {
      trayIndex++;
      tray = dealTray(trayRng(s.seedKey, trayIndex));
    }
    const sel = tray.findIndex(Boolean);
    const next: Saved = {
      ...s,
      grid: result.grid,
      tray,
      trayIndex,
      sel,
      score: s.score + result.gained,
      combo: result.combo,
      bestCombo: Math.max(s.bestCombo, lines ? s.combo : 1),
      lines: s.lines + lines,
      cols: s.cols + result.cols,
      multi: s.multi + (lines > 1 ? 1 : 0),
      pieces: s.pieces + 1,
      over: false,
    };
    const g = adventure ? goalProgress(next, level) : null;
    const stuck = !anyFit(next.grid, tray);
    const outOfPieces = g ? g.piecesLeft <= 0 && !g.done : false;
    next.over = stuck || (g?.done ?? false) || outOfPieces;
    if (lines) {
      haptic.success();
      setFlashCells(result.cleared);
      setMsg({ text: lines > 1 ? t("blocksMultiClear", { count: lines, points: n(result.gained) }) : t("blocksLineClear", { points: n(result.gained) }), err: false });
    } else {
      haptic.tap();
      setMsg(null);
    }
    setS(next);
    if (next.over) {
      if (!g?.done) haptic.error();
      finish(next, g?.done ?? false);
    }
  }

  // ------------------------------------------------------------------ drag and drop
  // Drag a piece from the tray; it floats above the finger so the board stays visible, and lands
  // where its top-left block is nearest.
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ slot: number; x: number; y: number; moved: boolean } | null>(null);
  const dragPiece = drag ? s.tray[drag.slot] : null;

  function metrics() {
    const el = boardRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const pitch = (rect.width + BOARD_GAP) / SIZE;
    return { rect, pitch, cell: pitch - BOARD_GAP };
  }

  /** Where the dragged piece would land: its top-left cell, or null when it is off the board. */
  function landing(d: { slot: number; x: number; y: number }) {
    const piece = s.tray[d.slot];
    const m = metrics();
    if (!piece || !m) return null;
    const { w, h } = shapeSize(piece.shape);
    // Snap the floating piece's top-left corner to the nearest cell.
    const left = d.x - (w * m.pitch - BOARD_GAP) / 2;
    const top = d.y - lift(h, m.pitch) - (h * m.pitch - BOARD_GAP);
    const col = Math.round((left - m.rect.left) / m.pitch);
    const row = Math.round((top - m.rect.top) / m.pitch);
    // Off the board once less than half the piece would be over it.
    if (row + h / 2 < 0 || row + h / 2 > SIZE || col + w / 2 < 0 || col + w / 2 > SIZE) return null;
    return { row, col };
  }

  const land = drag?.moved ? landing(drag) : null;
  const preview = (() => {
    if (!dragPiece || !land) return null;
    const ok = fits(s.grid, dragPiece.shape, land.row, land.col);
    const cells = SHAPES[dragPiece.shape]
      .map(([r, c]) => [land.row + r, land.col + c])
      .filter(([r, c]) => r >= 0 && r < SIZE && c >= 0 && c < SIZE)
      .map(([r, c]) => r * SIZE + c);
    const clearing = ok ? place(s.grid, dragPiece, land.row, land.col, s.combo).cleared : [];
    return { ok, cells: new Set(cells), clearing: new Set(clearing), color: dragPiece.color };
  })();

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, moved: d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 } : d));
    };
    // The effect re-subscribes every render, so `drag` here is the latest one.
    const up = () => {
      const d = drag;
      setDrag(null);
      if (!d.moved) return;
      const at = landing(d);
      if (at && fits(s.grid, s.tray[d.slot]!.shape, at.row, at.col)) placeAt(d.slot, at.row * SIZE + at.col);
      else if (at) {
        haptic.warn();
        setMsg({ text: t("blocksNoFit"), err: true });
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  });

  function grab(slot: number, e: ReactPointerEvent) {
    if (s.over || !s.tray[slot]) return;
    haptic.select();
    setMsg(null);
    setS({ ...s, sel: slot });
    setDrag({ slot, x: e.clientX, y: e.clientY, moved: false });
  }

  const dragHint = drag?.moved && dragPiece
    ? preview ? (preview.ok ? (preview.clearing.size ? t("blocksDropClear") : t("blocksDropPlace")) : t("blocksNoFitHere")) : null
    : null;

  // Keyboard: 1–3 pick a piece.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = Number(e.key);
      if (k >= 1 && k <= 3 && s.tray[k - 1]) setS({ ...s, sel: k - 1 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function restart() {
    setXp(null);
    setResultParams(null);
    setMsg(null);
    setS(fresh(mode, number, level));
  }

  const boardWidth = "min(350px, calc(100vw - 44px))";
  const overTitle = adventure ? (won ? t("blocksLevelCleared", { level }) : t("blocksLevelFailed", { level })) : t("blocksNoSpace");

  return (
    <Screen theme="night">
      <div className="row row--between" style={{ padding: "14px 16px 8px" }}>
        <IconButton icon="back" label={t("backToGame", { game: t("gameBlocks") })} onClick={back} />
        <div style={{ textAlign: "center" }}>
          <div className="display num" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }} aria-live="polite">{n(s.score)}</div>
          <div className="tiny muted">
            {adventure ? t("blocksLevelN", { level }) : mode === "daily" ? t("blocksDailyN", { number }) : best ? t("blocksBestShort", { score: n(best) }) : t("blocksPoints")}
          </div>
        </div>
        <div className="num" style={{ minWidth: 44, padding: "8px 10px", borderRadius: 12, background: s.combo > 1 ? "#F0A83A" : "var(--surface)", color: s.combo > 1 ? "#1A1206" : "var(--muted)", fontWeight: 700, textAlign: "center", fontSize: 14 }} aria-label={t("blocksComboLabel", { count: s.combo })}>
          ×{n(s.combo)}
        </div>
      </div>

      {goal && (
        <div className="row row--between" style={{ margin: "0 16px 4px", padding: "8px 12px", borderRadius: 12, background: "var(--surface)", fontSize: 13 }}>
          <span>{t(`blocksGoal_${goal.lvl.goal}`, { count: n(goal.lvl.target) })}</span>
          <span className="num" style={{ fontWeight: 600, color: goal.done ? ACCENT : undefined }}>
            {n(goal.value)}/{n(goal.lvl.target)} · {t("blocksPiecesLeft", { count: n(Math.max(0, goal.piecesLeft)) })}
          </span>
        </div>
      )}

      <div role="status" style={{ minHeight: 28, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
        {dragHint ? (
          <span style={{ fontSize: 13, fontWeight: 600, color: preview?.ok ? "#F0A83A" : "#F08A7A" }}>{dragHint}</span>
        ) : msg && <span style={{ fontSize: 13, fontWeight: 600, color: msg.err ? "#F08A7A" : "#F0A83A" }}>{msg.text}</span>}
      </div>

      <div style={{ position: "relative", alignSelf: "center", padding: 6, borderRadius: 16, background: "var(--surface)" }} dir="ltr">
        <div ref={boardRef} role="grid" aria-label={t("blocksBoard")} style={{ display: "grid", gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, gap: BOARD_GAP, width: boardWidth }}>
          {s.grid.map((v, i) => {
            const ghost = preview?.cells.has(i);
            const clearing = preview?.clearing.has(i) && !ghost;
            let bg = flashCells.includes(i) ? "#EDEBF5" : v ?? EMPTY;
            let border = "0";
            let shade = v ? "inset 0 -4px 0 rgba(0,0,0,0.18)" : "none";
            if (ghost && preview!.ok) { bg = `${preview!.color}99`; border = `2px solid ${preview!.color}`; shade = "none"; }
            else if (ghost) { bg = v ?? "#3A1C22"; border = "2px solid #F08A7A"; shade = "none"; }
            if (clearing) { bg = v ? preview!.color : EMPTY; border = `2px solid ${preview!.color}`; }
            return (
              <button
                key={i}
                type="button"
                onClick={() => tap(i)}
                aria-label={t("blocksCell", { row: Math.floor(i / SIZE) + 1, col: (i % SIZE) + 1 }) + (v ? `, ${t("blocksFilled")}` : "")}
                style={{ aspectRatio: "1", padding: 0, boxSizing: "border-box", borderRadius: 7, border, background: bg, boxShadow: shade, cursor: "pointer", transition: drag ? "none" : "background 200ms" }}
              />
            );
          })}
        </div>
        {s.over && (
          <div className="stack center" style={{ position: "absolute", inset: 0, borderRadius: 16, background: "rgba(11,13,26,0.86)", justifyContent: "center", gap: 12, textAlign: "center" }}>
            <div className="display" style={{ fontSize: 28, fontWeight: 800 }}>{overTitle}</div>
            <div style={{ fontSize: 15, color: "var(--text-2)" }}>
              {t("blocksOverSummary", { score: n(s.score), lines: n(s.lines) })}{xp ? ` · +${n(xp.xpGained)} XP` : ""}
            </div>
            <div className="row" style={{ gap: 8 }}>
              {mode !== "daily" && (
                <button type="button" className="btn" style={{ minHeight: 48, padding: "0 20px", width: "auto", background: ACCENT, color: INK, fontSize: 15 }} onClick={adventure && won ? () => replace({ name: "game", game: "blocks", screen: "play", params: { mode, level: Math.min(ADVENTURE_LEVELS, level + 1) } }) : restart}>
                  {adventure && won ? t("blocksNextLevel") : t("playAgainGame")}
                </button>
              )}
              {resultParams && (
                <button type="button" className="btn btn--outline" style={{ minHeight: 48, padding: "0 18px", width: "auto", fontSize: 15 }} onClick={() => replace({ name: "game", game: "blocks", screen: "result", params: resultParams })}>
                  {t("seeResults")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "12px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {s.tray.map((p, i) => {
            if (!p) return <div key={i} aria-hidden="true" style={{ height: 112, borderRadius: 18, background: "#10122A", opacity: 0.4 }} />;
            const { w, h } = shapeSize(p.shape);
            const on = i === s.sel;
            const lifted = drag?.slot === i && drag.moved;
            const cell = w >= 4 || h >= 4 ? 14 : 18;
            return (
              <button
                key={i}
                type="button"
                onPointerDown={(e) => grab(i, e)}
                onClick={() => { if (!lifted) { haptic.select(); setS({ ...s, sel: i }); setMsg(null); } }}
                aria-label={t("blocksPieceN", { n: i + 1, cells: SHAPES[p.shape].length }) + (on ? `, ${t("selected")}` : "")}
                aria-pressed={on}
                style={{ height: 112, padding: 0, borderRadius: 18, border: `2px ${lifted ? "dashed" : "solid"} ${on ? p.color : "#262A44"}`, background: lifted ? "#10122A" : on ? "#1A1D36" : "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", touchAction: "none", opacity: lifted ? 0.45 : 1 }}
              >
                <span style={{ display: "grid", gridTemplateColumns: `repeat(${w}, ${cell}px)`, gap: 2, transform: lifted ? "scale(0.85)" : undefined }} dir="ltr">
                  {Array.from({ length: w * h }, (_, k) => {
                    const r = Math.floor(k / w);
                    const c = k % w;
                    const filled = SHAPES[p.shape].some(([rr, cc]) => rr === r && cc === c);
                    return <span key={k} style={{ width: cell, height: cell, borderRadius: 4, background: filled ? p.color : "transparent" }} />;
                  })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="small muted" style={{ padding: "0 16px calc(22px + env(safe-area-inset-bottom))", textAlign: "center" }}>{t("blocksHint")}</div>
      {drag?.moved && dragPiece && <FloatingPiece piece={dragPiece} x={drag.x} y={drag.y} pitch={metrics()?.pitch ?? 40} />}
    </Screen>
  );
}

const BOARD_GAP = 2;

/** How far above the finger the dragged piece floats, so the finger never covers it. */
function lift(rows: number, pitch: number) {
  return Math.max(28, pitch * 0.9) + (rows > 3 ? pitch / 2 : 0);
}

function FloatingPiece({ piece, x, y, pitch }: { piece: { shape: number; color: string }; x: number; y: number; pitch: number }) {
  const { w, h } = shapeSize(piece.shape);
  const cell = pitch - BOARD_GAP;
  const width = w * pitch - BOARD_GAP;
  const height = h * pitch - BOARD_GAP;
  return (
    <div
      aria-hidden="true"
      dir="ltr"
      style={{
        position: "fixed", left: x - width / 2, top: y - lift(h, pitch) - height, width, height, pointerEvents: "none", zIndex: 50,
        display: "grid", gridTemplateColumns: `repeat(${w}, ${cell}px)`, gridAutoRows: cell, gap: BOARD_GAP, filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.45))",
      }}
    >
      {Array.from({ length: w * h }, (_, k) => {
        const filled = SHAPES[piece.shape].some(([r, c]) => r === Math.floor(k / w) && c === k % w);
        return <span key={k} style={{ borderRadius: 7, background: filled ? piece.color : "transparent", boxShadow: filled ? "inset 0 -4px 0 rgba(0,0,0,0.18)" : "none" }} />;
      })}
    </div>
  );
}

export function BlocksResult({ params }: { params?: ResultParams }) {
  const { t, n } = useLanguage();
  const { replace } = useNavigation();
  const { api } = useHub();
  const xp = parseXp(params);
  const mode = (params?.mode as BlocksMode) ?? "classic";
  const adventure = mode === "adventure";
  const level = Number(params?.level ?? 1);
  const won = Boolean(params?.won);
  const score = Number(params?.score ?? 0);
  const previousBest = Number(params?.previousBest ?? 0);
  const weekly = useLoad(() => (adventure ? Promise.resolve(null) : api.weekly("blocks")), [api, adventure]).data;
  const newBest = !adventure && (xp?.newBest ?? score > previousBest);
  const grid: string[] = (() => {
    try {
      return JSON.parse(String(params?.grid ?? "[]"));
    } catch {
      return [];
    }
  })();
  const kicker = adventure ? (won ? t("blocksLevelCleared", { level }) : t("blocksLevelFailed", { level })) : newBest ? t("newPersonalBest") : t("blocksNoSpace");
  const sub = adventure
    ? won ? t("blocksAdventureNext", { level: Math.min(ADVENTURE_LEVELS, level + 1) }) : t("blocksAdventureRetry")
    : newBest && previousBest > 0 ? t("blocksBeatBy", { best: n(previousBest), by: n(score - previousBest) })
      : newBest ? t("firstScoreOnBoard") : t("bestStill", { best: n(Math.max(previousBest, score)) });

  return (
    <Screen theme="night">
      <div className="row" style={{ justifyContent: "flex-end", padding: "14px 16px 0" }}>
        <IconButton icon="close" label={t("close")} onClick={() => replace({ name: "game", game: "blocks", screen: "intro" })} />
      </div>
      <Body style={{ paddingTop: 0, paddingBottom: 20 }}>
        <section className="stack center" style={{ gap: 6, textAlign: "center" }}>
          <div className="kicker" style={{ color: newBest || (adventure && won) ? "#F0A83A" : "#F08A7A" }}>{kicker}</div>
          <h1 className="display num" style={{ fontSize: 52, lineHeight: 1 }}>{n(score)}</h1>
          <p style={{ fontSize: 15, color: "var(--text-2)" }}>{sub}</p>
        </section>
        {grid.length === SIZE * SIZE && (
          <div style={{ alignSelf: "center", padding: 6, borderRadius: 14, background: "var(--surface)" }} aria-hidden="true" dir="ltr">
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, gap: 2, width: 176 }}>
              {grid.map((c, i) => <span key={i} style={{ height: 20, borderRadius: 3, background: c || EMPTY }} />)}
            </div>
          </div>
        )}
        <div className="stat-grid stat-grid--4">
          {[
            [n(Number(params?.lines ?? 0)), t("blocksLines"), undefined],
            [`×${n(Number(params?.bestCombo ?? 1))}`, t("blocksBestCombo"), "#F0A83A"],
            [n(Number(params?.multi ?? 0)), t("blocksMultiClears"), undefined],
            [n(Number(params?.pieces ?? 0)), t("blocksPieces"), undefined],
          ].map(([v, l, c]) => (
            <div key={l} className="stat stat--center" style={{ padding: "10px 6px" }}>
              <div className="stat__value" style={{ fontSize: 17, color: c }}>{v}</div>
              <div className="stat__label">{l}</div>
            </div>
          ))}
        </div>
        {xp ? <XpCard xp={xp} /> : <div className="card small muted">{t("resultSavedLater")}</div>}
        {weekly && (
          <section className="stack" style={{ gap: 10, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
            <div className="row row--between">
              <span style={{ fontSize: 14, fontWeight: 600 }}>{t("blocksWeekly", { division: `${t(`division${weekly.division}` as "divisionGold")} ${roman(weekly.tier)}` })}</span>
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
      </Body>
      <div className="screen__bar screen__bar--row" style={{ gap: 8 }}>
        <button type="button" className="btn btn--outline" style={{ flex: 1, fontSize: 15 }} onClick={() => void shareLink(appLink(), t("blocksShare", { score: n(score) }))}>
          {t("shareScore")}
        </button>
        <button
          type="button"
          className="btn"
          style={{ flex: 1.3, fontSize: 15, background: ACCENT, color: INK }}
          onClick={() => replace({ name: "game", game: "blocks", screen: "play", params: adventure ? { mode, level: won ? Math.min(ADVENTURE_LEVELS, level + 1) : level } : { mode: mode === "daily" ? "classic" : mode, at: Date.now() } })}
        >
          {adventure ? (won ? t("blocksNextLevel") : t("blocksRetryLevel")) : mode === "daily" ? t("stackPlayClassic") : t("playAgainGame")}
        </button>
      </div>
    </Screen>
  );
}
