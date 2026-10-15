import { useState, type ReactNode } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation, type GameKey } from "../app/router";
import { useSession } from "../app/session";
import { Avatar, Body, ProgressBar, Screen, Toast } from "../ui/components";
import { Icon } from "../ui/Icon";
import { TabBar } from "../ui/TabBar";
import { useHub, useLoad } from "./HubData";
import type { DailyStatus, Home } from "../api/hub";
import { formatClock, formatShortDate, formatTimeOfDay } from "../lib/format";
import { roomCode } from "../mafia/roomCode";
import { dailyLadder } from "../games/ladder/logic";
import { CoupleHomeCard } from "../couple/CoupleHomeCard";
import { haptic } from "../lib/haptics";

const avatarColors = ["#F0A83A", "#5FD0BE", "#B79CF2", "#E5604D", "#8FA8FF", "#E9D8A6"];

export function HomeScreen() {
  const { t, language, n } = useLanguage();
  const { push } = useNavigation();
  const session = useSession();
  const { api, profile } = useHub();
  const home = useLoad(() => api.home(), [api]);
  const [toast, setToast] = useState<string | null>(null);
  const data = home.data;

  const daily = (game: string) => data?.daily.find((d) => d.game === game);
  const open = (game: GameKey, screen: "intro" | "play" = "intro", params?: Record<string, string>) => {
    haptic.tap();
    push({ name: "game", game, screen, params });
  };

  async function quickMatch() {
    try {
      const { gameId } = await api.quickMatch();
      push({ name: "mafia", gameId });
    } catch {
      setToast(t("noOpenTable"));
      window.setTimeout(() => setToast(null), 2500);
    }
  }

  const ladder = daily("ladder");
  const ladderPuzzle = ladder ? dailyLadder(ladder.number) : null;

  return (
    <Screen theme="hub">
      <Body style={{ padding: "20px 16px 24px", gap: 22 }}>
        <header className="row row--between">
          <div className="display" style={{ fontSize: 28, letterSpacing: -0.5 }}>Nightfall</div>
          <div className="row">
            <span className="pill" style={{ background: "#2A2113", color: "#F0A83A", fontSize: 14 }}>
              <Icon name="flame" size={16} />
              {t("streakDays", { count: data?.streak ?? profile?.puzzles.streak ?? 0 })}
            </span>
            <button
              type="button"
              aria-label={t("yourProfile")}
              onClick={() => push({ name: "profile" })}
              style={{ width: 44, height: 44, borderRadius: 999, border: 0, background: "#2B3042", color: "var(--text)", fontWeight: 600, cursor: "pointer" }}
            >
              {Array.from(session.firstName || session.username || "?")[0]?.toUpperCase()}
            </button>
          </div>
        </header>

        <section className="stack" style={{ gap: 12 }}>
          <div className="row row--between row--baseline">
            <h2 className="display" style={{ fontSize: 20, fontWeight: 700 }}>{t("todaysPuzzles")}</h2>
            {data && <span className="small muted">{formatShortDate(data.date, language)}</span>}
          </div>

          <DailyRow
            icon={<Icon name="zipFull" size={24} />} iconBg="#173A36" iconFg="#5FD0BE"
            title={t("puzzleNumbered", { name: t("gameZip"), number: daily("zip")?.number ?? "" })}
            sub={t("zipTagline")}
            status={daily("zip")}
            primary
            onPlay={() => open("zip", "play", { mode: "daily" })}
          />
          <DailyRow
            icon={<Icon name="crown" size={24} />} iconBg="#2E2340" iconFg="#B79CF2"
            title={t("puzzleNumbered", { name: t("gameQueens"), number: daily("queens")?.number ?? "" })}
            sub={t("queensTagline")}
            status={daily("queens")}
            onPlay={() => open("queens", "play", { mode: "daily" })}
          />
          <DailyRow
            icon={<span className="display" style={{ fontSize: 18 }}>Aa</span>} iconBg="#3A2A16" iconFg="#F0A83A"
            title={t("gameLadder")}
            sub={ladderPuzzle ? t("ladderToday", { from: ladderPuzzle.start, to: ladderPuzzle.end, steps: ladderPuzzle.par }) : t("subLadder")}
            status={ladder}
            showMoves
            onPlay={() => open("ladder", "intro")}
          />
          <DailyRow
            icon={<MergeGlyph />} iconBg="#2A2650" iconFg="#9C8CFF"
            title={t("gameMerge")}
            sub={data?.mergeBest ? t("mergeEndlessBest", { best: n(data.mergeBest) }) : t("mergeEndless")}
            onPlay={() => open("merge", "intro")}
          />
          <button
            type="button"
            onClick={() => push({ name: "solo" })}
            className="row"
            style={{ justifyContent: "center", gap: 6, minHeight: 48, borderRadius: 14, border: "1.5px dashed #3A3F52", background: "transparent", color: "var(--text)", fontWeight: 600, fontSize: 14, cursor: "pointer", padding: "0 12px" }}
          >
            {t("allSoloGames")}
            <span className="flip-rtl" style={{ display: "flex" }}><Icon name="forward" size={16} /></span>
          </button>
        </section>

        <TableCard data={data} onSeat={(gameId) => push({ name: "mafia", gameId })} onQuickMatch={() => void quickMatch()} />

        <CoupleHomeCard />

        <LeagueCard data={data} onOpen={() => push({ name: "league" })} />
      </Body>
      <TabBar />
      <Toast message={toast} />
    </Screen>
  );

  function TableCard({ data, onSeat, onQuickMatch }: { data: Home | null; onSeat: (id: string) => void; onQuickMatch: () => void }) {
    const table = data?.table;
    return (
      <section className="stack stack--lg" style={{ padding: 18, borderRadius: 22, background: "#22161A", border: "1px solid #3D2328" }} aria-label={t("tonightsTable")}>
        <div className="row row--between">
          <div className="stack" style={{ gap: 2 }}>
            <span className="kicker" style={{ color: "#F08A7A" }}>{t("tonightsTable")}</span>
            <span className="display" style={{ fontSize: 22, fontWeight: 700 }}>
              {table ? t("mafiaRoom", { code: roomCode(table.gameId) }) : t("noTableYet")}
            </span>
          </div>
          {table && (
            <div style={{ textAlign: "end" }}>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{formatTimeOfDay(table.createdAt, language)}</div>
              <div className="tiny" style={{ color: "#B9A6A9" }}>{t("classicPlayers", { count: table.maxPlayers })}</div>
            </div>
          )}
        </div>
        {table ? (
          <>
            <div className="row row--between">
              <div className="row" style={{ gap: 0 }} aria-hidden="true">
                {table.players.map((name, i) => (
                  <Avatar key={`${name}-${i}`} name={name} color={avatarColors[i % avatarColors.length]} size={34} fontSize={13} style={{ marginInlineEnd: -8, border: "2px solid #22161A", color: "#101218" }} />
                ))}
              </div>
              <span style={{ fontSize: 14, color: "#E7D9DB" }}>{t("seatedOf", { seated: table.seated, max: table.maxPlayers })}</span>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <button type="button" className="btn btn--md grow" style={{ background: "#E5604D", color: "#1C0905" }} onClick={() => onSeat(table.gameId)}>
                {table.youAreSeated ? t("returnToTable") : t("takeASeat")}
              </button>
              <button type="button" className="btn btn--md btn--outline grow" style={{ borderColor: "#5A3439" }} onClick={onQuickMatch}>{t("quickMatch")}</button>
            </div>
          </>
        ) : (
          <p className="small" style={{ color: "#E7D9DB" }}>{t("noTableHint")}</p>
        )}
      </section>
    );
  }

  function LeagueCard({ data, onOpen }: { data: Home | null; onOpen: () => void }) {
    const league = data?.league;
    if (!league) return null;
    const ranked = league.rank !== null;
    const pct = ranked && league.playerCount > 0 ? 100 - ((league.rank! - 1) / league.playerCount) * 100 : 0;
    return (
      <button type="button" onClick={onOpen} className="stack" style={{ gap: 12, padding: 16, borderRadius: 18, background: "var(--surface)", border: 0, color: "var(--text)", textAlign: "start", cursor: "pointer" }}>
        <div className="row row--between small muted" style={{ width: "100%" }}>
          <span>{t("seasonDivision", { season: league.season, division: t(`division${league.division}` as "divisionGold"), tier: roman(league.tier) })}</span>
          <span>{t("daysLeft", { count: league.daysLeft })}</span>
        </div>
        {ranked ? (
          <div className="row row--baseline" style={{ gap: 8 }}>
            <span className="display" style={{ fontSize: 30 }}>#{n(league.rank!)}</span>
            <span style={{ fontSize: 15 }}>{t("ofPlayersZone", { count: league.playerCount, zone: t(`zone_${league.zone ?? "safe"}` as "zone_safe") })}</span>
          </div>
        ) : (
          <div style={{ fontSize: 15 }}>{t("notRankedHome")}</div>
        )}
        <div style={{ width: "100%" }}><ProgressBar value={pct} track="#2B3042" /></div>
      </button>
    );
  }
}

