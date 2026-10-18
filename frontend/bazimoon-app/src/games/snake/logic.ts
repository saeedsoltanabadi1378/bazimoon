import { seeded } from "../../lib/rng";

export const SIZE = 15;
export const GOLD_EVERY = 5;
export type Dir = "up" | "down" | "left" | "right";
export type SnakeMode = "classic" | "daily" | "wrap";
export interface Cell { x: number; y: number }

export interface SnakeState {
  body: Cell[]; // head first
  dir: Dir;
  food: Cell;
  gold: boolean;
  eaten: number;
  score: number;
  /** Index into the fruit sequence, so the daily drops fruit on the same spots for everyone. */
  next: number;
  dead: boolean;
}

const delta: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const opposite: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

/** Fruit spots in order. The daily uses the day's seed so the pattern is shared. */
export function fruitSequence(seedKey: string, length = 600): Cell[] {
  const rng = seeded(seedKey);
  return Array.from({ length }, () => ({ x: Math.floor(rng() * SIZE), y: Math.floor(rng() * SIZE) }));
}

/** The next fruit spot in the sequence; if the snake is on it, the next free cell in reading order. */
function placeFood(body: Cell[], seq: Cell[], index: number): Cell {
  const wanted = seq[index % seq.length];
  const taken = new Set(body.map((c) => c.y * SIZE + c.x));
  for (let i = 0; i < SIZE * SIZE; i++) {
    const at = (wanted.y * SIZE + wanted.x + i) % (SIZE * SIZE);
    if (!taken.has(at)) return { x: at % SIZE, y: Math.floor(at / SIZE) };
  }
  return wanted;
}

export function start(seq: Cell[]): SnakeState {
  const mid = Math.floor(SIZE / 2);
  const body = [{ x: mid - 2, y: mid }, { x: mid - 3, y: mid }, { x: mid - 4, y: mid }];
  return { body, dir: "right", food: placeFood(body, seq, 0), gold: false, eaten: 0, score: 0, next: 1, dead: false };
}

export function canTurn(current: Dir, next: Dir) {
  return next !== current && next !== opposite[current];
}

/** Milliseconds per step: starts at 150 and speeds up with every fruit, down to 70 (100 with no walls). */
export function stepMs(eaten: number, mode: SnakeMode) {
  return Math.max(mode === "wrap" ? 100 : 70, 150 - eaten * 4);
}

export function step(state: SnakeState, dir: Dir, mode: SnakeMode, seq: Cell[]): SnakeState {
  if (state.dead) return state;
  const d = delta[dir];
  let head = { x: state.body[0].x + d.x, y: state.body[0].y + d.y };
  if (mode === "wrap") head = { x: (head.x + SIZE) % SIZE, y: (head.y + SIZE) % SIZE };
  else if (head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE) return { ...state, dir, dead: true };

  const eats = head.x === state.food.x && head.y === state.food.y;
  // The tail moves away this step unless the snake grows, so it is safe to move into.
  const rest = eats ? state.body : state.body.slice(0, -1);
  if (rest.some((c) => c.x === head.x && c.y === head.y)) return { ...state, dir, dead: true };

  const body = [head, ...rest];
  if (!eats) return { ...state, body, dir };
  const eaten = state.eaten + 1;
  return {
    ...state, body, dir, eaten,
    score: state.score + (state.gold ? 3 : 1),
    food: placeFood(body, seq, state.next),
    next: state.next + 1,
    gold: eaten % GOLD_EVERY === GOLD_EVERY - 1,
  };
}
