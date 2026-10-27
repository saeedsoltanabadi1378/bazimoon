import { seeded, shuffle, type Rng } from "../../lib/rng";

export interface QueensPuzzle {
  size: number;
  /** Region id (0..size-1) for every cell. */
  regions: number[];
  /** Column of the queen in each row. */
  solution: number[];
}

/** Random placement with one queen per row and column and no two queens touching. */
function randomSolution(size: number, rng: Rng): number[] | null {
  const cols: number[] = [];
  const used = new Set<number>();
  const place = (row: number): boolean => {
    if (row === size) return true;
    for (const c of shuffle(rng, Array.from({ length: size }, (_, i) => i))) {
      if (used.has(c)) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) <= 1) continue;
      cols[row] = c;
      used.add(c);
      if (place(row + 1)) return true;
      used.delete(c);
    }
    return false;
  };
  return place(0) ? cols : null;
}

/** Grows one region from each queen by random flood fill until every cell belongs to a region. */
function growRegions(size: number, solution: number[], rng: Rng) {
  const regions = new Array<number>(size * size).fill(-1);
  const frontier: number[][] = [];
  solution.forEach((c, r) => {
    regions[r * size + c] = r;
    frontier.push([r * size + c]);
  });
  let remaining = size * size - size;
  while (remaining > 0) {
    const region = Math.floor(rng() * size);
    const cells = frontier[region];
    if (!cells.length) continue;
    const from = cells[Math.floor(rng() * cells.length)];
    const r = Math.floor(from / size);
    const c = from % size;
    const options = [
      r > 0 ? from - size : -1,
      r < size - 1 ? from + size : -1,
      c > 0 ? from - 1 : -1,
      c < size - 1 ? from + 1 : -1,
    ].filter((x) => x >= 0 && regions[x] === -1);
    if (!options.length) {
      cells.splice(cells.indexOf(from), 1);
      continue;
    }
    const next = options[Math.floor(rng() * options.length)];
    regions[next] = region;
    cells.push(next);
    remaining--;
  }
  return regions;
}

/**
 * Region-first search: always fills the region with the fewest still-possible cells next, which
 * prunes far harder than row order. Calls `onSolution` with each full placement (row → column);
 * stop by returning true.
 */
function solve(size: number, regions: number[], onSolution: (cols: number[]) => boolean) {
  const cellsByRegion: number[][] = Array.from({ length: size }, () => []);
  regions.forEach((reg, i) => cellsByRegion[reg].push(i));
  const rowUsed = new Array<boolean>(size).fill(false);
  const colUsed = new Array<boolean>(size).fill(false);
  const regionDone = new Array<boolean>(size).fill(false);
  const cols = new Array<number>(size).fill(-1);
  const placed: number[] = [];

  const free = (cell: number) => {
    const r = Math.floor(cell / size), c = cell % size;
    if (rowUsed[r] || colUsed[c]) return false;
    for (const q of placed) {
      const qr = Math.floor(q / size), qc = q % size;
      if (Math.abs(qr - r) <= 1 && Math.abs(qc - c) <= 1) return false;
    }
    return true;
  };

  const search = (depth: number): boolean => {
    if (depth === size) return onSolution([...cols]);
    let bestRegion = -1;
    let bestCells: number[] = [];
    for (let reg = 0; reg < size; reg++) {
      if (regionDone[reg]) continue;
      const options = cellsByRegion[reg].filter(free);
      if (options.length === 0) return false;
      if (bestRegion < 0 || options.length < bestCells.length) {
        bestRegion = reg;
        bestCells = options;
      }
    }
    regionDone[bestRegion] = true;
    for (const cell of bestCells) {
      const r = Math.floor(cell / size), c = cell % size;
      rowUsed[r] = colUsed[c] = true;
      cols[r] = c;
      placed.push(cell);
      if (search(depth + 1)) return true;
      placed.pop();
      rowUsed[r] = colUsed[c] = false;
      cols[r] = -1;
    }
    regionDone[bestRegion] = false;
    return false;
  };
  search(0);
}

/** Counts solutions up to `limit`. */
export function countSolutions(size: number, regions: number[], limit = 2) {
  let found = 0;
  solve(size, regions, () => ++found >= limit);
  return found;
}

/** First solution that differs from `solution`, or null when `solution` is the only one. */
function findOther(size: number, regions: number[], solution: number[]): number[] | null {
  let result: number[] | null = null;
  solve(size, regions, (cols) => {
    if (cols.some((c, r) => c !== solution[r])) {
      result = cols;
      return true;
    }
    return false;
  });
  return result;
}

