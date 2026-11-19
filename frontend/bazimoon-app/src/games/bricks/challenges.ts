// Challenge mode: six categories of five challenges, each with bronze, silver and gold. Medal
// targets come from the same bot that tunes the adventure levels (CHALLENGE_TUNING in pars.ts).
import type { Goal, PowerKey, Setup } from "./engine";
import { F, buildBoard, specialsOf } from "./levels";
import { CHALLENGE_TUNING } from "./pars";

export type ChallengeCategory = "precision" | "survival" | "limited" | "combo" | "clear" | "power";
export const CHALLENGE_CATEGORIES: ChallengeCategory[] = ["precision", "survival", "limited", "combo", "clear", "power"];
export const CHALLENGES_PER_CATEGORY = 5;
export const CHALLENGE_COUNT = CHALLENGE_CATEGORIES.length * CHALLENGES_PER_CATEGORY;

/** shots: fewer is better; rounds and bricks: more is better. */
export type Metric = "shots" | "rounds" | "bricks";
export const METRIC: Record<ChallengeCategory, Metric> = {
  precision: "shots", survival: "rounds", limited: "shots", combo: "bricks", clear: "shots", power: "shots",
};

/** Coins for reaching each medal the first time, by difficulty: [gold, silver, bronze]. */
export const MEDAL_COINS: [number, number, number][] = [[25, 15, 10], [40, 25, 15], [60, 35, 20], [80, 50, 25], [120, 70, 35]];

interface Spec {
  f: string;
  sp?: string;
  k?: number;
  balls: number;
  /** Health of a normal brick as a share of the balls. */
  hp: number;
  given?: Partial<Record<PowerKey, number>>;
  mirror?: boolean;
}

const SPECS: Record<ChallengeCategory, Spec[]> = {
  precision: [
    { f: "cage", balls: 8, hp: 1.2 }, { f: "keyhole", balls: 12, hp: 1.3, sp: "A", k: 4 }, { f: "maze", balls: 16, hp: 1.4 },
    { f: "fortress", balls: 22, hp: 1.5, sp: "A", k: 3 }, { f: "rocket", balls: 28, hp: 1.6, sp: "A@", k: 2 },
  ],
  survival: [
    { f: "pair", balls: 10, hp: 0.9 }, { f: "wave", balls: 18, hp: 1, sp: "?", k: 4 }, { f: "rain", balls: 26, hp: 1.05, sp: "AB", k: 4 },
    { f: "dots", balls: 34, hp: 1.1, sp: "ABH", k: 3 }, { f: "checker", balls: 42, hp: 1.15, sp: "ABHV?", k: 3 },
  ],
  limited: [
    { f: "pyramid", balls: 4, hp: 1.4 }, { f: "twin", balls: 6, hp: 1.6 }, { f: "comb", balls: 8, hp: 1.8, sp: "A", k: 6 },
    { f: "lattice", balls: 10, hp: 2, sp: "@", k: 4 }, { f: "grid", balls: 12, hp: 2.2, sp: "A@", k: 3 },
  ],
  combo: [
    { f: "stripes", balls: 14, hp: 0.6 }, { f: "lattice", balls: 20, hp: 0.65, sp: "B", k: 5 }, { f: "grid", balls: 26, hp: 0.7, sp: "H", k: 6 },
    { f: "hourglass", balls: 32, hp: 0.75, sp: "BV", k: 4 }, { f: "shield", balls: 40, hp: 0.8, sp: "BHV", k: 3 },
  ],
  clear: [
    { f: "arrow", balls: 10, hp: 1.2 }, { f: "butterfly", balls: 16, hp: 1.3, sp: "?", k: 4 }, { f: "tunnel", balls: 22, hp: 1.4, sp: "A", k: 3 },
    { f: "spiral", balls: 28, hp: 1.5, sp: "AB", k: 3 }, { f: "star", balls: 36, hp: 1.6, sp: "AB@", k: 2 },
  ],
  power: [
    { f: "stripes", balls: 3, hp: 3, given: { hlaser: 3 } }, { f: "columns", balls: 4, hp: 3.2, given: { vlaser: 4 } },
    { f: "islands", balls: 5, hp: 3.4, given: { bomb: 3 } }, { f: "cross", balls: 6, hp: 3.6, given: { hlaser: 1, vlaser: 1, bomb: 1 } },
    { f: "grid", balls: 8, hp: 3.8, sp: "A", k: 5, given: { hlaser: 2, vlaser: 2, bomb: 2 } },
  ],
};

export interface ChallengeDef {
  id: number;
  category: ChallengeCategory;
  index: number;
  metric: Metric;
  /** [gold, silver, bronze] targets in the challenge's metric. */
  medals: [number, number, number];
  coins: [number, number, number];
  setup: Setup;
}

export function challengeDef(id: number, tuning?: [number, number, number, number]): ChallengeDef {
  const n = Math.max(1, Math.min(CHALLENGE_COUNT, Math.round(id)));
  const category = CHALLENGE_CATEGORIES[Math.floor((n - 1) / CHALLENGES_PER_CATEGORY)];
  const index = (n - 1) % CHALLENGES_PER_CATEGORY;
  const spec = SPECS[category][index];
  const [scale, gold, silver, bronze] = tuning ?? CHALLENGE_TUNING[n - 1] ?? [1, 5, 7, 9];
  const metric = METRIC[category];
  const base = Math.max(1, Math.round(spec.balls * spec.hp * scale));
  const { bricks, rings } = buildBoard({ rows: F[spec.f], base, sp: spec.sp, k: spec.k, mirror: spec.mirror, target: category === "precision", seed: 9000 + n });
  let goal: Goal = { kind: "clear" };
  let flow: Setup["flow"] = "static";
  let shotLimit: number | null = metric === "shots" ? bronze : null;
  let gen: Setup["gen"];
  let round: number | undefined;
  if (category === "precision") goal = { kind: "target" };
  if (category === "clear") flow = "descend";
  if (category === "combo") { goal = { kind: "combo", count: gold }; shotLimit = 5; }
  if (category === "survival") {
    flow = "endless";
    goal = { kind: "survive", rounds: gold };
    round = spec.balls;
    gen = { hp: spec.hp * scale, density: index >= 3 ? 1 : 0, specials: specialsOf(spec.sp) };
  }
  return {
    id: n, category, index, metric, medals: [gold, silver, bronze], coins: MEDAL_COINS[index],
    setup: { seed: 90000 + n, balls: spec.balls, bricks, rings, flow, goal, shotLimit, powerups: false, given: spec.given, gen, round },
  };
}

/** The medal a result earns: 3 gold, 2 silver, 1 bronze, 0 none. */
export function medalFor(def: ChallengeDef, value: number, finished: boolean): number {
  const [g, s, b] = def.medals;
  if (def.metric === "shots") {
    if (!finished) return 0;
    return value <= g ? 3 : value <= s ? 2 : value <= b ? 1 : 0;
  }
  return value >= g ? 3 : value >= s ? 2 : value >= b ? 1 : 0;
}

/** Whether `a` is a better result than `b` in this challenge's metric. */
export function better(def: ChallengeDef, a: number, b: number | null) {
  if (b === null) return true;
  return def.metric === "shots" ? a < b : a > b;
}
