// Everything a Brick Breaker player keeps between visits: coins, power-ups, cosmetics, stars,
// medals, daily tries, missions, achievements, lifetime stats and settings. Kept on this device
// (like the other solo games' adventure progress); scores and rankings also go to the server.
import { useSyncExternalStore } from "react";
import { puzzleToday } from "../../lib/format";
import { seeded } from "../../lib/rng";
import { readLocal, removeLocal, writeLocal } from "../../lib/storage";
import { POWER_KEYS, type BrickType, type PowerKey, type RunState } from "./engine";
import { POWER_PRICE, STARTING_OWNED, priceOf } from "./cosmetics";
import { LEVEL_COUNT, LEVELS_PER_WORLD, WORLDS, WORLD_COINS, WORLD_KEYS, WORLD_REWARD } from "./levels";
import { CHALLENGE_COUNT, MEDAL_COINS } from "./challenges";

const KEY = "bazimoon-bricks";

export interface Settings {
  music: number;
  sound: number;
  vibration: boolean;
  /** 0 off, 1 low, 2 full. */
  trail: 0 | 1 | 2;
  particles: 0 | 1 | 2;
  colorblind: boolean;
  reducedMotion: boolean;
  guide: boolean;
  confirm: boolean;
  ranked: boolean;
}

export interface Stats {
  endlessGames: number;
  bricks: number;
  balls: number;
  shots: number;
  dailies: number;
  powers: number;
  coinsEarned: number;
  timeMs: number;
  bestScore: number;
  bestRound: number;
  bestShot: number;
  bestCombo: number;
  bestDailyStreak: number;
}

export interface MissionState { id: string; progress: number; done: boolean }

export interface Profile {
  v: 1;
  coins: number;
  inv: Record<PowerKey, number>;
  owned: string[];
  equipped: { ball: string; trail: string; theme: string };
  /** Stars per adventure level (index = level - 1). */
  stars: number[];
  worldsRewarded: number[];
  /** Best medal per challenge (0–3) and best result in its metric. */
  medals: number[];
  challengeBest: (number | null)[];
  daily: { number: number; tries: number; best: number | null; done: boolean };
  dailyHistory: { number: number; best: number | null; done: boolean }[];
  streak: { count: number; last: string | null };
  missions: { date: string; list: MissionState[] };
  achievements: Record<string, string>;
  stats: Stats;
  settings: Settings;
  tips: { tutorial: boolean; adventure: boolean; bricks: BrickType[]; powers: PowerKey[] };
  lastRun: string | null;
}

const prefersReducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

function freshProfile(): Profile {
  return {
    v: 1,
    coins: 0,
    inv: { hlaser: 2, vlaser: 2, bomb: 2, double: 2, shield: 1 },
    owned: [...STARTING_OWNED],
    equipped: { ball: "classic", trail: "glow", theme: "classic" },
    stars: Array(LEVEL_COUNT).fill(0),
    worldsRewarded: [],
    medals: Array(CHALLENGE_COUNT).fill(0),
    challengeBest: Array(CHALLENGE_COUNT).fill(null),
    daily: { number: 0, tries: 0, best: null, done: false },
    dailyHistory: [],
    streak: { count: 0, last: null },
    missions: { date: "", list: [] },
    achievements: {},
    stats: { endlessGames: 0, bricks: 0, balls: 0, shots: 0, dailies: 0, powers: 0, coinsEarned: 0, timeMs: 0, bestScore: 0, bestRound: 0, bestShot: 0, bestCombo: 0, bestDailyStreak: 0 },
    settings: { music: 40, sound: 70, vibration: true, trail: 2, particles: 2, colorblind: false, reducedMotion: prefersReducedMotion(), guide: true, confirm: true, ranked: true },
    tips: { tutorial: false, adventure: false, bricks: [], powers: [] },
    lastRun: null,
  };
}

function load(): Profile {
  const saved = readLocal<Partial<Profile> | null>(KEY, null);
  const base = freshProfile();
  if (!saved || saved.v !== 1) return base;
  // Merge field by field so a profile from an older build picks up anything new.
  return {
    ...base,
    ...saved,
    inv: { ...base.inv, ...saved.inv },
    equipped: { ...base.equipped, ...saved.equipped },
    stars: base.stars.map((_, i) => saved.stars?.[i] ?? 0),
    medals: base.medals.map((_, i) => saved.medals?.[i] ?? 0),
    challengeBest: base.challengeBest.map((_, i) => saved.challengeBest?.[i] ?? null),
    stats: { ...base.stats, ...saved.stats },
    settings: { ...base.settings, ...saved.settings },
    tips: { ...base.tips, ...saved.tips },
  } as Profile;
}

