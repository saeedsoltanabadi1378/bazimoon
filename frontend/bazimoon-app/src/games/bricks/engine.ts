// Brick Breaker: the board, ball physics, shots, rounds and power-ups. Pure and deterministic:
// a run is fully described by its state plus the aim of each shot, so a shot that was cut off
// (the app closed mid-shot) replays to exactly the same result from the state saved before it.
import { hashString, mulberry32, type Rng } from "../../lib/rng";

export const COLS = 7;
/** Brick rows above the danger line. A brick pushed into row ROWS has crossed it. */
export const ROWS = 9;
export const CELL = 50;
export const W = COLS * CELL;
export const LINE = ROWS * CELL;
export const FLOOR = 500;
export const H = 510;
export const R = 5;
const INSET = 2;
const SPEED = 9;
const SUBSTEPS = 3;
/** Shallowest launch angle above flat, and the shallowest a bounce may leave a ball at. */
const MIN_AIM = (7 * Math.PI) / 180;
const MIN_BOUNCE = (4 * Math.PI) / 180;
const LAUNCH_EVERY = 3;
/** After this many frames a shot drifts its balls down, and after the second it ends. */
const DRIFT_AFTER = 1800;
const RECALL_AFTER = 3600;

export type BrickType = "std" | "armor" | "bomb" | "hlaser" | "vlaser" | "mystery";
export type PowerKey = "hlaser" | "vlaser" | "bomb" | "double" | "shield";
export const POWER_KEYS: PowerKey[] = ["hlaser", "vlaser", "bomb", "double", "shield"];
export const SPECIAL_TYPES: BrickType[] = ["armor", "bomb", "hlaser", "vlaser", "mystery"];

export interface Brick {
  id: number;
  row: number;
  col: number;
  hp: number;
  max: number;
  type: BrickType;
  armor: number;
  armorMax: number;
  /** Adventure: the brick a "target" level asks you to break. */
  target?: boolean;
  /** Adventure: part of the formation a "formation" level asks you to finish. */
  mark?: boolean;
}

export interface Ring { id: number; row: number; col: number }

export type Goal =
  | { kind: "endless" }
  | { kind: "clear" }
  | { kind: "target" }
  | { kind: "formation" }
  | { kind: "collect"; count: number }
  | { kind: "survive"; rounds: number }
  | { kind: "combo"; count: number };

/** What happens after a shot: endless adds a new row, descend only moves the board down, static keeps it. */
export type Flow = "endless" | "descend" | "static";

/** Row generation for endless and survival boards. */
export interface RowGen {
  /** Multiplies brick health. */
  hp: number;
  /** Extra bricks per row on top of the round's usual count (can be negative). */
  density: number;
  /** Special bricks allowed, or "rounds" to bring them in by round like Endless does. */
  specials: BrickType[] | "rounds";
}

export interface Setup {
  seed: number;
  balls: number;
  bricks: Omit<Brick, "id">[];
  rings: Omit<Ring, "id">[];
  flow: Flow;
  goal: Goal;
  shotLimit: number | null;
  /** Whether the player's power-up inventory may be used. */
  powerups: boolean;
  /** Power-ups handed out by the level itself (Power-Up challenges), used before the inventory. */
  given?: Partial<Record<PowerKey, number>>;
  gen?: RowGen;
  round?: number;
  score?: number;
}

export interface RunState {
  v: 1;
  seed: number;
  flow: Flow;
  goal: Goal;
  shotLimit: number | null;
  powerups: boolean;
  given: Partial<Record<PowerKey, number>>;
  gen: RowGen;
  round: number;
  startRound: number;
  balls: number;
  score: number;
  lx: number;
  bricks: Brick[];
  rings: Ring[];
  nextId: number;
  shots: number;
  broken: number;
  hits: number;
  ringsCollected: number;
  bestShot: number;
  combo: number;
  bestCombo: number;
  coins: number;
  powersUsed: number;
  over: null | "won" | "lost";
  /** Special brick types that have been on this board, for first-time explanations. */
  seen: BrickType[];
}

export interface Aim { dx: number; dy: number }

export interface Ball { x: number; y: number; vx: number; vy: number; done: boolean; trail: number }

