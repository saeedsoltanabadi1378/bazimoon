import { seeded, shuffle, type Rng } from "../../lib/rng";

export type SudokuLevel = "easy" | "medium" | "hard" | "expert";

export interface SudokuPuzzle {
  /** 81 cells, 0 for empty. */
  givens: number[];
  solution: number[];
  level: SudokuLevel;
}

/** Clue counts the generator aims for; it stops earlier if removing more would need guessing. */
export const LEVEL_GIVENS: Record<SudokuLevel, number> = { easy: 38, medium: 30, hard: 26, expert: 23 };
/** Logic the player may need: singles only for Easy and Medium, plus locked candidates and pairs above. */
const LEVEL_TECHNIQUES: Record<SudokuLevel, number> = { easy: 1, medium: 1, hard: 2, expert: 2 };

const ROW = (i: number) => Math.floor(i / 9);
const COL = (i: number) => i % 9;
const BOX = (i: number) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);

/** The 27 units (rows, columns, boxes) as cell lists, and each cell's 20 peers. */
export const UNITS: number[][] = [
  ...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, b) => Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3))),
];
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) =>
  Array.from({ length: 81 }, (_, j) => j).filter((j) => j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))),
);

const bit = (d: number) => 1 << d;
const ALL = 0b1111111110; // digits 1–9
const popcount = (m: number) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
const lowestDigit = (m: number) => { for (let d = 1; d <= 9; d++) if (m & bit(d)) return d; return 0; };

/** Counts solutions up to `limit` by backtracking on the most constrained cell. */
export function countSolutions(grid: number[], limit = 2): number {
  const g = [...grid];
  let found = 0;
  const search = (): boolean => {
    let best = -1, bestMask = 0, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      let mask = ALL;
      for (const p of PEERS[i]) if (g[p]) mask &= ~bit(g[p]);
      const n = popcount(mask);
      if (n === 0) return false;
      if (n < bestCount) { best = i; bestMask = mask; bestCount = n; if (n === 1) break; }
    }
    if (best < 0) { found++; return found >= limit; }
    for (let d = 1; d <= 9; d++) {
      if (!(bestMask & bit(d))) continue;
      g[best] = d;
      if (search()) return true;
    }
    g[best] = 0;
    return false;
  };
  search();
  return found;
}

/** A random full grid. */
function fullGrid(rng: Rng): number[] {
  const g = new Array<number>(81).fill(0);
  const fill = (i: number): boolean => {
    if (i === 81) return true;
    let mask = ALL;
    for (const p of PEERS[i]) if (g[p]) mask &= ~bit(g[p]);
    for (const d of shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (!(mask & bit(d))) continue;
      g[i] = d;
      if (fill(i + 1)) return true;
    }
    g[i] = 0;
    return false;
  };
  fill(0);
  return g;
}

/**
 * Solves the way a person would, without guessing: naked and hidden singles (level 1), then
 * locked candidates and naked pairs (level 2). Returns true when that logic finishes the grid.
 */
