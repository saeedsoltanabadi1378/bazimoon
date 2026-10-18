import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useHub } from "../hub/HubData";
import { botLink } from "../lib/links";
import { shareToTelegram } from "../lib/telegram";
import { haptic } from "../lib/haptics";
import type { TableInfo } from "../api/hub";

/** The host's "Invite players" box in the lobby: the t_CODE link, copy and share, and the
 * public / private switch. Anyone with the link or code can join, whichever way it is set. */
export function InviteBox({ info, onChange }: { info: TableInfo; onChange(info: TableInfo): void }) {
  const { t } = useLanguage();
  const { api } = useHub();
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const code = info.inviteCode ?? "";
  const link = botLink(`t_${code}`);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      haptic.success();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function toggle() {
    setSaving(true);
    try {
      onChange(await api.setTableOpen(info.gameId, !info.isOpen));
      haptic.select();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="invite-title" className="stack" style={{ gap: 12, padding: 14, borderRadius: 18, border: "1.5px dashed #3A3566" }}>
      <div className="row row--between row--baseline">
        <h2 id="invite-title" style={{ fontSize: 15, fontWeight: 600 }}>{t("invitePlayers")}</h2>
        <span className="tiny muted">{t("onlyYouSeeThis")}</span>
      </div>
      <div className="row" style={{ gap: 8, padding: "10px 12px", borderRadius: 12, background: "#0B0D1A" }}>
        <span dir="ltr" style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.replace(/^https?:\/\//, "")}</span>
        <span dir="ltr" aria-label={t("inviteCodeLabel", { code })} style={{ fontSize: 12, fontWeight: 700, color: "#9C8CFF", letterSpacing: 1 }}>{code}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <button type="button" className="btn btn--outline" onClick={() => void copy()} style={{ minHeight: 44, fontSize: 14 }}>
          <span aria-live="polite">{copied ? t("linkCopied") : t("copyLink")}</span>
        </button>
        <button type="button" className="btn" onClick={() => shareToTelegram(link, t("inviteShareText", { code }))} style={{ minHeight: 44, fontSize: 14, background: "#9C8CFF", color: "#120D2E" }}>
          {t("shareInTelegram")}
        </button>
      </div>
      <div className="row" style={{ gap: 12, paddingTop: 10, borderTop: "1px solid #1E2138" }}>
        <div className="grow stack" style={{ gap: 2 }}>
          <span id="open-label" style={{ fontSize: 14, fontWeight: 600 }}>{t("publicTableSwitch")}</span>
          <span className="tiny muted" style={{ lineHeight: 1.4 }}>{info.isOpen ? t("openHintOn") : t("openHintOff")}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={info.isOpen}
          aria-labelledby="open-label"
          disabled={saving}
          onClick={() => void toggle()}
          style={{ width: 52, height: 30, flex: "none", padding: 3, borderRadius: 999, border: 0, background: info.isOpen ? "#5FD0BE" : "#3A3F5E", display: "flex", justifyContent: info.isOpen ? "flex-end" : "flex-start", cursor: "pointer" }}
        >
          <span style={{ width: 24, height: 24, borderRadius: 999, background: "#EDEBF5" }} />
        </button>
      </div>
    </section>
  );
}
