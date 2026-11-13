import { useGame } from "./GameProvider";
import { useVoice } from "./VoiceProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { Bar, PhaseHeader, Screen } from "../ui/components";
import { isMafiaRole } from "./roles";
import { TableScene, type SeatTag } from "./TableScene";
import { PanelNote, PhasePanel } from "./TablePanel";
import { ActionError, MicButton, ReconnectingBanner, RolePeek, useRoleName } from "./parts";
import { GraveyardBar, SpectatorBanner } from "./Graveyard";

export function FirstNightScreen() {
  const { view } = useGame();
  const voice = useVoice();
  const { t } = useLanguage();
  const roleName = useRoleName();
  if (!view) return null;

  const mafia = isMafiaRole(view.yourRole) && view.youAreAlive;
  // Only the Mafia see who is on their side: each teammate's seat carries their role.
  const teamTags = new Map<string, SeatTag>();
  if (mafia) for (const member of view.mafiaTeam ?? []) if (member.playerId !== view.yourPlayerId) teamTags.set(member.playerId, { text: member.rank === 2 && member.role === "Mafia" ? t("mafiaNextInLine") : roleName(member.role), color: "#F08A7A" });

  return (
    <Screen theme="night" className="screen--table">
      <PhaseHeader kicker={t("nightN", { number: 0 })} title={t("firstNight")} right={<RolePeek role={view.yourRole} alive={view.youAreAlive} />} />
      <TableScene
        tags={teamTags}
        clock={{
          label: t("firstNight"),
          name: mafia ? t("privateMafiaVoice") : t("townSleeps"),
          sub: mafia ? t("mafiaPlanHint") : t("townSleepsText"),
          deadline: view.phaseDeadline,
          accent: mafia ? "#F08A7A" : "#C9A25A",
        }}
      />

      <PhasePanel>
        <ReconnectingBanner />
        <SpectatorBanner />
        <PanelNote icon="info" title={t("firstNight")}>{t("firstNightInfo")}</PanelNote>
        <ActionError />
      </PhasePanel>

      {view.youCanUseGraveyard ? (
        <Bar><GraveyardBar /></Bar>
      ) : (
      <Bar row>
        <div className="grow">
          <div style={{ fontSize: 14, fontWeight: 600 }}>{mafia ? t("mafiaVoice") : t("roomVoice")}</div>
          <div className="tiny muted">
            {voice.failed ? t("voiceFailed") : mafia ? (voice.muted ? t("youAreMuted") : t("teamHearsYou")) : t("listeningOnlyNight")}
          </div>
        </div>
        {voice.failed && <button type="button" className="btn btn--outline btn--pill" onClick={voice.retry}>{t("tryAgain")}</button>}
        <MicButton />
      </Bar>
      )}
    </Screen>
  );
}