export function solvesByLogic(grid: number[], level: number): boolean {
  const g = [...grid];
  const cand = g.map((v, i) => {
    if (v) return 0;
    let mask = ALL;
    for (const p of PEERS[i]) if (g[p]) mask &= ~bit(g[p]);
    return mask;
  });
  const place = (i: number, d: number) => {
    g[i] = d;
    cand[i] = 0;
    for (const p of PEERS[i]) cand[p] &= ~bit(d);
  };
  for (;;) {
    let progress = false;
    // Naked singles.
    for (let i = 0; i < 81; i++) if (!g[i] && popcount(cand[i]) === 1) { place(i, lowestDigit(cand[i])); progress = true; }
    // Hidden singles.
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d++) {
        let spot = -1, count = 0;
        for (const i of unit) if (!g[i] && cand[i] & bit(d)) { spot = i; count++; }
        if (count === 1) { place(spot, d); progress = true; }
      }
    }
    if (!progress && level >= 2) {
      // Locked candidates: a digit confined to one box within a line (or one line within a box).
      for (const unit of UNITS) {
        for (let d = 1; d <= 9; d++) {
          const spots = unit.filter((i) => !g[i] && cand[i] & bit(d));
          if (spots.length < 2) continue;
          for (const other of UNITS) {
            if (other === unit || !spots.every((i) => other.includes(i))) continue;
            for (const j of other) if (!spots.includes(j) && !g[j] && cand[j] & bit(d)) { cand[j] &= ~bit(d); progress = true; }
          }
        }
      }
      // Naked pairs.
      for (const unit of UNITS) {
        const pairs = unit.filter((i) => !g[i] && popcount(cand[i]) === 2);
        for (let a = 0; a < pairs.length; a++) for (let b = a + 1; b < pairs.length; b++) {
          const m = cand[pairs[a]];
          if (m !== cand[pairs[b]]) continue;
          for (const j of unit) if (j !== pairs[a] && j !== pairs[b] && !g[j] && cand[j] & m) { cand[j] &= ~m; progress = true; }
        }
      }
    }
    if (g.every(Boolean)) return true;
    if (!progress) return false;
  }
}

/** How many fresh grids Hard and Expert may try to get down to their clue count. */
const ATTEMPTS: Record<SudokuLevel, number> = { easy: 1, medium: 2, hard: 12, expert: 24 };

/** Strips one full grid down towards the level's clue count. */
function carve(rng: Rng, level: SudokuLevel) {
  const solution = fullGrid(rng);
  const givens = [...solution];
  const target = LEVEL_GIVENS[level];
  const technique = LEVEL_TECHNIQUES[level];
  let count = 81;
  const tryRemove = (cells: number[]) => {
    if (count - cells.length < target - 1) return;
    const before = cells.map((k) => givens[k]);
    if (before.some((v) => !v)) return;
    for (const k of cells) givens[k] = 0;
    if (countSolutions(givens) === 1 && solvesByLogic(givens, technique)) count -= cells.length;
    else cells.forEach((k, n) => (givens[k] = before[n]));
  };
  // Mirror pairs first so the grid looks balanced, then single cells to get the last few out.
  for (const i of shuffle(rng, Array.from({ length: 41 }, (_, k) => k))) {
    if (count <= target) break;
    tryRemove(i === 40 ? [40] : [i, 80 - i]);
  }
  for (const i of shuffle(rng, Array.from({ length: 81 }, (_, k) => k))) {
    if (count <= target) break;
    tryRemove([i]);
  }
  return { givens, solution, count };
}

/** A deterministic puzzle for `seedKey`: one solution, solvable without guessing. */
export function generateSudoku(seedKey: string, level: SudokuLevel): SudokuPuzzle {
  const rng = seeded(seedKey);
  let best = carve(rng, level);
  for (let n = 1; n < ATTEMPTS[level] && best.count > LEVEL_GIVENS[level]; n++) {
    const next = carve(rng, level);
    if (next.count < best.count) best = next;
  }
  return { givens: best.givens, solution: best.solution, level };
}

/** Cells holding a digit that repeats in their row, column or box. */
export function clashes(entries: number[]): Set<number> {
  const bad = new Set<number>();
  entries.forEach((v, i) => {
    if (v && PEERS[i].some((p) => entries[p] === v)) bad.add(i);
  });
  return bad;
}

/** Units (rows, columns, boxes) completed correctly, by unit index into UNITS. */
export function completeUnits(entries: number[], solution: number[]): Set<number> {
  const done = new Set<number>();
  UNITS.forEach((unit, u) => { if (unit.every((i) => entries[i] === solution[i])) done.add(u); });
  return done;
}

/** Difficulty for a level: easy grids first, expert from level 61 on. */
export function sudokuLevelDifficulty(level: number): SudokuLevel {
  return level <= 10 ? "easy" : level <= 30 ? "medium" : level <= 60 ? "hard" : "expert";
}
