import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { Body, IconButton, Screen, Switch, TopBar } from "../ui/components";
import { useHub } from "../hub/HubData";
import { haptic } from "../lib/haptics";
import { clanError } from "./clanText";

const field = { width: "100%", minHeight: 48, padding: "0 14px", borderRadius: 14, border: "1px solid #3A3F5E", background: "#0B0D1A", color: "var(--text)", font: "inherit", fontSize: 15 } as const;
const MIN_SEATS = 4;
const MAX_SEATS = 12;

/** "yyyy-MM-ddTHH:mm" in local time, as a datetime-local input wants it. */
function localInput(date: Date) {
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Tomorrow at 21:00, the usual Mafia hour. */
function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(21, 0, 0, 0);
  return localInput(d);
}

/** An owner or admin plans a game night: name, when, seats, a note, and whether it repeats weekly. */
export function ClanEventScreen({ clanId }: { clanId: string }) {
  const { t, n } = useLanguage();
  const { back } = useNavigation();
  const { clans } = useHub();
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(defaultStart);
  const [seats, setSeats] = useState(10);
  const [note, setNote] = useState("");
  const [weekly, setWeekly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startsAt = when ? new Date(when) : null;
  const valid = title.trim().length > 0 && startsAt !== null && !Number.isNaN(startsAt.getTime());

  async function create() {
    if (!valid || !startsAt) return;
    setBusy(true);
    setError(null);
    try {
      await clans.createEvent(clanId, { title: title.trim(), note: note.trim() || null, startsAt: startsAt.toISOString(), seats, repeatWeekly: weekly });
      haptic.success();
      back();
    } catch (err) {
      setError(clanError(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen theme="night">
      <TopBar onBack={back} title={t("clanEventTitle")} titleSize={24} />
      <Body style={{ gap: 20, paddingBottom: 24 }}>
        <label className="stack" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 600 }}>{t("clanEventName")}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder={t("clanEventNamePlaceholder")} autoComplete="off" style={field} />
        </label>

        <label className="stack" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 600 }}>{t("clanEventWhen")}</span>
          <input type="datetime-local" dir="ltr" value={when} min={localInput(new Date())} onChange={(e) => setWhen(e.target.value)} style={{ ...field, colorScheme: "dark" }} />
        </label>

        <div className="row row--between" style={{ gap: 12 }}>
          <span className="small" style={{ fontWeight: 600 }} id="seats-label">{t("clanEventSeats")}</span>
          <div className="row" style={{ gap: 10 }} role="group" aria-labelledby="seats-label">
            <IconButton icon="minus" label={`${t("clanEventSeats")} −`} disabled={seats <= MIN_SEATS} onClick={() => setSeats((s) => Math.max(MIN_SEATS, s - 1))} />
            <span className="num display" aria-live="polite" style={{ minWidth: 32, textAlign: "center", fontSize: 22, fontWeight: 800 }}>{n(seats)}</span>
            <IconButton icon="plus" label={`${t("clanEventSeats")} +`} disabled={seats >= MAX_SEATS} onClick={() => setSeats((s) => Math.min(MAX_SEATS, s + 1))} />
          </div>
        </div>

        <label className="stack" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 600 }}>{t("clanEventNote")}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={3} placeholder={t("clanEventNotePlaceholder")} style={{ ...field, minHeight: 88, padding: "12px 14px", resize: "none", lineHeight: 1.45 }} />
        </label>

        <button type="button" role="switch" aria-checked={weekly} onClick={() => setWeekly((w) => !w)} className="row"
          style={{ gap: 12, padding: 14, borderRadius: 16, border: "1px solid #2E3252", background: "var(--surface)", color: "var(--text)", font: "inherit", textAlign: "start", cursor: "pointer" }}>
          <span className="grow stack" style={{ gap: 2 }}>
            <span style={{ fontWeight: 700 }}>{t("clanEventWeekly")}</span>
            <span className="tiny muted" style={{ lineHeight: 1.4 }}>{t("clanEventWeeklyDesc")}</span>
          </span>
          <Switch on={weekly} />
        </button>

        <p className="tiny muted" style={{ lineHeight: 1.5 }}>{t("clanEventHint")}</p>
      </Body>
      <div className="screen__bar">
        {error && <div className="small" role="alert" style={{ color: "#F08A7A", textAlign: "center" }}>{error}</div>}
        <button type="button" className="btn" disabled={busy || !valid} onClick={() => void create()} style={{ background: "#E5604D", color: "#1C0905" }}>
          {t("clanEventCreate")}
        </button>
      </div>
    </Screen>
  );
}