// ------------------------------------------------------------------ notices

/** Something to tell the player without stopping play: a reward, an unlock, a finished mission. */
export type Notice =
  | { kind: "achievement"; id: string; coins: number }
  | { kind: "mission"; id: string; coins: number }
  | { kind: "streak"; days: number; coins: number; item: string | null }
  | { kind: "world"; world: number; items: string[]; coins: number }
  | { kind: "coins"; coins: number; why: "milestone" | "mystery" };

// ------------------------------------------------------------------ store

let profile: Profile = load();
let notices: Notice[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function save() {
  writeLocal(KEY, profile);
}

function update(fn: (p: Profile) => void) {
  const next = structuredClone(profile);
  fn(next);
  profile = next;
  save();
  emit();
}

export function getProfile() {
  return profile;
}

export function useBricksProfile(): Profile {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => profile, () => profile);
}

/** Takes the notices waiting to be shown. */
export function takeNotices(): Notice[] {
  const out = notices;
  notices = [];
  return out;
}

export function useNoticeCount() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => notices.length, () => 0);
}

function earn(p: Profile, coins: number) {
  p.coins += coins;
  p.stats.coinsEarned += coins;
}

// ------------------------------------------------------------------ day, streak and missions

export const today = () => puzzleToday();

function dayNumber(iso: string) {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
}

export interface MissionDef { id: string; kind: MissionKind; target: number; coins: number }
type MissionKind = "bricks" | "endless" | "balls" | "oneShot" | "levels" | "powers" | "round" | "daily" | "stars";

export const MISSIONS: MissionDef[] = [
  { id: "bricks100", kind: "bricks", target: 100, coins: 25 },
  { id: "bricks250", kind: "bricks", target: 250, coins: 50 },
  { id: "bricks500", kind: "bricks", target: 500, coins: 75 },
  { id: "endless3", kind: "endless", target: 3, coins: 25 },
  { id: "endless5", kind: "endless", target: 5, coins: 50 },
  { id: "balls15", kind: "balls", target: 15, coins: 25 },
  { id: "balls40", kind: "balls", target: 40, coins: 50 },
  { id: "shot10", kind: "oneShot", target: 10, coins: 50 },
  { id: "shot15", kind: "oneShot", target: 15, coins: 75 },
  { id: "levels3", kind: "levels", target: 3, coins: 25 },
  { id: "levels5", kind: "levels", target: 5, coins: 50 },
  { id: "powers2", kind: "powers", target: 2, coins: 25 },
  { id: "round20", kind: "round", target: 20, coins: 50 },
  { id: "round35", kind: "round", target: 35, coins: 75 },
  { id: "daily1", kind: "daily", target: 1, coins: 25 },
  { id: "stars5", kind: "stars", target: 5, coins: 50 },
];

export function missionDef(id: string) {
  return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
}

/** Three missions for a day, the same for everyone, never two of the same kind. */
function missionsFor(date: string): MissionState[] {
  const rng = seeded(`bricks-missions-${date}`);
  const pool = [...MISSIONS];
  const out: MissionState[] = [];
  const kinds = new Set<string>();
  while (out.length < 3 && pool.length) {
    const m = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    if (kinds.has(m.kind)) continue;
    kinds.add(m.kind);
    out.push({ id: m.id, progress: 0, done: false });
  }
  return out;
}

/** Brings missions and the daily slot up to today. Called whenever the game opens. */
export function refreshDay(dailyNumberToday: number) {
  const date = today();
  if (profile.missions.date === date && profile.daily.number === dailyNumberToday) return;
  update((p) => {
    if (p.missions.date !== date) p.missions = { date, list: missionsFor(date) };
    if (p.daily.number !== dailyNumberToday) {
      if (p.daily.number) {
        p.dailyHistory = [{ number: p.daily.number, best: p.daily.best, done: p.daily.done }, ...p.dailyHistory].slice(0, 30);
      }
      p.daily = { number: dailyNumberToday, tries: 0, best: null, done: false };
    }
  });
}

/** The streak as it stands today (it lapses once a whole day is missed). */
export function currentStreak(p: Profile) {
  if (!p.streak.last) return 0;
  const gap = dayNumber(today()) - dayNumber(p.streak.last);
  return gap <= 1 ? p.streak.count : 0;
}

