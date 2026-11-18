import { seeded, type Rng } from "../../lib/rng";

export interface ZipPuzzle {
  size: number;
  /** The one path through every cell (cell index = row * size + col). */
  solution: number[];
  /** cell index → checkpoint number (1..count). 1 is the start, count is the end. */
  checkpoints: Record<number, number>;
  count: number;
  /** Walls between two side-by-side cells, as [a, b] with a < b. The path can't cross them. */
  walls: [number, number][];
}

/**
 * How hard a puzzle is built. `walls` is the share of the edges the solution doesn't use that start
 * walled (walls that turn out not to matter are taken away again). `clues` is the share of cells that
 * stay numbered at least; the generator removes numbers down to that floor while the puzzle still has
 * only one solution, so a low floor means as few numbers as the walls allow.
 */
export interface ZipDifficulty {
  walls: number;
  clues: number;
}

const EASY: ZipDifficulty = { walls: 0, clues: 0.28 };
const MEDIUM: ZipDifficulty = { walls: 0.35, clues: 0.18 };
const HARD: ZipDifficulty = { walls: 0.45, clues: 0.1 };
const EXPERT: ZipDifficulty = { walls: 0.6, clues: 0 };

/** Practice boards sit in the middle of the level curve. */
export const ZIP_PRACTICE: ZipDifficulty = MEDIUM;

function neighbors(cell: number, size: number) {
  const r = Math.floor(cell / size);
  const c = cell % size;
  const out: number[] = [];
  if (r > 0) out.push(cell - size);
  if (r < size - 1) out.push(cell + size);
  if (c > 0) out.push(cell - 1);
  if (c < size - 1) out.push(cell + 1);
  return out;
}

const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/**
 * Random Hamiltonian path by "backbite" moves: start from a serpentine and repeatedly attach an
 * endpoint to one of its other grid neighbours, reversing the loop that creates. Every step keeps a
 * valid path that visits every cell exactly once, so generation never fails.
 */
function randomPath(size: number, rng: Rng) {
  const path: number[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) path.push(r * size + (r % 2 ? size - 1 - c : c));
  }
  const steps = size * size * 40;
  for (let s = 0; s < steps; s++) {
    const fromEnd = rng() < 0.5;
    if (fromEnd) path.reverse();
    // Work on the head (index 0).
    const head = path[0];
    const options = neighbors(head, size).filter((x) => x !== path[1]);
    const x = options[Math.floor(rng() * options.length)];
    const i = path.indexOf(x);
    // Connect head to x: reverse path[0 .. i-1].
    const prefix = path.slice(0, i).reverse();
    for (let k = 0; k < i; k++) path[k] = prefix[k];
  }
  return path;
}

function shuffle<T>(items: T[], rng: Rng) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Board size for a level: small boards to learn on, then bigger ones, with every tenth level a step up. */
export function zipLevelSize(level: number) {
  const base = level <= 3 ? 5 : level <= 15 ? 6 : level <= 40 ? 7 : 8;
  return level % 10 === 0 ? Math.min(8, base + 1) : base;
}

/** No walls while players learn, then walls and fewer numbers; every tenth level is the hardest kind. */
export function zipLevelDifficulty(level: number): ZipDifficulty {
  if (level <= 5) return EASY;
  if (level % 10 === 0) return EXPERT;
  if (level <= 15) return MEDIUM;
  if (level <= 35) return HARD;
  return EXPERT;
}

/** Node limit for one uniqueness check, so generation time stays bounded (and the same on every device). */
const SEARCH_BUDGET = 60_000;

/**
 * Counts paths that start on `start`, pass the numbered cells in order, cover every cell and end on
 * `end`, stopping at 2. Running out of budget counts as 2, so an unproven puzzle is never called unique.
 */
function countSolutions(adj: number[][], clue: Int32Array, start: number, end: number) {
  const total = adj.length;
  const visited = new Uint8Array(total);
  const seen = new Int32Array(total);
  const queue = new Int32Array(total);
  let stamp = 0;
  let found = 0;
  let nodes = 0;

  // Every unvisited cell must still be reachable from the head.
  function connected(head: number, remaining: number) {
    stamp++;
    let qh = 0;
    let qt = 0;
    for (const nb of adj[head]) if (!visited[nb]) { seen[nb] = stamp; queue[qt++] = nb; }
    while (qh < qt) {
      const c = queue[qh++];
      for (const nb of adj[c]) if (!visited[nb] && seen[nb] !== stamp) { seen[nb] = stamp; queue[qt++] = nb; }
    }
    return qt === remaining;
  }

  function dfs(head: number, filled: number, next: number) {
    if (++nodes > SEARCH_BUDGET) return;
    if (filled === total) { found++; return; }
    for (const nb of adj[head]) {
      if (visited[nb]) continue;
      const c = clue[nb];
      if (c && c !== next) continue;
      if (nb === end && filled + 1 !== total) continue;
      visited[nb] = 1;
      // The old head stops being a way in or out for its other neighbours: each still needs two
      // (the end cell one), counting the new head.
      let ok = true;
      for (const u of adj[head]) {
        if (visited[u]) continue;
        let d = 0;
        for (const w of adj[u]) if (!visited[w] || w === nb) d++;
        if (d < (u === end ? 1 : 2)) { ok = false; break; }
      }
      if (ok && filled + 1 < total && !connected(nb, total - filled - 1)) ok = false;
      if (ok) dfs(nb, filled + 1, c ? next + 1 : next);
      visited[nb] = 0;
      if (found >= 2 || nodes > SEARCH_BUDGET) return;
    }
  }

  visited[start] = 1;
  dfs(start, 1, 2);
  return nodes > SEARCH_BUDGET ? 2 : found;
}

