import type { ReactNode } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { Icon } from "../../ui/Icon";

/** − value + control for setup screens (players, spies, rounds). */
export function Stepper({ label, value, min, max, onChange, format }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const { t, n } = useLanguage();
  const btn = (delta: number, disabled: boolean, aria: string, icon: ReactNode) => (
    <button type="button" className="icon-btn" aria-label={aria} disabled={disabled} onClick={() => onChange(value + delta)} style={{ background: "var(--surface-2)" }}>
      {icon}
    </button>
  );
  return (
    <div className="row row--between" style={{ gap: 12, minHeight: 56, paddingBlock: 6, paddingInlineStart: 14, paddingInlineEnd: 8, borderRadius: 14, background: "var(--surface)" }}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
      <div className="row" style={{ gap: 10 }}>
        {btn(-1, value <= min, t("partyLess", { label }), <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 12h12" /></svg>)}
        <span className="num" aria-live="polite" style={{ minWidth: 32, textAlign: "center", fontSize: 18, fontWeight: 700 }}>{format ? format(value) : n(value)}</span>
        {btn(1, value >= max, t("partyMore", { label }), <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>)}
      </div>
    </div>
  );
}

/** Full-screen "pass the phone to …" handover, so nobody sees the previous player's screen. */
export function PassPhone({ accent, ink, kicker, name, hint, action, onReady }: {
  accent: string;
  ink: string;
  kicker: string;
  name: string;
  hint: string;
  action: string;
  onReady: () => void;
}) {
  return (
    <div className="stack center" style={{ flex: 1, justifyContent: "center", gap: 14, padding: "24px 24px", textAlign: "center" }}>
      <span style={{ width: 84, height: 84, borderRadius: 999, background: "var(--surface)", color: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="people" size={38} />
      </span>
      <div className="kicker" style={{ color: accent }}>{kicker}</div>
      <h1 className="display" style={{ fontSize: 34, lineHeight: 1.1 }}>{name}</h1>
      <p className="small" style={{ color: "var(--text-2)", maxWidth: 300 }}>{hint}</p>
      <button type="button" className="btn" style={{ marginTop: 10, maxWidth: 320, background: accent, color: ink }} onClick={onReady}>{action}</button>
    </div>
  );
}