function playedToday(p: Profile) {
  const date = today();
  if (p.streak.last === date) return;
  const gap = p.streak.last ? dayNumber(date) - dayNumber(p.streak.last) : 99;
  p.streak.count = gap === 1 ? p.streak.count + 1 : 1;
  p.streak.last = date;
  p.stats.bestDailyStreak = Math.max(p.stats.bestDailyStreak, p.streak.count);
  if (p.streak.count % 7 === 0) {
    // Every seventh day in a row: the Sparkles trail the first time, coins after that.
    const item = p.owned.includes("trail:sparkles") ? null : "trail:sparkles";
    const coins = item ? 0 : 150;
    if (item) p.owned.push(item);
    earn(p, coins);
    notices.push({ kind: "streak", days: p.streak.count, coins, item });
  }
}

function bump(p: Profile, kind: MissionKind, amount: number, mode: "add" | "max" = "add") {
  if (p.missions.date !== today()) p.missions = { date: today(), list: missionsFor(today()) };
  for (const m of p.missions.list) {
    const def = missionDef(m.id);
    if (def.kind !== kind || m.done) continue;
    m.progress = mode === "max" ? Math.max(m.progress, amount) : m.progress + amount;
    if (m.progress >= def.target) {
      m.progress = def.target;
      m.done = true;
      earn(p, def.coins);
      notices.push({ kind: "mission", id: def.id, coins: def.coins });
    }
  }
}

// ------------------------------------------------------------------ achievements

export type AchievementGroup = "destruction" | "survival" | "balls" | "combo" | "adventure";
export interface AchievementDef { id: string; group: AchievementGroup; target: number; coins: number }

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "firstBreak", group: "destruction", target: 1, coins: 50 },
  { id: "brickHunter", group: "destruction", target: 100, coins: 50 },
  { id: "brickDestroyer", group: "destruction", target: 1000, coins: 100 },
  { id: "brickMaster", group: "destruction", target: 10000, coins: 150 },
  { id: "totalDestruction", group: "destruction", target: 100000, coins: 250 },
  { id: "gettingStarted", group: "survival", target: 10, coins: 50 },
  { id: "survivor", group: "survival", target: 25, coins: 100 },
  { id: "expert", group: "survival", target: 50, coins: 100 },
  { id: "masterSurvivor", group: "survival", target: 100, coins: 200 },
  { id: "unstoppable", group: "survival", target: 200, coins: 250 },
  { id: "growingStronger", group: "balls", target: 10, coins: 50 },
  { id: "ballCollector", group: "balls", target: 100, coins: 100 },
  { id: "ballArmy", group: "balls", target: 500, coins: 150 },
  { id: "endlessArsenal", group: "balls", target: 2000, coins: 250 },
  { id: "comboBeginner", group: "combo", target: 5, coins: 50 },
  { id: "comboExpert", group: "combo", target: 10, coins: 100 },
  { id: "comboMaster", group: "combo", target: 20, coins: 150 },
  { id: "perfectChaos", group: "combo", target: 30, coins: 250 },
  { id: "firstVictory", group: "adventure", target: 1, coins: 50 },
  { id: "worldExplorer", group: "adventure", target: 1, coins: 100 },
  { id: "halfwayThere", group: "adventure", target: 5, coins: 150 },
  { id: "grandChampion", group: "adventure", target: LEVEL_COUNT, coins: 250 },
  { id: "starCollector", group: "adventure", target: 300, coins: 200 },
  { id: "perfectAdventure", group: "adventure", target: LEVEL_COUNT * 3, coins: 250 },
];

export function levelsDone(p: Profile) {
  return p.stars.filter((s) => s > 0).length;
}
export function starTotal(p: Profile) {
  return p.stars.reduce((a, b) => a + b, 0);
}
export function worldsDone(p: Profile) {
  let n = 0;
  for (let w = 0; w < WORLDS; w++) if (p.stars.slice(w * LEVELS_PER_WORLD, (w + 1) * LEVELS_PER_WORLD).every((s) => s > 0)) n++;
  return n;
}

/** Where an achievement stands: [progress, target]. */
export function achievementProgress(p: Profile, a: AchievementDef): number {
  switch (a.id) {
    case "firstVictory": case "grandChampion": return levelsDone(p);
    case "worldExplorer": case "halfwayThere": return worldsDone(p);
    case "starCollector": case "perfectAdventure": return starTotal(p);
  }
  switch (a.group) {
    case "destruction": return p.stats.bricks;
    case "survival": return p.stats.bestRound;
    case "balls": return p.stats.balls;
    case "combo": return p.stats.bestShot;
    default: return 0;
  }
}

