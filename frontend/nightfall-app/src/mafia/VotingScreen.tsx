import { useState } from "react";
import { useGame } from "./GameProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { Bar, Body, PhaseHeader, Screen } from "../ui/components";
import { Icon } from "../ui/Icon";
import { findPlayer, playerColor } from "./roles";
import { ActionError, ReconnectingBanner, VoiceStatusLine } from "./parts";
import { haptic } from "../lib/haptics";

export function VotingScreen() {
  const { view, busy, submitVote, resolveVoting } = useGame();
  const { t } = useLanguage();
  const [picked, setPicked] = useState<string | null>(null);
  if (!view) return null;

  const name = (id: string | null | undefined) => {
    const p = findPlayer(view, id);
    if (!p) return t("unknown");
    return p.playerId === view.yourPlayerId ? t("youName", { name: p.telegramUsername }) : p.telegramUsername;
  };

  const alivePlayers = view.players.filter((p) => p.isAlive);
  const votes = view.votes ?? [];
  const mine = votes.find((v) => v.voterPlayerId === view.yourPlayerId);
  const voted = Boolean(mine);
  const alive = view.youAreAlive;
  const open = alive && !voted;

  const tally = alivePlayers
    .map((p) => {
      const by = votes.filter((v) => v.targetPlayerId === p.playerId).map((v) => name(v.voterPlayerId));
      return { p, by, count: by.length };
    })
    .sort((a, b) => b.count - a.count);

  const outWatching = view.players.filter((p) => !p.isAlive).map((p) => p.telegramUsername);

  let doneText = "";
  if (!alive) doneText = t("voteDeadNote");
  else if (mine?.targetPlayerId) doneText = t("youVotedFor", { name: name(mine.targetPlayerId) });
  else if (mine) doneText = t("youAbstained");

  async function cast(target: string | null) {
    const ok = await submitVote(target);
    if (ok) haptic.success();
  }

  return (
    <Screen theme="day">
      <PhaseHeader
        kicker={t("dayN", { number: view.nightNumber })}
        title={t("townVote")}
        right={
          <div style={{ textAlign: "end" }}>
            <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{votes.length} / {alivePlayers.length}</div>
            <div className="tiny muted">{t("votesCast")}</div>
          </div>
        }
      />

      <Body tight>
        <ReconnectingBanner />
        <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label={t("townVote")}>
          {tally.map(({ p, by, count }) => {
            const you = p.playerId === view.yourPlayerId;
            const chosen = (open && picked === p.playerId) || mine?.targetPlayerId === p.playerId;
            const locked = !open || you;
            const pct = alivePlayers.length ? Math.round((count / alivePlayers.length) * 100) : 0;
            return (
              <button
                key={p.playerId}
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={locked || busy}
                onClick={() => {
                  haptic.select();
                  setPicked(p.playerId);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 12, minHeight: 62, padding: "10px 12px", borderRadius: 16,
                  border: `2px solid ${chosen ? "#F0A83A" : "#2B241B"}`, background: "#1F1A14", color: "var(--text)",
                  textAlign: "start", cursor: locked ? "default" : "pointer", position: "relative", overflow: "hidden",
                }}
              >
                <span style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: `${pct}%`, background: "#3A2A16", transition: "width 240ms ease" }} />
                <span className="avatar" aria-hidden="true" style={{ position: "relative", width: 38, height: 38, fontSize: 16, background: playerColor(view, p.playerId) }}>
                  {Array.from(p.telegramUsername)[0]?.toUpperCase()}
                </span>
                <span style={{ position: "relative", flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{name(p.playerId)}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}>
                    {by.length ? t("byVoters", { names: by.join(", ") }) : you ? t("you") : t("noVotesYet")}
                  </span>
                </span>
                <span className="num" style={{ position: "relative", fontSize: 20, fontWeight: 700 }}>{count}</span>
              </button>
            );
          })}
        </div>

        <section className="stack" style={{ gap: 8, padding: 14, borderRadius: 18, background: "#1A1611" }} aria-live="polite">
          <h2 style={{ fontSize: 14, fontWeight: 600 }}>{t("liveVoting")}</h2>
          {votes.length === 0 && <div style={{ fontSize: 14, color: "var(--text-2)" }}>{t("waitingForVotes")}</div>}
          {[...votes].reverse().map((v) => (
            <div key={v.voterPlayerId} style={{ fontSize: 14, color: "var(--text-2)" }}>
              <b style={{ color: "var(--text)" }}>{name(v.voterPlayerId)}</b>{" "}
              {v.targetPlayerId ? <>{t("votedFor")} <b style={{ color: "var(--text)" }}>{name(v.targetPlayerId)}</b></> : t("abstained")}
            </div>
          ))}
          {outWatching.length > 0 && <div className="small muted">{t("outWatching", { names: outWatching.join(", ") })}</div>}
        </section>

        {view.youAreController && (
          <button type="button" className="btn btn--outline btn--sm" style={{ borderStyle: "dashed" }} disabled={busy} onClick={() => void resolveVoting()}>
            {t("creatorTallyVotes")}
          </button>
        )}
        <ActionError />
      </Body>

      <Bar>
        {open ? (
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn--outline btn--auto" style={{ fontSize: 15, padding: "0 18px" }} disabled={busy} onClick={() => void cast(null)}>
              {t("abstain")}
            </button>
            <button type="button" className="btn btn--primary grow" style={{ fontSize: 15 }} disabled={!picked || busy} onClick={() => void cast(picked)}>
              {picked ? t("voteToEliminate", { name: name(picked) }) : t("pickAPlayer")}
            </button>
          </div>
        ) : (
          <div className="row" style={{ justifyContent: "center", gap: 8, minHeight: 52, borderRadius: 16, background: "#1F1A14", fontSize: 15, color: "var(--text-2)", padding: "0 12px", textAlign: "center" }}>
            <Icon name={alive ? "check" : "eliminated"} size={18} color={alive ? "#5FD0BE" : "#B3A795"} strokeWidth={2.5} />
            <span>{doneText}</span>
          </div>
        )}
        <VoiceStatusLine />
      </Bar>
    </Screen>
  );
}
