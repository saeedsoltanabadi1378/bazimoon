// Word Ladder: change one letter at a time, every step a real word. Daily ladders are precomputed
// (start, end and par through the full 4-letter dictionary); endless ladders are generated here.
import { DAILY_LADDERS } from "../words/ladders";
import { FA_LADDER_PATHS, FA_LADDER_WORDS } from "../words/faLadders";
import { COMMON3, COMMON4, COMMON6, EN_ANSWERS } from "../words/answers";
import { mulberry32 } from "../../lib/rng";

export interface Ladder {
  start: string;
  end: string;
  par: number;
}

const daily = DAILY_LADDERS;

/** The daily 4-letter ladder for puzzle #number (uppercase). */
export function dailyLadder(number: number, language: "en" | "fa" = "en"): Ladder {
  if (language === "fa") {
    const path = FA_LADDER_PATHS[(((number - 1) % FA_LADDER_PATHS.length) + FA_LADDER_PATHS.length) % FA_LADDER_PATHS.length];
    const shortest = shortestPath(path[0], path[path.length - 1], new Set(FA_LADDER_WORDS));
    return { start: path[0], end: path[path.length - 1], par: Math.max(1, (shortest?.length ?? path.length) - 1) };
  }
  const entry = daily[(((number - 1) % daily.length) + daily.length) % daily.length];
  return { start: entry.slice(0, 4).toUpperCase(), end: entry.slice(4, 8).toUpperCase(), par: Number(entry.slice(8)) };
}

const dictionaries = new Map<string, Promise<Set<string>>>();

/** Loads the full dictionary for a word length (uppercase words). */
export function loadLadderDictionary(length: number, language: "en" | "fa" = "en"): Promise<Set<string>> {
  const key = `${language}-${length}`;
  let found = dictionaries.get(key);
  if (!found) {
    if (language === "fa") {
      found = Promise.resolve(new Set(FA_LADDER_WORDS.filter((word) => word.length === length)));
      dictionaries.set(key, found);
      return found;
    }
    const load = length === 3 ? import("../words/en3") : length === 5 ? import("../words/en5") : length === 6 ? import("../words/en6") : import("../words/en4");
    found = load.then((m) => new Set(m.default.toUpperCase().split(" ")));
    dictionaries.set(key, found);
  }
  return found;
}

function neighbours(word: string, dict: Set<string>) {
  const out: string[] = [];
  const letters = new Set(Array.from(dict).flatMap((candidate) => candidate.split("")));
  for (let i = 0; i < word.length; i++) {
    for (const ch of letters) {
      if (ch === word[i]) continue;
      const next = word.slice(0, i) + ch + word.slice(i + 1);
      if (dict.has(next)) out.push(next);
    }
  }
  return out;
}

/** A shortest path from `from` to `to` (both included), or null when the words are not connected. */
export function shortestPath(from: string, to: string, dict: Set<string>, avoid: ReadonlySet<string> = new Set()): string[] | null {
  if (from === to) return [from];
  const prev = new Map<string, string>([[from, ""]]);
  let frontier = [from];
  while (frontier.length) {
    const next: string[] = [];
    for (const w of frontier) {
      for (const n of neighbours(w, dict)) {
        if (prev.has(n) || (avoid.has(n) && n !== to)) continue;
        prev.set(n, w);
        if (n === to) {
          const path = [n];
          for (let p = w; p; p = prev.get(p)!) path.unshift(p);
          return path;
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

/** Number of letters that differ between two words of the same length. */
export function letterDiff(a: string, b: string) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff;
}

const common = (length: number) =>
  (length === 3 ? COMMON3 : length === 4 ? COMMON4 : length === 6 ? COMMON6 : EN_ANSWERS).map((w) => w.toUpperCase());

/** Endless level → word length and target par: difficulty rises every few ladders. */
export function endlessShape(level: number, language: "en" | "fa" = "en") {
  if (language === "fa") return { length: 4, par: level % 4 === 0 ? 4 : 3 };
  const length = level <= 3 ? 3 : level <= 8 ? 4 : level <= 14 ? 5 : 6;
  const par = Math.min(6, 3 + Math.floor(((level - 1) % 6) / 2));
  return { length, par };
}

/** Generates an endless ladder between two common words; falls back to a shorter par when the dictionary is sparse. */
export function endlessLadder(level: number, dict: Set<string>, seed = Date.now(), language: "en" | "fa" = "en"): Ladder {
  if (language === "fa") {
    const rng = mulberry32((seed + level) >>> 0);
    const path = FA_LADDER_PATHS[Math.floor(rng() * FA_LADDER_PATHS.length)];
    const shortest = shortestPath(path[0], path[path.length - 1], dict);
    return { start: path[0], end: path[path.length - 1], par: Math.max(1, (shortest?.length ?? path.length) - 1) };
  }
  const { length, par } = endlessShape(level);
  const rng = mulberry32(seed >>> 0);
  const pool = common(length).filter((w) => dict.has(w));
  const commonSet = new Set(pool);
  let fallback: Ladder | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const start = pool[Math.floor(rng() * pool.length)];
    // Breadth-first layers from the start; the end is a common word exactly `par` steps away.
    const seen = new Set([start]);
    let layer = [start];
    for (let d = 1; d <= par && layer.length; d++) {
      const next: string[] = [];
      for (const w of layer) for (const n of neighbours(w, dict)) if (!seen.has(n)) { seen.add(n); next.push(n); }
      layer = next;
      const targets = layer.filter((w) => commonSet.has(w));
      if (targets.length && d >= 2) {
        const end = targets[Math.floor(rng() * targets.length)];
        if (d === par) return { start, end, par: d };
        if (!fallback || d > fallback.par) fallback = { start, end, par: d };
      }
    }
  }
  return fallback ?? { start: pool[0], end: pool[0], par: 0 };
}
