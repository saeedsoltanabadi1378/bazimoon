import type { Language } from "../../i18n/LanguageContext";
import { puzzleToday } from "../../lib/format";
import { dailyNumber, pick, seeded } from "../../lib/rng";
import { readLocal } from "../../lib/storage";
import type { ResultParams } from "../shared/play";
import { LETTERS } from "./logic";

export const soloDailyKey = (letters: Language, number: number) => `nightfall-esmfamil-daily-${letters}-${number}`;

/** Today's solo letter: the same for everyone who plays in that alphabet. */
export function dailyLetter(letters: Language, number: number) {
  return pick(seeded(`esmfamil-${letters}-${number}`), LETTERS[letters]);
}

/** The saved result of today's first solo try, if there was one. */
export function soloDoneToday(letters: Language) {
  return readLocal<ResultParams | null>(soloDailyKey(letters, dailyNumber("esmfamil", puzzleToday())), null);
}
