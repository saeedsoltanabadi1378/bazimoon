import { useGame } from "./GameProvider";
import { PushPrompt } from "../hub/PushPrompt";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { Avatar, Bar, Body, IconButton, Screen } from "../ui/components";
import { Icon } from "../ui/Icon";
import { playerColor, roleMeta, rolesFor } from "./roles";
import { ActionError, CreatorBox, ReconnectingBanner, useRoleName } from "./parts";
import { useSecondsLeft } from "./timers";
import { roomCode } from "./roomCode";
import { useHub, useLoad } from "../hub/HubData";
import { InviteBox } from "./InviteBox";

export function LobbyScreen() {
  const { view, busy, joinGame, leaveGame, startGame, setReady } = useGame();
  const { t, n, language, setLanguage } = useLanguage();
  const startsIn = useSecondsLeft(view?.autoStartAt);
  const { back } = useNavigation();
  const roleName = useRoleName();
  const { api } = useHub();
  const gameId = view?.gameId;
  const table = useLoad(() => (gameId ? api.tableInfo(gameId) : Promise.resolve(null)), [api, gameId]);
  if (!view) return null;
  const info = table.data;

  const joined = view.players.some((p) => p.playerId === view.yourPlayerId);
  const count = view.players.length;
  const max = view.maxPlayers || 12;
  const full = count >= max;
  const setup = view.setup;
  const setupFits = !setup || setup.problem === null;
  const startable = count >= view.minPlayers && setupFits;
  const controllerId = view.controllerPlayerId ?? view.players[0]?.playerId;
  const ready = new Set(view.readyPlayerIds ?? []);
  const youReady = ready.has(view.yourPlayerId);
  const roles = rolesFor(count, setup?.roles);
  const note = !setupFits
    ? setup!.problem === "TooManyMafia" ? t("setupTooManyMafia", { count }) : t("setupNeeds", { min: setup!.minimumPlayers, count })
    : count < view.minPlayers
    ? t("rolesNoteWaiting", { min: view.minPlayers })
    : count === 3
      ? t("rolesNoteThree")
      : t("rolesNoteNormal");

  return (
    <Screen theme="night">
      <header className="topbar">
        <IconButton icon="back" label={t("backToGames")} onClick={back} />
        <div className="topbar__text">
          <div className="row tiny muted" style={{ gap: 6 }}>
            <span>{info?.name ?? t("roomLabel", { code: roomCode(view.gameId) })}</span>
            {info && (
              <span className="row" style={{ gap: 4, padding: "1px 8px", borderRadius: 999, background: info.isOpen ? "#13302C" : "#1E2138", color: info.isOpen ? "#5FD0BE" : "#B79CF2", fontWeight: 600 }}>
                <Icon name={info.isOpen ? "globe" : "lock"} size={11} strokeWidth={2.6} />
                {info.isOpen ? t("tablePublic") : t("tablePrivate")}
              </span>
            )}
          </div>
          <div className="display" style={{ fontSize: 22 }}>Bazimoon</div>
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
          <div className="small" style={{ marginTop: 6 }}>
            <b className="num">{n(ready.size)}</b> {t("readyOf", { count })}
          </div>
          <div className="small muted">{full ? t("readyHintFull") : t("readyHintFilling", { max })}</div>
        </section>

        {startsIn !== null && (
          <div role="timer" className="row" style={{ gap: 14, padding: 16, borderRadius: 18, background: "#1A1836", border: "1.5px solid #9C8CFF" }}>
            <span className="display" style={{ width: 52, height: 52, flex: "none", borderRadius: 999, background: "#9C8CFF", color: "#120D2E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{n(startsIn)}</span>
            <div className="stack" style={{ gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{t("startingTitle")}</span>
              <span className="small" style={{ color: "var(--text-2)" }}>{t("startingText")}</span>
            </div>
          </div>
        )}

        {joined && info?.isHost && info.inviteCode && <InviteBox info={info} onChange={table.setData} />}

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
          {setup && setup.preset !== "Classic" && <p className="tiny strong" style={{ color: "#9C8CFF" }}>{t("setupLabel", { preset: t(`preset${setup.preset}`) })}</p>}
          {setupFits ? (
            <p className="small muted">{note}</p>
          ) : (
            <p role="alert" className="small" style={{ padding: "10px 12px", borderRadius: 12, background: "#2A1612", border: "1px solid #4A2620", color: "#F4D2CC" }}>{note}</p>
          )}
        </section>

        <section className="stack stack--sm" aria-labelledby="table-rules">
          <h2 id="table-rules" className="h2">{t("tableRules")}</h2>
          <p className="small muted" style={{ margin: 0 }}>
            {[
              t("ruleSpeaking", { seconds: view.rules.speakerSeconds }),
              t("ruleChallenge", { seconds: view.rules.challengeSeconds }),
              t("ruleDefence", { seconds: view.rules.defenceSeconds }),
              t("ruleLastWords", { seconds: view.rules.lastWordsSeconds }),
              view.rules.nightSeconds ? t("ruleNight", { seconds: view.rules.nightSeconds }) : t("ruleNightOff"),
              view.rules.votingSeconds ? t("ruleVoting", { seconds: view.rules.votingSeconds }) : t("ruleVotingOff"),
            ].join(" · ")}
          </p>
          {view.rules.lastWordsForNightKills && <p className="small muted" style={{ margin: 0 }}>{t("ruleNightLastWords")}</p>}
          {view.rules.godfatherAppearsInnocent && <p className="small muted" style={{ margin: 0 }}>{t("optInnocent")}</p>}
          {!view.rules.revealRolesOnDeath && <p className="small muted" style={{ margin: 0 }}>{t("hiddenRolesNote")}</p>}
        </section>

        <ul className="list" style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label={t("playersInLobby")}>
          {view.players.map((p) => {
            const you = p.playerId === view.yourPlayerId;
            return (
              <li key={p.playerId} className="list__row">
                <Avatar name={p.displayName} color={playerColor(view, p.playerId)} size={36} fontSize={15} />
                <span className="grow" style={{ fontSize: 15 }}>{you ? t("youName", { name: p.displayName }) : p.displayName}</span>
                {p.playerId === controllerId && <span className="tiny strong" style={{ color: "#9C8CFF" }}>{t("creator")}</span>}
                <span className="tiny strong" style={{ padding: "3px 10px", borderRadius: 999, background: ready.has(p.playerId) ? "#13302C" : "#1E2138", color: ready.has(p.playerId) ? "#5FD0BE" : "#9A9CB8" }}>
                  {ready.has(p.playerId) ? t("ready") : t("notYet")}
                </span>
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
        {joined && (
          <button
            type="button"
            className={`btn ${youReady ? "btn--outline" : "btn--primary"}`}
            aria-pressed={youReady}
            disabled={busy}
            onClick={() => void setReady(!youReady)}
          >
            {youReady ? t("notReady") : t("imReady")}
          </button>
        )}
        {joined && view.youAreController && startsIn === null && (
          <CreatorBox note={t("creatorStartNote", { min: view.minPlayers })}>
            {startable ? (
              <button type="button" className="btn btn--outline" disabled={busy} onClick={() => void startGame()}>{t("startNow")}</button>
            ) : (
              <button type="button" className="btn btn--locked" disabled>{t("needPlayers", { count, min: view.minPlayers })}</button>
            )}
          </CreatorBox>
        )}
        {joined && (
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void leaveGame()}>{t("leaveLobby")}</button>
        )}
      </Bar>
      <PushPrompt active={joined} />
    </Screen>
  );
}