export interface Shot {
  aim: Aim;
  balls: Ball[];
  launched: number;
  timer: number;
  firstX: number | null;
  pending: number;
  broken: number;
  frames: number;
  dmg: number;
  coins: number;
}

export type GameEvent =
  | { type: "launch" }
  | { type: "wall"; x: number; y: number }
  | { type: "hit"; x: number; y: number; hp: number; armored: boolean }
  | { type: "break"; x: number; y: number; color: number; kind: BrickType }
  | { type: "explode"; x: number; y: number; radius: number }
  | { type: "beamH"; row: number }
  | { type: "beamV"; col: number }
  | { type: "ring"; x: number; y: number }
  | { type: "mystery"; x: number; y: number; reward: "coins" | "balls" | "laser"; amount: number }
  | { type: "return"; x: number };

export interface ShotSummary {
  broken: number;
  collected: number;
  comboWord: ComboWord | null;
  comboBonus: number;
  coins: number;
  milestone: number | null;
  shieldUsed: boolean;
  newTypes: BrickType[];
  over: null | "won" | "lost";
}

export type ComboWord = "nice" | "great" | "amazing" | "incredible" | "legendary";

export function comboWord(broken: number): ComboWord | null {
  if (broken >= 20) return "legendary";
  if (broken >= 15) return "incredible";
  if (broken >= 10) return "amazing";
  if (broken >= 7) return "great";
  if (broken >= 4) return "nice";
  return null;
}

/** Health tier 0–6 for colour (green → purple), the same on every board. */
export function tierOf(hp: number) {
  return hp < 5 ? 0 : hp < 10 ? 1 : hp < 20 ? 2 : hp < 40 ? 3 : hp < 80 ? 4 : hp < 160 ? 5 : 6;
}

const rowRng = (seed: number, round: number): Rng => mulberry32(hashString(`${seed}:${round}`));

// ------------------------------------------------------------------ setup

export function createRun(setup: Setup): RunState {
  const s: RunState = {
    v: 1,
    seed: setup.seed,
    flow: setup.flow,
    goal: setup.goal,
    shotLimit: setup.shotLimit,
    powerups: setup.powerups,
    given: { ...(setup.given ?? {}) },
    gen: setup.gen ?? { hp: 1, density: 0, specials: "rounds" },
    round: setup.round ?? 1,
    startRound: setup.round ?? 1,
    balls: setup.balls,
    score: setup.score ?? 0,
    lx: W / 2,
    bricks: [],
    rings: [],
    nextId: 1,
    shots: 0,
    broken: 0,
    hits: 0,
    ringsCollected: 0,
    bestShot: 0,
    combo: 0,
    bestCombo: 0,
    coins: 0,
    powersUsed: 0,
    over: null,
    seen: [],
  };
  for (const b of setup.bricks) s.bricks.push({ ...b, id: s.nextId++ });
  for (const r of setup.rings) s.rings.push({ ...r, id: s.nextId++ });
  if (s.flow === "endless" && !setup.bricks.length) spawnRow(s);
  noteSeen(s);
  return s;
}

export function cloneRun(s: RunState): RunState {
  return JSON.parse(JSON.stringify(s)) as RunState;
}

function noteSeen(s: RunState): BrickType[] {
  const fresh: BrickType[] = [];
  for (const b of s.bricks) {
    if (b.type !== "std" && !s.seen.includes(b.type) && !fresh.includes(b.type)) fresh.push(b.type);
  }
  s.seen.push(...fresh);
  return fresh;
}

/** How many bricks a new endless row has at a round: 2–3 early, up to 4–6 past round 100. */
function rowCount(round: number, rng: Rng, extra: number) {
  const [lo, hi] = round <= 10 ? [2, 3] : round <= 25 ? [3, 4] : round <= 50 ? [3, 5] : round <= 100 ? [4, 5] : [4, 6];
  return Math.max(1, Math.min(6, lo + Math.floor(rng() * (hi - lo + 1)) + extra));
}

