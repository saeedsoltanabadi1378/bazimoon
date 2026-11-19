import { useState, type ReactNode } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation, type GameKey } from "../app/router";
import { Body, IconButton, Screen } from "../ui/components";
import { TabBar } from "../ui/TabBar";
import { useHub, useLoad } from "./HubData";
import { GameCard } from "./GameCard";
import { LadderBoard, MergeBoard, QueensBoard, ZipBoard } from "./HomeBoards";
import { BlocksBoard, BricksBoard, CoupleBoard, DoozBoard, EsmFamilBoard, MemoryBoard, MinesBoard, ShelemBoard, SnakeBoard, SpyBoard, StackBoard, SudokuBoard, WordBoard } from "./GameBoards";
import { catalog, tagColors, type GameCategory } from "../games/catalog";
import { dailyLadder } from "../games/ladder/logic";
import { readLocal } from "../lib/storage";
import { haptic } from "../lib/haptics";

const filters: ("All" | GameCategory)[] = ["All", "Puzzles", "Words", "Party", "Couples", "Classics", "Arcade"];

/** A saved Merge game the player can jump back into. Merge stores {score} under this key. */
function savedMerge(): number | null {
  const saved = readLocal<{ score: number; over: boolean } | null>("bazimoon-merge-classic", null);
  return saved && !saved.over && saved.score > 0 ? saved.score : null;
}

export function SoloScreen() {
  const { t, n, language } = useLanguage();
  const { push, back, depth } = useNavigation();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const mergeScore = savedMerge();
  const { api, isGameOn } = useHub();
  const home = useLoad(() => api.home(), [api]).data;
  const games = catalog.filter((g) => isGameOn(g.key) && (filter === "All" || g.category === filter));

  const levelOf = (game: string) => home?.levels.find((d) => d.game === game);
  const ladder = levelOf("ladder");
  const ladderPuzzle = ladder ? dailyLadder(ladder.level, language) : null;

  function boardFor(key: string): ReactNode {
    switch (key) {
      case "zip": return <ZipBoard size={110} />;
      case "queens": return <QueensBoard size={110} />;
      case "ladder": return <LadderBoard start={ladderPuzzle?.start} end={ladderPuzzle?.end} />;
      case "merge": return <MergeBoard />;
      case "mines": return <MinesBoard />;
      case "memory": return <MemoryBoard />;
      case "sudoku": return <SudokuBoard />;
      case "word": return <WordBoard />;
      case "stack": return <StackBoard />;
      case "couple": return <CoupleBoard />;
      case "esmfamil": return <EsmFamilBoard />;
      case "shelem": return <ShelemBoard />;
      case "spy": return <SpyBoard />;
      case "dooz": return <DoozBoard />;
      case "snake": return <SnakeBoard />;
      case "blocks": return <BlocksBoard />;
      case "bricks": return <BricksBoard />;
      default: return null;
    }
  }

  function open(key: string) {
    if (key === "couple") push({ name: "couple", screen: "home" });
    else push({ name: "game", game: key as GameKey, screen: "intro" });
  }

  return (
    <Screen theme="night">
      <header className="topbar">
        {depth > 1 && <IconButton icon="back" label={t("backToHome")} onClick={back} />}
        <div className="topbar__text">
          <h1 className="display" style={{ fontSize: 26 }}>{t("soloGames")}</h1>
          <div className="tiny muted">{t("soloSubtitle")}</div>
        </div>
      </header>

      <Body style={{ paddingBottom: 20 }}>
        <div className="filter-row" role="tablist" aria-label={t("gameType")}>
          {filters.map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
              {t(`filter${f}`)}
            </button>
          ))}
        </div>

        <div className="games-grid">
          {games.map((g) => {
            const [tagBg, tagFg] = tagColors[g.tag];
            const status = levelOf(g.key);
            const mergeSave = g.key === "merge" ? mergeScore : null;
            // A half-finished game goes straight back to its board; anything else opens the game's intro.
            const resume = status?.hasSave
              ? () => push({ name: "game", game: g.key as GameKey, screen: "play", params: { mode: "level", level: status.level } })
              : mergeSave !== null
                ? () => push({ name: "game", game: "merge", screen: "play", params: { mode: "classic" } })
                : null;
            const meta = status ? t("levelN", { n: status.level })
              : mergeSave !== null ? t("gamesScore", { score: n(mergeSave) })
                : g.key === "merge" && home?.mergeBest ? t("homeMergeBest", { best: n(home.mergeBest) })
                  : t(g.sub);
            return (
              <GameCard
                key={g.key}
                tint={g.tint}
                board={boardFor(g.key)}
                title={t(g.name)}
                meta={meta}
                tag={{ text: t(`tag${g.tag}`), bg: tagBg, fg: tagFg }}
                solvedToday={status?.solvedToday}
                action={resume ? t("continueGame") : t("play")}
                gold={resume !== null}
                onPlay={() => {
                  haptic.tap();
                  if (resume) resume();
                  else open(g.key);
                }}
              />
            );
          })}
        </div>
      </Body>
      <TabBar />
    </Screen>
  );
}
