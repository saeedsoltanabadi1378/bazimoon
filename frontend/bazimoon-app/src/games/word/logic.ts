import { EN_ANSWERS, FA_ANSWERS } from "../words/answers";
import { seeded, shuffle } from "../../lib/rng";

export type WordLang = "en" | "fa";
export type Score = 0 | 1 | 2; // absent, present elsewhere, correct

const orderCache: Partial<Record<WordLang, string[]>> = {};

/** How many Word levels a language has: one per answer in its list. */
export function wordLevelCount(lang: WordLang) {
  return (lang === "fa" ? FA_ANSWERS : EN_ANSWERS).length;
}

/** Level n's answer, from a fixed shuffle so consecutive levels never follow the list order. */
export function answerFor(lang: WordLang, number: number) {
  const pool = lang === "fa" ? FA_ANSWERS : EN_ANSWERS;
  const order = (orderCache[lang] ??= shuffle(seeded(`word-${lang}-order`), pool));
  const word = order[((number - 1) % order.length + order.length) % order.length];
  return Array.from(lang === "en" ? word.toUpperCase() : word);
}

/** Wordle scoring with correct handling of repeated letters. */
export function score(guess: string[], answer: string[]): Score[] {
  const res: Score[] = [0, 0, 0, 0, 0];
  const left: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) res[i] = 2;
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let j = 0; j < 5; j++) {
    if (res[j] !== 2 && left[guess[j]]) {
      res[j] = 1;
      left[guess[j]]--;
    }
  }
  return res;
}

const dictionaries: Partial<Record<WordLang, Promise<Set<string>>>> = {};

/** Valid guesses are loaded on demand (they are large); answers are always accepted. */
export function loadDictionary(lang: WordLang) {
  dictionaries[lang] ??= (lang === "fa" ? import("../words/fa5") : import("../words/en5")).then(
    (m) => new Set([...m.default.split(" "), ...(lang === "fa" ? FA_ANSWERS : EN_ANSWERS)]),
  );
  return dictionaries[lang]!;
}

export const keyboards: Record<WordLang, string[][]> = {
  en: [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "DEL"],
  ],
  fa: [
    ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "چ"],
    ["ش", "س", "ی", "ب", "ل", "ا", "ت", "ن", "م", "ک", "گ"],
    ["ENTER", "ظ", "ط", "ز", "ر", "ذ", "د", "پ", "و", "ژ", "DEL"],
  ],
};
