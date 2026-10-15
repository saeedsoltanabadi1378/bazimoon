import { useEffect, useRef, useState, type ReactNode } from "react";
import { slidePlan, tileStyle, type Dir } from "./logic";

/** A tile on screen. Tiles keep their id while they slide so the browser can animate them. */
interface Tile {
  id: number;
  v: number;
  at: number;
  /** born: just spawned (grows in) · merged: doubled this move (pops) · gone: slid into another tile */
  kind: "idle" | "born" | "merged" | "gone";
  /** Bumped on every merge so the pop animation restarts. */
  gen: number;
}

const SLIDE_MS = 110;

/** Keeps the on-screen tiles in step with the grid and works out each move's animation. */
export function useMergeTiles(grid: number[]) {
  const nextId = useRef(1);
  const fromGrid = (g: number[], kind: Tile["kind"] = "idle"): Tile[] =>
    g.flatMap((v, at) => (v ? [{ id: nextId.current++, v, at, kind, gen: 0 }] : []));
  const [tiles, setTiles] = useState<Tile[]>(() => fromGrid(grid));
  const cleanup = useRef<number | undefined>(undefined);

  // Undo, a new game or a resumed save change the grid without a move: redraw without sliding.
  useEffect(() => {
    const shown = tiles.filter((t) => t.kind !== "gone");
    const same = shown.length === grid.filter(Boolean).length && shown.every((t) => grid[t.at] === t.v);
    if (!same) setTiles(fromGrid(grid, "born"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid]);

  useEffect(() => () => window.clearTimeout(cleanup.current), []);

  /** Call with the grid before and after a successful move. */
  function animate(before: number[], after: number[], size: number, dir: Dir) {
    const plan = slidePlan(before, size, dir);
    const live = tiles.filter((t) => t.kind !== "gone");
    const byAt = new Map(live.map((t) => [t.at, t]));
    const next: Tile[] = plan.map((p) => {
      const tile = byAt.get(p.from) ?? { id: nextId.current++, v: before[p.from], at: p.from, kind: "idle" as const, gen: 0 };
      if (p.merge === "keep") return { ...tile, at: p.to, v: tile.v * 2, kind: "merged", gen: tile.gen + 1 };
      if (p.merge === "absorb") return { ...tile, at: p.to, kind: "gone" };
      return { ...tile, at: p.to, kind: "idle" };
    });
    const landed = new Set(plan.map((p) => p.to));
    after.forEach((v, at) => {
      if (v && !landed.has(at)) next.push({ id: nextId.current++, v, at, kind: "born", gen: 0 });
    });
    setTiles(next);
    window.clearTimeout(cleanup.current);
    cleanup.current = window.setTimeout(() => setTiles((ts) => ts.filter((t) => t.kind !== "gone")), SLIDE_MS + 30);
  }

  return { tiles, animate };
}

/** The 2048 board: empty slots underneath, tiles on top that slide, pop when they merge and grow
 * in when they spawn. `children` draws over the board (hint, game over). */
export function MergeBoardView({ tiles, size, boardPx, shake, children }: {
  tiles: Tile[];
  size: number;
  boardPx: number;
  shake: number;
  children?: ReactNode;
}) {
  const pad = 10;
  const gap = size === 5 ? 8 : 10;
  const tilePx = (boardPx - pad * 2 - gap * (size - 1)) / size;
  const ref = useRef<HTMLDivElement>(null);
  // A nudge when a swipe moves nothing.
  useEffect(() => {
    if (!shake || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ref.current?.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(6px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }],
      { duration: 240, easing: "ease-out" },
    );
  }, [shake]);
  const pos = (at: number) => ({ x: (at % size) * (tilePx + gap), y: Math.floor(at / size) * (tilePx + gap) });

  return (
    <div ref={ref} style={{ position: "relative", width: boardPx, height: boardPx, padding: pad, borderRadius: 22, background: "var(--surface)" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gap }} aria-hidden="true">
        {Array.from({ length: size * size }, (_, i) => (
          <div key={i} style={{ height: tilePx, borderRadius: 12, background: tileStyle(0)[0] }} />
        ))}
      </div>
      <div style={{ position: "absolute", inset: pad }}>
        {tiles.map((tile) => {
          const [bg, fg] = tileStyle(tile.v);
          const { x, y } = pos(tile.at);
          const fontSize = (size === 5 ? 0.8 : 1) * (tile.v >= 1024 ? 24 : tile.v >= 128 ? 28 : 32);
          return (
            <div
              key={tile.id}
              style={{
                position: "absolute", left: 0, top: 0, width: tilePx, height: tilePx,
                transform: `translate(${x}px, ${y}px)`, transition: `transform ${SLIDE_MS}ms ease-in-out`,
                zIndex: tile.kind === "gone" ? 1 : tile.kind === "merged" ? 3 : 2,
              }}
            >
              <div
                key={tile.gen}
                className={`display${tile.kind === "born" ? " tile-born" : tile.kind === "merged" ? " tile-pop" : ""}`}
                style={{
                  width: "100%", height: "100%", borderRadius: 12, background: bg, color: fg,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize, fontWeight: 800,
                  boxShadow: tile.v >= 512 ? `0 0 18px ${bg}66` : "none",
                }}
              >
                {tile.v}
              </div>
            </div>
          );
        })}
      </div>
      {children}
    </div>
  );
}

/** First game only: a hand swiping across the board to show how to move. */
export function SwipeHint({ label }: { label: string }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: 22, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "rgba(11,13,26,0.45)", zIndex: 5 }}>
      <div className="swipe-hand" style={{ color: "#EDEBF5", filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.5))" }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="#9C8CFF" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
      </div>
      <div style={{ padding: "8px 14px", borderRadius: 999, background: "rgba(11,13,26,0.85)", color: "#EDEBF5", fontSize: 14, fontWeight: 600 }}>{label}</div>
    </div>
  );
}