function specialFor(round: number, rng: Rng, allowed: BrickType[] | "rounds"): BrickType {
  const r = rng();
  if (allowed === "rounds") {
    if (round >= 40 && r < 0.035) return "vlaser";
    if (round >= 40 && r < 0.07) return "hlaser";
    if (round >= 26 && r < 0.13) return "bomb";
    if (round >= 26 && r < 0.21) return "armor";
    if (round >= 12 && r < 0.26) return "mystery";
    return "std";
  }
  if (!allowed.length || r > 0.3) return "std";
  return allowed[Math.floor(rng() * allowed.length)];
}

/** Brick health for a row at a round. Grows a little faster than one +1 a round past round 50. */
export function rowHealth(round: number, rng: Rng, scale: number) {
  const growth = 1 + Math.max(0, round - 50) / 220;
  let hp = Math.max(1, Math.round(round * growth * scale * (0.8 + rng() * 0.5)));
  const doubleChance = round <= 10 ? 0 : round <= 50 ? 0.18 : 0.28;
  if (rng() < doubleChance) hp *= 2;
  return hp;
}

/** Adds a new row at the top with one +1 ring in a free cell. Every row leaves at least one gap. */
export function spawnRow(s: RunState) {
  const rng = rowRng(s.seed, s.round);
  const n = rowCount(s.round, rng, s.gen.density);
  const cols = [0, 1, 2, 3, 4, 5, 6];
  for (let i = cols.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cols[i], cols[j]] = [cols[j], cols[i]];
  }
  const used = cols.slice(0, n);
  const free = cols.slice(n);
  for (const col of used) {
    const hp = rowHealth(s.round, rng, s.gen.hp);
    const type = specialFor(s.round, rng, s.gen.specials);
    const armor = type === "armor" ? Math.max(2, Math.round(hp * 0.5)) : 0;
    s.bricks.push({ id: s.nextId++, row: 0, col, hp, max: hp, type, armor, armorMax: armor });
  }
  if (free.length) s.rings.push({ id: s.nextId++, row: 0, col: free[Math.floor(rng() * free.length)] });
}

// ------------------------------------------------------------------ geometry

type Cells = Map<number, Brick>;

function cellsOf(s: RunState): Cells {
  const m: Cells = new Map();
  for (const b of s.bricks) if (b.row >= 0 && b.row < ROWS + 1) m.set(b.row * COLS + b.col, b);
  return m;
}

/** The brick the ball overlaps most, with the push-out normal, or null. */
function overlap(cells: Cells, x: number, y: number): { brick: Brick; nx: number; ny: number; depth: number } | null {
  const c0 = Math.floor((x - R) / CELL), c1 = Math.floor((x + R) / CELL);
  const r0 = Math.floor((y - R) / CELL), r1 = Math.floor((y + R) / CELL);
  let best: { brick: Brick; nx: number; ny: number; depth: number } | null = null;
  for (let r = r0; r <= r1; r++) {
    if (r < 0) continue;
    for (let c = c0; c <= c1; c++) {
      if (c < 0 || c >= COLS) continue;
      const brick = cells.get(r * COLS + c);
      if (!brick) continue;
      const x0 = c * CELL + INSET, x1 = (c + 1) * CELL - INSET;
      const y0 = r * CELL + INSET, y1 = (r + 1) * CELL - INSET;
      const cx = Math.max(x0, Math.min(x, x1)), cy = Math.max(y0, Math.min(y, y1));
      let dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= R * R) continue;
      let depth: number;
      if (d2 === 0) {
        // The centre is inside the brick: push out along the shortest side.
        const left = x - x0, right = x1 - x, top = y - y0, bottom = y1 - y;
        const m = Math.min(left, right, top, bottom);
        dx = m === left ? -1 : m === right ? 1 : 0;
        dy = m === top ? -1 : m === bottom ? 1 : 0;
        if (dx && dy) dy = 0;
        depth = R + m;
      } else {
        const d = Math.sqrt(d2);
        dx /= d;
        dy /= d;
        depth = R - d;
      }
      if (!best || depth > best.depth) best = { brick, nx: dx, ny: dy, depth };
    }
  }
  return best;
}

