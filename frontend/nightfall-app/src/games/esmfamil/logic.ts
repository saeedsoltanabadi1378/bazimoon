import type { Language } from "../../i18n/LanguageContext";

export type EsmMode = "classic" | "quick";
export const CATEGORIES: Record<EsmMode, string[]> = {
  classic: ["name", "family", "city", "country", "animal", "food", "thing", "color"],
  quick: ["name", "city", "animal", "food", "thing"],
};

// Letters that start plenty of words in each category; the awkward ones are left out.
export const LETTERS: Record<Language, string[]> = {
  fa: ["ا", "ب", "پ", "ت", "ج", "چ", "ح", "خ", "د", "ر", "ز", "س", "ش", "ع", "ف", "ق", "ک", "گ", "ل", "م", "ن", "و", "ه", "ی"],
  en: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "R", "S", "T", "V", "W", "Y"],
};

/** Folds the spellings people treat as the same letter or word: case, آ/ا, Arabic ي/ك, spaces and ZWNJ. */
export function normalize(text: string) {
  return text
    .trim()
    .toLocaleLowerCase()
    .replace(/[‌‏‎ً-ٟ]/g, "")
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
