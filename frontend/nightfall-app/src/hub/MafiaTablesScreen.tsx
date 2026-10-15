import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { Avatar, Body, IconDisc, Screen } from "../ui/components";
import { TabBar } from "../ui/TabBar";
import { useHub, useLoad } from "./HubData";
import { roomCode } from "../mafia/roomCode";
import { formatTimeOfDay } from "../lib/format";

const avatarColors = ["#F0A83A", "#5FD0BE", "#B79CF2", "#E5604D", "#8FA8FF", "#E9D8A6"];

/** Mafia tab: the open tables in your Telegram groups, or how to start one. */
export function MafiaTablesScreen() {
  const { t, language } = useLanguage();
  const { push } = useNavigation();
  const { api } = useHub();
  const { data, loading, error, reload } = useLoad(() => api.tables(), [api]);

  return (
    <Screen theme="night">
      <header className="topbar">
        <div className="topbar__text">
          <h1 className="display" style={{ fontSize: 26 }}>Nightfall</h1>
          <div className="tiny muted">{t("mafiaTablesSubtitle")}</div>
        </div>
      </header>
      <Body>
        {loading && !data && <div className="skeleton" style={{ height: 150, borderRadius: 22 }} />}
        {error && (
          <div className="card stack center">
            <p className="soft small">{t("genericError")}</p>
            <button type="button" className="btn btn--outline btn--pill" onClick={reload}>{t("tryAgain")}</button>
          </div>
        )}
        {data && data.length === 0 && (
          <div className="stack center" style={{ gap: 14, padding: "36px 18px", borderRadius: 22, background: "var(--surface-3)", textAlign: "center" }}>
            <IconDisc icon="moon" size={88} iconSize={40} bg="#1E2138" fg="#9C8CFF" />
            <h2 className="display" style={{ fontSize: 22, fontWeight: 700 }}>{t("state_no-table_title")}</h2>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-2)", maxWidth: 300 }}>{t("state_no-table_body")}</p>
            <div style={{ maxWidth: 300, padding: "10px 14px", borderRadius: 12, background: "var(--surface)", fontSize: 13, color: "var(--muted)" }}>{t("state_no-table_note")}</div>
          </div>
        )}
        {data?.map((table) => (
          <button
            key={table.gameId}
            type="button"
            onClick={() => push({ name: "mafia", gameId: table.gameId })}
            className="stack"
            style={{ gap: 14, padding: 18, borderRadius: 22, background: "#22161A", border: "1px solid #3D2328", color: "var(--text)", textAlign: "start", cursor: "pointer" }}
          >
            <span className="row row--between" style={{ width: "100%" }}>
              <span className="stack" style={{ gap: 2 }}>
                <span className="kicker" style={{ color: "#F08A7A" }}>{t(`tablePhase_${table.phase}` as "tablePhase_Lobby")}</span>
                <span className="display" style={{ fontSize: 22, fontWeight: 700 }}>{t("mafiaRoom", { code: roomCode(table.gameId) })}</span>
              </span>
              <span style={{ textAlign: "end" }}>
                <span style={{ display: "block", fontSize: 20, fontWeight: 600 }}>{formatTimeOfDay(table.createdAt, language)}</span>
                <span className="tiny" style={{ color: "#B9A6A9" }}>{t("seatedOf", { seated: table.seated, max: table.maxPlayers })}</span>
              </span>
            </span>
            <span className="row" style={{ gap: 0 }} aria-hidden="true">
              {table.players.map((name, i) => (
                <Avatar key={`${name}-${i}`} name={name} color={avatarColors[i % avatarColors.length]} size={34} fontSize={13} style={{ marginInlineEnd: -8, border: "2px solid #22161A", color: "#101218" }} />
              ))}
            </span>
            <span className="btn btn--md" style={{ background: "#E5604D", color: "#1C0905" }}>
              {table.youAreSeated ? t("returnToTable") : table.phase === "Lobby" ? t("takeASeat") : t("watchTable")}
            </span>
          </button>
        ))}
      </Body>
      <TabBar />
    </Screen>
  );
}
