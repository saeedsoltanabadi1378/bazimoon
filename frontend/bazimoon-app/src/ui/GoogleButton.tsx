import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { googleClientId, renderGoogleButton } from "../lib/google";

/** Google's own "Sign in with Google" button. Calls <c>onCredential</c> with the ID token. */
export function GoogleButton({ onCredential, width = 358 }: { onCredential: (idToken: string) => void; width?: number }) {
  const { t, language } = useLanguage();
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(!googleClientId);
  const latest = useRef(onCredential);
  latest.current = onCredential;

  useEffect(() => {
    if (!box.current || !googleClientId) return;
    renderGoogleButton(box.current, (token) => latest.current(token), { locale: language, width: Math.min(width, 400) })
      .catch(() => setFailed(true));
  }, [language, width]);

  if (failed) {
    return <p role="status" style={{ margin: 0, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>{t("googleUnavailable")}</p>;
  }
  // Google renders an iframe button; the box keeps the layout steady while it loads.
  return <div ref={box} aria-label={t("signInWithGoogle")} style={{ minHeight: 44, display: "flex", justifyContent: "center" }} />;
}
