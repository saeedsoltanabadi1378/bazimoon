// Blocks: an 8×8 board, three pieces at a time, full rows and columns clear. Pieces never rotate.
import { seeded, type Rng } from "../../lib/rng";

export const SIZE = 8;

/** Cell offsets [row, col] from the piece's top-left corner. */
export const SHAPES: [number, number][][] = [
  [[0, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 1], [1, 0], [1, 1]],
];

// Small pieces come up more often than the big square.
const WEIGHTS = [6, 8, 7, 8, 7, 7, 5, 6, 5, 4, 2, 4, 6];
const TOTAL_WEIGHT = WEIGHTS.reduce((a, b) => a + b, 0);

export const COLORS = ["#F2B8D0", "#8FA8FF", "#5FD0BE", "#F0A83A", "#B79CF2", "#9ED98C"];

export type Grid = (string | null)[];

export interface Piece {
  shape: number;
  color: string;
}

export function emptyGrid(): Grid {
  return Array.from({ length: SIZE * SIZE }, () => null);
}

export function shapeSize(shape: number) {
  let w = 0;
  let h = 0;
  for (const [r, c] of SHAPES[shape]) {
    h = Math.max(h, r + 1);
    w = Math.max(w, c + 1);
  }
  return { w, h };
}

export function fits(grid: Grid, shape: number, row: number, col: number) {
  for (const [r, c] of SHAPES[shape]) {
    const rr = row + r;
    const cc = col + c;
    if (rr >= SIZE || cc >= SIZE || grid[rr * SIZE + cc]) return false;
  }
  return true;
}

export function anyFit(grid: Grid, tray: (Piece | null)[]) {
  return tray.some((p) => p && canPlaceAnywhere(grid, p.shape));
}

export function canPlaceAnywhere(grid: Grid, shape: number) {
  for (let i = 0; i < SIZE * SIZE; i++) if (fits(grid, shape, Math.floor(i / SIZE), i % SIZE)) return true;
  return false;
}

export interface Placement {
  grid: Grid;
  rows: number;
  cols: number;
  cleared: number[];
  gained: number;
  combo: number;
}

/** Places a piece, clears full lines and scores it: cells + lines² × 10 × the running combo. */
export function place(grid: Grid, piece: Piece, row: number, col: number, combo: number): Placement {
  const g = [...grid];
  for (const [r, c] of SHAPES[piece.shape]) g[(row + r) * SIZE + col + c] = piece.color;
  const clear = new Set<number>();
  let rows = 0;
  let cols = 0;
  for (let r = 0; r < SIZE; r++) {
    if (Array.from({ length: SIZE }, (_, k) => g[r * SIZE + k]).every(Boolean)) {
      rows++;
      for (let k = 0; k < SIZE; k++) clear.add(r * SIZE + k);
    }
  }
  for (let c = 0; c < SIZE; c++) {
    if (Array.from({ length: SIZE }, (_, k) => g[k * SIZE + c]).every(Boolean)) {
      cols++;
      for (let k = 0; k < SIZE; k++) clear.add(k * SIZE + c);
    }
  }
  for (const i of clear) g[i] = null;
  const lines = rows + cols;
  const gained = SHAPES[piece.shape].length + lines * lines * 10 * (lines ? combo : 1);
  return { grid: g, rows, cols, cleared: [...clear], gained, combo: lines ? combo + 1 : 1 };
}

export function randomPiece(rng: Rng): Piece {
  let roll = rng() * TOTAL_WEIGHT;
  let shape = 0;
  while (roll >= WEIGHTS[shape]) {
    roll -= WEIGHTS[shape];
    shape++;
  }
  return { shape, color: COLORS[Math.floor(rng() * COLORS.length)] };
}

/** Deals three pieces. Seeded games (daily, adventure) pass the tray index so everyone gets the same order. */
export function dealTray(rng: Rng): Piece[] {
  return [randomPiece(rng), randomPiece(rng), randomPiece(rng)];
}

export function trayRng(seedKey: string, trayIndex: number): Rng {
  return seeded(`${seedKey}-${trayIndex}`);
}

// ---------------------------------------------------------------- adventure

export const ADVENTURE_LEVELS = 60;

export type GoalKind = "lines" | "columns" | "score";

export interface AdventureLevel {
  level: number;
  goal: GoalKind;
  target: number;
  pieces: number;
  grid: Grid;
}

/** Level k cycles through goals that grow with k; later levels start with blocks already on the board. */
export function adventureLevel(level: number): AdventureLevel {
  const rng = seeded(`blocks-adventure-${level}`);
  const kind: GoalKind = level % 3 === 1 ? "lines" : level % 3 === 2 ? "columns" : "score";
  // Budgets are tuned so a simple greedy bot clears most levels; people plan ahead and do better.
  const target = kind === "lines" ? 2 + Math.floor(level / 6) : kind === "columns" ? 1 + Math.floor(level / 12) : 120 + level * 12;
  const pieces = kind === "score" ? Math.ceil(target / 8) + 8 : kind === "lines" ? target * 4 + 8 : target * 6 + 10;
  const grid = emptyGrid();
  const fill = level < 4 ? 0 : Math.min(12, 2 + Math.floor(level / 5));
  let placed = 0;
  for (let tries = 0; placed < fill && tries < 400; tries++) {
    const i = Math.floor(rng() * SIZE * SIZE);
    if (grid[i]) continue;
    grid[i] = "#3A3F5E";
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    const rowFull = Array.from({ length: SIZE }, (_, k) => grid[r * SIZE + k]).filter(Boolean).length >= SIZE - 1;
    const colFull = Array.from({ length: SIZE }, (_, k) => grid[k * SIZE + c]).filter(Boolean).length >= SIZE - 1;
    if (rowFull || colFull) grid[i] = null;
    else placed++;
  }
  return { level, goal: kind, target, pieces, grid };
}
