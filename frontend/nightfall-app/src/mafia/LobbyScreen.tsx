import { useGame } from "./GameProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { Avatar, Bar, Body, IconButton, Screen } from "../ui/components";
import { Icon } from "../ui/Icon";
import { playerColor, roleMeta, rolesFor } from "./roles";
import { ActionError, ReconnectingBanner, useRoleName } from "./parts";
import { roomCode } from "./roomCode";

export function LobbyScreen() {
  const { view, busy, joinGame, leaveGame, startGame } = useGame();
  const { t, language, setLanguage } = useLanguage();
  const { back } = useNavigation();
  const roleName = useRoleName();
  if (!view) return null;

  const joined = view.players.some((p) => p.playerId === view.yourPlayerId);
  const count = view.players.length;
  const max = view.maxPlayers || 12;
  const full = count >= max;
  const startable = count >= view.minPlayers;
  const controllerId = view.players[0]?.playerId;
  const roles = rolesFor(count);
  const note = !startable
    ? t("rolesNoteWaiting", { min: view.minPlayers })
    : count === 3
      ? t("rolesNoteThree")
      : t("rolesNoteNormal");

  return (
    <Screen theme="night">
      <header className="topbar">
        <IconButton icon="back" label={t("backToGames")} onClick={back} />
        <div className="topbar__text">
          <div className="tiny muted">{t("roomLabel", { code: roomCode(view.gameId) })}</div>
          <div className="display" style={{ fontSize: 22 }}>Nightfall</div>
        </div>
        <button type="button" className="btn btn--outline btn--pill" style={{ fontSize: 13, padding: "0 14px" }} onClick={() => setLanguage(language === "en" ? "fa" : "en")}>
          {t("otherLanguage")}
        </button>
      </header>

      <Body>
        <ReconnectingBanner />
        <section className="card card--lg stack stack--sm" aria-label={t("lobby")}>
          <span className="kicker">{t("lobby")}</span>
          <div className="row row--baseline" style={{ gap: 8 }}>
            <span className="display num" style={{ fontSize: 44, lineHeight: 1 }}>{count}</span>
            <span style={{ fontSize: 16, color: "var(--text-2)" }}>{t("ofJoined", { max })}</span>
          </div>
          <div className="row" style={{ gap: 4, marginTop: 6 }} aria-hidden="true">
            {Array.from({ length: max }, (_, i) => (
              <span key={i} style={{ flex: 1, height: 6, borderRadius: 999, background: i < count ? "#9C8CFF" : i < view.minPlayers ? "#3A3566" : "#1E2138" }} />
            ))}
          </div>
          <div className="small muted">{t("atLeastToStart", { min: view.minPlayers })}</div>
        </section>

        <section className="stack">
          <h2 className="h2">{t("rolesForPlayers", { count })}</h2>
          {roles.length > 0 && (
            <div className="row row--wrap">
              {roles.map(({ role, n }) => {
                const meta = roleMeta[role];
                return (
                  <span key={role} className="row" style={{ gap: 8, padding: "8px 12px 8px 8px", paddingInlineStart: 8, borderRadius: 999, background: "var(--surface)", border: "1px solid var(--edge-soft)" }}>
                    <span style={{ width: 26, height: 26, borderRadius: 999, background: meta.bg, color: meta.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name={meta.icon} size={15} />
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{n} {role === "Villager" && n !== 1 ? t("villagersPlural") : roleName(role)}</span>
                  </span>
                );
              })}
            </div>
          )}
          <p className="small muted">{note}</p>
        </section>

        <ul className="list" style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label={t("playersInLobby")}>
          {view.players.map((p) => {
            const you = p.playerId === view.yourPlayerId;
            return (
              <li key={p.playerId} className="list__row">
                <Avatar name={p.telegramUsername} color={playerColor(view, p.playerId)} size={36} fontSize={15} />
                <span className="grow" style={{ fontSize: 15 }}>{you ? t("youName", { name: p.telegramUsername }) : p.telegramUsername}</span>
                {p.playerId === controllerId && <span className="tiny strong" style={{ color: "#9C8CFF" }}>{t("creator")}</span>}
              </li>
            );
          })}
        </ul>
        <ActionError />
      </Body>

      <Bar>
        {!joined && !full && (
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void joinGame()}>{t("joinLobby")}</button>
        )}
        {!joined && full && (
          <button type="button" className="btn btn--outline" disabled>{t("lobbyFull", { max })}</button>
        )}
        {joined && view.youAreController && startable && (
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void startGame()}>{t("startGame")}</button>
        )}
        {joined && view.youAreController && !startable && (
          <button type="button" className="btn btn--locked" disabled>{t("needPlayers", { count, min: view.minPlayers })}</button>
        )}
        {joined && !view.youAreController && (
          <div style={{ textAlign: "center", padding: 14, borderRadius: 16, border: "1.5px dashed var(--edge)", color: "var(--text-2)", fontSize: 15 }}>
            {t("waitingCreatorStart")}
          </div>
        )}
        {joined && (
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void leaveGame()}>{t("leaveLobby")}</button>
        )}
      </Bar>
    </Screen>
  );
}
