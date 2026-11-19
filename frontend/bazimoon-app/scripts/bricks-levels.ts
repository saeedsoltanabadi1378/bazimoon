// Plays every Brick Breaker adventure level and challenge with a simple greedy bot (no inventory
// power-ups), and a year of daily challenges. It sets each level's brick health to the hardest the
// bot can still finish, records its shot count as the three-star par, sets challenge medal targets,
// checks no two levels are the same board, and rewrites src/games/bricks/pars.ts.
// Run: npx jiti scripts/bricks-levels.ts
import { readFileSync, writeFileSync } from "node:fs";
import { COLS, ROWS, aimFromAngle, cloneRun, createRun, endShot, runShot, startShot, firePower, type PowerKey, type RunState, type Setup } from "../src/games/bricks/engine";
import { LEVEL_COUNT, levelDef, levelSignature } from "../src/games/bricks/levels";
import { CHALLENGE_COUNT, challengeDef } from "../src/games/bricks/challenges";
import { dailyDef } from "../src/games/bricks/daily";

const ANGLES = Array.from({ length: 33 }, (_, i) => 10 + i * 5);
const NL = "\n";

function value(s: RunState) {
  let hp = 0, target = 0, marked = 0;
  for (const b of s.bricks) {
    hp += b.hp + b.armor;
    if (b.target) target += b.hp + b.armor;
    if (b.mark) marked += b.hp + b.armor;
  }
  const lowest = s.bricks.reduce((m, b) => Math.max(m, b.row), -1);
  return -hp - target * 6 - marked * 3 + s.ringsCollected * 400 + s.balls * 40 - Math.max(0, lowest - 5) * 600 + s.bestShot * 30;
}

/** Spends the board's own power-ups where each does the most. */
function spendGivenPowers(s: RunState) {
  for (const kind of ["bomb", "hlaser", "vlaser"] as const) {
    while ((s.given[kind as PowerKey] ?? 0) > 0 && !s.over) {
      let best: RunState | null = null, bestV = -Infinity;
      for (let row = 0; row < ROWS; row++) for (let col = 0; col < (kind === "hlaser" ? 1 : COLS); col++) {
        if (kind === "vlaser" && row > 0) continue;
        const t = cloneRun(s);
        firePower(t, kind, row, col, []);
        const v = t.over === "won" ? 1e9 : value(t);
        if (v > bestV) { bestV = v; best = t; }
      }
      best!.given[kind as PowerKey] = (s.given[kind as PowerKey] ?? 0) - 1;
      s = Object.assign(s, best!);
    }
  }
  return s;
}

export function play(setup: Setup, maxShots = 40): RunState {
  let s = createRun(setup);
  while (!s.over && s.shots < maxShots) {
    s = spendGivenPowers(s);
    if (s.over) break;
    let best: RunState | null = null, bestV = -Infinity;
    for (const a of ANGLES) {
      const t = cloneRun(s);
      const shot = startShot(t, aimFromAngle(a), false);
      runShot(t, shot);
      endShot(t, shot, false);
      const v = t.over === "won" ? 1e9 - t.shots : t.over === "lost" ? -1e9 + t.bestShot * 1000 + t.round : value(t);
      if (v > bestV) { bestV = v; best = t; }
    }
    s = best!;
  }
  return s;
}

const SCALES = [1, 0.85, 0.72, 0.6, 0.5, 0.42, 0.35, 0.29, 0.24, 0.2, 0.16, 0.13, 0.1];
const problems: string[] = [];
const only = process.argv[2];

