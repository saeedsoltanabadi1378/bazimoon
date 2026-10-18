import { useEffect, useState, type ReactNode } from "react";
import type { Role } from "../api/types";
import { useLanguage } from "../i18n/LanguageContext";
import { Icon } from "../ui/Icon";
import { Banner } from "../ui/components";
import { roleMeta, eliminatedMeta } from "./roles";
import { useGame } from "./GameProvider";
import { useSecondsLeft } from "./timers";
import { useVoice } from "./VoiceProvider";
import { haptic } from "../lib/haptics";

/** The countdown strip for a timed night or vote (the table's Night or Voting timer). Shows nothing when untimed. */
export function PhaseTimer({ deadline, total, label, accent = "#F0A83A", track = "#342C22", bg = "#241D12", edge = "#4A3A22" }: {
  deadline: string | null | undefined;
  total: number | null | undefined;
  label: (seconds: number) => string;
  accent?: string;
  track?: string;
  bg?: string;
  edge?: string;
}) {
  const seconds = useSecondsLeft(deadline);
  if (seconds === null || !total) return null;
  return (
    <div className="row" style={{ gap: 10, padding: "10px 14px", borderRadius: 14, background: bg, border: `1px solid ${edge}` }} role="timer" aria-live="off">
      <Icon name="clock" size={18} color={accent} />
      <span className="grow" style={{ fontSize: 14, fontWeight: 600 }}>{label(seconds)}</span>
      <span style={{ width: 80, height: 6, borderRadius: 999, background: track, overflow: "hidden", flex: "none" }}>
        <span style={{ display: "block", width: `${Math.min(100, (seconds / total) * 100)}%`, height: 6, background: accent, transition: "width 250ms linear" }} />
      </span>
    </div>
  );
}

export function useRoleName() {
  const { t } = useLanguage();
  return (role: Role) => t(`role${role}`);
}

/**
 * The role chip stays hidden until tapped so a glance at someone's phone never leaks it
 * (design note). It hides itself again after a few seconds.
 */
export function RolePeek({ role, alive }: { role: Role | null; alive: boolean }) {
  const { t } = useLanguage();
  const roleName = useRoleName();
  const [peek, setPeek] = useState(false);

  useEffect(() => {
    if (!peek) return;
    const id = window.setTimeout(() => setPeek(false), 6000);
    return () => window.clearTimeout(id);
  }, [peek]);

  if (!role) return null;
  const meta = alive ? roleMeta[role] : { ...roleMeta[role], bg: eliminatedMeta.bg, fg: eliminatedMeta.fg };
  const label = alive ? roleName(role) : t("roleOut", { role: roleName(role) });
  return (
    <button
      type="button"
      onClick={() => {
        haptic.select();
        setPeek((p) => !p);
      }}
      aria-label={peek ? t("hideRole") : t("showRole")}
      style={{
        display: "flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 14px", borderRadius: 999, border: 0,
        background: peek ? meta.bg : "var(--surface-2)", color: peek ? meta.fg : "var(--text-2)",
        fontSize: 13, fontWeight: 600, cursor: "pointer", flex: "none",
      }}
    >
      <Icon name={peek ? meta.icon : "eyeOff"} size={15} />
      <span>{peek ? label : t("tapToSeeRole")}</span>
    </button>
  );
}

/** Dashed box that holds creator-only controls, so players see why they can't press them. */
export function CreatorBox({ note, children }: { note?: ReactNode; children: ReactNode }) {
  return (
    <div className="dashed stack" style={{ gap: 8 }}>
      {note && <span className="small muted">{note}</span>}
      {children}
    </div>
  );
}

export function ActionError() {
  const { actionError } = useGame();
  if (!actionError) return null;
  return <Banner tone="error" icon="warning">{actionError}</Banner>;
}

export function ReconnectingBanner() {
  const { link } = useGame();
  const { t } = useLanguage();
  if (link === "connected") return null;
  return <Banner icon="refresh" iconColor="var(--accent)">{t("reconnectingLive")}</Banner>;
}

/** Footer line that always shows where your voice is going ("voice state is always visible"). */
export function VoiceStatusLine() {
  const { view } = useGame();
  const voice = useVoice();
  const { t } = useLanguage();
  if (!view) return null;
  const mafia = voice.channel === "mafia";
  let text: string;
  if (voice.failed) text = t("voiceFailed");
  else if (voice.connecting && !voice.channel) text = t("voiceConnecting");
  else if (!view.youAreAlive) text = t("voiceEliminated");
  else if (mafia) text = t("voiceMafiaTalk");
  else if (voice.publishing) text = voice.muted ? t("voiceRoomMuted") : t("voiceRoomLive");
  else text = view.phase === "Night" || view.phase === "NightZero" ? t("voiceRoomNight") : t("voiceRoomListening");
  return (
    <div className="row" style={{ gap: 8, fontSize: 13, color: "var(--muted)" }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: mafia ? "#E5604D" : voice.publishing && !voice.muted ? "var(--accent)" : "#4A4E70", flex: "none" }} />
      <span className="grow">{text}</span>
      {voice.failed && (
        <button type="button" className="btn btn--ghost btn--auto" style={{ minHeight: 32, padding: "0 8px", fontSize: 13 }} onClick={voice.retry}>
          {t("tryAgain")}
        </button>
      )}
    </div>
  );
}