function stillConnected(size: number, regions: number[], region: number, without: number) {
  const cells = regions.flatMap((r, i) => (r === region && i !== without ? [i] : []));
  if (!cells.length) return false;
  const seen = new Set([cells[0]]);
  const queue = [cells[0]];
  while (queue.length) {
    const cell = queue.pop()!;
    const r = Math.floor(cell / size), c = cell % size;
    for (const n of [r > 0 ? cell - size : -1, r < size - 1 ? cell + size : -1, c > 0 ? cell - 1 : -1, c < size - 1 ? cell + 1 : -1]) {
      if (n >= 0 && n !== without && regions[n] === region && !seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen.size === cells.length;
}

/**
 * Deterministic puzzle with exactly one solution, so logic alone can always solve it. Regions are
 * grown at random, then repaired: while another solution exists, one of its queen cells is moved
 * into a neighbouring region (which that other solution already uses), breaking it.
 */
/** Board size for a level: 5×5 to learn on, growing to 9×9. */
export function queensLevelSize(level: number) {
  return level <= 3 ? 5 : level <= 10 ? 6 : level <= 25 ? 7 : level <= 50 ? 8 : 9;
}

export function generateQueens(size: number, seedKey: string): QueensPuzzle {
  const rng = seeded(seedKey);
  for (let attempt = 0; attempt < 200; attempt++) {
    const solution = randomSolution(size, rng);
    if (!solution) continue;
    const regions = growRegions(size, solution, rng);
    const queenCells = new Set(solution.map((c, r) => r * size + c));
    for (let repair = 0; repair < size * size * 3; repair++) {
      const other = findOther(size, regions, solution);
      if (!other) return { size, regions, solution };
      let moved = false;
      for (const row of shuffle(rng, Array.from({ length: size }, (_, i) => i))) {
        if (other[row] === solution[row]) continue;
        const cell = row * size + other[row];
        if (queenCells.has(cell)) continue;
        const r = Math.floor(cell / size), c = cell % size;
        const targets = shuffle(rng, [r > 0 ? cell - size : -1, r < size - 1 ? cell + size : -1, c > 0 ? cell - 1 : -1, c < size - 1 ? cell + 1 : -1]
          .filter((n) => n >= 0 && regions[n] !== regions[cell]));
        if (!targets.length || !stillConnected(size, regions, regions[cell], cell)) continue;
        regions[cell] = regions[targets[0]];
        moved = true;
        break;
      }
      if (!moved) break;
    }
  }
  throw new Error("Could not generate a unique Queens puzzle");
}

export type Mark = 0 | 1 | 2; // empty, X, queen

/** Cells holding a queen that breaks a rule (same row, column, region, or touching). */
export function conflicts(puzzle: QueensPuzzle, marks: Mark[]) {
  const { size, regions } = puzzle;
  const queens = marks.flatMap((m, i) => (m === 2 ? [i] : []));
  const bad = new Set<number>();
  for (let a = 0; a < queens.length; a++) {
    for (let b = a + 1; b < queens.length; b++) {
      const i = queens[a];
      const j = queens[b];
      const r1 = Math.floor(i / size), c1 = i % size, r2 = Math.floor(j / size), c2 = j % size;
      if (r1 === r2 || c1 === c2 || regions[i] === regions[j] || (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1)) {
        bad.add(i);
        bad.add(j);
      }
    }
  }
  return { bad, count: queens.length };
}

/** Cells a queen at `cell` rules out (for Auto X). */
export function blockedBy(puzzle: QueensPuzzle, cell: number) {
  const { size, regions } = puzzle;
  const r = Math.floor(cell / size), c = cell % size;
  const out: number[] = [];
  for (let j = 0; j < size * size; j++) {
    if (j === cell) continue;
    const rj = Math.floor(j / size), cj = j % size;
    if (rj === r || cj === c || regions[j] === regions[cell] || (Math.abs(rj - r) <= 1 && Math.abs(cj - c) <= 1)) out.push(j);
  }
  return out;
}

export type QueensHint =
  | { kind: "wrongQueen"; cell: number }
  | { kind: "place"; cell: number; regionSize: number };

/** Removes a misplaced queen, or places the queen of the most constrained unsolved region. */
export function hint(puzzle: QueensPuzzle, marks: Mark[]): QueensHint | null {
  const { size, regions, solution } = puzzle;
  const correct = new Set(solution.map((c, r) => r * size + c));
  const wrong = marks.findIndex((m, i) => m === 2 && !correct.has(i));
  if (wrong >= 0) return { kind: "wrongQueen", cell: wrong };
  let best: { cell: number; open: number } | null = null;
  for (const cell of correct) {
    if (marks[cell] === 2) continue;
    const open = marks.filter((m, i) => regions[i] === regions[cell] && m === 0).length;
    if (!best || open < best.open) best = { cell, open };
  }
  return best ? { kind: "place", cell: best.cell, regionSize: best.open } : null;
}

export const regionColors = ["#4B3F72", "#2F5D62", "#6B4E2E", "#3D5A80", "#5C3D5E", "#3F5E3A", "#6A3B3B", "#4A4A5E", "#5A5130", "#2E4A5C"];