function openNeighbors(size: number, walls: Set<string>) {
  return Array.from({ length: size * size }, (_, cell) => neighbors(cell, size).filter((nb) => !walls.has(edgeKey(cell, nb))));
}

function clueArray(solution: number[], keep: boolean[]) {
  const clue = new Int32Array(solution.length);
  let n = 0;
  solution.forEach((cell, i) => {
    if (keep[i]) clue[cell] = ++n;
  });
  return clue;
}

export function generateZip(size: number, seedKey: string, difficulty: ZipDifficulty = EASY): ZipPuzzle {
  const rng = seeded(seedKey);
  const solution = randomPath(size, rng);
  const total = size * size;
  const start = solution[0];
  const end = solution[total - 1];

  // Walls only ever go on edges the solution doesn't use, so the puzzle always stays solvable.
  const used = new Set<string>();
  for (let i = 1; i < total; i++) used.add(edgeKey(solution[i - 1], solution[i]));
  const spare: string[] = [];
  for (let cell = 0; cell < total; cell++) {
    for (const nb of neighbors(cell, size)) if (nb > cell && !used.has(edgeKey(cell, nb))) spare.push(edgeKey(cell, nb));
  }
  const walls = new Set(shuffle(spare, rng).slice(0, Math.round(spare.length * difficulty.walls)));
  const adj = openNeighbors(size, walls);

  // Start with every cell numbered, then take numbers away while the solution stays the only one.
  const keep = solution.map(() => true);
  let kept = total;
  const floor = Math.max(3, Math.round(total * difficulty.clues));
  for (const i of shuffle(Array.from({ length: total - 2 }, (_, k) => k + 1), rng)) {
    if (kept <= floor) break;
    keep[i] = false;
    if (countSolutions(adj, clueArray(solution, keep), start, end) === 1) kept--;
    else keep[i] = true;
  }

  // Take away walls the puzzle doesn't need, so every wall left changes how it's solved.
  const clue = clueArray(solution, keep);
  for (const key of shuffle([...walls], rng)) {
    walls.delete(key);
    if (countSolutions(openNeighbors(size, walls), clue, start, end) !== 1) walls.add(key);
  }

  const checkpoints: Record<number, number> = {};
  for (let cell = 0; cell < total; cell++) if (clue[cell]) checkpoints[cell] = clue[cell];
  const wallList = [...walls].map((key) => key.split("-").map(Number) as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { size, solution, checkpoints, count: kept, walls: wallList };
}

/** True when a wall stands between two side-by-side cells. */
export function hasWall(puzzle: ZipPuzzle, a: number, b: number) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return puzzle.walls.some(([x, y]) => x === lo && y === hi);
}

export type VisitResult =
  | { ok: true; path: number[]; solved: boolean; message?: never }
  | { ok: false; message: ZipMessage; values?: Record<string, number> };

export type ZipMessage = "startOn1" | "lastMustBeEnd" | "reachInOrder" | "fullButNotEnd" | "wall" | "none";

export function isSolved(puzzle: ZipPuzzle, path: number[]) {
  return path.length === puzzle.size * puzzle.size && puzzle.checkpoints[path[path.length - 1]] === puzzle.count;
}

/** Applies a tap/drag onto `cell`: start, extend, or rewind the path, enforcing the rules. */
export function visit(puzzle: ZipPuzzle, path: number[], cell: number): VisitResult | { ok: true; path: number[]; solved: boolean; unchanged: true } {
  const { size, checkpoints, count } = puzzle;
  if (!path.length) {
    if (checkpoints[cell] === 1) return { ok: true, path: [cell], solved: false };
    return { ok: false, message: "startOn1" };
  }
  const pos = path.indexOf(cell);
  if (pos >= 0) {
    if (pos < path.length - 1) return { ok: true, path: path.slice(0, pos + 1), solved: false };
    return { ok: true, path, solved: isSolved(puzzle, path), unchanged: true };
  }
  const last = path[path.length - 1];
  if (!neighbors(last, size).includes(cell)) return { ok: true, path, solved: false, unchanged: true };
  if (hasWall(puzzle, last, cell)) return { ok: false, message: "wall" };
  if (checkpoints[last] === count) return { ok: false, message: "lastMustBeEnd", values: { count } };
  const reached = path.filter((i) => checkpoints[i]).length;
  if (checkpoints[cell] && checkpoints[cell] !== reached + 1) {
    return { ok: false, message: "reachInOrder", values: { next: reached + 1, target: checkpoints[cell] } };
  }
  const next = [...path, cell];
  const solved = isSolved(puzzle, next);
  if (next.length === size * size && !solved) return { ok: false, message: "fullButNotEnd", values: { count } };
  return { ok: true, path: next, solved };
}

/** Whether a saved path still fits this puzzle (levels can be rebuilt, which makes old saves stale). */
export function isValidPath(puzzle: ZipPuzzle, path: number[]) {
  let current: number[] = [];
  for (const cell of path) {
    const result = visit(puzzle, current, cell);
    if (!result.ok || "unchanged" in result || result.path.length !== current.length + 1) return false;
    current = result.path;
  }
  return true;
}

/** Rewinds to where the path leaves the solution, or adds the next correct cell. */
export function hint(puzzle: ZipPuzzle, path: number[]) {
  let k = 0;
  while (k < path.length && path[k] === puzzle.solution[k]) k++;
  if (k < path.length) return { path: path.slice(0, Math.max(1, k)), kind: "offTrack" as const };
  return { path: puzzle.solution.slice(0, path.length + 1), kind: "added" as const };
}
