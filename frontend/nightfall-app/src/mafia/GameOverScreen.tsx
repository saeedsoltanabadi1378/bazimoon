import { useEffect, useState } from "react";
import type { MvpPointsKind, MyGameResult } from "../api/types";
import type { TranslationKey } from "../i18n/LanguageContext";
import { Icon } from "../ui/Icon";
import { badgeMeta } from "../hub/badges";
import { useGame } from "./GameProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { Bar, Body, IconDisc, RoleTag, Screen, Stat, Toast } from "../ui/components";
import { isMafiaRole, playerColor, roleMeta } from "./roles";
import { useRoleName } from "./parts";
import { shareToTelegram } from "../lib/telegram";
import { botLink } from "../lib/links";
import { haptic } from "../lib/haptics";

/** Bonus XP for the MVP (Progression.MvpBonusXp on the server). */
const MVP_XP = 50;

const pointsLabel: Record<MvpPointsKind, TranslationKey> = {
  teamWon: "mvpTeamWon",
  mafiaFound: "mvpMafiaFound",
  killBlocked: "mvpKillBlocked",
  killMade: "mvpKillMade",
  voteOnMafiaOut: "mvpVoteOnMafiaOut",
  nightSurvived: "mvpNightSurvived",
};

export function GameOverScreen() {
  const { view, apiClient, gameId } = useGame();
  const { t, n } = useLanguage();
  const roleName = useRoleName();
  const { reset, replace, push } = useNavigation();
  const [seenAchievements, setSeenAchievements] = useState(0);
  const [mine, setMine] = useState<MyGameResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    haptic.success();
    apiClient.getMyGameResult(gameId).then(setMine).catch(() => setMine(null));
  }, [apiClient, gameId]);

  if (!view) return null;

  const town = view.winCondition === "VillagersWin";
  const accent = town ? "#5FD0BE" : "#F08A7A";
  const youWon = mine ? mine.won : view.yourRole ? (isMafiaRole(view.yourRole) ? !town : town) : null;
  const resultColor = youWon ? "#5FD0BE" : "#F08A7A";

  // Survivors first, then the fallen in the order they fell.
  const players = [...view.players].sort((a, b) => {
    if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
    return (b.eliminatedRound ?? 0) - (a.eliminatedRound ?? 0);
  });

  const fate = (p: (typeof players)[number]) => {
    if (p.isAlive) return p.wasPromoted ? t("fatePromotedSurvived") : t("fateSurvived");
    const number = p.eliminatedRound ?? 0;
    if (p.eliminatedBy === "Left") return t("fateLeft");
    if (p.eliminatedBy === "Night") return t(p.wasPromoted ? "fatePromotedKilled" : "fateKilled", { number });
    return t(p.wasPromoted ? "fatePromotedVoted" : "fateVotedOut", { number });
  };

  const mvps = view.mvps ?? [];
  const tie = mvps.length > 1;
  const newAchievement = mine?.newAchievements?.[seenAchievements];
  const achievement = newAchievement ? badgeMeta[newAchievement] : undefined;
  const name = (id: string) => {
    const p = view.players.find((x) => x.playerId === id);
    if (!p) return t("unknown");
    return p.playerId === view.yourPlayerId ? t("youName", { name: p.telegramUsername }) : p.telegramUsername;
  };

  async function playAgain() {
    setBusy(true);
    try {
      const { gameId: next } = await apiClient.rematch(gameId);
      replace({ name: "mafia", gameId: next });
    } catch {
      setToast(t("genericError"));
      window.setTimeout(() => setToast(null), 2500);
    } finally {
      setBusy(false);
    }
  }

  function share() {
    const text = town ? t("shareTownWon", { nights: view!.nightNumber }) : t("shareMafiaWon", { nights: view!.nightNumber });
    shareToTelegram(botLink(), text);
  }

  return (
    <Screen theme="night">
      <Body style={{ paddingTop: 22 }}>
        <section className="row" style={{ gap: 14, padding: 16, borderRadius: 22, background: town ? "#0F2420" : "#24121A", border: `1px solid ${town ? "#1E4A40" : "#4A2620"}` }}>
          <IconDisc icon={town ? "villager" : "godfather"} size={52} iconSize={26} bg={town ? "#13302C" : "#3A1C1A"} fg={accent} />
          <div className="grow">
            <div className="kicker" style={{ color: accent }}>{t("gameOverNights", { nights: view.nightNumber })}</div>
            <h1 className="display" style={{ fontSize: 24, lineHeight: 1.1 }}>{town ? t("townWins") : t("mafiaWins")}</h1>
            <p className="small" style={{ color: "var(--text-2)" }}>{town ? t("townWinsSub") : t("mafiaWinsSub")}</p>
          </div>
        </section>

        {mvps.length > 0 && (
          <section className="stack center" style={{ gap: 8, padding: "22px 16px", borderRadius: 22, background: "#1F1A2E", border: "1.5px solid #F0A83A", textAlign: "center" }} aria-label={tie ? t("mvpJoint") : t("mvpOfGame")}>
            <span className="kicker" style={{ color: "#F0A83A" }}>{tie ? t("mvpJoint") : t("mvpOfGame")}</span>
            <div className="row" style={{ gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
              {mvps.map((m) => (
                <div key={m.playerId} className="stack center" style={{ gap: 6 }}>
                  <span className="avatar display" aria-hidden="true" style={{ width: 72, height: 72, fontSize: 30, background: playerColor(view, m.playerId), boxShadow: "0 0 0 3px #1F1A2E, 0 0 0 5px #F0A83A" }}>
                    {Array.from(view.players.find((p) => p.playerId === m.playerId)?.telegramUsername ?? "?")[0]?.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>{name(m.playerId)}</span>
                  <span className="tiny" style={{ color: "var(--text-2)" }}>{t("mvpPoints", { count: m.points })}</span>
                </div>
              ))}
            </div>
            {!tie && (
              <ul className="stack" style={{ listStyle: "none", margin: "4px 0 0", padding: 0, width: "100%", gap: 6, textAlign: "start" }}>
                {mvps[0].breakdown.map((line) => (
                  <li key={line.kind} className="row row--between" style={{ gap: 10, padding: "8px 12px", borderRadius: 12, background: "var(--surface)", fontSize: 13 }}>
                    <span style={{ color: "var(--text-soft)" }}>{t(pointsLabel[line.kind], { count: line.count })}</span>
                    <span className="num" dir="ltr" style={{ fontWeight: 700, color: "#F0A83A" }}>+{n(line.points)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="small" style={{ color: "var(--text-2)" }}>{tie ? t("mvpNoteTie", { xp: MVP_XP }) : t("mvpNote", { xp: MVP_XP })}</div>
          </section>
        )}

        <div className="stat-grid">
          <Stat label={t("result")} value={youWon === null ? "—" : youWon ? t("win") : t("loss")} color={youWon === null ? undefined : resultColor} />
          <Stat label={t("rating")} value={mine ? mine.rating : "—"} />
          <Stat
            label={t("change")}
            value={mine ? `${mine.ratingDelta >= 0 ? "+" : ""}${mine.ratingDelta}` : "—"}
            color={mine ? (mine.ratingDelta >= 0 ? "#5FD0BE" : "#F08A7A") : undefined}
          />
        </div>

        <button type="button" className="row" onClick={() => push({ name: "recap", gameId })} style={{ gap: 12, padding: 14, border: 0, borderRadius: 16, background: "var(--surface)", color: "var(--text)", font: "inherit", textAlign: "start", cursor: "pointer" }}>
          <span style={{ width: 40, height: 40, flex: "none", borderRadius: 12, background: "#1E2138", color: "#9C8CFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="clock" size={20} />
          </span>
          <span className="grow stack" style={{ gap: 0 }}>
            <span style={{ fontWeight: 600 }}>{t("seeRecap")}</span>
            <span className="tiny muted">{t("seeRecapText")}</span>
          </span>
          <Icon name="forward" size={18} color="var(--muted)" className="flip-rtl" />
        </button>

        <section className="list" aria-label={t("everyonesRole")}>
          <h2 className="list__head">{t("everyonesRole")}</h2>
          {players.map((p) => {
            const you = p.playerId === view.yourPlayerId;
            const meta = p.revealedRole ? roleMeta[p.revealedRole] : null;
            return (
              <div key={p.playerId} className="list__row">
                <span className="avatar" aria-hidden="true" style={{ width: 34, height: 34, fontSize: 14, background: playerColor(view, p.playerId), opacity: p.isAlive ? 1 : 0.45 }}>
                  {Array.from(p.telegramUsername)[0]?.toUpperCase()}
                </span>
                <div className="grow">
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{you ? t("youName", { name: p.telegramUsername }) : p.telegramUsername}</div>
                  <div className="tiny muted">{fate(p)}</div>
                </div>
                {meta && p.revealedRole && <RoleTag size="sm" icon={meta.icon} bg={meta.bg} fg={meta.fg} label={roleName(p.revealedRole)} />}
              </div>
            );
          })}
        </section>
      </Body>

      <Bar>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn--outline grow" style={{ fontSize: 15 }} onClick={share}>{t("shareToGroup")}</button>
          <button type="button" className="btn btn--primary grow" style={{ fontSize: 15 }} disabled={busy} onClick={() => void playAgain()}>
            {view.rematchGameId ? t("joinRematch") : t("playAgain")}
          </button>
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => reset({ name: "home" })}>{t("backToGames")}</button>
      </Bar>
      <Toast message={toast} />
      {achievement && newAchievement && (
        <div style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(5,6,14,0.72)", display: "flex", alignItems: "flex-end" }}>
          <div role="dialog" aria-modal="true" aria-labelledby="achievement-title" className="stack center" style={{ width: "100%", boxSizing: "border-box", gap: 10, padding: "24px 16px 26px", borderRadius: "26px 26px 0 0", background: "var(--surface)", textAlign: "center" }}>
            <span className="kicker" style={{ color: "#F0A83A" }}>{t("achievementUnlocked")}</span>
            <span style={{ width: 88, height: 88, borderRadius: 999, background: achievement.bg, color: achievement.fg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 6px #10122A, 0 0 0 8px ${achievement.fg}` }}>
              <Icon name={achievement.icon} size={40} />
            </span>
            <h2 id="achievement-title" className="display" style={{ fontSize: 26, marginTop: 4 }}>{t(achievement.name)}</h2>
            {achievement.how && <p style={{ fontSize: 14, color: "var(--text-2)" }}>{t(achievement.how)}</p>}
            <div className="small muted">{t("achievementMore")}</div>
            <button type="button" className="btn btn--primary" style={{ width: "100%", marginTop: 8 }} autoFocus onClick={() => setSeenAchievements((i) => i + 1)}>{t("achievementOk")}</button>
          </div>
        </div>
      )}
    </Screen>
  );
}
