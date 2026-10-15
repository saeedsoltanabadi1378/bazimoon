export type Dir = "up" | "down" | "left" | "right";

export interface MergeState {
  size: number;
  grid: number[];
  score: number;
  moves: number;
  undos: number;
  undosUsed: number;
  prev: { grid: number[]; score: number } | null;
  won: boolean;
  keepGoing: boolean;
}

export function emptyGrid(size: number) {
  return new Array<number>(size * size).fill(0);
}

export function spawn(grid: number[], rng: () => number = Math.random) {
  const empty = grid.flatMap((v, i) => (v ? [] : [i]));
  if (!empty.length) return grid;
  const next = [...grid];
  next[empty[Math.floor(rng() * empty.length)]] = rng() < 0.9 ? 2 : 4;
  return next;
}

export function newGame(size: number, undos = 3): MergeState {
  return { size, grid: spawn(spawn(emptyGrid(size))), score: 0, moves: 0, undos, undosUsed: 0, prev: null, won: false, keepGoing: false };
}

function slideLine(line: number[]) {
  const tiles = line.filter(Boolean);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      out.push(tiles[i] * 2);
      gained += tiles[i] * 2;
      i++;
    } else {
      out.push(tiles[i]);
    }
  }
  while (out.length < line.length) out.push(0);
  return { out, gained };
}

function index(size: number, dir: Dir, line: number, k: number) {
  if (dir === "left") return line * size + k;
  if (dir === "right") return line * size + (size - 1 - k);
  if (dir === "up") return k * size + line;
  return (size - 1 - k) * size + line;
}

export function canMove(grid: number[], size: number) {
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i]) return true;
    if (i % size < size - 1 && grid[i] === grid[i + 1]) return true;
    if (i < grid.length - size && grid[i] === grid[i + size]) return true;
  }
  return false;
}

/** Slides every row/column toward `dir`, merging equal neighbours once; null when nothing moves. */
export function move(state: MergeState, dir: Dir, rng: () => number = Math.random): MergeState | null {
  const { size } = state;
  const grid = [...state.grid];
  let gained = 0;
  let changed = false;
  for (let line = 0; line < size; line++) {
    const cells = Array.from({ length: size }, (_, k) => grid[index(size, dir, line, k)]);
    const { out, gained: g } = slideLine(cells);
    gained += g;
    out.forEach((v, k) => {
      const at = index(size, dir, line, k);
      if (grid[at] !== v) changed = true;
      grid[at] = v;
    });
  }
  if (!changed) return null;
  const next = spawn(grid, rng);
  return {
    ...state,
    grid: next,
    score: state.score + gained,
    moves: state.moves + 1,
    prev: { grid: state.grid, score: state.score },
    won: state.won || next.includes(2048),
  };
}

export const tileStyles: Record<number, [string, string]> = {
  0: ["#1A1D33", "#1A1D33"], 2: ["#262A44", "#EDEBF5"], 4: ["#30355A", "#EDEBF5"], 8: ["#3E3A78", "#EDEBF5"],
  16: ["#54449E", "#F4F2FF"], 32: ["#6E55C4", "#F4F2FF"], 64: ["#9C8CFF", "#120D2E"], 128: ["#5FD0BE", "#0B1F1B"],
  256: ["#3FB8A6", "#0B1F1B"], 512: ["#F0A83A", "#1A1206"], 1024: ["#E5604D", "#1C0905"], 2048: ["#F6C377", "#1A1206"],
};

export function tileStyle(v: number): [string, string] {
  return tileStyles[v] ?? ["#F6C377", "#1A1206"];
}
