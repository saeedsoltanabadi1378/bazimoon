import type { ReactNode } from "react";
import { IconDisc, Screen } from "../ui/components";
import type { IconName } from "../ui/Icon";
import { useLanguage } from "../i18n/LanguageContext";

export type AppState = "offline" | "reconnecting" | "expired" | "update" | "not-found" | "error" | "no-table";

interface StateDef {
  icon: IconName;
  bg: string;
  fg: string;
}

const defs: Record<AppState, StateDef> = {
  offline: { icon: "wifiOff", bg: "#2A1418", fg: "#F08A7A" },
  reconnecting: { icon: "refresh", bg: "#1E2138", fg: "#9C8CFF" },
  expired: { icon: "clock", bg: "#2A2113", fg: "#F0A83A" },
  update: { icon: "download", bg: "#1B2A44", fg: "#8FA8FF" },
  "not-found": { icon: "searchMinus", bg: "#1E2138", fg: "#9A9CB8" },
  error: { icon: "alert", bg: "#2A1418", fg: "#F08A7A" },
  "no-table": { icon: "moon", bg: "#1E2138", fg: "#9C8CFF" },
};

/** Full-screen message for loading failures and empty states ("App states" artboard). */
export function StateScreen({ state, onPrimary, primaryLabel, onSecondary, secondaryLabel, children }: {
  state: AppState;
  onPrimary?: () => void;
  primaryLabel?: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
  children?: ReactNode;
}) {
  const { t } = useLanguage();
  const def = defs[state];
  const title = t(`state_${state}_title`);
  const body = t(`state_${state}_body`);
  const note = t(`state_${state}_note`);
  return (
    <Screen theme="night">
      <div className="stack center" style={{ flex: 1, justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
        <IconDisc icon={def.icon} size={88} iconSize={40} bg={def.bg} fg={def.fg} />
        <h1 className="display" style={{ fontSize: 26 }}>{title}</h1>
        <p style={{ maxWidth: 300, fontSize: 15, lineHeight: 1.5, color: "var(--text-2)" }}>{body}</p>
        {note && (
          <div style={{ maxWidth: 300, padding: "10px 14px", borderRadius: 12, background: "var(--surface)", fontSize: 13, lineHeight: 1.45, color: "var(--muted)" }}>{note}</div>
        )}
        {children}
      </div>
      {(onPrimary || onSecondary) && (
        <div style={{ padding: "12px 16px calc(22px + var(--safe-bottom))", display: "flex", flexDirection: "column", gap: 8 }}>
          {onPrimary && <button type="button" className="btn btn--primary" onClick={onPrimary}>{primaryLabel}</button>}
          {onSecondary && (
            <button type="button" className="btn btn--ghost" style={{ fontSize: 15, fontWeight: 600, color: "var(--accent)" }} onClick={onSecondary}>
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </Screen>
  );
}

/** Skeleton of the home screen shown while signing in. */
export function LoadingScreen({ label }: { label?: string }) {
  const { t } = useLanguage();
  return (
    <Screen theme="night">
      <div aria-busy="true" aria-label={t("loading")} style={{ flex: 1, padding: "20px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="row row--between">
          <div className="skeleton" style={{ width: 120, height: 28 }} />
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 999 }} />
        </div>
        <div className="skeleton" style={{ width: 160, height: 18 }} />
        {[70, 55, 62].map((w) => (
          <div key={w} className="row" style={{ gap: 12, padding: 14, borderRadius: 18, background: "#121428" }}>
            <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 14, background: "#1E2138" }} />
            <div className="grow stack" style={{ gap: 8 }}>
              <div className="skeleton" style={{ width: `${w}%`, height: 14, background: "#1E2138" }} />
              <div className="skeleton" style={{ width: "60%", height: 11, background: "#1A1D33" }} />
            </div>
          </div>
        ))}
        <div className="skeleton" style={{ height: 150, borderRadius: 22, background: "#121428" }} />
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)" }}>{label ?? t("signingIn")}</div>
      </div>
    </Screen>
  );
}