function checkAchievements(p: Profile) {
  for (const a of ACHIEVEMENTS) {
    if (p.achievements[a.id]) continue;
    if (achievementProgress(p, a) >= a.target) {
      p.achievements[a.id] = new Date().toISOString();
      earn(p, a.coins);
      notices.push({ kind: "achievement", id: a.id, coins: a.coins });
    }
  }
}

// ------------------------------------------------------------------ events from play

/** After every shot: lifetime counts, missions and achievements. */
export function recordShot(info: { broken: number; collected: number; coins: number; milestone: number | null }) {
  update((p) => {
    p.stats.bricks += info.broken;
    p.stats.balls += info.collected;
    p.stats.shots++;
    p.stats.bestShot = Math.max(p.stats.bestShot, info.broken);
    if (info.coins) {
      earn(p, info.coins);
      notices.push({ kind: "coins", coins: info.coins, why: "mystery" });
    }
    if (info.milestone) {
      earn(p, 25);
      notices.push({ kind: "coins", coins: 25, why: "milestone" });
    }
    bump(p, "bricks", info.broken);
    bump(p, "balls", info.collected);
    bump(p, "oneShot", info.broken, "max");
    checkAchievements(p);
  });
}

/** A power-up spent: from the board's own supply (given) or the inventory. */
export function recordPower(kind: PowerKey, fromInventory: boolean, broken: number) {
  update((p) => {
    if (fromInventory) p.inv[kind] = Math.max(0, p.inv[kind] - 1);
    p.stats.powers++;
    p.stats.bricks += broken;
    p.stats.bestShot = Math.max(p.stats.bestShot, broken);
    bump(p, "powers", 1);
    bump(p, "bricks", broken);
    if (!p.tips.powers.includes(kind)) p.tips.powers.push(kind);
    checkAchievements(p);
  });
}

/** Rounds reached in an endless run so far (missions and the round achievements count live). */
export function recordRound(round: number) {
  update((p) => {
    p.stats.bestRound = Math.max(p.stats.bestRound, round);
    bump(p, "round", round, "max");
    checkAchievements(p);
  });
}

export function recordEndlessEnd(s: RunState, timeMs: number) {
  update((p) => {
    p.stats.endlessGames++;
    p.stats.timeMs += timeMs;
    p.stats.bestScore = Math.max(p.stats.bestScore, s.score);
    p.stats.bestRound = Math.max(p.stats.bestRound, s.round);
    p.stats.bestCombo = Math.max(p.stats.bestCombo, s.bestCombo);
    bump(p, "endless", 1);
    playedToday(p);
    checkAchievements(p);
  });
}

/** A finished adventure level. Returns the coins it paid (10 the first time, 5 per new star). */
export function recordLevel(level: number, stars: number, won: boolean, timeMs: number): { coins: number; newStars: number; world: number | null } {
  let coins = 0, newStars = 0, world: number | null = null;
  update((p) => {
    p.stats.timeMs += timeMs;
    playedToday(p);
    if (!won) return;
    const before = p.stars[level - 1];
    if (before === 0) coins += 10;
    newStars = Math.max(0, stars - before);
    coins += newStars * 5;
    p.stars[level - 1] = Math.max(before, stars);
    earn(p, coins);
    bump(p, "levels", 1);
    if (newStars) bump(p, "stars", newStars);
    const w = Math.floor((level - 1) / LEVELS_PER_WORLD);
    const worldDone = p.stars.slice(w * LEVELS_PER_WORLD, (w + 1) * LEVELS_PER_WORLD).every((s) => s > 0);
    if (worldDone && !p.worldsRewarded.includes(w)) {
      p.worldsRewarded.push(w);
      const items = WORLD_REWARD[WORLD_KEYS[w]].filter((i) => !p.owned.includes(i));
      p.owned.push(...items);
      for (const k of POWER_KEYS) p.inv[k]++;
      earn(p, WORLD_COINS);
      world = w;
      notices.push({ kind: "world", world: w, items, coins: WORLD_COINS });
    }
    checkAchievements(p);
  });
  return { coins, newStars, world };
}

/** A finished challenge. Returns the coins for medals reached for the first time. */
export function recordChallenge(id: number, medal: number, value: number | null, isBetter: boolean, timeMs: number): number {
  let coins = 0;
  update((p) => {
    p.stats.timeMs += timeMs;
    playedToday(p);
    const before = p.medals[id - 1];
    const table = MEDAL_COINS[(id - 1) % 5];
    // [gold, silver, bronze]: each medal pays once, the first time it is reached.
    for (let m = before + 1; m <= medal; m++) coins += table[3 - m];
    p.medals[id - 1] = Math.max(before, medal);
    if (value !== null && isBetter) p.challengeBest[id - 1] = value;
    earn(p, coins);
    checkAchievements(p);
  });
  return coins;
}

