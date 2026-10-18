import { useCallback, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useSession } from "../app/session";
import { Icon, type IconName } from "../ui/Icon";
import { GoogleButton } from "../ui/GoogleButton";
import { readLocal, writeLocal } from "../lib/storage";
import { haptic } from "../lib/haptics";
import { useHub } from "./HubData";

export type SaveProgressStage = "prompt" | "linking" | "linked" | "exists";

const PROMPTED_KEY = "bazimoon-save-progress-prompted";

/** Runs Google sign-in for a guest: link and keep progress, or offer the existing profile. */
export function useGoogleLink() {
  const session = useSession();
  const [stage, setStage] = useState<SaveProgressStage | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const onCredential = useCallback(async (idToken: string) => {
    setError(false);
    setStage("linking");
    try {
      const outcome = await session.signInWithGoogle(idToken);
      if (outcome === "exists") {
        setPendingToken(idToken);
        setStage("exists");
      } else {
        haptic.success();
        setStage("linked");
      }
    } catch {
      setError(true);
      setStage("prompt");
    }
  }, [session]);

  const switchProfile = useCallback(async () => {
    if (!pendingToken) return;
    setStage("linking");
    try {
      await session.switchToGoogle(pendingToken);
      setStage("linked");
    } catch {
      setError(true);
      setStage("exists");
    }
  }, [session, pendingToken]);

  return { stage, setStage, error, onCredential, switchProfile };
}

/** Whether to offer "Save your progress" after a win: guests only, at most once a day. */
export function shouldPromptSave(isGuest: boolean) {
  if (!isGuest) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (readLocal<string | null>(PROMPTED_KEY, null) === today) return false;
  writeLocal(PROMPTED_KEY, today);
  return true;
}

/** Bottom sheet from the "Save your progress" artboard: prompt, linking, linked and the
 * "this Google account already has a profile" case. */
export function SaveProgressSheet({ link, onClose }: { link: ReturnType<typeof useGoogleLink>; onClose: () => void }) {
  const { t, n } = useLanguage();
  const session = useSession();
  const { profile } = useHub();
  const stage = link.stage ?? "prompt";
  const look: Record<SaveProgressStage, { icon: IconName; bg: string; fg: string; title: string; body: string }> = {
    prompt: { icon: "cloudUp", bg: "#2A2113", fg: "#F0A83A", title: t("saveProgressTitle"), body: t("saveProgressBody") },
    linking: { icon: "cloudUp", bg: "#2A2113", fg: "#F0A83A", title: t("saveProgressTitle"), body: t("saveProgressBody") },
    linked: { icon: "check", bg: "#13302C", fg: "#5FD0BE", title: t("progressSaved"), body: t("progressSavedBody") },
    exists: { icon: "alert", bg: "#2A1418", fg: "#F08A7A", title: t("accountExistsTitle"), body: t("accountExistsBody") },
  };
  const l = look[stage];
  const streak = profile?.puzzles.streak ?? 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(5,6,14,0.72)", display: "flex", alignItems: "flex-end" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="save-progress-title" className="stack" style={{ width: "100%", boxSizing: "border-box", gap: 14, padding: "22px 20px calc(26px + var(--safe-bottom))", borderRadius: "28px 28px 0 0", background: "var(--surface)" }}>
        <span aria-hidden="true" style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 999, background: "#2E3252" }} />
        <span style={{ width: 64, height: 64, borderRadius: 20, background: l.bg, color: l.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={l.icon} size={32} />
        </span>
        <h2 id="save-progress-title" className="display" style={{ fontSize: 26, lineHeight: 1.2 }}>{l.title}</h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--text-2)" }}>{l.body}</p>

        {(stage === "prompt" || stage === "linking") && (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {[streak > 0 ? t("keepStreak", { days: n(streak) }) : null, t("keepRating"), t("keepBadges")].filter(Boolean).map((item) => (
              <li key={item} className="row" style={{ gap: 10, fontSize: 14 }}><Icon name="check" size={18} color="#5FD0BE" />{item}</li>
            ))}
          </ul>
        )}

        {(stage === "linked" || stage === "exists") && (
          <div className="row" style={{ gap: 12, padding: "12px 14px", borderRadius: 14, background: "var(--bg)" }}>
            <span style={{ width: 36, height: 36, borderRadius: 999, background: "#2E3252", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
              {Array.from(session.displayName || "?")[0]?.toUpperCase()}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{stage === "exists" ? t("existingProfile") : session.displayName}</span>
          </div>
        )}

        {link.error && <p role="alert" style={{ margin: 0, fontSize: 13, color: "#F08A7A" }}>{t("genericError")}</p>}

        <div className="stack" style={{ gap: 8, paddingTop: 4 }}>
          {stage === "prompt" && <GoogleButton onCredential={link.onCredential} />}
          {stage === "linking" && (
            <div role="status" className="row" style={{ justifyContent: "center", minHeight: 54, fontSize: 15, color: "var(--text-2)" }}>{t("linkingGoogle")}</div>
          )}
          {stage === "linked" && (
            <button type="button" className="btn btn--primary" onClick={onClose}>{t("keepPlaying")}</button>
          )}
          {stage === "exists" && (
            <button type="button" className="btn" style={{ background: "#F08A7A", color: "#2A0C07" }} onClick={() => void link.switchProfile()}>{t("switchToProfile")}</button>
          )}
          {(stage === "prompt" || stage === "exists") && (
            <button type="button" className="btn btn--ghost" style={{ fontSize: 15, fontWeight: 600, color: "var(--text-2)" }} onClick={onClose}>
              {stage === "exists" ? t("stayGuest") : t("keepPlayingGuest")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
