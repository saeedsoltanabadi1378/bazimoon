import { useEffect, useState } from "react";
import type { MyGameResult } from "../api/types";
import { useGame } from "./GameProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { Bar, Body, IconDisc, RoleTag, Screen, Stat, Toast } from "../ui/components";
import { isMafiaRole, playerColor, roleMeta } from "./roles";
import { useRoleName } from "./parts";
import { shareToTelegram } from "../lib/telegram";
import { botLink } from "../lib/links";
import { haptic } from "../lib/haptics";

export function GameOverScreen() {
  const { view, apiClient, gameId } = useGame();
  const { t } = useLanguage();
  const roleName = useRoleName();
  const { reset, replace } = useNavigation();
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
    if (p.eliminatedBy === "Night") return t(p.wasPromoted ? "fatePromotedKilled" : "fateKilled", { number });
    return t(p.wasPromoted ? "fatePromotedVoted" : "fateVotedOut", { number });
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
        <section className="stack center" style={{ gap: 10, padding: "26px 16px", borderRadius: 26, background: town ? "#0F2420" : "#24121A", border: `1px solid ${town ? "#1E4A40" : "#4A2620"}`, textAlign: "center" }}>
          <IconDisc icon={town ? "villager" : "godfather"} size={84} iconSize={40} bg={town ? "#13302C" : "#3A1C1A"} fg={accent} />
          <div className="kicker" style={{ color: accent }}>{t("gameOverNights", { nights: view.nightNumber })}</div>
          <h1 className="display" style={{ fontSize: 34, lineHeight: 1.05 }}>{town ? t("townWins") : t("mafiaWins")}</h1>
          <p style={{ fontSize: 15, color: "var(--text-soft)" }}>{town ? t("townWinsSub") : t("mafiaWinsSub")}</p>
        </section>

        <div className="stat-grid">
          <Stat label={t("result")} value={youWon === null ? "—" : youWon ? t("win") : t("loss")} color={youWon === null ? undefined : resultColor} />
          <Stat label={t("rating")} value={mine ? mine.rating : "—"} />
          <Stat
            label={t("change")}
            value={mine ? `${mine.ratingDelta >= 0 ? "+" : ""}${mine.ratingDelta}` : "—"}
            color={mine ? (mine.ratingDelta >= 0 ? "#5FD0BE" : "#F08A7A") : undefined}
          />
        </div>

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
    </Screen>
  );
}