export function startDailyTry() {
  update((p) => { p.daily.tries++; });
}

/** A finished daily try. Pays the daily coins the first time the objective is met today. */
export function recordDaily(score: number, won: boolean, timeMs: number): number {
  let coins = 0;
  update((p) => {
    p.stats.timeMs += timeMs;
    p.stats.dailies++;
    p.daily.best = Math.max(p.daily.best ?? 0, score);
    if (won && !p.daily.done) {
      p.daily.done = true;
      coins = 50;
      earn(p, coins);
    }
    bump(p, "daily", 1);
    playedToday(p);
    checkAchievements(p);
  });
  return coins;
}

// ------------------------------------------------------------------ shop and settings

export function buyCosmetic(key: string): boolean {
  const price = priceOf(key);
  if (profile.owned.includes(key) || profile.coins < price) return false;
  update((p) => {
    p.coins -= price;
    p.owned.push(key);
    const [kind, id] = key.split(":") as ["ball" | "trail" | "theme", string];
    p.equipped[kind] = id;
  });
  return true;
}

export function equip(kind: "ball" | "trail" | "theme", id: string) {
  if (!profile.owned.includes(`${kind}:${id}`)) return;
  update((p) => { p.equipped[kind] = id; });
}

export function buyPower(kind: PowerKey): boolean {
  const price = POWER_PRICE[kind];
  if (profile.coins < price) return false;
  update((p) => {
    p.coins -= price;
    p.inv[kind]++;
  });
  return true;
}

export function setSettings(patch: Partial<Settings>) {
  update((p) => { p.settings = { ...p.settings, ...patch }; });
}

export function markTip(tip: "tutorial" | "adventure") {
  update((p) => { p.tips[tip] = true; });
}

export function markBrickTips(types: BrickType[]) {
  if (types.every((t) => profile.tips.bricks.includes(t))) return;
  update((p) => { p.tips.bricks = [...new Set([...p.tips.bricks, ...types])]; });
}

export function resetTips() {
  update((p) => { p.tips = { tutorial: false, adventure: false, bricks: [], powers: [] }; });
}

/** Deletes every bit of Brick Breaker progress on this device, and its unfinished runs. Settings stay. */
export function resetProgress() {
  for (const key of [...RUN_KEYS, "endless"]) removeLocal(runStorageKey(key));
  RUN_KEYS.clear();
  writeLocal("bazimoon-bricks-runs", []);
  const settings = profile.settings;
  profile = freshProfile();
  profile.settings = settings;
  save();
  emit();
}

// ------------------------------------------------------------------ unfinished runs

export type RunMode = "endless" | "adventure" | "daily" | "challenge";

export interface SavedRun {
  key: string;
  mode: RunMode;
  /** Level, challenge id or daily number. */
  ref: number;
  /** The board as it stood before the shot in progress (or the next shot). */
  run: RunState;
  /** A shot that was under way when the game was left: replayed from `run` with the same aim. */
  pending: { dx: number; dy: number; double: boolean } | null;
  timeMs: number;
  savedAt: number;
}

const RUN_KEYS = new Set<string>(readLocal<string[]>("bazimoon-bricks-runs", []));

function runStorageKey(key: string) {
  return `bazimoon-bricks-run-${key}`;
}

export function runKey(mode: RunMode, ref: number) {
  return mode === "endless" ? "endless" : `${mode}-${ref}`;
}

export function loadRun(key: string): SavedRun | null {
  const r = readLocal<SavedRun | null>(runStorageKey(key), null);
  return r && r.run?.v === 1 && !r.run.over ? r : null;
}

export function saveRun(r: SavedRun) {
  writeLocal(runStorageKey(r.key), r);
  RUN_KEYS.add(r.key);
  writeLocal("bazimoon-bricks-runs", [...RUN_KEYS]);
  if (profile.lastRun !== r.key) update((p) => { p.lastRun = r.key; });
}

export function clearRun(key: string) {
  removeLocal(runStorageKey(key));
  RUN_KEYS.delete(key);
  writeLocal("bazimoon-bricks-runs", [...RUN_KEYS]);
  if (profile.lastRun === key) update((p) => { p.lastRun = null; });
}

/** The most recent unfinished run, if any. */
export function lastRun(): SavedRun | null {
  if (profile.lastRun) {
    const r = loadRun(profile.lastRun);
    if (r) return r;
  }
  return loadRun("endless");
}
