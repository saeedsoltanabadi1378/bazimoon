import type { ReactNode } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation, type GameKey } from "../app/router";
import { useSession } from "../app/session";
import { Body, ProgressBar, Screen } from "../ui/components";
import { Icon } from "../ui/Icon";
import { LogoTiles } from "../ui/LogoTiles";
import { TabBar } from "../ui/TabBar";
import { useHub, useLoad } from "./HubData";
import type { Home, LevelStatus } from "../api/hub";
import { dailyLadder } from "../games/ladder/logic";
import { useCoupleSummary } from "../couple/CoupleHomeCard";
import { haptic } from "../lib/haptics";

const avatarColors = ["#F0A83A", "#5FD0BE", "#B79CF2", "#E5604D", "#8FA8FF", "#E9D8A6"];

export function HomeScreen() {
  const { t, language, n } = useLanguage();
  const { push } = useNavigation();
  const session = useSession();
  const { api, profile, isGameOn } = useHub();
  const home = useLoad(() => api.home(), [api]);
  const data = home.data;

  const levelOf = (game: string) => data?.levels.find((d) => d.game === game);
  const open = (game: GameKey, screen: "intro" | "play" = "intro", params?: Record<string, string | number>) => {
    haptic.tap();
    push({ name: "game", game, screen, params });
  };
  /** Straight into the player's current level, or the intro while Home is still loading. */
  const playLevel = (game: GameKey) => {
    const status = levelOf(game);
    if (status) open(game, "play", { mode: "level", level: status.level });
    else open(game, "intro");
  };
  const levelTitle = (name: "gameZip" | "gameQueens" | "gameLadder", game: string) => {
    const status = levelOf(game);
    return status ? `${t(name)} · ${t("levelN", { n: status.level })}` : t(name);
  };

  const ladder = levelOf("ladder");
  const ladderPuzzle = ladder ? dailyLadder(ladder.level, language) : null;

  return (
    <Screen theme="hub">
      <Body style={{ padding: "20px 16px 24px", gap: 22 }}>
        <header className="row row--between motion-item">
          <div className="row" style={{ gap: 10 }}>
            <LogoTiles />
            <div className="display" style={{ fontSize: 28, letterSpacing: -0.5 }}>Bazimoon</div>
          </div>
          <div className="row">
            <span className="pill" style={{ background: "#2A2113", color: "#F0A83A", fontSize: 14, whiteSpace: "nowrap" }}>
              <Icon name="flame" size={16} />
              {t("streakDays", { count: data?.streak ?? profile?.puzzles.streak ?? 0 })}
            </span>
            <button
              type="button"
              aria-label={t("yourProfile")}
              onClick={() => push({ name: "profile" })}
              style={{ width: 44, height: 44, borderRadius: 999, border: 0, background: "#2B3042", color: "var(--text)", fontWeight: 600, cursor: "pointer" }}
            >
              {Array.from(session.displayName || "?")[0]?.toUpperCase()}
            </button>
          </div>
        </header>

        <section className="stack motion-item" style={{ gap: 12 }}>
          <div className="row row--between row--baseline">
            <h2 className="display" style={{ fontSize: 20, fontWeight: 700 }}>{t("yourPuzzles")}</h2>
          </div>

          {isGameOn("zip") && (
            <LevelRow
              icon={<Icon name="zipFull" size={24} />} iconBg="#173A36" iconFg="#5FD0BE"
              title={levelTitle("gameZip", "zip")}
              sub={t("zipTagline")}
              status={levelOf("zip")}
              primary
              onPlay={() => playLevel("zip")}
            />
          )}
          {isGameOn("queens") && (
            <LevelRow
              icon={<Icon name="crown" size={24} />} iconBg="#2E2340" iconFg="#B79CF2"
              title={levelTitle("gameQueens", "queens")}
              sub={t("queensTagline")}
              status={levelOf("queens")}
              onPlay={() => playLevel("queens")}
            />
          )}
          {isGameOn("ladder") && (
            <LevelRow
              icon={<span className="display" style={{ fontSize: 18 }}>Aa</span>} iconBg="#3A2A16" iconFg="#F0A83A"
              title={levelTitle("gameLadder", "ladder")}
              sub={ladderPuzzle ? t("ladderToday", { from: ladderPuzzle.start, to: ladderPuzzle.end, steps: ladderPuzzle.par }) : t("subLadder")}
              status={ladder}
              onPlay={() => playLevel("ladder")}
            />
          )}
          {isGameOn("merge") && (
            <LevelRow
              icon={<MergeGlyph />} iconBg="#2A2650" iconFg="#9C8CFF"
              title={t("gameMerge")}
              sub={data?.mergeBest ? t("mergeEndlessBest", { best: n(data.mergeBest) }) : t("mergeEndless")}
              onPlay={() => open("merge", "intro")}
            />
          )}
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

        <PlayTogether data={data} />

        <LeagueCard data={data} onOpen={() => push({ name: "league" })} />
      </Body>
      <TabBar />
    </Screen>
  );

  function LeagueCard({ data, onOpen }: { data: Home | null; onOpen: () => void }) {
    const league = data?.league;
    if (!league) return null;
    const ranked = league.rank !== null;
    const pct = ranked && league.playerCount > 0 ? 100 - ((league.rank! - 1) / league.playerCount) * 100 : 0;
    return (
      <button type="button" onClick={onOpen} className="stack interactive-card motion-item" style={{ gap: 12, padding: 16, borderRadius: 18, background: "var(--surface)", border: 0, color: "var(--text)", textAlign: "start", cursor: "pointer" }}>
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

/** A puzzle on Home: the player's level, how many they finished today, and a button into the next one. */
function LevelRow({ icon, iconBg, iconFg, title, sub, status, primary, onPlay }: {
  icon: ReactNode;
  iconBg: string;
  iconFg: string;
  title: string;
  sub: string;
  status?: LevelStatus;
  primary?: boolean;
  onPlay: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="row interactive-card" style={{ gap: 12, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
      <span className="interactive-card__icon" style={{ width: 48, height: 48, flex: "none", borderRadius: 14, background: iconBg, color: iconFg, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
      <div className="grow">
        <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
        <div className="small muted">{sub}</div>
        {status && status.solvedToday > 0 && (
          <div className="row tiny" style={{ gap: 4, marginTop: 2, color: "#5FD0BE", fontWeight: 600 }}>
            <Icon name="check" size={12} strokeWidth={3} />
            {t("levelsSolvedToday", { count: status.solvedToday })}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onPlay}
        className="btn btn--pill"
        style={primary ? { background: "#F0A83A", color: "#1A1206" } : { background: "transparent", border: "1.5px solid #3A3F52", color: "var(--text)" }}
      >
        {status?.hasSave ? t("continueGame") : t("play")}
      </button>
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

/** Home's "Play together": equal Mafia and Couple Quiz tiles, so neither leads the hub. */
function PlayTogether({ data }: { data: Home | null }) {
  const { t, language } = useLanguage();
  const { push } = useNavigation();
  const couple = useCoupleSummary();
  const { isGameOn } = useHub();
  const mafiaOn = isGameOn("mafia");
  const coupleOn = isGameOn("couple");
  const table = data?.table ?? null;
  const open = data?.openTables ?? 0;
  const tableName = table?.name;
  const mafiaSub = table && table.phase === "Lobby" && tableName
    ? t("mafiaTileYourTable", { name: tableName })
    : open === 1 ? t("mafiaTileOneOpen") : open > 1 ? t("mafiaTileOpen", { count: open }) : t("mafiaTileNone");
  const tile = { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 18, background: "var(--surface)", border: 0, color: "var(--text)", textAlign: "start", font: "inherit", cursor: "pointer", minWidth: 0 } as const;
  const iconBox = (bg: string, fg: string) => ({ width: 44, height: 44, borderRadius: 14, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center" });

  if (!mafiaOn && !coupleOn) return null;
  return (
    <section className="stack motion-item" style={{ gap: 12 }} aria-labelledby="together-title">
      <div className="row row--between row--baseline">
        <h2 id="together-title" className="display" style={{ fontSize: 20, fontWeight: 700 }}>{t("playTogether")}</h2>
        <button type="button" onClick={() => push({ name: "mafia" })} style={{ background: "none", border: 0, padding: 0, color: "#F0A83A", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("seeAll")}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${mafiaOn && coupleOn ? 2 : 1}, minmax(0, 1fr))`, gap: 10 }}>
        {mafiaOn && <button type="button" className="interactive-card" style={tile} onClick={() => push(table && table.phase === "Lobby" ? { name: "mafia", gameId: table.gameId } : { name: "mafia" })}>
          <span className="interactive-card__icon" style={iconBox("#2E2340", "#B79CF2")}><Icon name="moon" size={22} /></span>
          <span>
            <span style={{ display: "block", fontWeight: 600, fontSize: 16 }}>{t("roleMafia")}</span>
            <span style={{ display: "block", fontSize: 13, color: "var(--muted)" }}>{mafiaSub}</span>
          </span>
          {table && table.players.length > 0 && (
            <span className="row" style={{ gap: 0 }} aria-hidden="true">
              {table.players.slice(0, 4).map((name, i) => (
                <span key={`${name}-${i}`} style={{ width: 26, height: 26, marginInlineEnd: -7, borderRadius: 999, border: "2px solid var(--surface)", background: avatarColors[i % avatarColors.length], color: "#101218", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                  {Array.from(name)[0]?.toUpperCase()}
                </span>
              ))}
            </span>
          )}
        </button>}
        {coupleOn && <button type="button" className="interactive-card" style={tile} onClick={() => push({ name: "couple", screen: couple.couple ? "home" : "invite" })}>
          <span className="interactive-card__icon" style={iconBox("#24121C", "#F2A7C3")}><Icon name="heart" size={22} /></span>
          <span>
            <span style={{ display: "block", fontWeight: 600, fontSize: 16 }}>{t("coupleQuiz")}</span>
            <span style={{ display: "block", fontSize: 13, color: "var(--muted)" }}>{couple.couple ? couple.sub : t("coupleTileInvite")}</span>
          </span>
          {couple.couple && couple.couple.streak > 0 && (
            <span style={{ padding: "3px 10px", borderRadius: 999, background: "#24121C", color: "#F2A7C3", fontSize: 12, fontWeight: 600 }}>{t("streakDays", { count: couple.couple.streak })}</span>
          )}
        </button>}
      </div>
      <a
        href={`/${language}/guides/`}
        onClick={() => haptic.tap()}
        className="row"
        style={{ gap: 10, minHeight: 52, padding: "8px 12px", borderRadius: 14, border: "1.5px dashed #3A3F52", color: "var(--text)", textDecoration: "none" }}
      >
        <span style={{ width: 34, height: 34, flex: "none", borderRadius: 10, background: "#1E2138", color: "#C3B9FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="info" size={18} />
        </span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{t("gameGuides")}</span>
          <span className="tiny muted" style={{ display: "block" }}>{t("gameGuidesSubtitle")}</span>
        </span>
        <span className="flip-rtl" style={{ display: "flex", color: "var(--muted)" }}><Icon name="forward" size={16} /></span>
      </a>
    </section>
  );
}
