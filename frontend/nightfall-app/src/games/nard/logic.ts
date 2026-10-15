// Takhte Nard (backgammon) rules engine. Points 1..24; you ("w") move from 24 toward 1 and bear
// off below 1; the bot ("k") moves the other way. The bot is handled by mirroring the board so the
// same move generator serves both sides.

export interface Point {
  w: number;
  k: number;
}

export interface Position {
  pts: (Point | null)[];
  barW: number;
  barK: number;
  offW: number;
  offK: number;
}

export interface Move {
  from: number | "bar";
  to: number | "off";
  d: number;
  /** Index into the remaining dice list. */
  die: number;
  hit: boolean;
}

export type Difficulty = "easy" | "medium" | "hard";

export function startPosition(): Position {
  const pts: (Point | null)[] = [null];
  for (let i = 1; i <= 24; i++) pts.push({ w: 0, k: 0 });
  pts[24]!.w = 2; pts[13]!.w = 5; pts[8]!.w = 3; pts[6]!.w = 5;
  pts[1]!.k = 2; pts[12]!.k = 5; pts[17]!.k = 3; pts[19]!.k = 5;
  return { pts, barW: 0, barK: 0, offW: 0, offK: 0 };
}

export function clone(p: Position): Position {
  return { pts: p.pts.map((x) => (x ? { w: x.w, k: x.k } : null)), barW: p.barW, barK: p.barK, offW: p.offW, offK: p.offK };
}

export function mirror(p: Position): Position {
  const pts: (Point | null)[] = [null];
  for (let i = 1; i <= 24; i++) pts.push({ w: p.pts[25 - i]!.k, k: p.pts[25 - i]!.w });
  return { pts, barW: p.barK, barK: p.barW, offW: p.offK, offK: p.offW };
}

type Single = Omit<Move, "die" | "hit">;

function single(p: Position, d: number): Single[] {
  const out: Single[] = [];
  if (p.barW > 0) {
    const t = 25 - d;
    if (p.pts[t]!.k < 2) out.push({ from: "bar", to: t, d });
    return out;
  }
  let allHome = true;
  let highest = 0;
  for (let i = 1; i <= 24; i++) {
    if (p.pts[i]!.w) {
      if (i > 6) allHome = false;
      highest = Math.max(highest, i);
    }
  }
  for (let q = 24; q >= 1; q--) {
    if (!p.pts[q]!.w) continue;
    const to = q - d;
    if (to >= 1) {
      if (p.pts[to]!.k < 2) out.push({ from: q, to, d });
    } else if (allHome && (to === 0 || q === highest)) {
      out.push({ from: q, to: "off", d });
    }
  }
  return out;
}

export function apply(p: Position, m: Single): Position {
  const n = clone(p);
  if (m.from === "bar") n.barW--;
  else n.pts[m.from]!.w--;
  if (m.to === "off") n.offW++;
  else {
    if (n.pts[m.to]!.k === 1) {
      n.pts[m.to]!.k = 0;
      n.barK++;
    }
    n.pts[m.to]!.w++;
  }
  return n;
}

function maxUse(p: Position, dice: number[]): number {
  if (!dice.length || p.offW === 15) return 0;
  let best = 0;
  const tried = new Set<number>();
  for (let i = 0; i < dice.length; i++) {
    if (tried.has(dice[i])) continue;
    tried.add(dice[i]);
    const rest = [...dice.slice(0, i), ...dice.slice(i + 1)];
    for (const m of single(p, dice[i])) {
      best = Math.max(best, 1 + maxUse(apply(p, m), rest));
      if (best === dice.length) return best;
    }
  }
  return best;
}

const legalCache = new Map<string, Move[]>();

/** Legal single moves for the side to move: they must allow using as many dice as possible, and the higher die when only one can be used. */
export function legal(p: Position, dice: number[]): Move[] {
  const key = JSON.stringify(p) + dice.join(",");
  const cached = legalCache.get(key);
  if (cached) return cached;
  const total = maxUse(p, dice);
  let out: Move[] = [];
  if (total > 0) {
    const tried = new Set<number>();
    for (let i = 0; i < dice.length; i++) {
      if (tried.has(dice[i])) continue;
      tried.add(dice[i]);
      const rest = [...dice.slice(0, i), ...dice.slice(i + 1)];
      for (const m of single(p, dice[i])) {
        if (1 + maxUse(apply(p, m), rest) === total) {
          out.push({ ...m, die: i, hit: m.to !== "off" && p.pts[m.to]!.k === 1 });
        }
      }
    }
    if (total === 1 && dice.length === 2 && dice[0] !== dice[1]) {
      const hi = Math.max(dice[0], dice[1]);
      if (out.some((m) => m.d === hi)) out = out.filter((m) => m.d === hi);
    }
  }
  if (legalCache.size > 5000) legalCache.clear();
  legalCache.set(key, out);
  return out;
}

