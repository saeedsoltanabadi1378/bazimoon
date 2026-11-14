import type { ReactNode } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation, type GameKey } from "../app/router";
import { useSession } from "../app/session";
import { Body, ProgressBar, Screen } from "../ui/components";
import { Icon, type IconName } from "../ui/Icon";
import { LogoTiles } from "../ui/LogoTiles";
import { TabBar } from "../ui/TabBar";
import { useHub, useLoad } from "./HubData";
import type { Home, LevelStatus } from "../api/hub";
import { dailyLadder } from "../games/ladder/logic";
import { useCoupleSummary } from "../couple/CoupleHomeCard";
import { haptic } from "../lib/haptics";
import { LadderBoard, MergeBoard, QueensBoard, ZipBoard } from "./HomeBoards";
import "./home.css";

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
  const levelMeta = (game: string) => {
    const status = levelOf(game);
    return status ? t("levelN", { n: status.level }) : t("tagLevels");
  };

  const ladder = levelOf("ladder");
  const ladderPuzzle = ladder ? dailyLadder(ladder.level, language) : null;

  const puzzles = [
    { game: "zip", tint: "linear-gradient(160deg, #1F4F48, #14302D)", board: <ZipBoard />, title: t("gameZip"), meta: levelMeta("zip"), status: levelOf("zip"), onPlay: () => playLevel("zip") },
    { game: "queens", tint: "linear-gradient(160deg, #3D2F58, #261D36)", board: <QueensBoard />, title: t("gameQueens"), meta: levelMeta("queens"), status: levelOf("queens"), onPlay: () => playLevel("queens") },
    { game: "ladder", tint: "linear-gradient(160deg, #4A3418, #2A1F10)", board: <LadderBoard start={ladderPuzzle?.start} end={ladderPuzzle?.end} />, title: t("gameLadder"), meta: levelMeta("ladder"), status: ladder, onPlay: () => playLevel("ladder") },
    { game: "merge", tint: "linear-gradient(160deg, #322D66, #1F1C40)", board: <MergeBoard />, title: t("gameMerge"), meta: data?.mergeBest ? t("homeMergeBest", { best: n(data.mergeBest) }) : t("tagEndless"), status: undefined, onPlay: () => open("merge", "intro") },
  ].filter((puzzle) => isGameOn(puzzle.game));

  return (
    <Screen theme="hub">
      <Body style={{ padding: "20px 16px 24px", gap: 22 }}>
        <header className="row row--between motion-item">
          <div className="row" style={{ gap: 10, minWidth: 0 }}>
            <LogoTiles />
            <div className="display home-wordmark" style={{ fontSize: "clamp(20px, 6.6vw, 28px)", letterSpacing: -0.5 }}>Bazimoon</div>
          </div>
          <div className="row" style={{ flex: "none" }}>
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

        {isGameOn("mafia") && <MafiaHero data={data} />}

        <section className="stack motion-item" style={{ gap: 8 }} aria-labelledby="puzzles-title">
          <div className="row row--between row--baseline">
            <h2 id="puzzles-title" className="display" style={{ fontSize: 20, fontWeight: 700 }}>{t("keepGoing")}</h2>
            <button type="button" className="home-link" onClick={() => push({ name: "solo" })}>
              {t("allGames")}
              <span className="flip-rtl" style={{ display: "flex" }}><Icon name="forward" size={14} /></span>
            </button>
          </div>
          {puzzles.length > 0 && (
            <div className="home-rail">
              {puzzles.map((puzzle, i) => <PuzzleCard key={puzzle.game} {...puzzle} primary={i === 0} />)}
            </div>
          )}
        </section>

        <PlayTogether />

        <LeagueStrip data={data} />

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
      </Body>
      <TabBar />
    </Screen>
  );
}

