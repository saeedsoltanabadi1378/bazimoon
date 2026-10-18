import type { Language } from "../../../i18n/LanguageContext";
import { normalize } from "../logic";
import { enWords } from "./en";
import { faWords } from "./fa";

const sets = new Map<string, Set<string>>();

/** Spaces and ZWNJ are optional when matching ("ته دیگ" = "ته‌دیگ" = "تهدیگ"). */
const key = (text: string) => normalize(text).replace(/ /g, "");

function wordSet(language: Language, category: string) {
  const id = `${language}:${category}`;
  let set = sets.get(id);
  if (!set) {
    const raw = (language === "fa" ? faWords : enWords)[category] ?? "";
    set = new Set(raw.split("|").filter(Boolean).map(key));
    sets.set(id, set);
  }
  return set;
}

/** Whether solo accepts the answer: it is on Bazimoon's list for that category and language. */
export function isKnownWord(language: Language, category: string, answer: string) {
  return wordSet(language, category).has(key(answer));
}
