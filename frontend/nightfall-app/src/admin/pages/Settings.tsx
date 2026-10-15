import { useEffect, useState } from "react";
import { adminApi, ALL_COMMANDS, type BotSettings } from "../adminApi";
import { useAdminI18n } from "../i18n";
import { Header, PageState, Svg, ICONS, useAdminData } from "../ui";

type MessageKey = "welcomeMessage" | "helpMessage" | "reminderMessage";

export function SettingsPage() {
  const { t, date } = useAdminI18n();
  const { data, error, reload, setData } = useAdminData<BotSettings>("/settings");
  const [draft, setDraft] = useState<BotSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  // Warn before leaving the page with unsaved edits.
  const changes = data && draft ? countChanges(data, draft) : 0;
  useEffect(() => {
    if (!changes) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changes]);

  const header = (version?: number, updated?: string) => (
    <Header kicker={t("configKicker", { version: version ?? 0 })} title={t("settingsTitle")}>
      {updated && <span className="small text-2">{t("lastSaved", { date: date(updated, true) })}</span>}
    </Header>
  );
  if (!data || !draft) return <main className="adm-main">{header()}<PageState error={error} onRetry={reload} /></main>;

  const set = <K extends keyof BotSettings>(key: K, value: BotSettings[K]) => {
    setMessage(null);
    setDraft({ ...draft, [key]: value });
  };
  const toggleCommand = (cmd: string) => set("enabledCommands", draft.enabledCommands.includes(cmd) ? draft.enabledCommands.filter((c) => c !== cmd) : [...draft.enabledCommands, cmd]);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await adminApi.put<BotSettings>("/settings", draft);
      setData(saved);
      setMessage({ text: t("saved"), ok: true });
    } catch (e) {
      setMessage({ text: (e as Error).message, ok: false });
    } finally {
      setBusy(false);
    }
  }

  const steppers: { key: "minPlayers" | "maxPlayers"; label: string; hint: string; min: number; max: number }[] = [
    { key: "minPlayers", label: t("minPlayers"), hint: t("minPlayersHint"), min: 3, max: draft.maxPlayers },
    { key: "maxPlayers", label: t("maxPlayers"), hint: t("maxPlayersHint"), min: draft.minPlayers, max: 12 },
  ];
  const messages: { key: MessageKey; title: string; rows: number }[] = [
    { key: "welcomeMessage", title: t("msgWelcome"), rows: 3 },
    { key: "helpMessage", title: t("msgHelp"), rows: 7 },
    { key: "reminderMessage", title: t("msgReminder"), rows: 2 },
  ];

  return (
    <main className="adm-main" style={{ gap: 18 }}>
      {header(data.version, data.updatedAt)}

      {draft.maintenanceMode && !data.maintenanceMode && (
        <div role="status" className="adm-banner">
          <Svg d={ICONS.alert} size={20} stroke="#F0A83A" />
          <div style={{ fontSize: 14, lineHeight: 1.45 }}><b>{t("maintenanceWarning")}</b> {t("maintenanceWarningBody")}</div>
        </div>
      )}

      <div className="adm-grid">
        <section className="adm-panel" aria-labelledby="rules-title" style={{ gap: 14 }}>
          <h2 id="rules-title" style={{ fontSize: 16, fontWeight: 600 }}>{t("tablesTitle")}</h2>
          {steppers.map((st) => (
            <div key={st.key} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 12, borderTop: "1px solid #1E2138" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontWeight: 600 }}>{st.label}</span>
                <span className="tiny muted">{st.hint}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button type="button" className="adm-btn" style={{ width: 40, minHeight: 40, padding: 0, fontSize: 18 }} aria-label={`${t("fewer")} · ${st.label}`} disabled={draft[st.key] <= st.min} onClick={() => set(st.key, draft[st.key] - 1)}>−</button>
                <output className="num" style={{ minWidth: 44, textAlign: "center", fontSize: 18, fontWeight: 700 }}>{draft[st.key]}</output>
                <button type="button" className="adm-btn" style={{ width: 40, minHeight: 40, padding: 0, fontSize: 18 }} aria-label={`${t("more")} · ${st.label}`} disabled={draft[st.key] >= st.max} onClick={() => set(st.key, draft[st.key] + 1)}>+</button>
              </div>
            </div>
          ))}
          <label className="adm-label" style={{ fontSize: 14, paddingTop: 12, borderTop: "1px solid #1E2138" }}>
            {t("miniAppLink")}
            <input className="adm-input" type="url" value={draft.miniAppBaseUrl} onChange={(e) => set("miniAppBaseUrl", e.target.value)} placeholder="https://t.me/YourBot/app" dir="ltr" />
            <span className="tiny muted" style={{ fontWeight: 400 }}>{t("miniAppHint")}</span>
          </label>
        </section>

        <section className="adm-panel" aria-labelledby="maint-title" style={{ gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <h2 id="maint-title" style={{ fontSize: 16, fontWeight: 600 }}>{t("maintenanceTitle")}</h2>
              <span className="tiny muted">{t("maintenanceHint")}</span>
            </div>
            <button type="button" role="switch" className="adm-switch warn" aria-checked={draft.maintenanceMode} aria-labelledby="maint-title" onClick={() => set("maintenanceMode", !draft.maintenanceMode)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 10 }}>
            <label className="adm-label">
              {t("messageEn", { title: t("maintenanceMessage") })}
              <textarea className="adm-textarea" rows={3} value={draft.maintenanceMessage} onChange={(e) => set("maintenanceMessage", e.target.value)} dir="ltr" />
            </label>
            <label className="adm-label">
              {t("messageFa", { title: t("maintenanceMessage") })}
              <textarea className="adm-textarea" rows={3} value={draft.maintenanceMessageFa} onChange={(e) => set("maintenanceMessageFa", e.target.value)} dir="rtl" style={{ fontFamily: "'Vazirmatn', sans-serif" }} />
            </label>
          </div>
        </section>
      </div>

      <section className="adm-panel" aria-labelledby="cmd-title" style={{ gap: 12 }}>
        <div className="adm-panel-head">
          <h2 id="cmd-title">{t("commandsTitle")}</h2>
          <span className="tiny muted">{t("commandsHint")}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))", gap: 8 }}>
          {ALL_COMMANDS.map((cmd) => {
            const on = draft.enabledCommands.includes(cmd);
            return (
              <div key={cmd} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 52, padding: "0 12px", borderRadius: 12, background: "#0B0D1A" }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 600 }} dir="ltr">/{cmd}</span>
                  <span className="tiny muted">{t(`cmd_${cmd}`)}</span>
                </div>
                <button type="button" role="switch" className="adm-switch sm" aria-checked={on} aria-label={t("enabled", { name: `/${cmd}` })} onClick={() => toggleCommand(cmd)} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="adm-panel" aria-labelledby="msg-title" style={{ gap: 12 }}>
        <div className="adm-panel-head">
          <h2 id="msg-title">{t("messagesTitle")}</h2>
          <span className="tiny muted">{t("messagesHint")}</span>
        </div>
        {messages.map((m) => {
          const faKey = `${m.key}Fa` as `${MessageKey}Fa`;
          return (
            <div key={m.key} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 10, paddingTop: 12, borderTop: "1px solid #1E2138" }}>
              <label className="adm-label">
                {t("messageEn", { title: m.title })}
                <textarea className="adm-textarea" rows={m.rows} value={draft[m.key]} onChange={(e) => set(m.key, e.target.value)} dir="ltr" />
              </label>
              <label className="adm-label">
                {t("messageFa", { title: m.title })}
                <textarea className="adm-textarea" rows={m.rows} value={draft[faKey]} onChange={(e) => set(faKey, e.target.value)} dir="rtl" style={{ fontFamily: "'Vazirmatn', sans-serif" }} />
              </label>
            </div>
          );
        })}
      </section>

      <div className="adm-savebar">
        <span role="status" style={{ fontSize: 14, color: message ? (message.ok ? "#5FD0BE" : "#F08A7A") : changes ? "#F0A83A" : "#9A9CB8" }}>
          {message?.text ?? (changes === 0 ? t("allSaved") : changes === 1 ? t("unsavedOne") : t("unsaved", { count: changes }))}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="adm-btn" disabled={!changes || busy} onClick={() => { setDraft(data); setMessage(null); }}>{t("discard")}</button>
          <button type="button" className="adm-btn primary" disabled={!changes || busy} onClick={() => void save()}>{busy ? t("saving") : t("save")}</button>
        </div>
      </div>
    </main>
  );
}

function countChanges(a: BotSettings, b: BotSettings) {
  const keys: (keyof BotSettings)[] = ["minPlayers", "maxPlayers", "maintenanceMode", "maintenanceMessage", "maintenanceMessageFa", "miniAppBaseUrl",
    "welcomeMessage", "welcomeMessageFa", "helpMessage", "helpMessageFa", "reminderMessage", "reminderMessageFa"];
  let n = keys.filter((k) => a[k] !== b[k]).length;
  for (const cmd of ALL_COMMANDS) if (a.enabledCommands.includes(cmd) !== b.enabledCommands.includes(cmd)) n++;
  return n;
}
