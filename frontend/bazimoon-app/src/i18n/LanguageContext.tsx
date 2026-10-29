import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readLocal, writeLocal } from "../lib/storage";
import { en } from "./en";
import { fa } from "./fa";

export type Language = "en" | "fa";
export type TranslationKey = keyof typeof en;
type Values = Record<string, string | number>;

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, fa };
const STORAGE_KEY = "bazimoon-language";

interface LanguageContextValue {
  language: Language;
  /** A URL language wins for this visit, including over a saved profile preference. */
  fromUrl: boolean;
  /** True once the person has picked a language (or we've remembered one). */
  chosen: boolean;
  setLanguage(language: Language): void;
  t(key: TranslationKey, values?: Values): string;
  /** Formats a number with the current language's digits. */
  n(value: number, options?: Intl.NumberFormatOptions): string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function languageFromUrl(): Language | null {
  // Links from the search pages say which language the visitor was reading (?lang=fa).
  const fromLink = new URLSearchParams(window.location.search).get("lang");
  if (fromLink === "fa" || fromLink === "en") return fromLink;
  return null;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const fromLink = languageFromUrl();
  const remembered = readLocal<Language | null>(STORAGE_KEY, null);
  const [language, setLanguageState] = useState<Language>(fromLink ?? remembered ?? "fa");
  const [chosen, setChosen] = useState(fromLink !== null || remembered !== null);
  const setLanguage = useCallback((next: Language) => {
    writeLocal(STORAGE_KEY, next);
    setChosen(true);
    setLanguageState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => {
    const locale = language === "fa" ? "fa-IR" : "en-US";
    const n = (v: number, options?: Intl.NumberFormatOptions) => v.toLocaleString(locale, options);
    return {
      language,
      fromUrl: fromLink !== null,
      chosen,
      setLanguage,
      n,
      t(key, values) {
        const template = dictionaries[language][key] ?? en[key] ?? key;
        if (!values) return template;
        return template.replace(/\{(\w+)\}/g, (match, name: string) => {
          const v = values[name];
          if (v === undefined) return match;
          return typeof v === "number" ? n(v) : v;
        });
      },
    };
  }, [language, chosen, fromLink, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
