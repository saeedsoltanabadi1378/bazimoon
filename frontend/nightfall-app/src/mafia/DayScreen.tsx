import { useEffect, useState } from "react";
import { useGame } from "./GameProvider";
import { useVoice } from "./VoiceProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { Bar, Body, PhaseHeader, Screen } from "../ui/components";
import { Icon, type IconName } from "../ui/Icon";
import { findPlayer, playerColor } from "./roles";
import { ActionError, LeaveGameButton, ReconnectingBanner, RolePeek, useRoleName, TableNotices } from "./parts";
import { GraveyardBar, SpectatorBanner, SpectatorList } from "./Graveyard";
import { haptic } from "../lib/haptics";

const RING = 2 * Math.PI * 60;

export function DayScreen() {
  const { view, busy, requestChallenge, cancelChallenge, acceptChallenge, rejectChallenge, finishDiscussion, startVoting, revealMayor, callInquiry } = useGame();
  const voice = useVoice();
  const { t } = useLanguage();
  const roleName = useRoleName();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  if (!view) return null;

  const name = (id: string | null | undefined) => {
    const p = findPlayer(view, id);
    if (!p) return t("unknown");
    return p.playerId === view.yourPlayerId ? t("youName", { name: p.telegramUsername }) : p.telegramUsername;
  };

  // Morning report.
  const night = view.lastNightElimination;
  const dead = findPlayer(view, night?.eliminatedPlayerId);
  type Report = { title: string; text: string; icon: IconName; bg: string; edge: string; fg: string; ibg: string };
  let report: Report;
  if (dead) {
    report = {
      title: t("foundDead", { name: name(dead.playerId) }),
      text: dead.revealedRole ? t("theyWereThe", { role: roleName(dead.revealedRole) }) : view.rules.revealRolesOnDeath ? "" : t("roleHidden"),
      icon: "coffin", bg: "#2A1612", edge: "#4A2620", fg: "#F08A7A", ibg: "#3A1C1A",
    };
  } else if (night?.wasSaved) {
    report = { title: t("doctorSavedTitle"), text: t("nobodyDied"), icon: "doctor", bg: "#10251F", edge: "#1E4A40", fg: "#5FD0BE", ibg: "#13302C" };
  } else {
    report = { title: t("quietNight"), text: t("nobodyDied"), icon: "sun", bg: "#241D12", edge: "#4A3A22", fg: "#F0A83A", ibg: "#3A2A16" };
  }

  // Notices for the new roles, below the morning report.
  type Notice = { key: string; title: string; text: string; icon: IconName; bg: string; edge: string; fg: string; ibg: string };
  const notices: Notice[] = [];
  const shot = findPlayer(view, night?.shotPlayerId);
  if (shot) {
    notices.push({ key: "shot", title: t("shotDead", { name: name(shot.playerId) }),
      text: shot.revealedRole ? t("theyWereThe", { role: roleName(shot.revealedRole) }) : view.rules.revealRolesOnDeath ? "" : t("roleHidden"),
      icon: "target", bg: "#2A1612", edge: "#4A2620", fg: "#F08A7A", ibg: "#3A1C1A" });
  }
  if (view.youSurvivedTheNight) {
    notices.push({ key: "diehard", title: t("dieHardSurvivedTitle"), text: t("dieHardSurvivedText"), icon: "shield", bg: "#10251F", edge: "#1E4A40", fg: "#5FD0BE", ibg: "#13302C" });
  }
  const silenced = findPlayer(view, view.silencedPlayerId);
  const youSilenced = view.silencedPlayerId === view.yourPlayerId;
  if (silenced) {
    notices.push(youSilenced
      ? { key: "silenced", title: t("silencedYouTitle"), text: t("silencedYouText"), icon: "mute", bg: "#2A1612", edge: "#4A2620", fg: "#F08A7A", ibg: "#3A1C1A" }
      : { key: "silenced", title: t("silencedOtherTitle", { name: name(silenced.playerId) }), text: t("silencedOtherText"), icon: "mute", bg: "#2A1612", edge: "#4A2620", fg: "#F08A7A", ibg: "#3A1C1A" });
  }
  for (const mayor of view.players.filter((p) => p.revealed && p.isAlive)) {
    notices.push({ key: `mayor-${mayor.playerId}`, title: t("mayorRevealedTitle", { name: name(mayor.playerId) }), text: t("mayorRevealedText"), icon: "townHall", bg: "#241D12", edge: "#4A3A22", fg: "#F0A83A", ibg: "#3A2A16" });
  }
  if (view.yourRole === "Mayor" && view.discussion?.activePlayerId === view.yourPlayerId && view.discussion.segmentType === "Speaker" && !findPlayer(view, view.yourPlayerId)?.revealed) {
    notices.push({ key: "mayorTurn", title: t("mayorTurnTitle"), text: t("mayorTurnText"), icon: "townHall", bg: "#241D12", edge: "#4A3A22", fg: "#F0A83A", ibg: "#3A2A16" });
  }
  // At tables that hide roles, out players with a role shown were announced by the Die Hard's Inquiry.
  const inquiry = view.rules.revealRolesOnDeath ? [] : view.players.filter((p) => !p.isAlive && p.revealedRole);
  const canInquire = view.youAreAlive && view.yourRole === "DieHard" && !view.rules.revealRolesOnDeath && !view.yourInquiryUsed;

  const discussion = view.discussion;
  const active = findPlayer(view, discussion?.activePlayerId);
  const challenge = discussion?.segmentType === "Challenge";
  const youActive = discussion?.activePlayerId === view.yourPlayerId;
  const youSpeaker = youActive && !challenge;
  const total = challenge ? view.rules.challengeSeconds : view.rules.speakerSeconds;
  const seconds = discussion ? Math.max(0, Math.ceil((new Date(discussion.deadline).getTime() - now) / 1000)) : 0;
  const frac = Math.min(1, seconds / total);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const order = discussion?.speakerOrder ?? [];
  const completed = new Set(discussion?.completedSpeakerIds ?? []);
  const segFg = challenge ? "#F0A83A" : "#F4EEE4";

  let speakerSub = t("speakingNow");
  if (challenge) speakerSub = t("challengingName", { name: name(discussion?.originalSpeakerId) });
  else if (youSpeaker) speakerSub = t("yourTurnRoom");

  const pending = discussion?.yourChallengeIsPending ?? false;
  const canChallenge = discussion?.youCanRequestChallenge ?? false;
  const live = voice.publishing && !voice.muted;

  return (
    <Screen theme="day">
      <PhaseHeader kicker={t("morning")} title={t("dayN", { number: view.nightNumber })} right={<RolePeek role={view.yourRole} alive={view.youAreAlive} />} />

      <Body tight>
        <ReconnectingBanner />
        <SpectatorBanner />
        <TableNotices />
        <section className="row" style={{ gap: 12, padding: 14, borderRadius: 18, background: report.bg, border: `1px solid ${report.edge}` }}>
          <span style={{ width: 44, height: 44, flex: "none", borderRadius: 999, background: report.ibg, color: report.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={report.icon} />
          </span>
          <div style={{ fontSize: 14, lineHeight: 1.45 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{report.title}</div>
            {report.text && <div style={{ color: "var(--text-2)" }}>{report.text}</div>}
          </div>
        </section>

        {notices.map((n) => (
          <section key={n.key} role="status" className="row" style={{ gap: 12, padding: 14, borderRadius: 18, background: n.bg, border: `1px solid ${n.edge}` }}>
            <span style={{ width: 44, height: 44, flex: "none", borderRadius: 999, background: n.ibg, color: n.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={n.icon} />
            </span>
            <div style={{ fontSize: 14, lineHeight: 1.45 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{n.title}</div>
              <div style={{ color: "var(--text-2)" }}>{n.text}</div>
            </div>
          </section>
        ))}

        {inquiry.length > 0 && (
          <section className="list" aria-label={t("inquiryTitle")}>
            <h2 className="list__head">{t("inquiryTitle")}</h2>
            {inquiry.map((p) => (
              <div key={p.playerId} className="list__row row--between" style={{ fontSize: 14 }}>
                <span>{name(p.playerId)}</span>
                <span className="strong" style={{ color: p.revealedRole ? undefined : "var(--muted)" }}>{p.revealedRole ? roleName(p.revealedRole) : ""}</span>
              </div>
            ))}
          </section>
        )}

        {canInquire && (
          <div className="stack" style={{ gap: 6 }}>
            <button type="button" className="btn btn--outline" style={{ color: "#5FD0BE", borderColor: "#1E4A40" }} disabled={busy} onClick={() => void callInquiry()}>{t("inquiryButton")}</button>
            <span className="tiny muted">{t("inquiryNote")}</span>
          </div>
        )}

        {discussion && active && (
          <section className="stack center" style={{ gap: 12, padding: "20px 16px", borderRadius: 24, background: "var(--surface)" }} aria-live="polite">
            <span style={{ padding: "4px 10px", borderRadius: 999, background: challenge ? "#3A2A16" : "#2B241B", color: segFg, fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>
              {challenge ? t("challenge") : t("speakerTurn")}
            </span>
            <div style={{ position: "relative", width: 132, height: 132 }}>
              <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
                <circle cx="66" cy="66" r="60" fill="none" stroke="#342C22" strokeWidth="7" />
                <circle
                  cx="66" cy="66" r="60" fill="none" stroke={segFg} strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={`${(RING * frac).toFixed(1)} ${RING.toFixed(1)}`} transform="rotate(-90 66 66)"
                  style={{ transition: "stroke-dasharray 250ms linear" }}
                />
              </svg>
              <span
                className="avatar display"
                aria-hidden="true"
                style={{ position: "absolute", left: 16, top: 16, width: 100, height: 100, fontSize: 40, fontWeight: 800, background: playerColor(view, active.playerId) }}
              >
                {Array.from(active.telegramUsername)[0]?.toUpperCase()}
              </span>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{name(active.playerId)}</div>
              <div style={{ fontSize: 14, color: "var(--muted)" }}>{speakerSub}</div>
            </div>
            <div className="display num" style={{ fontSize: 34 }} aria-label={t("secondsLeft", { seconds })}>{clock}</div>
          </section>
        )}

        {order.length > 0 && (
          <section className="stack" style={{ gap: 8 }}>
            <div className="row row--between" style={{ fontSize: 13 }}>
              <span className="strong">{t("speakingOrder")}</span>
              <span className="muted">{t("turnLengths", { speaker: view.rules.speakerSeconds, challenge: view.rules.challengeSeconds })}</span>
            </div>
            <ol className="row" style={{ gap: 8, overflowX: "auto", listStyle: "none", margin: 0, padding: 0 }}>
              {order.map((id) => {
                const p = findPlayer(view, id);
                const nowSpeaking = id === discussion?.originalSpeakerId;
                const done = completed.has(id);
                const label = nowSpeaking ? t("now") : done ? t("done") : id === view.yourPlayerId ? t("you") : p?.telegramUsername ?? "";
                return (
                  <li key={id} className="stack center" style={{ gap: 4, minWidth: 56 }}>
                    <span
                      className="avatar"
                      aria-hidden="true"
                      style={{
                        width: 40, height: 40, fontSize: 16, background: playerColor(view, id), opacity: done ? 0.45 : 1,
                        boxShadow: nowSpeaking ? "0 0 0 3px #14110D, 0 0 0 5px #F0A83A" : "none",
                      }}
                    >
                      {Array.from(p?.telegramUsername ?? "?")[0]?.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, color: nowSpeaking ? "#F0A83A" : "var(--muted)", maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {youSpeaker && (discussion?.pendingChallengerIds.length ?? 0) > 0 && (
          <section className="stack" style={{ padding: 14, borderRadius: 18, background: "var(--surface)", border: "1px solid var(--edge)" }}>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>{t("challengeRequests")}</h2>
            {discussion!.pendingChallengerIds.map((id) => (
              <div key={id} className="row" style={{ gap: 8 }}>
                <span className="grow" style={{ fontSize: 15 }}>{name(id)}</span>
                <button type="button" className="btn btn--outline btn--auto" style={{ minHeight: 44, borderRadius: 12, fontSize: 14 }} disabled={busy} onClick={() => void rejectChallenge(id)}>{t("reject")}</button>
                <button type="button" className="btn btn--primary btn--auto" style={{ minHeight: 44, borderRadius: 12, fontSize: 14 }} disabled={busy} onClick={() => void acceptChallenge(id)}>{t("accept")}</button>
              </div>
            ))}
          </section>
        )}

        {view.youAreController && (
          <button type="button" className="btn btn--outline btn--sm" style={{ borderStyle: "dashed" }} disabled={busy} onClick={() => void startVoting()}>
            {t("creatorStartVoting")}
          </button>
        )}
        <ActionError />
        <LeaveGameButton />
        <SpectatorList />
      </Body>

      {view.youCanUseGraveyard ? (
        <Bar><GraveyardBar /></Bar>
      ) : (
      <Bar row>
        {!view.youAreAlive ? (
          <div className="grow" style={{ minHeight: 52, padding: "8px 14px", borderRadius: 16, border: "1.5px dashed var(--edge)", color: "var(--text-2)", fontSize: 14, display: "flex", alignItems: "center" }}>
            {view.youAreSpectator ? t("daySpectatorNote") : t("dayDeadNote")}
          </div>
        ) : youActive ? (
          <div className="grow stack" style={{ gap: 8 }}>
            {youSpeaker && view.yourRole === "Mayor" && !findPlayer(view, view.yourPlayerId)?.revealed && (
              <button type="button" className="btn btn--primary" style={{ fontSize: 15 }} disabled={busy} onClick={() => { haptic.success(); void revealMayor(); }}>
                {t("revealAsMayor")}
              </button>
            )}
            <button type="button" className={`btn ${view.yourRole === "Mayor" && youSpeaker && !findPlayer(view, view.yourPlayerId)?.revealed ? "btn--outline" : "btn--primary"}`} style={{ fontSize: 15 }} disabled={busy} onClick={() => void finishDiscussion()}>
              {t("finishEarly")}
            </button>
          </div>
        ) : youSilenced ? (
          <div className="grow" style={{ minHeight: 52, padding: "8px 14px", borderRadius: 16, border: "1.5px dashed var(--edge)", color: "var(--text-2)", fontSize: 14, display: "flex", alignItems: "center" }}>
            {t("silencedNote")}
          </div>
        ) : (
          <button
            type="button"
            className={`btn grow ${pending ? "btn--outline" : "btn--primary"}`}
            style={{ fontSize: 15 }}
            disabled={busy || (!pending && !canChallenge)}
            onClick={() => {
              haptic.tap();
              void (pending ? cancelChallenge() : requestChallenge());
            }}
          >
            {pending ? t("cancelChallenge") : t("requestChallenge")}
          </button>
        )}
        <div className="stack center" style={{ gap: 2, minWidth: 76 }}>
          <button
            type="button"
            disabled={!voice.publishing}
            onClick={() => void voice.toggleMute()}
            aria-label={voice.publishing ? (live ? t("mute") : t("unmute")) : t("micOnYourTurn")}
            style={{
              width: 44, height: 44, borderRadius: 999, border: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: live ? "#F0A83A" : "#2B241B", color: live ? "#1A1206" : "#B3A795", cursor: voice.publishing ? "pointer" : "default",
            }}
          >
            <Icon name={live ? "mic" : "micOff"} size={20} />
          </button>
          <span style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
            {!view.youAreAlive ? t("listeningOnly") : live ? t("youAreLive") : voice.publishing ? t("muted") : pending ? t("requestSent") : t("micOnYourTurn")}
          </span>
        </div>
      </Bar>
      )}
    </Screen>
  );
}
