import { useState } from "react";
import { useGame } from "./GameProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { Bar, Body, IconDisc, Screen } from "../ui/components";
import { findPlayer, roleMeta } from "./roles";
import { useRoleName } from "./parts";
import { haptic } from "../lib/haptics";

/** Shown once per game right after roles are dealt; the card stays face-down until tapped. */
export function RoleRevealScreen({ onReady }: { onReady: () => void }) {
  const { view } = useGame();
  const { t } = useLanguage();
  const roleName = useRoleName();
  const [shown, setShown] = useState(false);
  if (!view?.yourRole) return null;

  const role = view.yourRole;
  const meta = roleMeta[role];
  const tip = role === "Sniper" ? t("tipSniper")
    : role === "DieHard" ? (view.rules.revealRolesOnDeath ? null : t("tipDieHard"))
    : role === "Silencer" ? t("tipSilencer")
    : role === "Joker" ? (view.rules.jokerWinEndsGame ? t("tipJokerEnds") : t("tipJokerGoesOn"))
    : role === "Mayor" ? t("tipMayor")
    : null;
  const team = view.mafiaTeam ?? [];

  return (
    <Screen theme="night">
      <header style={{ padding: "18px 16px 6px", textAlign: "center" }}>
        <div className="kicker">{t("rolesAssigned")}</div>
        <h1 className="display" style={{ marginTop: 6, fontSize: 26 }}>{t("keepScreenPrivate")}</h1>
      </header>

      <Body>
        <button
          type="button"
          onClick={() => {
            haptic.tap();
            setShown((s) => !s);
          }}
          aria-label={shown ? t("hideRole") : t("revealRole")}
          style={{
            width: "100%", minHeight: 380, borderRadius: 28, border: `1.5px solid ${shown ? meta.fg : "#2E3252"}`,
            background: shown ? "#141629" : "#121428", color: "var(--text)", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 28,
          }}
        >
          {!shown ? (
            <>
              <IconDisc icon="moon" size={96} iconSize={44} bg="#1E2138" fg="#9C8CFF" />
              <span className="display" style={{ fontSize: 22, fontWeight: 700 }}>{t("tapToReveal")}</span>
              <span style={{ fontSize: 14, color: "var(--muted)" }}>{t("tapAgainToHide")}</span>
            </>
          ) : (
            <span className="stack center fade-in" style={{ gap: 14 }}>
              <IconDisc icon={meta.icon} size={104} iconSize={50} bg={meta.bg} fg={meta.fg} />
              <span style={{ fontSize: 14, color: "var(--text-2)" }}>{t("youAreThe")}</span>
              <span className="display" style={{ fontSize: 40, lineHeight: 1, color: meta.fg }}>{roleName(role)}</span>
              <span style={{ fontSize: 15, lineHeight: 1.5, color: "var(--text-soft)", maxWidth: 280 }}>
                {t(`reveal${role}`)}
              </span>
              <span style={{ padding: "6px 12px", borderRadius: 999, background: "#1E2138", fontSize: 13, color: "var(--text-2)" }}>
                {t("teamLabel", { team: meta.team === "mafia" ? t("teamMafia") : meta.team === "independent" ? t("teamIndependent") : t("teamTown") })}
              </span>
              {tip && <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-2)", maxWidth: 290 }}>{tip}</span>}
            </span>
          )}
        </button>

        {shown && team.length > 0 && (
          <section className="stack fade-in" style={{ padding: 16, borderRadius: 18, background: "var(--mafia-deep)", border: "1px solid var(--mafia-edge)" }}>
            <div className="row row--between row--baseline">
              <h2 className="h2">{t("yourMafiaTeam")}</h2>
              <span className="tiny" style={{ color: "#B9A6A9" }}>{t("successionOrder")}</span>
            </div>
            {team.map((member, i) => {
              const player = findPlayer(view, member.playerId);
              const you = member.playerId === view.yourPlayerId;
              return (
                <div key={member.playerId} className="row">
                  <span style={{ width: 24, height: 24, borderRadius: 999, background: "#3D2328", color: "#F08A7A", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {member.rank ?? i + 1}
                  </span>
                  <span className="grow" style={{ fontSize: 15 }}>{you ? t("youName", { name: player?.telegramUsername ?? "" }) : player?.telegramUsername}</span>
                  <span style={{ fontSize: 13, color: "#F08A7A", fontWeight: 600 }}>{roleName(member.role)}</span>
                </div>
              );
            })}
            <p className="small" style={{ color: "#B9A6A9" }}>{t("successionNote")}</p>
          </section>
        )}
      </Body>

      <Bar>
        <button type="button" className="btn btn--primary" onClick={onReady}>{t("readyNightFalls")}</button>
      </Bar>
    </Screen>
  );
}
