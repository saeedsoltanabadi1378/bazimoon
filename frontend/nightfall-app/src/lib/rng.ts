/** Deterministic PRNG so a daily puzzle is identical for everyone (mulberry32). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string (FNV-1a). */
export function hashString(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Rng = () => number;

export function seeded(key: string): Rng {
  return mulberry32(hashString(key));
}

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

export function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)];
}

export function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Daily numbering shared with the server (Progression.DailyNumber): first day of each series. */
const dailyEpochs: Record<string, string> = {
  zip: "2026-05-25",
  queens: "2026-07-18",
  word: "2026-06-01",
  ladder: "2026-08-01",
  mines: "2026-09-01",
  stack: "2026-09-01",
  blocks: "2026-09-01",
  sudoku: "2026-10-15",
};

export function dailyNumber(game: string, isoDate: string) {
  const epoch = dailyEpochs[game];
  if (!epoch) return 0;
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${epoch}T00:00:00Z`)) / 86_400_000) + 1;
}

export function dateOfDaily(game: string, number: number) {
  const epoch = dailyEpochs[game];
  const ms = Date.parse(`${epoch}T00:00:00Z`) + (number - 1) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
