import { ReactionRow } from "./Reactions";
import { useGame } from "./GameProvider";
import { useVoice } from "./VoiceProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { Bar, Screen } from "../ui/components";
import { findPlayer } from "./roles";
import { HeaderTools } from "./table";
import { TableScene } from "./TableScene";
import { PanelNote, PhasePanel } from "./TablePanel";
import { ActionError, ReconnectingBanner } from "./parts";
import { GraveyardBar, SpectatorBanner } from "./Graveyard";
import { MicState } from "./DefenceScreen";

/**
 * A player who is out speaks once before their role is shown: always after being voted out, and at
 * the start of the day after a night kill when the table turns that on.
 */
export function LastWordsScreen() {
  const { view, busy, finishLastWords } = useGame();
  const voice = useVoice();
  const { t } = useLanguage();
  if (!view) return null;

  const name = (id: string | null | undefined) => {
    const p = findPlayer(view, id);
    if (!p) return t("unknown");
    return p.playerId === view.yourPlayerId ? t("youName", { name: p.displayName }) : p.displayName;
  };

  const lastWords = view.lastWords;
  const speaker = findPlayer(view, lastWords?.playerId);
  const night = lastWords?.cause === "Night";
  const speaking = lastWords?.youAreSpeaking ?? false;
  const accent = night ? "#F08A7A" : "#F0A83A";
  const total = view.rules.lastWordsSeconds;
  const live = voice.publishing && !voice.muted;

  return (
    <Screen theme="day" className="screen--table">
      <header className="topbar topbar--split">
        <div>
          <div className="kicker" style={{ color: accent }}>
            {night ? t("lastWordsNightKicker", { number: view.nightNumber }) : t("lastWordsVoteKicker", { number: view.nightNumber })}
          </div>
          <h1 className="h1" style={{ marginTop: 2 }}>{t("lastWordsTitle")}</h1>
        </div>
        <HeaderTools />
      </header>
      <TableScene
        nowId={lastWords?.playerId}
        clock={lastWords && speaker ? {
          label: night ? t("killedLastNight") : t("votedOutByTown"),
          name: name(speaker.playerId),
          sub: speaking ? t("yourLastWords") : t("sayingLastWords"),
          deadline: lastWords.deadline,
          accent,
        } : null}
      />

      <PhasePanel>
        <ReconnectingBanner />
        <SpectatorBanner />
        <PanelNote icon="info" title={t("lastWordsTitle")}>{night ? t("lastWordsNightNote") : t("lastWordsVoteNote")}</PanelNote>
        <ActionError />
      </PhasePanel>

      {view.youCanUseGraveyard && !view.lastWords?.youAreSpeaking ? (
        <Bar><GraveyardBar /></Bar>
      ) : (
      <Bar>
        <div className="row" style={{ gap: 10 }}>
          {speaking ? (
            <button type="button" className="btn btn--primary grow" style={{ fontSize: 15 }} disabled={busy} onClick={() => void finishLastWords()}>
              {t("finishEarly")}
            </button>
          ) : (
            <div className="grow" style={{ minHeight: 44, padding: "6px 12px", borderRadius: 14, border: "1.5px dashed var(--edge)", color: "var(--text-2)", fontSize: 13, display: "flex", alignItems: "center" }}>
              {t("lastWordsListening", { seconds: total })}
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