/** Keeps a ball at full speed and never flatter than MIN_BOUNCE, so it cannot skate sideways forever. */
function settle(b: { vx: number; vy: number }) {
  const sp = Math.hypot(b.vx, b.vy) || 1;
  b.vx = (b.vx / sp) * SPEED;
  b.vy = (b.vy / sp) * SPEED;
  const min = SPEED * Math.sin(MIN_BOUNCE);
  if (Math.abs(b.vy) < min) {
    b.vy = (b.vy < 0 ? -1 : 1) * min;
    b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(SPEED * SPEED - min * min);
  }
}

function reflect(b: { vx: number; vy: number }, nx: number, ny: number) {
  const dot = b.vx * nx + b.vy * ny;
  if (dot < 0) {
    b.vx -= 2 * dot * nx;
    b.vy -= 2 * dot * ny;
  }
  settle(b);
}

/** A valid aim from a pointer position, or null when it is not above the launcher. */
export function aimAt(s: RunState, px: number, py: number): Aim | null {
  const dx = px - s.lx, dy = py - (FLOOR - R);
  if (dy > -12) return null;
  return clampAim(dx, dy);
}

export function clampAim(dx: number, dy: number): Aim {
  const len = Math.hypot(dx, dy) || 1;
  let ax = dx / len, ay = dy / len;
  if (ay > -Math.sin(MIN_AIM)) {
    ay = -Math.sin(MIN_AIM);
    ax = (ax < 0 ? -1 : 1) * Math.cos(MIN_AIM);
  }
  return { dx: ax, dy: ay };
}

/** Aim from an angle in degrees above flat (0 = right, 180 = left). */
export function aimFromAngle(deg: number): Aim {
  const a = (Math.max(7, Math.min(173, deg)) * Math.PI) / 180;
  return { dx: Math.cos(a), dy: -Math.sin(a) };
}

export function angleOf(aim: Aim) {
  return (Math.atan2(-aim.dy, aim.dx) * 180) / Math.PI;
}

/**
 * The aiming guide: the path to the first thing the ball touches, then one bounce on to the next.
 * Uses the same collision rules as a real ball, so what you see is what the first ball does.
 */
export function guide(s: RunState, aim: Aim): { points: { x: number; y: number }[]; contacts: { x: number; y: number }[] } {
  const cells = cellsOf(s);
  const b = { x: s.lx, y: FLOOR - R, vx: aim.dx * SPEED, vy: aim.dy * SPEED };
  const points: { x: number; y: number }[] = [{ x: b.x, y: b.y }];
  const contacts: { x: number; y: number }[] = [];
  let after = 0;
  for (let i = 0; i < 2400; i++) {
    b.x += b.vx / SUBSTEPS;
    b.y += b.vy / SUBSTEPS;
    let touched = false;
    if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); settle(b); touched = true; }
    else if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); settle(b); touched = true; }
    if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); settle(b); touched = true; }
    const hit = overlap(cells, b.x, b.y);
    if (hit) {
      b.x += hit.nx * hit.depth;
      b.y += hit.ny * hit.depth;
      reflect(b, hit.nx, hit.ny);
      touched = true;
    }
    if (touched) {
      contacts.push({ x: b.x, y: b.y });
      points.push({ x: b.x, y: b.y });
      if (contacts.length >= 2) break;
    }
    if (contacts.length === 1) {
      after += SPEED / SUBSTEPS;
      if (after > 140) { points.push({ x: b.x, y: b.y }); break; }
    }
    if (b.vy > 0 && b.y >= FLOOR - R) { points.push({ x: b.x, y: b.y }); break; }
  }
  return { points, contacts };
}

// ------------------------------------------------------------------ damage

function effectDamage(s: RunState) {
  return Math.max(1, Math.ceil(s.balls / 2));
}

function centre(b: Brick) {
  return { x: b.col * CELL + CELL / 2, y: b.row * CELL + CELL / 2 };
}

interface DamageCtx { s: RunState; cells: Cells; shot: Shot | null; events: GameEvent[] }

/** Takes `amount` off a brick (armor first). Returns true when it broke. */
function damage(ctx: DamageCtx, b: Brick, amount: number): boolean {
  if (b.hp <= 0) return false;
  if (b.armor > 0) {
    const a = Math.min(b.armor, amount);
    b.armor -= a;
    amount -= a;
    if (amount <= 0) return false;
  }
  b.hp = Math.max(0, b.hp - amount);
  if (b.hp === 0) {
    destroy(ctx, b);
    return true;
  }
  return false;
}

