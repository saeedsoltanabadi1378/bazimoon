import { useLanguage } from "../i18n/LanguageContext";
import { useSession } from "../app/session";
import { Icon, type IconName } from "../ui/Icon";
import { GoogleButton } from "../ui/GoogleButton";
import { readLocal, writeLocal } from "../lib/storage";
import { useHub } from "./HubData";

export type SaveProgressStage = "prompt" | "linking" | "linked" | "exists" | "error";

const PROMPTED_KEY = "bazimoon-save-progress-prompted";

/** Whether to offer "Save your progress" after a win: guests only, at most once a day. */
export function shouldPromptSave(isGuest: boolean) {
  if (!isGuest) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (readLocal<string | null>(PROMPTED_KEY, null) === today) return false;
  writeLocal(PROMPTED_KEY, today);
  return true;
}

/** Bottom sheet from the "Save your progress" artboard: the prompt, and after Google sends the
 * player back, linking, linked and the "this Google account already has a profile" case. */
export function SaveProgressSheet({ stage, onClose }: { stage: SaveProgressStage; onClose: () => void }) {
  const { t, n } = useLanguage();
  const session = useSession();
  const { profile } = useHub();
  const look: Record<SaveProgressStage, { icon: IconName; bg: string; fg: string; title: string; body: string }> = {
    prompt: { icon: "cloudUp", bg: "#2A2113", fg: "#F0A83A", title: t("saveProgressTitle"), body: t("saveProgressBody") },
    linking: { icon: "cloudUp", bg: "#2A2113", fg: "#F0A83A", title: t("saveProgressTitle"), body: t("saveProgressBody") },
    linked: { icon: "check", bg: "#13302C", fg: "#5FD0BE", title: t("progressSaved"), body: t("progressSavedBody") },
    exists: { icon: "alert", bg: "#2A1418", fg: "#F08A7A", title: t("accountExistsTitle"), body: t("accountExistsBody") },
    error: { icon: "cloudUp", bg: "#2A2113", fg: "#F0A83A", title: t("saveProgressTitle"), body: t("saveProgressBody") },
  };
  const l = look[stage];
  const streak = profile?.puzzles.streak ?? 0;

  return (
    <div data-theme="night" style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(5,6,14,0.72)", display: "flex", alignItems: "flex-end", color: "var(--text)", fontFamily: "var(--font-body)" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="save-progress-title" className="stack" style={{ width: "100%", boxSizing: "border-box", gap: 14, padding: "22px 20px calc(26px + var(--safe-bottom))", borderRadius: "28px 28px 0 0", background: "var(--surface)" }}>
        <span aria-hidden="true" style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 999, background: "#2E3252" }} />
        <span style={{ width: 64, height: 64, borderRadius: 20, background: l.bg, color: l.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={l.icon} size={32} />
        </span>
        <h2 id="save-progress-title" className="display" style={{ fontSize: 26, lineHeight: 1.2 }}>{l.title}</h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--text-2)" }}>{l.body}</p>

        {(stage === "prompt" || stage === "linking" || stage === "error") && (
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

        {stage === "error" && <p role="alert" style={{ margin: 0, fontSize: 13, color: "#F08A7A" }}>{t("genericError")}</p>}

        <div className="stack" style={{ gap: 8, paddingTop: 4 }}>
          {(stage === "prompt" || stage === "error") && <GoogleButton />}
          {stage === "linking" && (
            <div role="status" className="row" style={{ justifyContent: "center", minHeight: 54, fontSize: 15, color: "var(--text-2)" }}>{t("linkingGoogle")}</div>
          )}
          {stage === "linked" && (
            <button type="button" className="btn btn--primary" onClick={onClose}>{t("keepPlaying")}</button>
          )}
          {stage === "exists" && (
            <button type="button" className="btn" style={{ background: "#F08A7A", color: "#2A0C07" }} onClick={() => void session.switchToGoogleProfile()}>{t("switchToProfile")}</button>
          )}
          {(stage === "prompt" || stage === "exists" || stage === "error") && (
            <button type="button" className="btn btn--ghost" style={{ fontSize: 15, fontWeight: 600, color: "var(--text-2)" }} onClick={onClose}>
              {stage === "exists" ? t("stayGuest") : t("keepPlayingGuest")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Shows how a Google sign-in ended once the player is back from Google's page. */
export function GoogleResultSheet() {
  const session = useSession();
  const stage = session.googleStage;
  if (!stage || stage === "signed-in") return null;
  return <SaveProgressSheet stage={stage} onClose={session.dismissGoogle} />;
}
