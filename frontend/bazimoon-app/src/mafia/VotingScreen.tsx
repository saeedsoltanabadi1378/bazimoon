import { ReactionRow } from "./Reactions";
import { useState } from "react";
import type { VoteView } from "../api/types";
import { useGame } from "./GameProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { Bar, PhaseHeader, Screen } from "../ui/components";
import { Icon } from "../ui/Icon";
import { voteWeight, findPlayer } from "./roles";
import { ActionError, ReconnectingBanner, VoiceStatusLine, TableNotices } from "./parts";
import { GraveyardBar, SpectatorBanner } from "./Graveyard";
import { HeaderTools } from "./table";
import { TableScene, type SeatTag } from "./TableScene";
import { PhasePanel } from "./TablePanel";
import { haptic } from "../lib/haptics";

export function VotingScreen() {
  const { view, busy, submitVote } = useGame();
  const { t, n } = useLanguage();
  const [picked, setPicked] = useState<string | null>(null);
  if (!view) return null;

  const name = (id: string | null | undefined) => {
    const p = findPlayer(view, id);
    if (!p) return t("unknown");
    return p.playerId === view.yourPlayerId ? t("youName", { name: p.displayName }) : p.displayName;
  };

  const alivePlayers = view.players.filter((p) => p.isAlive);
  // Round 2 (after a tie and the defences) is between the tied players only.
  const revote = view.votingRound === 2;
  const runoff = new Set(view.runoffCandidateIds ?? []);
  const candidates = revote ? alivePlayers.filter((p) => runoff.has(p.playerId)) : alivePlayers;
  const roundOne = revote ? view.lastVotingElimination?.ballots ?? [] : [];
  const votes = view.votes ?? [];
  const mine = votes.find((v) => v.voterPlayerId === view.yourPlayerId);
  const voted = Boolean(mine);
  const alive = view.youAreAlive;
  const open = alive && !voted;

  // The vote is read off the table: a count on each candidate, a line from each voter to their
  // choice, and under each voter the seat they voted for.
  const counts = new Map(candidates.map((p) => [p.playerId, votes.filter((v) => v.targetPlayerId === p.playerId).reduce((sum, v) => sum + voteWeight(view, v.voterPlayerId), 0)]));
  const voteTags = new Map<string, SeatTag>(votes.map((v) => {
    const seat = view.players.findIndex((p) => p.playerId === v.targetPlayerId);
    return [v.voterPlayerId, { text: seat >= 0 ? t("seatVotedFor", { seat: n(seat + 1) }) : t("seatAbstained"), color: "#F1D79A" }];
  }));

  let doneText = "";
  if (view.youAreSpectator) doneText = t("voteSpectatorNote");
  else if (!alive) doneText = t("voteDeadNote");
  else if (mine?.targetPlayerId) doneText = t("youVotedFor", { name: name(mine.targetPlayerId) });
  else if (mine) doneText = t("youAbstained");

  async function cast(target: string | null) {
    const ok = await submitVote(target);
    if (ok) haptic.success();
  }

  return (
    <Screen theme="day" className="screen--table">
      <PhaseHeader
        kicker={revote ? t("revoteKicker", { number: view.nightNumber }) : t("dayN", { number: view.nightNumber })}
        title={revote ? t("revoteTitle") : t("townVote")}
        right={
          <HeaderTools>
            <div style={{ textAlign: "end" }}>
              <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{votes.length} / {alivePlayers.length}</div>
              <div className="tiny muted">{t("votesCast")}</div>
            </div>
          </HeaderTools>
        }
      />

      <TableScene
        pick={open ? { selected: picked, canPick: (id) => !busy && id !== view.yourPlayerId && candidates.some((p) => p.playerId === id), onPick: setPicked } : null}
        counts={counts}
        tags={voteTags}
        links={votes.flatMap((v) => (v.targetPlayerId ? [{ fromId: v.voterPlayerId, toId: v.targetPlayerId }] : []))}
        dimIds={revote ? new Set(alivePlayers.filter((p) => !runoff.has(p.playerId)).map((p) => p.playerId)) : undefined}
        clock={{ label: revote ? t("revoteTitle") : t("townVote"), deadline: view.phaseDeadline }}
      />

      <PhasePanel>
        <ReconnectingBanner />
        <SpectatorBanner />
        <TableNotices />
        {revote && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--text-2)" }}>{t("revoteRule")}</p>}
        {revote && roundOne.length > 0 && (
          <section className="stack" style={{ gap: 6, padding: 10, borderRadius: 12, background: "#1A1611" }}>
            <h2 style={{ fontSize: 13, fontWeight: 600 }}>{t("roundOne")}</h2>
            <BallotRows ballots={roundOne} name={name} weight={(id) => voteWeight(view, id)} />
          </section>
        )}
        <ActionError />
      </PhasePanel>

      <Bar>
        <GraveyardBar />
        {open ? (
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn--outline btn--auto" style={{ fontSize: 15, padding: "0 18px" }} disabled={busy} onClick={() => void cast(null)}>
              {t("abstain")}
            </button>
            <button type="button" className="btn btn--primary grow" style={{ fontSize: 15 }} disabled={!picked || busy} onClick={() => void cast(picked)}>
              {picked ? t("voteToEliminate", { name: name(picked) }) : revote ? t("pickTiedPlayer") : t("pickAPlayer")}
            </button>
          </div>
        ) : (
          <div className="row" style={{ justifyContent: "center", gap: 8, minHeight: 52, borderRadius: 16, background: "#1F1A14", fontSize: 15, color: "var(--text-2)", padding: "0 12px", textAlign: "center" }}>
            <Icon name={alive ? "check" : "eliminated"} size={18} color={alive ? "#5FD0BE" : "#B3A795"} strokeWidth={2.5} />
            <span>{doneText}</span>
          </div>
        )}
        <VoiceStatusLine />
        <ReactionRow />
      </Bar>
    </Screen>
  );
}

/** A finished round's count per player, most votes first, with abstentions last. */
export function BallotRows({ ballots, name, highlightTop = false, weight = () => 1 }: { ballots: VoteView[]; name: (id: string) => string; highlightTop?: boolean; weight?: (voterId: string) => number }) {
  const { t, n } = useLanguage();
  const counts = new Map<string, number>();
  let abstained = 0;
  for (const b of ballots) {
    if (b.targetPlayerId) counts.set(b.targetPlayerId, (counts.get(b.targetPlayerId) ?? 0) + weight(b.voterPlayerId));
    else abstained++;
  }
  const rows = [...counts.entries()].map(([id, count]) => ({ key: id, label: name(id), count })).sort((a, b) => b.count - a.count);
  if (abstained) rows.push({ key: "abstain", label: t("abstainRow"), count: abstained });
  const top = rows.reduce((m, r) => Math.max(m, r.count), 0);
  return (
    <>
      {rows.map((r) => (
        <div key={r.key} className="row row--between" style={{ fontSize: 14, color: "var(--text-2)" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
          <span className="num" style={{ fontWeight: 700, color: highlightTop && r.count === top && r.key !== "abstain" ? "#F0A83A" : undefined }}>{n(r.count)}</span>
        </div>
      ))}
    </>
  );
}
