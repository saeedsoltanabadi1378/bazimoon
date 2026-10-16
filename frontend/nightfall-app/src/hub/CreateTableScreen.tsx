import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { Body, Screen, TopBar } from "../ui/components";
import { Icon } from "../ui/Icon";
import { useHub } from "./HubData";
import { haptic } from "../lib/haptics";

const MIN_SEATS = 3;
const MAX_SEATS = 12;

/** Open a Mafia table: public (listed for everyone) or private, a name and seats. No group is
 * needed; the host shares the invite link from the lobby. */
export function CreateTableScreen() {
  const { t, n } = useLanguage();
  const { back, replace } = useNavigation();
  const { api } = useHub();
  const [isOpen, setIsOpen] = useState(true);
  const [name, setName] = useState("");
  const [seats, setSeats] = useState(10);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function create() {
    setBusy(true);
    setFailed(false);
    try {
      const { gameId } = await api.createTable({ name: name.trim() || null, isOpen, seats });
      haptic.success();
      replace({ name: "mafia", gameId });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const options = [
    { open: true, title: t("publicTable"), desc: t("publicTableDesc"), icon: "globe" as const, bg: "#13302C", fg: "#5FD0BE" },
    { open: false, title: t("privateTable"), desc: t("privateTableDesc"), icon: "lock" as const, bg: "#1E2138", fg: "#B79CF2" },
  ];
  const selected = (on: boolean) => ({ border: `2px solid ${on ? "#9C8CFF" : "#262A44"}`, background: on ? "#1A1836" : "var(--surface)" });

  return (
    <Screen theme="night">
      <TopBar onBack={back} backLabel={t("backToTables")} title={t("createTable")} titleSize={24} />
      <Body style={{ gap: 18 }}>
        <fieldset className="stack" role="radiogroup" style={{ margin: 0, padding: 0, border: 0, gap: 8 }}>
          <legend style={{ padding: "0 0 8px", fontSize: 15, fontWeight: 600 }}>{t("whoCanJoin")}</legend>
          {options.map((o) => {
            const on = o.open === isOpen;
            return (
              <button key={String(o.open)} type="button" role="radio" aria-checked={on} onClick={() => setIsOpen(o.open)} className="row" style={{ ...selected(on), alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 16, color: "var(--text)", font: "inherit", textAlign: "start", cursor: "pointer" }}>
                <span style={{ width: 36, height: 36, flex: "none", borderRadius: 10, background: o.bg, color: o.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={o.icon} size={18} />
                </span>
                <span className="grow stack" style={{ gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{o.title}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.45, color: "var(--text-2)" }}>{o.desc}</span>
                </span>
              </button>
            );
          })}
        </fieldset>

        <label className="stack" style={{ gap: 6, fontSize: 15, fontWeight: 600 }}>
          {t("tableName")}
          <input
            type="text"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("tableNamePlaceholder")}
            dir="auto"
            style={{ minHeight: 48, padding: "0 14px", borderRadius: 12, border: "1px solid #3A3F5E", background: "var(--surface)", color: "var(--text)", font: "400 15px inherit", fontFamily: "inherit" }}
          />
        </label>

        <div className="row row--between" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{t("seats")}</span>
            <span className="tiny muted">{t("seatsRange", { min: MIN_SEATS, max: MAX_SEATS })}</span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn btn--outline" aria-label={t("fewerSeats")} disabled={seats <= MIN_SEATS} onClick={() => setSeats((s) => s - 1)} style={{ width: 44, minHeight: 44, padding: 0, fontSize: 18 }}>−</button>
            <output aria-live="polite" className="num" style={{ minWidth: 40, textAlign: "center", fontSize: 20, fontWeight: 700 }}>{n(seats)}</output>
            <button type="button" className="btn btn--outline" aria-label={t("moreSeats")} disabled={seats >= MAX_SEATS} onClick={() => setSeats((s) => s + 1)} style={{ width: 44, minHeight: 44, padding: 0, fontSize: 18 }}>+</button>
          </div>
        </div>
        {failed && <p role="alert" className="small" style={{ color: "#F08A7A" }}>{t("genericError")}</p>}
      </Body>

      <div className="stack" style={{ gap: 8, padding: "12px 16px 22px", background: "#10122A", borderTop: "1px solid #1E2138" }}>
        <button type="button" className="btn" disabled={busy} onClick={() => void create()} style={{ background: "#E5604D", color: "#1C0905" }}>
          {busy ? t("creating") : t("createAndOpen")}
        </button>
        <span className="tiny muted" style={{ textAlign: "center" }}>{t("createFootnote")}</span>
      </div>
    </Screen>
  );
}
