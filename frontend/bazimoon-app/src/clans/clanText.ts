import { useEffect, useState } from "react";
import { ApiError } from "../api/client";
import type { ClanRole } from "../api/clans";
import { en } from "../i18n/en";
import type { Language, TranslationKey, useLanguage } from "../i18n/LanguageContext";

type T = ReturnType<typeof useLanguage>["t"];

/** A clan error in the player's language: the server's clan code if we know it, else a generic line. */
export function clanError(err: unknown, t: T): string {
  if (err instanceof ApiError && err.code) {
    const key = `clanErr_${err.code}`;
    if (key in en) return t(key as TranslationKey);
  }
  return t("genericError");
}

/** "Fri 21 Nov, 21:00" in the player's language (Persian calendar and digits in fa). */
export function formatWhen(iso: string, language: Language) {
  return new Date(iso).toLocaleString(language === "fa" ? "fa-IR" : "en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export function roleLabel(role: ClanRole, t: T) {
  return role === "owner" ? t("clanRole_owner") : role === "admin" ? t("clanRole_admin") : t("clanRole_member");
}

/** A short-lived message at the bottom of the screen. */
export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);
  return [toast, setToast] as const;
}