/** Home's marquee: Mafia with its room and the Godfather, how many tables are open, and the way in. */
function MafiaHero({ data }: { data: Home | null }) {
  const { t } = useLanguage();
  const { push } = useNavigation();
  const table = data?.table ?? null;
  const lobby = table && table.phase === "Lobby" ? table : null;
  const open = data?.openTables ?? 0;
  const chip = lobby?.name
    ? t("mafiaTileYourTable", { name: lobby.name })
    : open === 1 ? t("mafiaTileOneOpen") : open > 1 ? t("mafiaTileOpen", { count: open }) : t("mafiaTileNone");

  return (
    <section className="home-hero motion-item" aria-labelledby="mafia-title">
      <img className="home-hero__man" src="/images/home/godfather.webp" alt="" />
      <div className="home-hero__in">
        <span className="pill home-hero__chip">
          {(lobby || open > 0) && <span className="home-live" />}
          <span>{chip}</span>
        </span>
        <div className="stack" style={{ gap: 10 }}>
          <h2 id="mafia-title" className="display home-hero__title">{t("roleMafia")}</h2>
          <div className="home-hero__sub">{t("mafiaHeroSub")}</div>
          {lobby && lobby.players.length > 0 && (
            <div className="row" style={{ gap: 0 }}>
              <span className="row" style={{ gap: 0 }} aria-hidden="true">
                {lobby.players.slice(0, 4).map((name, i) => (
                  <span key={`${name}-${i}`} className="home-hero__face" style={{ background: avatarColors[i % avatarColors.length] }}>
                    {Array.from(name)[0]?.toUpperCase()}
                  </span>
                ))}
              </span>
              <span className="tiny" style={{ marginInlineStart: 18, color: "#E6D8C9" }}>{t("seatedOf", { seated: lobby.seated, max: lobby.maxPlayers })}</span>
            </div>
          )}
          <div className="row" style={{ marginTop: 4 }}>
            <button
              type="button"
              className="home-btn home-btn--gold grow"
              onClick={() => {
                haptic.tap();
                push(lobby ? { name: "mafia", gameId: lobby.gameId } : { name: "mafia" });
              }}
            >
              {lobby ? t("returnToTable") : t("mafiaHeroJoin")}
            </button>
            {!lobby && (
              <button
                type="button"
                className="home-btn home-btn--glass"
                onClick={() => {
                  haptic.tap();
                  push({ name: "createTable" });
                }}
              >
                <Icon name="plus" size={16} />
                {t("mafiaHeroCreate")}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** A puzzle in Home's rail: its board, the player's level, and a way into the next one. */
function PuzzleCard({ tint, board, title, meta, status, primary, onPlay }: {
  tint: string;
  board: ReactNode;
  title: string;
  meta: string;
  status?: LevelStatus;
  primary?: boolean;
  onPlay: () => void;
}) {
  const { t } = useLanguage();
  return (
    <button type="button" className="home-card interactive-card" style={{ background: tint }} onClick={onPlay}>
      <span className="home-card__board">{board}</span>
      <span>
        <span style={{ display: "block", fontWeight: 600, fontSize: 16 }}>{title}</span>
        <span className="home-card__meta" style={{ display: "block" }}>{meta}</span>
        {status && status.solvedToday > 0 && (
          <span className="row tiny" style={{ gap: 4, marginTop: 2, color: "#5FD0BE", fontWeight: 600 }}>
            <Icon name="check" size={12} strokeWidth={3} />
            {t("levelsSolvedToday", { count: status.solvedToday })}
          </span>
        )}
      </span>
      <span className={`home-btn home-btn--sm ${primary ? "home-btn--gold" : "home-btn--glass"}`} style={{ marginTop: "auto" }}>
        {status?.hasSave ? t("continueGame") : t("play")}
      </span>
    </button>
  );
}

function LeagueStrip({ data }: { data: Home | null }) {
  const { t, n } = useLanguage();
  const { push } = useNavigation();
  const league = data?.league;
  if (!league) return null;
  const ranked = league.rank !== null;
  const pct = ranked && league.playerCount > 0 ? 100 - ((league.rank! - 1) / league.playerCount) * 100 : 0;
  return (
    <button type="button" onClick={() => push({ name: "league" })} className="home-strip interactive-card motion-item">
      <span className="interactive-card__icon" style={{ width: 44, height: 44, flex: "none", borderRadius: 14, background: "#2A2113", color: "#F0A83A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="trophyFull" size={22} />
      </span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="row row--between" style={{ gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{t("seasonDivision", { season: league.season, division: t(`division${league.division}` as "divisionGold"), tier: roman(league.tier) })}</span>
          <span className="tiny muted" style={{ whiteSpace: "nowrap" }}>{t("daysLeft", { count: league.daysLeft })}</span>
        </span>
        <span className="tiny muted" style={{ display: "block", margin: "1px 0 7px" }}>
          {ranked
            ? <>#{n(league.rank!)} {t("ofPlayersZone", { count: league.playerCount, zone: t(`zone_${league.zone ?? "safe"}` as "zone_safe") })}</>
            : t("notRankedHome")}
        </span>
        <ProgressBar value={pct} track="#2B3042" />
      </span>
    </button>
  );
}

export function roman(tier: number) {
  return ["", "I", "II", "III"][tier] ?? "";
}

/** Home's "Play together": the games for more than one player that the marquee does not cover. */
function PlayTogether() {
  const { t } = useLanguage();
  const { push } = useNavigation();
  const couple = useCoupleSummary();
  const { isGameOn } = useHub();
  const game = (key: GameKey) => () => push({ name: "game", game: key, screen: "intro" });
  const games: { key: string; icon: IconName; bg: string; fg: string; title: string; sub: string; onOpen: () => void }[] = [
    { key: "couple", icon: "heart", bg: "#24121C", fg: "#F2A7C3", title: t("coupleQuiz"), sub: couple.couple ? couple.sub : t("coupleTileInvite"), onOpen: () => push({ name: "couple", screen: couple.couple ? "home" : "invite" }) },
    { key: "shelem", icon: "cards", bg: "#24213D", fg: "#E2B86B", title: t("gameShelem"), sub: t("homeShelemSub"), onOpen: game("shelem") },
    { key: "spy", icon: "spy", bg: "#2A1418", fg: "#F08A7A", title: t("gameSpy"), sub: t("homeSpySub"), onOpen: game("spy") },
    { key: "esmfamil", icon: "esmFamil", bg: "#2A2113", fg: "#F6C377", title: t("gameEsmFamil"), sub: t("homeEsmFamilSub"), onOpen: game("esmfamil") },
  ];
  const shown = games.filter((g) => isGameOn(g.key));

  if (shown.length === 0) return null;
  return (
    <section className="stack motion-item" style={{ gap: 12 }} aria-labelledby="together-title">
      <div className="row row--between row--baseline">
        <h2 id="together-title" className="display" style={{ fontSize: 20, fontWeight: 700 }}>{t("playTogether")}</h2>
        {(isGameOn("mafia") || isGameOn("couple")) && (
          <button type="button" className="home-link" onClick={() => push({ name: "mafia" })}>{t("seeAll")}</button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {shown.map((g) => (
          <button
            key={g.key}
            type="button"
            className="home-chip interactive-card"
            onClick={() => {
              haptic.tap();
              g.onOpen();
            }}
          >
            <span className="home-chip__icon interactive-card__icon" style={{ background: g.bg, color: g.fg }}><Icon name={g.icon} size={21} /></span>
            <span className="home-chip__text">
              <span style={{ fontWeight: 600, fontSize: 14 }}>{g.title}</span>
              <span className="tiny muted">{g.sub}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
