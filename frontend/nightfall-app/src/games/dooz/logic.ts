export type Mark = "X" | "O";
export type Cell = Mark | null;
export type DoozMode = "easy" | "smart" | "big" | "friend";

export const WINS_NEEDED = 3;
export const MAX_ROUNDS = 7;

export function boardSize(mode: DoozMode) {
  return mode === "big" ? 5 : 3;
}

/** In a row needed to win: three on 3 × 3, four on 5 × 5. */
export function lineLength(size: number) {
  return size === 5 ? 4 : 3;
}

/** Every straight run of `len` cells (rows, columns, both diagonals) as lists of indexes. */
export function windows(size: number, len = lineLength(size)): number[][] {
  const out: number[][] = [];
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      for (const [dx, dy] of dirs) {
        const ex = x + dx * (len - 1);
        const ey = y + dy * (len - 1);
        if (ex < 0 || ex >= size || ey < 0 || ey >= size) continue;
        out.push(Array.from({ length: len }, (_, i) => (y + dy * i) * size + (x + dx * i)));
      }
    }
  }
  return out;
}

export function winner(board: Cell[], size: number): { mark: Mark; line: number[] } | null {
  for (const w of windows(size)) {
    const first = board[w[0]];
    if (first && w.every((i) => board[i] === first)) return { mark: first, line: w };
  }
  return null;
}

export function full(board: Cell[]) {
  return board.every((c) => c !== null);
}

/**
 * Scores each empty cell by the lines through it: lines only the bot holds are worth more the
 * fuller they are, and lines only the opponent holds are nearly as valuable to block.
 * This always takes a win and always blocks one, but can be beaten with a fork.
 */
function bestMove(board: Cell[], size: number, me: Mark, rng: () => number): number {
  const them: Mark = me === "X" ? "O" : "X";
  const ws = windows(size);
  for (const mark of [me, them]) {
    for (let i = 0; i < board.length; i++) {
      if (board[i]) continue;
      const next = [...board];
      next[i] = mark;
      if (winner(next, size)) return i;
    }
  }
  let best = -1;
  let bestScore = -Infinity;
  board.forEach((c, i) => {
    if (c) return;
    let score = 0;
    for (const w of ws) {
      if (!w.includes(i)) continue;
      const mine = w.filter((j) => board[j] === me).length;
      const theirs = w.filter((j) => board[j] === them).length;
      if (mine && theirs) continue;
      if (theirs) score += 0.9 * 10 ** theirs;
      else score += 10 ** mine;
    }
    // Slight pull toward the centre, plus a little noise so games differ.
    const cx = (i % size) - (size - 1) / 2;
    const cy = Math.floor(i / size) - (size - 1) / 2;
    score += 0.5 - (Math.abs(cx) + Math.abs(cy)) * 0.1 + rng() * 0.3;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

export function botMove(board: Cell[], size: number, me: Mark, mode: DoozMode, rng: () => number = Math.random): number {
  const empty = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
  if (mode === "easy" && rng() < 0.45) return empty[Math.floor(rng() * empty.length)];
  return bestMove(board, size, me, rng);
}