function destroy(ctx: DamageCtx, b: Brick) {
  const { s, cells, events } = ctx;
  cells.delete(b.row * COLS + b.col);
  s.score += 25;
  s.broken++;
  if (ctx.shot) ctx.shot.broken++;
  const c = centre(b);
  events.push({ type: "break", x: c.x, y: c.y, color: tierOf(b.max), kind: b.type });
  const d = effectDamage(s);
  const live = () => s.bricks.filter((o) => o.hp > 0 && o !== b);
  if (b.type === "bomb") {
    events.push({ type: "explode", x: c.x, y: c.y, radius: CELL * 1.5 });
    for (const o of live()) if (Math.abs(o.row - b.row) <= 1 && Math.abs(o.col - b.col) <= 1) damage(ctx, o, d);
  } else if (b.type === "hlaser") {
    events.push({ type: "beamH", row: b.row });
    for (const o of live()) if (o.row === b.row) damage(ctx, o, d);
  } else if (b.type === "vlaser") {
    events.push({ type: "beamV", col: b.col });
    for (const o of live()) if (o.col === b.col) damage(ctx, o, d);
  } else if (b.type === "mystery") {
    const roll = hashString(`${s.seed}:m:${b.id}`) % 3;
    if (roll === 0) {
      const amount = 10;
      s.coins += amount;
      if (ctx.shot) ctx.shot.coins += amount;
      events.push({ type: "mystery", x: c.x, y: c.y, reward: "coins", amount });
    } else if (roll === 1) {
      if (ctx.shot) ctx.shot.pending += 2;
      else s.balls += 2;
      events.push({ type: "mystery", x: c.x, y: c.y, reward: "balls", amount: 2 });
    } else {
      events.push({ type: "mystery", x: c.x, y: c.y, reward: "laser", amount: 0 });
      events.push({ type: "beamH", row: b.row });
      for (const o of live()) if (o.row === b.row) damage(ctx, o, d);
    }
  }
}

function prune(s: RunState) {
  s.bricks = s.bricks.filter((b) => b.hp > 0);
}

// ------------------------------------------------------------------ shots

export function startShot(_s: RunState, aim: Aim, double: boolean): Shot {
  return { aim, balls: [], launched: 0, timer: 0, firstX: null, pending: 0, broken: 0, frames: 0, dmg: double ? 2 : 1, coins: 0 };
}

/** Advances a shot by one 60 Hz frame. Returns true once every ball is back. */
export function stepShot(s: RunState, shot: Shot, events: GameEvent[], cache?: { cells: Cells | null }): boolean {
  shot.frames++;
  if (shot.launched < s.balls) {
    if (shot.timer <= 0) {
      shot.balls.push({ x: s.lx, y: FLOOR - R, vx: shot.aim.dx * SPEED, vy: shot.aim.dy * SPEED, done: false, trail: 0 });
      shot.launched++;
      shot.timer = LAUNCH_EVERY;
      events.push({ type: "launch" });
    } else shot.timer--;
  }
  const cells = cache?.cells ?? cellsOf(s);
  if (cache) cache.cells = cells;
  const ctx: DamageCtx = { s, cells, shot, events };
  const brokenBefore = s.broken;
  for (const b of shot.balls) {
    if (b.done) {
      if (shot.firstX !== null) b.x += (shot.firstX - b.x) * 0.22;
      continue;
    }
    if (shot.frames > RECALL_AFTER) {
      b.done = true;
      b.y = FLOOR - R;
      if (shot.firstX === null) shot.firstX = clampX(b.x);
      continue;
    }
    if (shot.frames > DRIFT_AFTER && b.vy > -SPEED) {
      b.vy += 0.04;
    }
    for (let i = 0; i < SUBSTEPS && !b.done; i++) moveBall(ctx, b);
  }
  if (s.broken !== brokenBefore) prune(s);
  return shot.launched >= s.balls && shot.balls.every((b) => b.done);
}

function clampX(x: number) {
  return Math.max(R + 2, Math.min(W - R - 2, x));
}

