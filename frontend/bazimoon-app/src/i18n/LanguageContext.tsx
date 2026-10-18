import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { deviceLanguage } from "../lib/platform";
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
  /** True once the person has picked a language (or we've remembered one). */
  chosen: boolean;
  setLanguage(language: Language): void;
  t(key: TranslationKey, values?: Values): string;
  /** Formats a number with the current language's digits. */
  n(value: number, options?: Intl.NumberFormatOptions): string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detect(): Language {
  // The Persian landing page (/fa/) opens in Persian for people who haven't picked a language.
  if (/^\/fa(\/|$)/.test(window.location.pathname)) return "fa";
  return deviceLanguage();
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const remembered = readLocal<Language | null>(STORAGE_KEY, null);
  const [language, setLanguageState] = useState<Language>(remembered ?? detect());
  const [chosen, setChosen] = useState(remembered !== null);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => {
    const locale = language === "fa" ? "fa-IR" : "en-US";
    const n = (v: number, options?: Intl.NumberFormatOptions) => v.toLocaleString(locale, options);
    return {
      language,
      chosen,
      setLanguage(next) {
        writeLocal(STORAGE_KEY, next);
        setChosen(true);
        setLanguageState(next);
      },
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
  }, [language, chosen]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
