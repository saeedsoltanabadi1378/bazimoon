import { useGame } from "./GameProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { Bar, PhaseHeader, Screen } from "../ui/components";
import { findPlayer, isMafiaRole, roleMeta, voteWeight } from "./roles";
import { ActionError, ReconnectingBanner, useRoleName, TableNotices } from "./parts";
import { GraveyardBar, SpectatorBanner } from "./Graveyard";
import { HeaderTools } from "./table";
import { TableScene, type SeatTag } from "./TableScene";
import { PanelNote, PhasePanel } from "./TablePanel";
import { BallotRows } from "./VotingScreen";

/**
 * Verdict after a vote. When the vote ended the game, `onSeeFinal` is set and the footer leads
 * to the Game over screen instead of the next night.
 */
export function ResultsScreen({ onSeeFinal }: { onSeeFinal?: () => void }) {
  const { view, busy, startNight } = useGame();
  const { t, n } = useLanguage();
  const roleName = useRoleName();
  if (!view) return null;

  const result = view.lastVotingElimination;
  const out = findPlayer(view, result?.eliminatedPlayerId);
  const tie = Boolean(result?.wasTie);
  const name = (id: string | null | undefined) => {
    const p = findPlayer(view, id);
    if (!p) return t("unknown");
    return p.playerId === view.yourPlayerId ? t("youName", { name: p.displayName }) : p.displayName;
  };

  const ballots = result?.ballots ?? [];
  const rows = new Map<string, number>();
  let abstained = 0;
  for (const b of ballots) {
    if (b.targetPlayerId) rows.set(b.targetPlayerId, (rows.get(b.targetPlayerId) ?? 0) + voteWeight(view, b.voterPlayerId));
    else abstained++;
  }
  const counts = rows;

  const promotedName = view.players.find((p) => p.wasPromoted && p.isAlive);
  const meta = out?.revealedRole ? roleMeta[out.revealedRole] : null;
  // Round 2 is the re-vote between the players tied in round 1.
  const revote = result?.round === 2;
  const headline = out ? t("verdictIn") : tie ? (revote ? t("tiedAgain") : t("tiedVote")) : t("noVerdict");
  const tiedNames = (result?.tiedPlayers ?? []).map((id) => name(id));

  // Under each voter, the seat they voted for; under the player who went out, their role.
  const seatTags = new Map<string, SeatTag>(ballots.map((b) => {
    const seat = view.players.findIndex((p) => p.playerId === b.targetPlayerId);
    return [b.voterPlayerId, { text: seat >= 0 ? t("seatVotedFor", { seat: n(seat + 1) }) : t("seatAbstained"), color: "#F1D79A" }];
  }));
  if (out?.revealedRole && meta) seatTags.set(out.playerId, { text: roleName(out.revealedRole), color: meta.fg });

  return (
    <Screen theme="day" className="screen--table">
      <PhaseHeader kicker={t("dayResults", { number: view.nightNumber })} title={headline} right={<HeaderTools />} />
      {/* The verdict sits on the table: who went out and what they were, the final count on each seat
          and a line from every voter. At a timed table the night starts by itself, so the clock runs
          under it (GameState.ResultsSeconds on the server). */}
      <TableScene
        spotId={out?.playerId}
        counts={counts}
        tags={seatTags}
        links={ballots.flatMap((b) => (b.targetPlayerId ? [{ fromId: b.voterPlayerId, toId: b.targetPlayerId }] : []))}
        clock={{
          label: out ? (revote ? t("roundTwoVotedOut") : t("townVotedOut")) : headline,
          name: out ? name(out.playerId)
            : tie ? t(revote ? "bothRoundsTied" : "tiedBetween", { names: tiedNames.join(t("listAnd")) })
            : t("noVotesCast"),
          sub: out ? (out.revealedRole ? t("theyWereThe", { role: roleName(out.revealedRole) }) : view.rules.revealRolesOnDeath ? undefined : t("roleHidden"))
            : revote ? t("nobodyOutToday") : t("nobodyEliminated"),
          deadline: view.phase === "Results" ? view.phaseDeadline : null,
          accent: out ? "#F08A7A" : "#F0A83A",
        }}
      />

      <PhasePanel>
        <ReconnectingBanner />
        <SpectatorBanner />
        <TableNotices />
        {out && view.jokerWinnerId === out.playerId && view.winCondition === "None" && (
          <PanelNote icon="star" title={t("jokerWonTitle", { name: name(out.playerId) })}>{t("jokerGoesOnText")}</PanelNote>
        )}

        {result?.godfatherPromoted && (
          <PanelNote icon="godfather" title={t("godfatherFallen")}>
            {isMafiaRole(view.yourRole) && promotedName ? t("newGodfatherIs", { name: name(promotedName.playerId) }) : t("onlyMafiaSees")}
          </PanelNote>
        )}

        {revote && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {[
              { title: t("roundOne"), ballots: result?.previousBallots ?? [] },
              { title: t("roundTwo"), ballots },
            ].map((round) => (
              <section key={round.title} className="stack" style={{ gap: 8, padding: 12, borderRadius: 16, background: "#1A1611", border: "1px solid #2B241B" }}>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{round.title}</h2>
                <BallotRows ballots={round.ballots} name={name} highlightTop weight={(id) => voteWeight(view, id)} />
              </section>
            ))}
          </div>
        )}

        <ActionError />
      </PhasePanel>

      <Bar>
        <GraveyardBar />
        {onSeeFinal ? (
          <button type="button" className="btn" style={{ background: "#5FD0BE", color: "#14110D" }} onClick={onSeeFinal}>{t("seeFinalResults")}</button>
        ) : view.youAreController ? (
          <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void startNight()}>
            {t("continueToNight", { number: view.nightNumber + 1 })}
          </button>
        ) : (
          <div style={{ textAlign: "center", padding: 14, fontSize: 15, color: "var(--text-2)" }}>{t("waitingContinue")}</div>
        )}
      </Bar>
    </Screen>
  );
}
