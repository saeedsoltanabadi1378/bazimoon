import { useGame } from "./GameProvider";
import { useVoice } from "./VoiceProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { Bar, PhaseHeader, Screen } from "../ui/components";
import { Icon, type IconName } from "../ui/Icon";
import { findPlayer } from "./roles";
import { ActionError, ReconnectingBanner, RolePeek, useRoleName, TableNotices } from "./parts";
import { GraveyardBar, SpectatorBanner } from "./Graveyard";
import { HeaderTools } from "./table";
import { TableScene } from "./TableScene";
import { PanelNote, PhasePanel } from "./TablePanel";
import { ReactionRow } from "./Reactions";
import { haptic } from "../lib/haptics";

export function DayScreen() {
  const { view, busy, requestChallenge, cancelChallenge, acceptChallenge, rejectChallenge, finishDiscussion, revealMayor, callInquiry } = useGame();
  const voice = useVoice();
  const { t } = useLanguage();
  const roleName = useRoleName();

  if (!view) return null;

  const name = (id: string | null | undefined) => {
    const p = findPlayer(view, id);
    if (!p) return t("unknown");
    return p.playerId === view.yourPlayerId ? t("youName", { name: p.displayName }) : p.displayName;
  };

  // What the whole table was told this morning is in the panel's log. Only what you alone are told is pinned here.
  type Notice = { key: string; title: string; text: string; icon: IconName };
  const personal: Notice[] = [];
  if (view.youWereRecruited) {
    personal.push({ key: "recruited", title: t("recruitedTitle"), text: t("recruitedText"), icon: "link" });
  } else if (view.yourNegotiation) {
    personal.push({ key: "negotiation", title: t(view.yourNegotiation.succeeded ? "negotiationWorked" : "negotiationFailed", { name: name(view.yourNegotiation.targetPlayerId) }), text: t("onlyMafiaSees"), icon: "link" });
  }
  if (view.youSurvivedTheNight) {
    personal.push({ key: "diehard", title: t("dieHardSurvivedTitle"), text: t("dieHardSurvivedText"), icon: "shield" });
  }
  const youSilenced = view.silencedPlayerId === view.yourPlayerId;
  if (youSilenced) personal.push({ key: "silenced", title: t("silencedYouTitle"), text: t("silencedYouText"), icon: "mute" });
  if (view.yourRole === "Mayor" && view.discussion?.activePlayerId === view.yourPlayerId && view.discussion.segmentType === "Speaker" && !findPlayer(view, view.yourPlayerId)?.revealed) {
    personal.push({ key: "mayorTurn", title: t("mayorTurnTitle"), text: t("mayorTurnText"), icon: "townHall" });
  }
  // At tables that hide roles, out players with a role shown were announced by the Die Hard's Inquiry.
  const inquiry = view.rules.revealRolesOnDeath ? [] : view.players.filter((p) => !p.isAlive && p.revealedRole);
  const canInquire = view.youAreAlive && view.yourRole === "DieHard" && !view.rules.revealRolesOnDeath && !view.yourInquiryUsed;

  const discussion = view.discussion;
  const active = findPlayer(view, discussion?.activePlayerId);
  const challenge = discussion?.segmentType === "Challenge";
  const youActive = discussion?.activePlayerId === view.yourPlayerId;
  const youSpeaker = youActive && !challenge;
  const completed = new Set(discussion?.completedSpeakerIds ?? []);

  let speakerSub = t("speakingNow");
  if (challenge) speakerSub = t("challengingName", { name: name(discussion?.originalSpeakerId) });
  else if (youSpeaker) speakerSub = t("yourTurnRoom");
  // A bot has no voice: its turn shows who it suspects, which is also who it will vote for.
  else if (active?.isBot) speakerSub = discussion?.botSuspectId ? t("botSays", { name: active.displayName, target: name(discussion.botSuspectId) }) : t("botSaysNothing", { name: active.displayName });

  const pending = discussion?.yourChallengeIsPending ?? false;
  const canChallenge = discussion?.youCanRequestChallenge ?? false;
  const live = voice.publishing && !voice.muted;
  const requests = youSpeaker ? discussion?.pendingChallengerIds ?? [] : [];
  const mayorCanReveal = youSpeaker && view.yourRole === "Mayor" && !findPlayer(view, view.yourPlayerId)?.revealed;

  return (
    <Screen theme="day" className="screen--table">
      <PhaseHeader kicker={t("morning")} title={t("dayN", { number: view.nightNumber })} right={<HeaderTools><RolePeek role={view.yourRole} alive={view.youAreAlive} /></HeaderTools>} />
      <TableScene
        nowId={discussion?.activePlayerId}
        doneIds={completed}
        clock={discussion && active ? {
          label: challenge ? t("challenge") : t("speakerTurn"),
          name: name(active.playerId),
          sub: speakerSub,
          deadline: discussion.deadline,
          accent: challenge ? "#F0A83A" : undefined,
        } : null}
      />

      <PhasePanel>
        <ReconnectingBanner />
        <SpectatorBanner />
        <TableNotices />

        {personal.map((notice) => <PanelNote key={notice.key} icon={notice.icon} title={notice.title}>{notice.text}</PanelNote>)}

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
        <ActionError />
      </PhasePanel>

      {view.youCanUseGraveyard ? (
        <Bar><GraveyardBar /></Bar>
      ) : (
      <Bar>
        {/* Requests need an answer, so they sit with the buttons and not in the scrolling panel. */}
        {requests.length > 0 && (
          <section className="dock-requests" aria-live="polite">
            <h2>{t("challengeRequests")}</h2>
            {requests.map((id) => (
              <div key={id} className="row" style={{ gap: 6 }}>
                <span className="grow" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14 }}>{name(id)}</span>
                <button type="button" className="btn btn--outline btn--auto" disabled={busy} onClick={() => void rejectChallenge(id)}>{t("reject")}</button>
                <button type="button" className="btn btn--primary btn--auto" disabled={busy} onClick={() => void acceptChallenge(id)}>{t("accept")}</button>
              </div>
            ))}
          </section>
        )}
        <div className="row" style={{ gap: 10 }}>
        {!view.youAreAlive ? (
          <div className="grow" style={{ minHeight: 44, padding: "6px 12px", borderRadius: 14, border: "1.5px dashed var(--edge)", color: "var(--text-2)", fontSize: 13, display: "flex", alignItems: "center" }}>
            {view.youAreSpectator ? t("daySpectatorNote") : t("dayDeadNote")}
          </div>
        ) : youActive ? (
          <div className="grow stack" style={{ gap: 8 }}>
            {mayorCanReveal && (
              <button type="button" className="btn btn--primary" style={{ fontSize: 15 }} disabled={busy} onClick={() => { haptic.success(); void revealMayor(); }}>
                {t("revealAsMayor")}
              </button>
            )}
            <button type="button" className={`btn ${mayorCanReveal ? "btn--outline" : "btn--primary"}`} style={{ fontSize: 15 }} disabled={busy} onClick={() => void finishDiscussion()}>
              {t("finishEarly")}
            </button>
          </div>
        ) : youSilenced ? (
          <div className="grow" style={{ minHeight: 44, padding: "6px 12px", borderRadius: 14, border: "1.5px dashed var(--edge)", color: "var(--text-2)", fontSize: 13, display: "flex", alignItems: "center" }}>
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
        </div>
        <ReactionRow />
      </Bar>
      )}
    </Screen>
  );
}
