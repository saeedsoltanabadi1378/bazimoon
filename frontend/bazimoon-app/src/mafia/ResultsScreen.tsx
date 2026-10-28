import { useGame } from "./GameProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { Bar, Body, IconDisc, RoleTag, Screen } from "../ui/components";
import { Icon } from "../ui/Icon";
import { findPlayer, isMafiaRole, playerColor, roleMeta, voteWeight } from "./roles";
import { ActionError, LeaveGameButton, ReconnectingBanner, useRoleName, TableNotices } from "./parts";
import { GraveyardBar, SpectatorBanner, SpectatorList } from "./Graveyard";
import { BallotRows } from "./VotingScreen";
import { RolePortrait } from "./RolePortrait";

/**
 * Verdict after a vote. When the vote ended the game, `onSeeFinal` is set and the footer leads
 * to the Game over screen instead of the next night.
 */
export function ResultsScreen({ onSeeFinal }: { onSeeFinal?: () => void }) {
  const { view, busy, startNight } = useGame();
  const { t } = useLanguage();
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
  const tally = [...rows.entries()].map(([id, n]) => ({ label: name(id), n })).sort((a, b) => b.n - a.n);
  if (abstained) tally.push({ label: t("abstainRow"), n: abstained });
  const top = tally.reduce((m, r) => Math.max(m, r.n), 0);
  const voters = Math.max(1, ballots.length);

  const promotedName = view.players.find((p) => p.wasPromoted && p.isAlive);
  const meta = out?.revealedRole ? roleMeta[out.revealedRole] : null;
  // Round 2 is the re-vote between the players tied in round 1.
  const revote = result?.round === 2;
  const headline = out ? t("verdictIn") : tie ? (revote ? t("tiedAgain") : t("tiedVote")) : t("noVerdict");
  const tiedNames = (result?.tiedPlayers ?? []).map((id) => name(id));

  return (
    <Screen theme="day">
      <header style={{ padding: "16px 16px 8px" }}>
        <div className="kicker">{t("dayResults", { number: view.nightNumber })}</div>
        <h1 className="h1" style={{ marginTop: 2 }}>{headline}</h1>
      </header>

      <Body tight>
        <ReconnectingBanner />
        <SpectatorBanner />
        <TableNotices />
        {out ? (
          <section className="stack center" style={{ gap: 12, padding: "24px 16px", borderRadius: 24, background: "var(--surface)", textAlign: "center" }}>
            {out.revealedRole ? (
              <RolePortrait role={out.revealedRole} size={128} full muted={!out.isAlive} />
            ) : (
              <span className="avatar display" aria-hidden="true" style={{ width: 96, height: 96, fontSize: 38, fontWeight: 800, background: playerColor(view, out.playerId), filter: "grayscale(0.6)" }}>
                {Array.from(out.displayName)[0]?.toUpperCase()}
              </span>
            )}
            <div style={{ fontSize: 15, color: "var(--text-2)" }}>{revote ? t("roundTwoVotedOut") : t("townVotedOut")}</div>
            <div className="display" style={{ fontSize: 30, lineHeight: 1 }}>{name(out.playerId)}</div>
            {meta && out.revealedRole && <RoleTag icon={meta.icon} bg={meta.bg} fg={meta.fg} label={t("theyWereThe", { role: roleName(out.revealedRole) })} />}
            {!out.revealedRole && !view.rules.revealRolesOnDeath && <div className="small muted">{t("roleHidden")}</div>}
            {view.jokerWinnerId === out.playerId && view.winCondition === "None" && (
              <div className="stack" style={{ gap: 4, padding: "12px 14px", borderRadius: 14, background: "#1C1428", border: "1px solid #3D2E55", fontSize: 14, lineHeight: 1.5 }}>
                <b>{t("jokerWonTitle", { name: name(out.playerId) })}</b>
                <span style={{ color: "var(--text-2)" }}>{t("jokerGoesOnText")}</span>
              </div>
            )}
          </section>
        ) : (
          <section className="stack center" style={{ gap: 10, padding: "28px 16px", borderRadius: 24, background: "var(--surface)", textAlign: "center" }}>
            <IconDisc icon="scales" size={72} iconSize={32} bg="#2B241B" fg="#F0A83A" strokeWidth={2} />
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {tie
                ? t(revote ? "bothRoundsTied" : "tiedBetween", { names: tiedNames.join(t("listAnd")) })
                : t("noVotesCast")}
            </div>
            <div style={{ fontSize: 14, color: "var(--text-2)" }}>{revote ? t("nobodyOutToday") : t("nobodyEliminated")}</div>
          </section>
        )}

        {result?.godfatherPromoted && (
          <div className="row" style={{ gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 14, background: "#2A1418", border: "1px solid #4A2620", fontSize: 14, lineHeight: 1.45 }}>
            <span style={{ marginTop: 2 }}><Icon name="godfather" size={18} color="#F08A7A" /></span>
            <span>
              {t("godfatherFallen")}{" "}
              <span style={{ color: "var(--text-2)" }}>
                {isMafiaRole(view.yourRole) && promotedName ? t("newGodfatherIs", { name: name(promotedName.playerId) }) : t("onlyMafiaSees")}
              </span>
            </span>
          </div>
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

        {!revote && tally.length > 0 && (
          <section className="stack" style={{ gap: 8 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>{t("finalTally")}</h2>
            {tally.map((row) => (
              <div key={row.label} className="row">
                <span style={{ width: 86, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
                <div className="grow" style={{ height: 10, borderRadius: 999, background: "#2B241B", overflow: "hidden" }}>
                  <div style={{ width: `${Math.round((row.n / voters) * 100)}%`, height: 10, background: row.n === top ? "#F0A83A" : "#6B5A3E" }} />
                </div>
                <span className="num" style={{ width: 20, textAlign: "end", fontSize: 14, fontWeight: 600 }}>{row.n}</span>
              </div>
            ))}
          </section>
        )}

        <div className="row row--wrap" aria-label={t("players")}>
          {view.players.map((p) => (
            <span key={p.playerId} className="chip" style={{ background: "var(--surface)", borderColor: "#2B241B", color: p.isAlive ? "var(--text)" : "var(--faint)", textDecoration: p.isAlive ? "none" : "line-through" }}>
              {name(p.playerId)}
              {!p.isAlive && <span className="visually-hidden">, {t("eliminated")}</span>}
            </span>
          ))}
        </div>
        <ActionError />
        <LeaveGameButton />
        <SpectatorList />
      </Body>

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
