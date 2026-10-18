import type { GameEvent, GameRecap } from "../api/hub";
import type { Role } from "../api/types";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { useHub, useLoad } from "../hub/HubData";
import { Body, IconButton, Screen } from "../ui/components";
import { Icon, type IconName } from "../ui/Icon";
import { roleMeta } from "./roles";
import { useRoleName } from "./parts";

const COLORS = ["#F0A83A", "#5FD0BE", "#B79CF2", "#8FA8FF", "#E9D8A6", "#F08A7A", "#9ED98C", "#EDEBF5", "#7FC8E8", "#F2A7C3", "#C9C8DC", "#F6C377"];

interface Line { dot: string; text: string }
interface Card { key: string; title: string; icon: IconName; tone: "night" | "day" | "end"; lines: Line[] }

const MAFIA = "#F08A7A", SAVE = "#5FD0BE", CHECK = "#8FA8FF", VOTE = "#F0A83A";

/** The timeline of a finished game: every night and every vote, with all roles shown. */
export function RecapScreen({ gameId }: { gameId: string }) {
  const { api } = useHub();
  const { t, language } = useLanguage();
  const { back } = useNavigation();
  const recap = useLoad(() => api.recap(gameId), [api, gameId]);
  const data = recap.data;

  return (
    <Screen theme="night">
      <header className="topbar">
        <IconButton icon="back" label={t("back")} onClick={back} />
        <div className="topbar__text">
          {data && (
            <div className="tiny muted">
              {[data.tableName, new Date(data.endedAt).toLocaleDateString(language === "fa" ? "fa-IR" : "en-GB", { day: "numeric", month: "short" })].filter(Boolean).join(" · ")}
            </div>
          )}
          <h1 className="display" style={{ fontSize: 22 }}>{t("recapTitle")}</h1>
        </div>
        {data && data.result !== "None" && (
          <span className="tiny strong" style={{ padding: "4px 10px", borderRadius: 999, background: data.result === "VillagersWin" ? "#13302C" : "#3A1C1A", color: data.result === "VillagersWin" ? "#5FD0BE" : "#F08A7A" }}>
            {data.result === "VillagersWin" ? t("recapTownWon") : t("recapMafiaWon")}
          </span>
        )}
      </header>

      <Body tight>
        {recap.loading && !data && <div className="skeleton" style={{ height: 320, borderRadius: 18 }} />}
        {!recap.loading && !data && <p className="small muted" style={{ textAlign: "center", padding: "24px 8px" }}>{t("recapMissing")}</p>}
        {data && <Timeline recap={data} />}
      </Body>
    </Screen>
  );
}