export function roll(rng: () => number = Math.random): number[] {
  const a = 1 + Math.floor(rng() * 6);
  const b = 1 + Math.floor(rng() * 6);
  return a === b ? [a, a, a, a] : [a, b];
}

export function pips(p: Position) {
  let mine = p.barW * 25;
  let bot = p.barK * 25;
  for (let q = 1; q <= 24; q++) {
    mine += p.pts[q]!.w * q;
    bot += p.pts[q]!.k * (25 - q);
  }
  return { mine, bot };
}

// ---------------------------------------------------------------- bot

/** Bot picks its moves on a mirrored board (so it is "w" moving 24 → 1). */
function heuristicMove(p: Position, options: Move[]): Move {
  let best = options[0];
  let bestScore = -Infinity;
  for (const m of options) {
    let sc = 0;
    if (m.hit) sc += 6;
    if (m.to === "off") sc += 5;
    if (m.to !== "off" && p.pts[m.to]!.w >= 1) sc += 3;
    if (m.to !== "off" && p.pts[m.to]!.w === 0) sc -= 1;
    if (m.from !== "bar" && p.pts[m.from]!.w === 2) sc -= 2;
    sc += (m.from === "bar" ? 25 : m.from) / 24;
    if (sc > bestScore) {
      bestScore = sc;
      best = m;
    }
  }
  return best;
}

/** Static evaluation (from w's side): race lead, made points, safety of single checkers. */
function evaluate(p: Position) {
  const { mine, bot } = pips(p);
  let score = (bot - mine) * 1.0 + p.offW * 4 + p.barK * 12 - p.barW * 12;
  for (let q = 1; q <= 24; q++) {
    const pt = p.pts[q]!;
    if (pt.w >= 2) score += q <= 6 ? 4 : q <= 12 ? 2 : 1;
    if (pt.w === 1) {
      // A blot is in danger when bot checkers sit behind it (higher point numbers are "behind" for k after mirroring).
      let shooters = p.barK;
      for (let s = 1; s < q; s++) if (p.pts[s]!.k > 0 && q - s <= 12) shooters += p.pts[s]!.k * (q - s <= 6 ? 2 : 1);
      score -= Math.min(10, shooters) * (q <= 12 ? 1.2 : 0.8);
    }
  }
  return score;
}

/** Plays a whole turn for the bot; returns the moves made (in mirrored coordinates) and the result. */
export function botPlay(position: Position, dice: number[], difficulty: Difficulty) {
  let mp = mirror(position);
  const played: Move[] = [];
  if (difficulty === "hard") {
    // Search every full sequence and keep the best final position.
    let best: { seq: Move[]; pos: Position; score: number } | null = null;
    const search = (pos: Position, remaining: number[], seq: Move[]) => {
      const opts = legal(pos, remaining);
      if (!opts.length || pos.offW === 15) {
        const score = evaluate(pos);
        if (!best || score > best.score) best = { seq, pos, score };
        return;
      }
      const seen = new Set<string>();
      for (const m of opts) {
        const sig = `${m.from}-${m.to}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        const next = apply(pos, m);
        const rest = [...remaining];
        rest.splice(m.die, 1);
        search(next, rest, [...seq, m]);
      }
    };
    search(mp, [...dice], []);
    const chosen = best as { seq: Move[]; pos: Position; score: number } | null;
    if (chosen) return { moves: chosen.seq, position: mirror(chosen.pos) };
    return { moves: [], position };
  }
  const remaining = [...dice];
  while (remaining.length) {
    const opts = legal(mp, remaining);
    if (!opts.length) break;
    const m = difficulty === "easy" && Math.random() < 0.6 ? opts[Math.floor(Math.random() * opts.length)] : heuristicMove(mp, opts);
    mp = apply(mp, m);
    remaining.splice(m.die, 1);
    played.push(m);
    if (mp.offW === 15) break;
  }
  return { moves: played, position: mirror(mp) };
}

/** Converts a bot move from mirrored coordinates to the board as the player sees it. */
export function describeBotMove(m: Move) {
  const from = m.from === "bar" ? "bar" : String(25 - m.from);
  const to = m.to === "off" ? "off" : String(25 - m.to);
  return { from, to, hit: m.hit };
}
