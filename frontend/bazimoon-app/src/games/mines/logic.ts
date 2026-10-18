import { seeded } from "../../lib/rng";

export type MinesMode = "daily" | "easy" | "medium" | "hard";

export const modeConfig: Record<MinesMode, { size: number; mines: number }> = {
  daily: { size: 9, mines: 10 },
  easy: { size: 9, mines: 10 },
  medium: { size: 12, mines: 24 },
  hard: { size: 16, mines: 40 },
};

export interface MinesState {
  size: number;
  mineCount: number;
  mines: boolean[] | null;
  revealed: boolean[];
  flags: boolean[];
  status: "play" | "won" | "lost";
  boom: number | null;
}

export function around(i: number, size: number) {
  const r = Math.floor(i / size), c = i % size;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < size && cc >= 0 && cc < size) out.push(rr * size + cc);
    }
  }
  return out;
}

export function countAround(mines: boolean[], i: number, size: number) {
  return around(i, size).filter((j) => mines[j]).length;
}

function placeMines(size: number, count: number, safe: number[], rng: () => number) {
  const mines = new Array<boolean>(size * size).fill(false);
  const banned = new Set(safe);
  let placed = 0;
  while (placed < count) {
    const i = Math.floor(rng() * size * size);
    if (mines[i] || banned.has(i)) continue;
    mines[i] = true;
    placed++;
  }
  return mines;
}

function flood(mines: boolean[], revealed: boolean[], start: number, flags: boolean[], size: number) {
  const rev = [...revealed];
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (rev[i] || flags[i]) continue;
    rev[i] = true;
    if (!mines[i] && countAround(mines, i, size) === 0) {
      for (const j of around(i, size)) if (!rev[j]) stack.push(j);
    }
  }
  return rev;
}

export function blankState(mode: MinesMode): MinesState {
  const { size, mines } = modeConfig[mode];
  return {
    size, mineCount: mines, mines: null,
    revealed: new Array(size * size).fill(false), flags: new Array(size * size).fill(false),
    status: "play", boom: null,
  };
}

/** The daily board is fixed for everyone and starts with the same opening already dug. */
export function dailyState(number: number): MinesState {
  const base = blankState("daily");
  const rng = seeded(`mines-daily-${number}`);
  const center = Math.floor(rng() * 25);
  const start = (2 + Math.floor(center / 5)) * 9 + (2 + (center % 5));
  const mines = placeMines(9, 10, [start, ...around(start, 9)], rng);
  return { ...base, mines, revealed: flood(mines, base.revealed, start, base.flags, 9) };
}

export function open(state: MinesState, cells: number[]): MinesState {
  const { size } = state;
  // First dig of a random board: the tapped cell and its neighbours are always safe.
  const mines = state.mines ?? placeMines(size, state.mineCount, [cells[0], ...around(cells[0], size)], Math.random);
  let rev = state.revealed;
  for (const cell of cells) {
    if (mines[cell]) {
      const all = rev.map((r, k) => r || mines[k]);
      return { ...state, mines, revealed: all, status: "lost", boom: cell };
    }
    rev = flood(mines, rev, cell, state.flags, size);
  }
  const safeLeft = mines.filter((m, j) => !m && !rev[j]).length;
  return { ...state, mines, revealed: rev, status: safeLeft === 0 ? "won" : "play" };
}

/** Tapping an opened number whose mines are all flagged opens the rest of its neighbours. */
export function chord(state: MinesState, i: number): MinesState | null {
  const { mines, size } = state;
  if (!mines || mines[i]) return null;
  const n = countAround(mines, i, size);
  if (!n) return null;
  const near = around(i, size);
  if (near.filter((j) => state.flags[j]).length !== n) return null;
  const toOpen = near.filter((j) => !state.flags[j] && !state.revealed[j]);
  return toOpen.length ? open(state, toOpen) : null;
}

export function toggleFlag(state: MinesState, i: number): MinesState {
  if (state.status !== "play" || state.revealed[i]) return state;
  const flags = [...state.flags];
  flags[i] = !flags[i];
  return { ...state, flags };
}

export function progress(state: MinesState) {
  const total = state.size * state.size - state.mineCount;
  const cleared = state.revealed.filter((r, i) => r && !(state.mines?.[i])).length;
  return { cleared, total, pct: Math.round((cleared / total) * 100), flags: state.flags.filter(Boolean).length, safeLeft: total - cleared };
}

export const numberColors = ["", "#8FA8FF", "#5FD0BE", "#F08A7A", "#B79CF2", "#F0A83A", "#9ED98C", "#EDEBF5", "#EDEBF5"];