function moveBall(ctx: DamageCtx, b: Ball) {
  const { s, shot, events, cells } = ctx;
  b.x += b.vx / SUBSTEPS;
  b.y += b.vy / SUBSTEPS;
  if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); settle(b); events.push({ type: "wall", x: b.x, y: b.y }); }
  else if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); settle(b); events.push({ type: "wall", x: b.x, y: b.y }); }
  if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); settle(b); events.push({ type: "wall", x: b.x, y: b.y }); }
  const hit = overlap(cells, b.x, b.y);
  if (hit) {
    b.x += hit.nx * hit.depth;
    b.y += hit.ny * hit.depth;
    reflect(b, hit.nx, hit.ny);
    s.hits++;
    s.score += 5;
    const brick = hit.brick;
    const armored = brick.armor > 0;
    events.push({ type: "hit", x: b.x - hit.nx * R, y: b.y - hit.ny * R, hp: brick.hp, armored });
    damage(ctx, brick, shot!.dmg);
  }
  for (const r of s.rings) {
    if (r.row < 0) continue;
    const dx = b.x - (r.col * CELL + CELL / 2), dy = b.y - (r.row * CELL + CELL / 2);
    if (dx * dx + dy * dy < (R + 12) * (R + 12)) {
      events.push({ type: "ring", x: r.col * CELL + CELL / 2, y: r.row * CELL + CELL / 2 });
      r.row = -100;
      shot!.pending++;
      s.ringsCollected++;
    }
  }
  if (b.vy > 0 && b.y >= FLOOR - R) {
    b.y = FLOOR - R;
    b.done = true;
    if (shot!.firstX === null) {
      shot!.firstX = clampX(b.x);
      events.push({ type: "return", x: shot!.firstX });
    }
  }
}

/** Runs a whole shot with no drawing (used to finish a shot that was cut off, and by tests). */
export function runShot(s: RunState, shot: Shot, events: GameEvent[] = []) {
  const cache = { cells: null as Cells | null };
  let guard = 0;
  while (!stepShot(s, shot, events, cache) && guard++ < RECALL_AFTER + 10) {
    if (events.length > 2000) events.length = 0;
  }
}

function goalMet(s: RunState, shot: Shot | null): boolean {
  switch (s.goal.kind) {
    case "clear": return s.bricks.length === 0;
    case "target": return !s.bricks.some((b) => b.target);
    case "formation": return !s.bricks.some((b) => b.mark);
    case "collect": return s.ringsCollected >= s.goal.count;
    case "combo": return (shot?.broken ?? 0) >= s.goal.count;
    default: return false;
  }
}

/** Progress toward the level's objective, for the HUD: [done, of]. */
export function goalProgress(s: RunState, initial: { bricks: number; marked: number }): [number, number] {
  switch (s.goal.kind) {
    case "clear": return [initial.bricks - s.bricks.length, initial.bricks];
    case "target": return [s.bricks.some((b) => b.target) ? 0 : 1, 1];
    case "formation": return [initial.marked - s.bricks.filter((b) => b.mark).length, initial.marked];
    case "collect": return [Math.min(s.goal.count, s.ringsCollected), s.goal.count];
    case "survive": return [Math.min(s.goal.rounds, s.round - s.startRound), s.goal.rounds];
    case "combo": return [Math.min(s.goal.count, s.bestShot), s.goal.count];
    default: return [s.round, 0];
  }
}

/**
 * Finishes a shot: combo bonus, collected balls, then the round change for the board's flow and the
 * win or loss. `shield` says whether a Second Chance is available; the summary says if it was used.
 */
