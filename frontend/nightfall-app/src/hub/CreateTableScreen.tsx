import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { Body, Screen, TopBar } from "../ui/components";
import { Icon } from "../ui/Icon";
import { useHub, useLoad } from "./HubData";
import { addToGroupLink } from "../lib/links";
import { openTelegramLink } from "../lib/telegram";
import { haptic } from "../lib/haptics";

const MIN_SEATS = 3;
const MAX_SEATS = 12;
const groupColors = ["#F0A83A", "#5FD0BE", "#B79CF2", "#8FA8FF", "#E9D8A6", "#F08A7A"];

/** Start a Mafia table for one of your groups: pick the group, who can join, a name and seats.
 * The bot then posts the table in that group. */
export function CreateTableScreen() {
  const { t, n, language } = useLanguage();
  const { back, replace } = useNavigation();
  const { api } = useHub();
  const { data: groups, error, reload } = useLoad(() => api.tableGroups(), [api]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [name, setName] = useState("");
  const [seats, setSeats] = useState(10);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Pick the first group without a table once the list arrives.
  useEffect(() => {
    if (groups && chatId === null) setChatId(groups.find((g) => !g.activeGameId)?.telegramChatId ?? null);
  }, [groups, chatId]);

  const group = groups?.find((g) => g.telegramChatId === chatId) ?? null;
  const groupName = group?.title ?? t("thisGroup");
  const addGroup = addToGroupLink();

  async function create() {
    if (!group) return;
    setBusy(true);
    setFailed(false);
    try {
      const { gameId } = await api.createTable({ telegramChatId: group.telegramChatId, name: name.trim() || null, isOpen, seats });
      haptic.success();
      replace({ name: "mafia", gameId });
    } catch {
      setFailed(true);
      reload();
    } finally {
      setBusy(false);
    }
  }

  const options = [
    { open: true, title: t("openToEveryone"), desc: t("openToEveryoneDesc"), icon: "globe" as const, bg: "#13302C", fg: "#5FD0BE" },
    { open: false, title: t("groupMembersOnly"), desc: t("groupMembersOnlyDesc", { group: groupName }), icon: "lock" as const, bg: "#1E2138", fg: "#B79CF2" },
  ];
  const selected = (on: boolean) => ({ border: `2px solid ${on ? "#9C8CFF" : "#262A44"}`, background: on ? "#1A1836" : "var(--surface)" });

  return (
    <Screen theme="night">
      <TopBar onBack={back} backLabel={t("backToTables")} title={t("createTable")} titleSize={24} />
      <Body style={{ gap: 18 }}>
        <fieldset className="stack" style={{ margin: 0, padding: 0, border: 0, gap: 8 }}>
          <legend style={{ padding: "0 0 8px", fontSize: 15, fontWeight: 600 }}>{t("whichGroup")}</legend>
          {!groups && !error && <div className="skeleton" style={{ height: 56, borderRadius: 14 }} />}
          {error && <button type="button" className="btn btn--outline" onClick={reload}>{t("tryAgain")}</button>}
          {groups?.length === 0 && <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-2)" }}>{t("noGroupsYet")}</p>}
          {groups?.map((g, i) => {
            const on = g.telegramChatId === chatId;
            const taken = g.activeGameId !== null;
            const title = g.title ?? t("thisGroup");
            return (
              <button
                key={g.telegramChatId}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={taken}
                onClick={() => setChatId(g.telegramChatId)}
                className="row"
                style={{ ...selected(on), gap: 12, minHeight: 56, padding: "0 14px", borderRadius: 14, color: "var(--text)", font: "inherit", textAlign: "start", cursor: taken ? "default" : "pointer", opacity: taken ? 0.55 : 1 }}
              >
                <span style={{ width: 36, height: 36, flex: "none", borderRadius: 10, background: groupColors[i % groupColors.length], color: "#0B0D1A", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {Array.from(title)[0]?.toUpperCase()}
                </span>
                <span className="grow stack" style={{ gap: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
                  <span className="tiny muted">
                    {taken ? t("groupHasTable") : g.since ? t("groupMeta", { count: g.players, date: new Date(g.since).toLocaleDateString(language === "fa" ? "fa-IR" : "en-GB", { day: "numeric", month: "short" }) }) : t("groupMetaNoDate", { count: g.players })}
                  </span>
                </span>
                <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${on ? "#9C8CFF" : "#4A4E70"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: on ? "#9C8CFF" : "transparent" }} />
                </span>
              </button>
            );
          })}
          <div className="tiny muted" style={{ lineHeight: 1.45 }}>
            {t("groupsNote")}{" "}
            {addGroup && <button type="button" onClick={() => openTelegramLink(addGroup)} style={{ background: "none", border: 0, padding: 0, color: "#9C8CFF", font: "inherit", cursor: "pointer", textDecoration: "underline" }}>
              {t("addBotToGroup")}
            </button>}
          </div>
        </fieldset>

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
        <button type="button" className="btn" disabled={!group || busy} onClick={() => void create()} style={{ background: "#E5604D", color: "#1C0905" }}>
          {busy ? t("creating") : t("createAndOpen")}
        </button>
        <span className="tiny muted" style={{ textAlign: "center" }}>{t("createFootnote", { group: groupName })}</span>
      </div>
    </Screen>
  );
}