/** Round mic toggle shown whenever you're allowed to talk. */
export function MicButton({ size = 52, hotColor = "#E5604D", hotInk = "#1C0905" }: { size?: number; hotColor?: string; hotInk?: string }) {
  const voice = useVoice();
  const { t } = useLanguage();
  if (!voice.publishing) return null;
  const live = !voice.muted;
  return (
    <button
      type="button"
      onClick={() => {
        haptic.tap();
        void voice.toggleMute();
      }}
      aria-label={live ? t("mute") : t("unmute")}
      aria-pressed={!live}
      style={{
        width: size, height: size, flex: "none", borderRadius: 999, border: 0, cursor: "pointer",
        background: live ? hotColor : "var(--surface-2)", color: live ? hotInk : "var(--text)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Icon name={live ? "mic" : "micOff"} size={22} />
    </button>
  );
}

/** Table notices: your strike warning, players removed for inactivity, and the creator hand-off. */
export function TableNotices() {
  const { view } = useGame();
  const { t } = useLanguage();
  const roleName = useRoleName();
  if (!view) return null;
  const removed = view.removedForInactivity ?? [];
  const youRemoved = removed.includes(view.yourPlayerId);
  const firstSeat = view.players[0];
  const handedOver = view.youAreController && firstSeat && firstSeat.playerId !== view.yourPlayerId && firstSeat.eliminatedBy === "Left";
  const box = (bg: string, edge: string) => ({ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 14, background: bg, border: `1px solid ${edge}`, fontSize: 14, lineHeight: 1.45 }) as const;
  return (
    <>
      {view.youAreAlive && view.yourStrikes > 0 && (
        <div role="alert" style={box("#2A2113", "#6B5A3E")}>
          <span style={{ marginTop: 2 }}><Icon name="warning" size={18} color="#F0A83A" /></span>
          <span><b>{t("strikeWarnTitle")}</b> {t("strikeWarnText")}</span>
        </div>
      )}
      {youRemoved && (
        <section className="stack center" style={{ gap: 10, padding: "24px 16px", borderRadius: 24, background: "var(--surface)", textAlign: "center" }}>
          <span style={{ width: 64, height: 64, borderRadius: 999, background: "#3A1C1A", color: "#F08A7A", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="clock" size={28} /></span>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{t("youRemovedTitle")}</div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-2)" }}>{t("youRemovedText")}</div>
        </section>
      )}
      {removed.filter((id) => id !== view.yourPlayerId).map((id) => {
        const p = view.players.find((x) => x.playerId === id);
        if (!p) return null;
        return (
          <div key={id} style={box("#2A1612", "#4A2620")}>
            <span style={{ marginTop: 2 }}><Icon name="eliminated" size={18} color="#F08A7A" /></span>
            <span>
              <b>{t("removedTitle", { name: p.telegramUsername })}</b> {t("removedText")}
              {p.revealedRole && <> {t("removedRole", { role: roleName(p.revealedRole) })}</>}
            </span>
          </div>
        );
      })}
      {handedOver && (
        <div style={box("#10251F", "#1E4A40")}>
          <span style={{ marginTop: 2 }}><Icon name="godfather" size={18} color="#5FD0BE" /></span>
          <span><b>{t("newCreatorTitle")}</b> {t("newCreatorText", { name: firstSeat.telegramUsername })}</span>
        </div>
      )}
    </>
  );
}

/** "Leave game" for a living player in a game under way, behind a confirm sheet (leaving counts as a loss). */
export function LeaveGameButton() {
  const { view, busy, leaveGame } = useGame();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  if (!view || !view.youAreAlive || view.phase === "Lobby" || view.phase === "Ended") return null;
  return (
    <>
      <button type="button" className="btn btn--outline btn--sm" onClick={() => setOpen(true)}>{t("leaveGame")}</button>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(8,6,4,0.72)", display: "flex", alignItems: "flex-end" }} onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-h"
            onClick={(e) => e.stopPropagation()}
            className="stack"
            style={{ width: "100%", gap: 12, padding: "22px 16px 26px", borderRadius: "24px 24px 0 0", background: "var(--surface)" }}
          >
            <h2 id="leave-h" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t("leaveTitle")}</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--text-2)" }}>{t("leaveText")}</p>
            <button
              type="button"
              className="btn"
              style={{ background: "#E5604D", color: "#1C0905" }}
              disabled={busy}
              onClick={async () => {
                if (await leaveGame()) setOpen(false);
              }}
            >
              {t("leaveConfirm")}
            </button>
            <button type="button" className="btn btn--outline" autoFocus onClick={() => setOpen(false)}>{t("leaveCancel")}</button>
          </div>
        </div>
      )}
    </>
  );
}
