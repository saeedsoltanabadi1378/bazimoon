import type { Language, TranslationKey } from "../../i18n/LanguageContext";
import { readLocal, writeLocal } from "../../lib/storage";

/** Built-in categories, in the order the setup screen shows them. */
export const BUILT_IN = ["name", "family", "city", "country", "animal", "food", "thing", "color", "fruit", "flower", "job", "car", "body", "sport", "celeb", "clothes"] as const;
export const CLASSIC = ["name", "family", "city", "country", "animal", "food", "thing", "color"];
export const QUICK = ["name", "city", "animal", "food", "thing"];
export const MIN_CATEGORIES = 3;
export const MAX_CATEGORIES = 12;
export const SECONDS = [60, 90, 120];
export const SOLO_SECONDS = 90;

/** A category is a built-in key or "custom:<label>" (the same shape the server takes). */
export function categoryLabel(cat: string, t: (key: TranslationKey) => string) {
  return cat.startsWith("custom:") ? cat.slice(7) : t(`esmCat_${cat}` as TranslationKey);
}

// Letters that start plenty of words in each category; the awkward ones are left out.
export const LETTERS: Record<Language, string[]> = {
  fa: ["ا", "ب", "پ", "ت", "ج", "چ", "ح", "خ", "د", "ر", "ز", "س", "ش", "ع", "ف", "ق", "ک", "گ", "ل", "م", "ن", "و", "ه", "ی"],
  en: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "R", "S", "T", "V", "W", "Y"],
};

export interface EsmSettings {
  categories: string[];
  rounds: number;
  seconds: number;
  letters: Language;
  /** Player names for one-phone games (2–8). */
  names: string[];
}

const SETTINGS_KEY = "nightfall-esmfamil-settings";

export function readSettings(language: Language): EsmSettings {
  const saved = readLocal<Partial<EsmSettings> | null>(SETTINGS_KEY, null);
  return {
    categories: saved?.categories?.length ? saved.categories : CLASSIC,
    rounds: saved?.rounds ?? 3,
    seconds: saved?.seconds && SECONDS.includes(saved.seconds) ? saved.seconds : 90,
    letters: saved?.letters ?? language,
    names: saved?.names?.length ? saved.names : ["", "", "", ""],
  };
}

export function writeSettings(settings: EsmSettings) {
  writeLocal(SETTINGS_KEY, settings);
}

/** Folds the spellings people treat as the same letter or word: case, آ/ا, Arabic ي/ك, spaces and ZWNJ. */
export function normalize(text: string) {
  return text
    .trim()
    .toLocaleLowerCase()
    .replace(/[\u200c\u200f\u200e\u064b-\u065f]/g, "")
    .replace(/[آأإ]/g, "ا")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

export function startsWithLetter(answer: string, letter: string) {
  const a = normalize(answer);
  return a.length > 1 && a.startsWith(normalize(letter));
}

export type Verdict = "unique" | "shared" | "alone" | "invalid";

/**
 * Scores one category for every player: 20 for the only valid answer, 10 for a valid answer
 * nobody else gave, 5 for one somebody else gave too, 0 for empty or rejected.
 */
export function scoreCategory(answers: string[], valid: boolean[]): { verdict: Verdict; points: number }[] {
  const keys = answers.map((a, i) => (valid[i] ? normalize(a) : null));
  const validCount = keys.filter((k) => k !== null).length;
  return keys.map((k) => {
    if (k === null) return { verdict: "invalid", points: 0 };
    if (validCount === 1) return { verdict: "alone", points: 20 };
    const same = keys.filter((other) => other === k).length;
    return same > 1 ? { verdict: "shared", points: 5 } : { verdict: "unique", points: 10 };
  });
}

/** Solo scoring: 10 per correct answer plus a point for every 3 seconds left. */
export function soloPoints(correct: number, msLeft: number) {
  return correct * 10 + Math.floor(Math.max(0, msLeft) / 3000);
}