// ---- adventure
let levelLines: string | null = null;
if (!only || only === "levels") {
  const tuning: [number, number, number][] = [];
  const seen = new Map<string, number>();
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    let found: [number, number, number] | null = null;
    for (const scale of SCALES) {
      const def = levelDef(n, [scale, 6]);
      const r = play({ ...def.setup, shotLimit: def.objective === "shots" ? null : def.setup.shotLimit });
      if (r.over === "won") { found = [scale, r.shots, Math.round(r.score / 50) * 50]; break; }
    }
    const def = levelDef(n, found ? [found[0], found[1]] : [1, 6]);
    const sig = levelSignature(def);
    if (seen.has(sig)) problems.push(`level ${n} is the same board as level ${seen.get(sig)}`);
    seen.set(sig, n);
    if (def.setup.goal.kind === "collect" && def.setup.goal.count > def.setup.rings.length) problems.push(`level ${n} asks for ${def.setup.goal.count} rings but has ${def.setup.rings.length}`);
    if (!found) problems.push(`level ${n} (${def.objective}) was not finished by the bot at any health`);
    tuning.push(found ?? [1, 6, 0]);
    console.log(`level ${n} (${def.objective}): ${found ? `health ×${found[0]}, par ${found[1]}` : "NOT FINISHED"}`);
  }
  levelLines = tuning.map((p, i) => `[${p[0]}, ${p[1]}, ${p[2]}],${(i + 1) % 10 === 0 ? NL : " "}`).join("");
}

// ---- challenges
let challengeLines: string | null = null;
if (!only || only === "challenges") {
  const tuning: [number, number, number, number][] = [];
  for (let id = 1; id <= CHALLENGE_COUNT; id++) {
    const probe = challengeDef(id, [1, 99, 99, 99]);
    let found: [number, number, number, number] | null = null;
    for (const scale of SCALES) {
      if (probe.metric === "shots") {
        const def = challengeDef(id, [scale, 99, 99, 99]);
        const r = play({ ...def.setup, shotLimit: null }, 25);
        if (r.over === "won") { found = [scale, r.shots, r.shots + 2, r.shots + 4]; break; }
      } else if (probe.metric === "rounds") {
        const gold = 12 + probe.index * 6;
        const def = challengeDef(id, [scale, gold, 0, 0]);
        const r = play(def.setup, gold + 2);
        if (r.over === "won") { found = [scale, gold, Math.round(gold * 0.7), Math.round(gold * 0.45)]; break; }
      } else {
        const gold = 8 + probe.index * 3;
        const def = challengeDef(id, [scale, gold, 0, 0]);
        const r = play(def.setup, 5);
        if (r.over === "won") { found = [scale, gold, Math.round(gold * 0.75), Math.round(gold * 0.5)]; break; }
      }
    }
    if (!found) problems.push(`challenge ${id} (${probe.category}) was not finished by the bot`);
    tuning.push(found ?? [1, 5, 7, 9]);
    console.log(`challenge ${id} (${probe.category}): ${found ? `health ×${found[0]}, medals ${found.slice(1).join("/")}` : "NOT FINISHED"}`);
  }
  challengeLines = tuning.map((p) => `[${p.join(", ")}],`).join(NL);
}

// ---- a year of dailies
if (!only || only === "daily") {
  let lost = 0;
  for (let n = 1; n <= 366; n++) {
    const def = dailyDef(n);
    const r = play(def.setup, 30);
    if (r.over !== "won") { lost++; problems.push(`daily ${n} (${def.kind}) was not finished by the bot`); }
  }
  console.log(`dailies: ${366 - lost} of 366 finished by the bot`);
}

console.log(problems.length ? `${NL}${problems.length} problems:${NL}${problems.join(NL)}` : `${NL}All fine.`);
if (!problems.length) {
  const path = new URL("../src/games/bricks/pars.ts", import.meta.url);
  const old = readFileSync(path, "utf8");
  const keep = (name: string) => {
    const at = old.indexOf(`export const ${name}`);
    if (at < 0) return "";
    const open = old.indexOf("= [", at) + 3;
    return old.slice(open, old.indexOf("];", open)).trim();
  };
  writeFileSync(path, [
    "// Per adventure level: [brick health scale, par shots, bot score], from the level bot in scripts/bricks-levels.ts.",
    `export const LEVEL_TUNING: [number, number, number][] = [${NL}${(levelLines ?? keep("LEVEL_TUNING")).trim()}${NL}];`,
    "",
    "// Per challenge: [brick health scale, gold, silver, bronze], from the same bot.",
    `export const CHALLENGE_TUNING: [number, number, number, number][] = [${NL}${(challengeLines ?? keep("CHALLENGE_TUNING")).trim()}${NL}];`,
    "",
  ].join(NL));
  console.log("Wrote pars.ts");
}
