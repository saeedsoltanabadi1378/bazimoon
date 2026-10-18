import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

/** Whole seconds left until `deadline` (ISO), ticking four times a second; null when there is no deadline. */
export function useSecondsLeft(deadline: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
}

/** m:ss for a countdown, in the reader's digits. */
export function useClock() {
  const { n } = useLanguage();
  return (seconds: number) => `${n(Math.floor(seconds / 60))}:${n(seconds % 60, { minimumIntegerDigits: 2 })}`;
}
