import { useEffect, useState } from "react";
import { useGame } from "./GameProvider";
import { useVoice } from "./VoiceProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { Bar, Body, PhaseHeader, Screen } from "../ui/components";
import { Icon, type IconName } from "../ui/Icon";
import { findPlayer, playerColor } from "./roles";
import { ActionError, LeaveGameButton, ReconnectingBanner, RolePeek, useRoleName, TableNotices } from "./parts";
import { haptic } from "../lib/haptics";

const RING = 2 * Math.PI * 60;

export function DayScreen() {
  const { view, busy, requestChallenge, cancelChallenge, acceptChallenge, rejectChallenge, finishDiscussion, startVoting } = useGame();
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
      text: dead.revealedRole ? t("theyWereThe", { role: roleName(dead.revealedRole) }) : "",
      icon: "coffin", bg: "#2A1612", edge: "#4A2620", fg: "#F08A7A", ibg: "#3A1C1A",
    };
  } else if (night?.wasSaved) {
    report = { title: t("doctorSavedTitle"), text: t("nobodyDied"), icon: "doctor", bg: "#10251F", edge: "#1E4A40", fg: "#5FD0BE", ibg: "#13302C" };
  } else {
    report = { title: t("quietNight"), text: t("nobodyDied"), icon: "sun", bg: "#241D12", edge: "#4A3A22", fg: "#F0A83A", ibg: "#3A2A16" };
  }

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
      </Body>

      <Bar row>
        {!view.youAreAlive ? (
          <div className="grow" style={{ minHeight: 52, padding: "8px 14px", borderRadius: 16, border: "1.5px dashed var(--edge)", color: "var(--text-2)", fontSize: 14, display: "flex", alignItems: "center" }}>
            {t("dayDeadNote")}
          </div>
        ) : youActive ? (
          <button type="button" className="btn btn--primary grow" style={{ fontSize: 15 }} disabled={busy} onClick={() => void finishDiscussion()}>
            {t("finishEarly")}
          </button>
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
    </Screen>
  );
}
