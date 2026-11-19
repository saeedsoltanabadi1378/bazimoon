// The daily challenge: one board a day, the same for everyone, picked from the formation library
// with an objective that rotates through the week. The level check plays a year of them.
import { hashString, seeded } from "../../lib/rng";
import type { Goal, RunState, Setup } from "./engine";
import { F, buildBoard } from "./levels";

export type DailyKind = "clear" | "target" | "collect" | "survive" | "combo" | "formation";
const KINDS: DailyKind[] = ["clear", "target", "collect", "survive", "combo", "formation", "clear"];
export const DAILY_TRIES = 3;
export const DAILY_COINS = 50;

const POOL: Record<DailyKind, string[]> = {
  clear: ["pyramid", "crown", "temple", "butterfly", "shield", "hourglass", "skyline", "spiral", "tunnel", "star"],
  target: ["cage", "ring", "eye", "orbit", "maze", "fortress", "keyhole", "rocket", "diamond"],
  collect: ["bowl", "funnel", "bridge", "wall", "corners", "islands", "rain", "dots"],
  survive: ["pair", "wave", "rain", "dots", "checker", "first"],
  combo: ["stripes", "lattice", "grid", "comb", "split", "twin"],
  formation: ["heartM", "xM", "ringM", "arrowM", "smileM", "starM", "diamondM", "crossM"],
};
const SPECIALS = ["", "?", "A", "B", "AB", "H", "V", "?B"];

export interface DailyDef {
  number: number;
  kind: DailyKind;
  count: number | null;
  setup: Setup;
  initial: { bricks: number; marked: number };
}

export function dailyDef(number: number): DailyDef {
  const rng = seeded(`bricks-daily-${number}`);
  const kind = KINDS[(number - 1) % KINDS.length];
  const pool = POOL[kind];
  const f = pool[Math.floor(rng() * pool.length)];
  const sp = SPECIALS[Math.floor(rng() * SPECIALS.length)];
  const balls = 14 + Math.floor(rng() * 4) * 4;
  const base = Math.max(1, Math.round(balls * (kind === "combo" ? 0.5 : kind === "formation" ? 0.65 : 0.85)));
  const comboWish = 8 + Math.floor(rng() * 3);
  const { bricks, rings } = buildBoard({
    rows: F[f], base, sp: sp || undefined, k: sp ? 4 : undefined, mirror: rng() < 0.5, target: kind === "target",
    needRings: kind === "collect" ? 5 : 0, rings: kind === "collect" ? 1 : 0, seed: hashString(`bd${number}`),
  });
  // A combo asks for at most about half the board in one shot.
  const count = kind === "collect" ? 5 : kind === "survive" ? 15 : kind === "combo" ? Math.min(comboWish, Math.max(5, Math.floor(bricks.length * 0.45))) : kind === "clear" ? 8 : null;
  let goal: Goal = { kind: "clear" };
  let flow: Setup["flow"] = "descend";
  let shotLimit: number | null = null;
  let gen: Setup["gen"];
  let round: number | undefined;
  switch (kind) {
    case "clear": flow = "static"; shotLimit = count; break;
    case "target": goal = { kind: "target" }; break;
    case "collect": goal = { kind: "collect", count: 5 }; break;
    case "formation": goal = { kind: "formation" }; break;
    case "combo": goal = { kind: "combo", count: count! }; flow = "static"; shotLimit = 6; break;
    case "survive": goal = { kind: "survive", rounds: count! }; flow = "endless"; round = balls; gen = { hp: 0.8, density: 0, specials: sp ? [...new Set([...sp].map((c) => (c === "A" ? "armor" : c === "B" ? "bomb" : c === "H" ? "hlaser" : c === "V" ? "vlaser" : "mystery")))] : [] }; break;
  }
  return {
    number, kind, count,
    setup: { seed: hashString(`bricks-daily-board-${number}`), balls, bricks, rings, flow, goal, shotLimit, powerups: false, gen, round },
    initial: { bricks: bricks.length, marked: bricks.filter((b) => b.mark).length },
  };
}

/** A daily try's ranking score: points, plus 500 for meeting the objective and 150 per shot left. */
export function dailyScore(s: RunState) {
  if (s.over !== "won") return s.score;
  const left = s.shotLimit !== null ? Math.max(0, s.shotLimit - s.shots) : 0;
  return s.score + 500 + left * 150;
}
