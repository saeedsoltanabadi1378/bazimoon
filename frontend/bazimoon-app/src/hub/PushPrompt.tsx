import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useSession } from "../app/session";
import { Icon } from "../ui/Icon";
import { enablePush, markPushAsked, pushSupport, shouldAskForPush } from "../lib/push";
import { useInstallMode } from "../lib/install";
import { InstallSheet } from "./InstallSheet";

/** "Get told when the game starts?" — asked once, after the player sits at a table, never on
 * first launch (Notification permission artboard). On iPhone it first explains installing. */
export function PushPrompt({ active }: { active: boolean }) {
  const { t } = useLanguage();
  const { api } = useSession();
  const installMode = useInstallMode();
  const [open, setOpen] = useState(false);
  const [install, setInstall] = useState(false);
  const ios = pushSupport() === "ios-not-installed";

  useEffect(() => {
    if (!active || !shouldAskForPush()) return;
    const timer = window.setTimeout(() => setOpen(true), 800);
    return () => window.clearTimeout(timer);
  }, [active]);

  function close() {
    markPushAsked();
    setOpen(false);
  }

  async function allow() {
    close();
    await enablePush(api).catch(() => false);
  }

  if (install) return <InstallSheet mode={installMode === "installed" ? "ios" : installMode} onClose={() => setInstall(false)} />;
  if (!open) return null;
  const reasons = [t("pushReasonTables"), t("pushReasonCouple"), t("pushReasonDaily")];
  return (
    <div data-theme="night" style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(5,6,14,0.72)", display: "flex", alignItems: "flex-end", color: "var(--text)", fontFamily: "var(--font-body)" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="push-title" className="stack" style={{ width: "100%", boxSizing: "border-box", gap: 14, padding: "22px 20px calc(26px + var(--safe-bottom))", borderRadius: "28px 28px 0 0", background: "var(--surface)" }}>
        <span style={{ width: 64, height: 64, borderRadius: 20, background: "#1E2138", color: "#9C8CFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="bell" size={32} />
        </span>
        <h2 id="push-title" className="display" style={{ fontSize: 24, lineHeight: 1.2 }}>{t("pushTitle")}</h2>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--text-2)" }}>{t("pushBody")}</p>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {reasons.map((r) => (
            <li key={r} className="row" style={{ gap: 10, fontSize: 14 }}><Icon name="check" size={18} color="#5FD0BE" />{r}</li>
          ))}
        </ul>
        {ios && <div style={{ padding: "10px 14px", borderRadius: 12, background: "var(--bg)", fontSize: 13, lineHeight: 1.45, color: "var(--muted)" }}>{t("pushIosNote")}</div>}
        <div className="stack" style={{ gap: 8, paddingTop: 4 }}>
          {ios ? (
            <button type="button" className="btn" style={{ background: "#9C8CFF", color: "#120D2E" }} onClick={() => { close(); setInstall(true); }}>{t("pushHowInstall")}</button>
          ) : (
            <button type="button" className="btn" style={{ background: "#9C8CFF", color: "#120D2E" }} onClick={() => void allow()}>{t("pushAllow")}</button>
          )}
          <button type="button" className="btn btn--ghost" style={{ fontSize: 15, fontWeight: 600, color: "var(--text-2)" }} onClick={close}>{t("notNow")}</button>
        </div>
      </div>
    </div>
  );
}