function Timeline({ recap }: { recap: GameRecap }) {
  const { t, n, language } = useLanguage();
  const roleName = useRoleName();
  const index = new Map(recap.players.map((p, i) => [p.playerId, i]));
  const name = (id: string | null | undefined) => recap.players.find((p) => p.playerId === id)?.name ?? t("unknown");
  const role = (id: string | null | undefined): Role | null => recap.players.find((p) => p.playerId === id)?.role ?? null;
  const cards = buildCards(recap.events);
  const mvps = recap.players.filter((p) => p.isMvp);
  if (recap.result !== "None") {
    cards.push({
      key: "end",
      title: recap.result === "VillagersWin" ? t("townWins") : t("mafiaWins"),
      icon: recap.result === "VillagersWin" ? "villager" : "godfather",
      tone: "end",
      lines: mvps.length > 0 ? [{ dot: SAVE, text: t("recapMvp", { names: mvps.map((m) => m.name).join(t("listAnd")), count: mvps[0].points ?? 0 }) }] : [],
    });
  }

  return (
    <>
      <div className="row" style={{ gap: 6, overflowX: "auto", paddingBottom: 2 }} aria-label={t("everyonesRole")}>
        {recap.players.map((p) => {
          const meta = p.role ? roleMeta[p.role] : null;
          return (
            <span key={p.playerId} className="row" style={{ flex: "none", gap: 6, padding: 5, paddingInlineEnd: 10, borderRadius: 999, background: "var(--surface)", fontSize: 12 }}>
              <span className="avatar" aria-hidden="true" style={{ width: 22, height: 22, fontSize: 11, background: COLORS[(index.get(p.playerId) ?? 0) % COLORS.length] }}>
                {Array.from(p.name)[0]?.toUpperCase()}
              </span>
              <span>{p.name}</span>
              {p.role && <span style={{ color: meta?.fg, fontWeight: 600 }}>{roleName(p.role)}</span>}
            </span>
          );
        })}
      </div>

      <ol className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 12 }}>
        {cards.map((c) => {
          const tone = c.tone === "night"
            ? { bg: "#10122A", edge: "#1E2138", iconBg: "#1E2138", fg: "#9C8CFF" }
            : c.tone === "day"
              ? { bg: "#1A1611", edge: "#2B241B", iconBg: "#2A2113", fg: "#F0A83A" }
              : { bg: "#0F2420", edge: "#1E4A40", iconBg: "#13302C", fg: "#5FD0BE" };
          return (
            <li key={c.key} className="stack" style={{ gap: 8, padding: 14, borderRadius: 18, background: tone.bg, border: `1px solid ${tone.edge}` }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: 999, background: tone.iconBg, color: tone.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={c.icon} size={15} />
                </span>
                <h2 style={{ fontSize: 15, fontWeight: 700 }}>{c.title}</h2>
              </div>
              {c.lines.map((l, i) => (
                <div key={i} className="row" style={{ gap: 8, alignItems: "flex-start", fontSize: 13, lineHeight: 1.45 }}>
                  <span aria-hidden="true" style={{ width: 6, height: 6, flex: "none", marginTop: 7, borderRadius: 999, background: l.dot }} />
                  <span style={{ color: "var(--text-soft)" }}>{l.text}</span>
                </div>
              ))}
            </li>
          );
        })}
      </ol>
    </>
  );

  function buildCards(events: GameEvent[]): Card[] {
    const out: Card[] = [];
    const day = (round: number) => {
      const key = `day-${round}`;
      let card = out.find((c) => c.key === key);
      if (!card) {
        card = { key, title: t("dayN", { number: round }), icon: "sun", tone: "day", lines: [] };
        out.push(card);
      }
      return card;
    };
    const tally = (ballots: Record<string, string | null> | null, ids: string[]) =>
      ids.map((id) => `${name(id)} ${n(Object.values(ballots ?? {}).filter((x) => x === id).length)}`).join(t("listAnd"));
    const votesFor = (e: GameEvent, id: string) => Object.values(e.ballots ?? {}).filter((x) => x === id).length;
    const ballotLines = (e: GameEvent): Line[] => {
      const byTarget = new Map<string, string[]>();
      for (const [voter, target] of Object.entries(e.ballots ?? {})) {
        if (!target) continue;
        byTarget.set(target, [...(byTarget.get(target) ?? []), name(voter)]);
      }
      return [...byTarget].map(([target, voters]) => ({ dot: "#4A4E6A", text: t("recapBallots", { target: name(target), voters: voters.join(language === "fa" ? "، " : ", ") }) }));
    };

    for (const e of events) {
      switch (e.kind) {
        case "Night": {
          const lines: Line[] = [];
          if (e.killTarget) lines.push({ dot: MAFIA, text: t(e.killed ? "recapMafiaKilled" : "recapMafiaBlocked", { name: name(e.killTarget) }) });
          else lines.push({ dot: MAFIA, text: t("recapMafiaNobody") });
          if (e.saved) lines.push({ dot: SAVE, text: t("recapDoctorSaved", { name: name(e.saved) }) });
          if (e.checked) lines.push({ dot: CHECK, text: t(e.checkedIsMafia ? "recapDetectiveMafia" : "recapDetectiveTown", { name: name(e.checked) }) });
          out.push({ key: `night-${e.round}`, title: t("nightN", { number: e.round }), icon: "moon", tone: "night", lines });
          break;
        }
        case "Vote": {
          const card = day(e.round);
          const cast = Object.values(e.ballots ?? {}).some((x) => x);
          if (!cast) {
            if (e.voteRound === 1) card.lines.push({ dot: VOTE, text: t("recapNoVotes") });
            break;
          }
          if (e.votedOut) {
            card.lines.push({ dot: VOTE, text: t(e.voteRound === 2 ? "recapRound2Out" : "recapVotedOut", { name: name(e.votedOut), count: votesFor(e, e.votedOut) }) });
          } else if ((e.tied?.length ?? 0) > 1) {
            card.lines.push({ dot: VOTE, text: t(e.voteRound === 2 ? "recapTieAgain" : "recapTie", { tally: tally(e.ballots, e.tied!) }) });
          } else {
            card.lines.push({ dot: VOTE, text: t("recapNoVotes") });
          }
          card.lines.push(...ballotLines(e));
          if (e.voteRound === 2) {
            for (const id of e.tied ?? []) if (id !== e.votedOut) card.lines.push({ dot: SAVE, text: t("recapSurvivedRevote", { name: name(id) }) });
          }
          break;
        }
        case "LastWords": {
          const r = role(e.playerId);
          const card = recap.players.find((p) => p.playerId === e.playerId)?.eliminatedBy === "Night"
            ? out.find((c) => c.key === `night-${e.round}`) ?? day(e.round)
            : day(e.round);
          card.lines.push({ dot: VOTE, text: t("recapLastWords", { name: name(e.playerId), role: r ? roleName(r) : t("unknown") }) });
          break;
        }
        case "Promoted":
          (out[out.length - 1] ?? day(e.round)).lines.push({ dot: MAFIA, text: t("recapPromoted", { name: name(e.playerId) }) });
          break;
        case "Left":
        case "Removed":
          (out[out.length - 1] ?? day(e.round)).lines.push({ dot: "#8F8473", text: t(e.kind === "Left" ? "recapLeft" : "recapRemoved", { name: name(e.playerId) }) });
          break;
      }
    }
    return out.filter((c) => c.lines.length > 0);
  }
  }
