import { ReactionRow } from "./Reactions";
import { useGame } from "./GameProvider";
import { useVoice } from "./VoiceProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { Bar, PhaseHeader, Screen } from "../ui/components";
import { Icon } from "../ui/Icon";
import { findPlayer } from "./roles";
import { ActionError, ReconnectingBanner, RolePeek, TableNotices } from "./parts";
import { GraveyardBar, SpectatorBanner } from "./Graveyard";
import { HeaderTools } from "./table";
import { TableScene } from "./TableScene";
import { PanelNote, PhasePanel } from "./TablePanel";

/** After a tied vote: each tied player defends themselves in turn, with no challenges, before round 2. */
export function DefenceScreen() {
  const { view, busy, finishDiscussion } = useGame();
  const voice = useVoice();
  const { t } = useLanguage();
  if (!view) return null;

  const name = (id: string | null | undefined) => {
    const p = findPlayer(view, id);
    if (!p) return t("unknown");
    return p.playerId === view.yourPlayerId ? t("youName", { name: p.displayName }) : p.displayName;
  };

  const discussion = view.discussion;
  const tied = view.runoffCandidateIds ?? [];
  const active = findPlayer(view, discussion?.activePlayerId);
  const youActive = discussion?.activePlayerId === view.yourPlayerId;
  const completed = new Set(discussion?.completedSpeakerIds ?? []);
  const total = view.rules.defenceSeconds;
  const live = voice.publishing && !voice.muted;

  return (
    <Screen theme="day" className="screen--table">
      <PhaseHeader kicker={t("defenceKicker", { number: view.nightNumber })} title={t("defenceTitle")} right={<HeaderTools><RolePeek role={view.yourRole} alive={view.youAreAlive} /></HeaderTools>} />
      <TableScene
        nowId={discussion?.activePlayerId}
        doneIds={completed}
        dimIds={new Set(view.players.filter((p) => p.isAlive && !tied.includes(p.playerId)).map((p) => p.playerId))}
        clock={discussion && active ? {
          label: t("defenceTitle"),
          name: name(active.playerId),
          sub: youActive ? t("yourDefence")
            : !active.isBot ? t("defendingNow")
            : discussion.botSuspectId ? t("botSays", { name: active.displayName, target: name(discussion.botSuspectId) })
            : t("botSaysNothing", { name: active.displayName }),
          deadline: discussion.deadline,
          accent: "#F0A83A",
        } : null}
      />

      <PhasePanel>
        <ReconnectingBanner />
        <SpectatorBanner />
        <TableNotices />
        <PanelNote icon="scales" title={t("defenceTieTitle", { names: tied.map(name).join(t("listAnd")) })}>
          {t("defenceTieText", { seconds: total })} {t("defenceNote")}
        </PanelNote>
        <ActionError />
      </PhasePanel>

      {view.youCanUseGraveyard ? (
        <Bar><GraveyardBar /></Bar>
      ) : (
      <Bar>
        <div className="row" style={{ gap: 10 }}>
          {youActive ? (
            <button type="button" className="btn btn--primary grow" style={{ fontSize: 15 }} disabled={busy} onClick={() => void finishDiscussion()}>
              {t("finishEarly")}
            </button>
          ) : (
            <div className="grow" style={{ minHeight: 44, padding: "6px 12px", borderRadius: 14, border: "1.5px dashed var(--edge)", color: "var(--text-2)", fontSize: 13, display: "flex", alignItems: "center" }}>
              {view.youAreAlive ? t("defenceListening") : view.youAreSpectator ? t("defenceSpectatorNote") : t("defenceDeadNote")}
            </div>
          )}
          <MicState live={live} />
        </div>
        <ReactionRow />
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
