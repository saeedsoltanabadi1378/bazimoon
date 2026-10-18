import { useGame } from "./GameProvider";
import { useVoice } from "./VoiceProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { Bar, Body, PhaseHeader, Screen } from "../ui/components";
import { Icon } from "../ui/Icon";
import { findPlayer, playerColor } from "./roles";
import { ActionError, LeaveGameButton, ReconnectingBanner, RolePeek, TableNotices } from "./parts";
import { GraveyardBar, SpectatorBanner, SpectatorList } from "./Graveyard";
import { useClock, useSecondsLeft } from "./timers";

const RING = 2 * Math.PI * 60;

/** After a tied vote: each tied player defends themselves in turn, with no challenges, before round 2. */
export function DefenceScreen() {
  const { view, busy, finishDiscussion } = useGame();
  const voice = useVoice();
  const { t } = useLanguage();
  const clock = useClock();
  const seconds = useSecondsLeft(view?.discussion?.deadline) ?? 0;
  if (!view) return null;

  const name = (id: string | null | undefined) => {
    const p = findPlayer(view, id);
    if (!p) return t("unknown");
    return p.playerId === view.yourPlayerId ? t("youName", { name: p.telegramUsername }) : p.telegramUsername;
  };

  const discussion = view.discussion;
  const tied = view.runoffCandidateIds ?? [];
  const active = findPlayer(view, discussion?.activePlayerId);
  const youActive = discussion?.activePlayerId === view.yourPlayerId;
  const completed = new Set(discussion?.completedSpeakerIds ?? []);
  const total = view.rules.defenceSeconds;
  const frac = Math.min(1, seconds / total);
  const live = voice.publishing && !voice.muted;

  return (
    <Screen theme="day">
      <PhaseHeader kicker={t("defenceKicker", { number: view.nightNumber })} title={t("defenceTitle")} right={<RolePeek role={view.yourRole} alive={view.youAreAlive} />} />

      <Body tight>
        <ReconnectingBanner />
        <SpectatorBanner />
        <TableNotices />
        <section className="row" style={{ gap: 12, padding: 14, borderRadius: 18, background: "#241D12", border: "1px solid #4A3A22" }}>
          <span style={{ width: 44, height: 44, flex: "none", borderRadius: 999, background: "#3A2A16", color: "#F0A83A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="scales" />
          </span>
          <div style={{ fontSize: 14, lineHeight: 1.45 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{t("defenceTieTitle", { names: tied.map(name).join(t("listAnd")) })}</div>
            <div style={{ color: "var(--text-2)" }}>{t("defenceTieText", { seconds: total })}</div>
          </div>
        </section>

        {discussion && active && (
          <section className="stack center" style={{ gap: 12, padding: "20px 16px", borderRadius: 24, background: "var(--surface)" }} aria-live="polite">
            <span style={{ padding: "4px 10px", borderRadius: 999, background: "#3A2A16", color: "#F0A83A", fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>
              {t("defenceTitle")}
            </span>
            <div style={{ position: "relative", width: 132, height: 132 }}>
              <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
                <circle cx="66" cy="66" r="60" fill="none" stroke="#342C22" strokeWidth="7" />
                <circle
                  cx="66" cy="66" r="60" fill="none" stroke="#F0A83A" strokeWidth="7" strokeLinecap="round"
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
              <div style={{ fontSize: 14, color: "var(--muted)" }}>{youActive ? t("yourDefence") : t("defendingNow")}</div>
            </div>
            <div className="display num" style={{ fontSize: 34 }} aria-label={t("secondsLeft", { seconds })}>{clock(seconds)}</div>
          </section>
        )}

        <section className="stack" style={{ gap: 8 }}>
          <div className="row row--between" style={{ fontSize: 13 }}>
            <span className="strong">{t("defenceOrder")}</span>
            <span className="muted">{t("defenceLengths", { seconds: total })}</span>
          </div>
          <ol className="row" style={{ gap: 8, listStyle: "none", margin: 0, padding: 0 }}>
            {tied.map((id) => {
              const p = findPlayer(view, id);
              const now = id === discussion?.activePlayerId;
              const done = completed.has(id);
              return (
                <li key={id} className="stack center" style={{ gap: 4, minWidth: 56 }}>
                  <span
                    className="avatar"
                    aria-hidden="true"
                    style={{
                      width: 40, height: 40, fontSize: 16, background: playerColor(view, id), opacity: done ? 0.45 : 1,
                      boxShadow: now ? "0 0 0 3px #14110D, 0 0 0 5px #F0A83A" : "none",
                    }}
                  >
                    {Array.from(p?.telegramUsername ?? "?")[0]?.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, color: now ? "#F0A83A" : "var(--muted)" }}>{now ? t("now") : done ? t("done") : t("next")}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="row" style={{ gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 14, background: "#1A1611", border: "1px solid #2B241B", fontSize: 13, lineHeight: 1.5, color: "var(--text-2)" }}>
          <span style={{ marginTop: 1 }}><Icon name="info" size={18} color="#F0A83A" /></span>
          <span>{t("defenceNote")}</span>
        </div>
        <ActionError />
        <LeaveGameButton />
        <SpectatorList />
      </Body>

      {view.youCanUseGraveyard ? (
        <Bar><GraveyardBar /></Bar>
      ) : (
      <Bar row>
        {youActive ? (
          <button type="button" className="btn btn--primary grow" style={{ fontSize: 15 }} disabled={busy} onClick={() => void finishDiscussion()}>
            {t("finishEarly")}
          </button>
        ) : (
          <div className="grow" style={{ minHeight: 52, padding: "8px 14px", borderRadius: 16, border: "1.5px dashed var(--edge)", color: "var(--text-2)", fontSize: 14, display: "flex", alignItems: "center" }}>
            {view.youAreAlive ? t("defenceListening") : view.youAreSpectator ? t("defenceSpectatorNote") : t("defenceDeadNote")}
          </div>
        )}
        <MicState live={live} />
      </Bar>
      )}
    </Screen>
  );
}

/** The mic toggle in the footer: tappable only while you hold the floor. */
export function MicState({ live }: { live: boolean }) {
  const voice = useVoice();
  const { t } = useLanguage();
  return (
    <div className="stack center" style={{ gap: 2, minWidth: 76 }}>
      <button
        type="button"
        disabled={!voice.publishing}
        onClick={() => void voice.toggleMute()}
        aria-label={voice.publishing ? (live ? t("mute") : t("unmute")) : t("listeningOnly")}
        style={{
          width: 44, height: 44, borderRadius: 999, border: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: live ? "#F0A83A" : "#2B241B", color: live ? "#1A1206" : "#B3A795", cursor: voice.publishing ? "pointer" : "default",
        }}
      >
        <Icon name={live ? "mic" : "micOff"} size={20} />
      </button>
      <span style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
        {live ? t("youAreLive") : voice.publishing ? t("muted") : t("listeningOnly")}
      </span>
    </div>
  );
}
