import { seeded, type Rng } from "../../lib/rng";

export interface ZipPuzzle {
  size: number;
  /** A solution path through every cell (cell index = row * size + col). */
  solution: number[];
  /** cell index → checkpoint number (1..count). 1 is the start, count is the end. */
  checkpoints: Record<number, number>;
  count: number;
}

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

/** Board size for a level: small boards to learn on, then bigger ones, with every tenth level a step up. */
export function zipLevelSize(level: number) {
  const base = level <= 3 ? 5 : level <= 15 ? 6 : level <= 40 ? 7 : 8;
  return level % 10 === 0 ? Math.min(8, base + 1) : base;
}

export function generateZip(size: number, seedKey: string): ZipPuzzle {
  const rng = seeded(seedKey);
  const solution = randomPath(size, rng);
  const total = size * size;
  const count = Math.max(6, Math.min(14, Math.round(total * 0.28)));
  const chosen = new Set<number>([0, total - 1]);
  while (chosen.size < count) chosen.add(1 + Math.floor(rng() * (total - 2)));
  const indexes = [...chosen].sort((a, b) => a - b);
  const checkpoints: Record<number, number> = {};
  indexes.forEach((pathIndex, n) => {
    checkpoints[solution[pathIndex]] = n + 1;
  });
  return { size, solution, checkpoints, count };
}

export type VisitResult =
  | { ok: true; path: number[]; solved: boolean; message?: never }
  | { ok: false; message: ZipMessage; values?: Record<string, number> };

export type ZipMessage = "startOn1" | "lastMustBeEnd" | "reachInOrder" | "fullButNotEnd" | "none";

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

/** Rewinds to where the path leaves the stored solution, or adds the next correct cell. */
export function hint(puzzle: ZipPuzzle, path: number[]) {
  let k = 0;
  while (k < path.length && path[k] === puzzle.solution[k]) k++;
  if (k < path.length) return { path: path.slice(0, Math.max(1, k)), kind: "offTrack" as const };
  return { path: puzzle.solution.slice(0, path.length + 1), kind: "added" as const };
}