export function endShot(s: RunState, shot: Shot, shield: boolean): ShotSummary {
  prune(s);
  const broken = shot.broken;
  const comboBonus = broken > 3 ? 10 * (broken - 3) : 0;
  s.score += comboBonus;
  s.bestShot = Math.max(s.bestShot, broken);
  s.combo = broken >= 4 ? s.combo + 1 : 0;
  s.bestCombo = Math.max(s.bestCombo, s.combo);
  const collected = shot.pending;
  s.balls += shot.pending;
  if (shot.firstX !== null) s.lx = shot.firstX;
  s.shots++;
  s.rings = s.rings.filter((r) => r.row >= 0);
  const summary: ShotSummary = {
    broken, collected, comboWord: comboWord(broken), comboBonus, coins: shot.coins, milestone: null, shieldUsed: false, newTypes: [], over: null,
  };

  if (goalMet(s, shot)) {
    s.over = "won";
    summary.over = "won";
    return summary;
  }

  if (s.flow !== "static") {
    for (const b of s.bricks) b.row++;
    for (const r of s.rings) r.row++;
    const auto = s.rings.filter((r) => r.row >= ROWS);
    if (auto.length) {
      s.balls += auto.length;
      s.ringsCollected += auto.length;
      summary.collected += auto.length;
      s.rings = s.rings.filter((r) => r.row < ROWS);
    }
  }
  if (s.flow === "endless") {
    s.round++;
    s.score += 50;
    if ((s.round - 1) % 10 === 0 && s.goal.kind === "endless") {
      summary.milestone = s.round - 1;
    }
    spawnRow(s);
  } else if (s.flow === "descend") {
    s.round++;
  }

  if (s.bricks.some((b) => b.row >= ROWS)) {
    if (shield) {
      // Second Chance: the bricks that reached the line go, and the row above them too, so the
      // next shot is never lost before it is taken.
      s.bricks = s.bricks.filter((b) => b.row < ROWS - 1);
      summary.shieldUsed = true;
    } else {
      s.over = "lost";
      summary.over = "lost";
      return summary;
    }
  }

  if (goalMet(s, null) && s.goal.kind !== "combo") {
    s.over = "won";
    summary.over = "won";
    return summary;
  }
  if (s.goal.kind === "survive" && s.round - s.startRound >= s.goal.rounds) {
    s.over = "won";
    summary.over = "won";
    return summary;
  }
  if (s.shotLimit !== null && s.shots >= s.shotLimit) {
    s.over = "lost";
    summary.over = "lost";
    return summary;
  }
  if (s.flow !== "endless" && s.goal.kind !== "survive" && s.bricks.length === 0 && s.rings.length === 0) {
    // Nothing left to hit or collect and the goal still not met.
    s.over = "lost";
    summary.over = "lost";
    return summary;
  }
  summary.newTypes = noteSeen(s);
  return summary;
}

/** Bricks sitting in the last row above the line: the next row change would end the run. */
export function inDanger(s: RunState) {
  return s.flow !== "static" && s.bricks.some((b) => b.row >= ROWS - 1);
}

// ------------------------------------------------------------------ power-ups

/** Fires a laser along a row or column, or drops a bomb on a cell, for the player's full ball count. */
export function firePower(s: RunState, kind: "hlaser" | "vlaser" | "bomb", row: number, col: number, events: GameEvent[]): number {
  const cells = cellsOf(s);
  const ctx: DamageCtx = { s, cells, shot: null, events };
  const d = Math.max(1, s.balls);
  const before = s.broken;
  if (kind === "hlaser") {
    events.push({ type: "beamH", row });
    for (const b of [...s.bricks]) if (b.row === row) damage(ctx, b, d);
  } else if (kind === "vlaser") {
    events.push({ type: "beamV", col });
    for (const b of [...s.bricks]) if (b.col === col) damage(ctx, b, d);
  } else {
    events.push({ type: "explode", x: col * CELL + CELL / 2, y: row * CELL + CELL / 2, radius: CELL * 1.6 });
    for (const b of [...s.bricks]) {
      const dr = b.row - row, dc = b.col - col;
      if (dr * dr + dc * dc <= 2.25) damage(ctx, b, d);
    }
  }
  prune(s);
  s.powersUsed++;
  const broken = s.broken - before;
  s.bestShot = Math.max(s.bestShot, broken);
  if (goalMet(s, null) && s.goal.kind !== "combo") s.over = "won";
  return broken;
}

/** Cell under a board point, or null outside the brick area. */
export function cellAt(x: number, y: number): { row: number; col: number } | null {
  if (y < 0 || y >= LINE || x < 0 || x >= W) return null;
  return { row: Math.floor(y / CELL), col: Math.floor(x / CELL) };
}