function DailyRow({ icon, iconBg, iconFg, title, sub, status, primary, showMoves, onPlay }: {
  icon: ReactNode;
  iconBg: string;
  iconFg: string;
  title: string;
  sub: string;
  status?: DailyStatus;
  primary?: boolean;
  showMoves?: boolean;
  onPlay: () => void;
}) {
  const { t, language, n } = useLanguage();
  const solved = status?.solved;
  return (
    <div className="row" style={{ gap: 12, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
      <span style={{ width: 48, height: 48, flex: "none", borderRadius: 14, background: iconBg, color: iconFg, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
      <div className="grow">
        <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
        <div className="small muted">{sub}</div>
      </div>
      {solved ? (
        <span className="row" style={{ gap: 6, color: "#5FD0BE", fontWeight: 600, fontSize: 14 }} aria-label={t("solvedLabel")}>
          <Icon name="check" size={18} strokeWidth={2.5} />
          {showMoves && status?.moves ? t("movesCount", { count: n(status.moves) }) : formatClock(status?.timeMs, language)}
        </span>
      ) : status?.played ? (
        <span className="small muted">{t("triedToday")}</span>
      ) : (
        <button
          type="button"
          onClick={onPlay}
          className="btn btn--pill"
          style={primary ? { background: "#F0A83A", color: "#1A1206" } : { background: "transparent", border: "1.5px solid #3A3F52", color: "var(--text)" }}
        >
          {t("play")}
        </button>
      )}
    </div>
  );
}

function MergeGlyph() {
  return (
    <span style={{ width: 30, height: 30, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 3 }} aria-hidden="true">
      {["#3E3A78", "#9C8CFF", "#F0A83A", "#54449E"].map((c) => <span key={c} style={{ borderRadius: 4, background: c }} />)}
    </span>
  );
}

export function roman(tier: number) {
  return ["", "I", "II", "III"][tier] ?? "";
}
