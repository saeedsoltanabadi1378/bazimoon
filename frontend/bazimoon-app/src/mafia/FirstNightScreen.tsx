import { useGame } from "./GameProvider";
import { useVoice } from "./VoiceProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { Bar, Body, IconDisc, PhaseHeader, Screen } from "../ui/components";
import { findPlayer, isMafiaRole, playerColor } from "./roles";
import { ActionError, CreatorBox, MicButton, ReconnectingBanner, RolePeek, useRoleName } from "./parts";
import { GraveyardBar, SpectatorBanner } from "./Graveyard";

export function FirstNightScreen() {
  const { view, busy, resolveNight } = useGame();
  const voice = useVoice();
  const { t } = useLanguage();
  const roleName = useRoleName();
  if (!view) return null;

  const mafia = isMafiaRole(view.yourRole) && view.youAreAlive;
  const teamIds = new Set((view.mafiaTeam ?? []).map((m) => m.playerId));

  return (
    <Screen theme="night">
      <PhaseHeader kicker={t("nightN", { number: 0 })} title={t("firstNight")} right={<RolePeek role={view.yourRole} alive={view.youAreAlive} />} />

      <Body>
        <ReconnectingBanner />
        <SpectatorBanner />
        <div className="card" style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-2)", padding: "12px 14px", borderRadius: 14 }}>
          {t("firstNightInfo")}
        </div>

        {mafia ? (
          <section className="stack stack--lg" style={{ padding: 18, borderRadius: 22, background: "var(--mafia-deep)", border: "1px solid var(--mafia-edge)" }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#E5604D" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#F08A7A" }}>{t("privateMafiaVoice")}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              {(view.mafiaTeam ?? []).map((member) => {
                const player = findPlayer(view, member.playerId);
                const you = member.playerId === view.yourPlayerId;
                const live = you && voice.channel === "mafia" && !voice.muted;
                const name = player?.telegramUsername ?? "";
                return (
                  <div key={member.playerId} className="stack center" style={{ gap: 8, padding: "16px 8px", borderRadius: 18, background: "#2A1820", textAlign: "center" }}>
                    <span
                      className="avatar"
                      aria-hidden="true"
                      style={{
                        width: 64, height: 64, fontSize: 24, fontWeight: 800, background: playerColor(view, member.playerId),
                        boxShadow: live ? "0 0 0 3px #2A1820, 0 0 0 6px #E5604D" : "none",
                      }}
                    >
                      {Array.from(name)[0]?.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{you ? t("youName", { name }) : name}</span>
                    <span className="tiny" style={{ color: "#F08A7A" }}>
                      {member.rank === 2 && member.role === "Mafia" ? t("mafiaNextInLine") : roleName(member.role)}
                    </span>
                    {you && (
                      <span className="tiny" style={{ color: "#B9A6A9" }}>
                        {voice.channel === "mafia" ? (voice.muted ? t("muted") : t("micOn")) : t("voiceConnecting")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="small" style={{ color: "#B9A6A9" }}>{t("mafiaPlanHint")}</p>
          </section>
        ) : (
          <section className="stack center" style={{ gap: 14, padding: "36px 18px", borderRadius: 22, background: "var(--surface-3)", textAlign: "center" }}>
            <IconDisc icon="moon" size={88} iconSize={40} bg="#1E2138" fg="#9C8CFF" />
            <h2 className="display" style={{ fontSize: 22, fontWeight: 700 }}>{t("townSleeps")}</h2>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-2)", maxWidth: 280 }}>{t("townSleepsText")}</p>
          </section>
        )}

        <section className="stack" style={{ gap: 8 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)" }}>{t("atTheTable", { count: view.players.length })}</h2>
          <div className="row row--wrap">
            {view.players.map((p) => {
              const mate = mafia && teamIds.has(p.playerId);
              const you = p.playerId === view.yourPlayerId;
              return (
                <span key={p.playerId} className="chip" style={{ borderColor: mate ? "#5A3439" : undefined, color: mate ? "#F08A7A" : undefined }}>
                  {you ? t("youName", { name: p.telegramUsername }) : p.telegramUsername}
                </span>
              );
            })}
          </div>
        </section>

        {view.youAreController && (
          <CreatorBox note={t("creatorEndFirstNight")}>
            <button type="button" className="btn btn--sm" style={{ fontSize: 15 }} disabled={busy} onClick={() => void resolveNight()}>
              {t("endFirstNight")}
            </button>
          </CreatorBox>
        )}
        <ActionError />
      </Body>

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
