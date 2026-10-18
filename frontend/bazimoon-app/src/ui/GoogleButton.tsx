import { useLanguage } from "../i18n/LanguageContext";
import { useSession } from "../app/session";
import { googleClientId } from "../lib/google";

/** "Sign in with Google" from the design: a white button with Google's G. It leaves for Google's
 * own sign-in page and comes back to the app (no popup). <c>beforeLeave</c> saves anything the
 * current screen needs to remember first. */
export function GoogleButton({ beforeLeave, compact }: { beforeLeave?: () => void; compact?: boolean }) {
  const { t } = useLanguage();
  const { startGoogle } = useSession();

  if (!googleClientId) {
    return <p role="status" style={{ margin: 0, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>{t("googleUnavailable")}</p>;
  }
  return (
    <button
      type="button"
      className="btn"
      onClick={() => {
        beforeLeave?.();
        startGoogle();
      }}
      style={{ minHeight: compact ? 48 : 54, gap: 10, background: "#FFFFFF", color: "#1F1F1F", fontSize: compact ? 15 : 16, fontWeight: 600 }}
    >
      <svg width={compact ? 18 : 20} height={compact ? 18 : 20} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" />
        <path fill="#34A853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.6H2.2v2.8A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8z" />
        <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
      </svg>
      {t("signInWithGoogle")}
    </button>
  );
}
