import { useLanguage } from "../i18n/LanguageContext";
import { promptInstall, type InstallMode } from "../lib/install";
import { Icon, type IconName } from "../ui/Icon";
import { LogoTiles } from "../ui/LogoTiles";

/** "Install the app" sheet: the browser's install prompt on Android and desktop, a three-step
 * Add to Home Screen guide on iPhone (from the "Install the app" artboard). */
export function InstallSheet({ mode, onClose }: { mode: InstallMode; onClose: () => void }) {
  const { t, n } = useLanguage();
  const ios = mode === "ios";
  const steps: { text: string; icon: IconName }[] = [
    { text: t("iosStep1"), icon: "share" },
    { text: t("iosStep2"), icon: "plus" },
    { text: t("iosStep3"), icon: "check" },
  ];

  async function install() {
    await promptInstall();
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(5,6,14,0.72)", display: "flex", alignItems: "flex-end" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="install-title" className="stack" style={{ width: "100%", boxSizing: "border-box", gap: 14, padding: "22px 20px calc(26px + var(--safe-bottom))", borderRadius: "28px 28px 0 0", background: "var(--surface)" }}>
        <div className="row" style={{ gap: 14 }}>
          <LogoTiles size={60} />
          <div className="stack" style={{ gap: 2 }}>
            <h2 id="install-title" className="display" style={{ fontSize: 22 }}>{t("installTitle")}</h2>
            <span className="small muted">{t("installSub", { mb: n(2) })}</span>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--text-2)" }}>{ios ? t("installBodyIos") : t("installBody")}</p>

        {ios && (
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {steps.map((s, i) => (
              <li key={s.text} className="row" style={{ gap: 12, padding: "12px 14px", borderRadius: 14, background: "var(--bg)" }}>
                <span style={{ width: 28, height: 28, flex: "none", borderRadius: 999, background: "#2A2113", color: "#F0A83A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>{n(i + 1)}</span>
                <span className="grow" style={{ fontSize: 14, lineHeight: 1.4 }}>{s.text}</span>
                <Icon name={s.icon} size={22} color="#8FA8FF" />
              </li>
            ))}
          </ol>
        )}

        <div className="stack" style={{ gap: 8, paddingTop: 4 }}>
          {mode === "prompt" && <button type="button" className="btn btn--primary" onClick={() => void install()}>{t("install")}</button>}
          <button type="button" className="btn btn--ghost" style={{ fontSize: 15, fontWeight: 600, color: "var(--text-2)" }} onClick={onClose}>
            {ios ? t("gotIt") : t("notNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
