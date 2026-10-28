import type { Route } from "../app/router";
import { LevelsScreen } from "./shared/levels";
import { ZipIntro, ZipResult } from "./zip/ZipScreens";
import { ZipPlay } from "./zip/ZipPlay";
import { MergeIntro, MergePlay, MergeResult } from "./merge/MergeScreens";
import { MemoryIntro, MemoryPlay, MemoryResult } from "./memory/MemoryScreens";
import { MinesIntro, MinesPlay, MinesResult } from "./mines/MinesScreens";
import { LadderIntro, LadderLevels, LadderPlay, LadderResult } from "./ladder/LadderScreens";
import { StackIntro, StackPlay, StackResult } from "./stack/StackScreens";
import { BlocksIntro, BlocksPlay, BlocksResult } from "./blocks/BlocksScreens";
import { WordIntro, WordPlay, WordResult } from "./word/WordScreens";
import { wordLevelCount } from "./word/logic";
import { QueensIntro, QueensPlay, QueensResult } from "./queens/QueensScreens";
import { SudokuIntro, SudokuPlay, SudokuResult } from "./sudoku/SudokuScreens";
import type { SudokuLevel } from "./sudoku/logic";
import { SnakeIntro, SnakePlay, SnakeResult } from "./snake/SnakeScreens";
import { DoozIntro, DoozPlay, DoozResult } from "./dooz/DoozScreens";
import { SpyIntro, SpyPlay, SpyResult } from "./spy/SpyScreens";
import { EsmFamilIntro, EsmFamilPlay, EsmFamilResult, EsmFamilSetup } from "./esmfamil/EsmFamilScreens";
import { EsmFamilSolo } from "./esmfamil/EsmFamilSolo";
import { EsmFamilLobby, EsmFamilOnline } from "./esmfamil/EsmFamilOnline";

type GameRouteProps = { route: Extract<Route, { name: "game" }> };

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : undefined);
const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)));

/** Picks the screen for a solo game route: intro, play, result (and the level list of level games). */
export function GameRoute({ route }: GameRouteProps) {
  const p = route.params;
  // Level games: play level `level`; anything else (or a level missing) plays practice.
  const level = str(p?.mode, "") === "level" ? num(p?.level) : undefined;
  switch (route.game) {
    case "zip":
      if (route.screen === "play") return <ZipPlay key={JSON.stringify(p)} mode={level ? "level" : "practice"} level={level} />;
      if (route.screen === "result") return <ZipResult params={p} />;
      if (route.screen === "levels") return <LevelsScreen game="zip" track="level" name="gameZip" accent="#5FD0BE" />;
      return <ZipIntro />;
    case "queens":
      if (route.screen === "play") return <QueensPlay key={JSON.stringify(p)} mode={level ? "level" : "practice"} level={level} size={num(p?.size)} />;
      if (route.screen === "result") return <QueensResult params={p} />;
      if (route.screen === "levels") return <LevelsScreen game="queens" track="level" name="gameQueens" accent="#B79CF2" />;
      return <QueensIntro />;
    case "sudoku":
      if (route.screen === "play") {
        const difficulty = str(p?.level, "medium");
        return <SudokuPlay key={JSON.stringify(p)} mode={level ? "level" : "classic"} number={level} difficulty={(["easy", "medium", "hard", "expert"].includes(difficulty) ? difficulty : "medium") as SudokuLevel} />;
      }
      if (route.screen === "result") return <SudokuResult params={p} />;
      if (route.screen === "levels") return <LevelsScreen game="sudoku" track="level" name="gameSudoku" accent="#7CC4FA" />;
      return <SudokuIntro />;
    case "merge":
      if (route.screen === "play") return <MergePlay key={JSON.stringify(p)} mode={str(p?.mode, "classic") as "classic" | "big" | "timed"} />;
      if (route.screen === "result") return <MergeResult params={p} />;
      return <MergeIntro />;
    case "mines":
      if (route.screen === "play") return <MinesPlay key={JSON.stringify(p)} mode={str(p?.mode, "easy") as "daily" | "easy" | "medium" | "hard"} />;
      if (route.screen === "result") return <MinesResult params={p} />;
      return <MinesIntro />;
    case "memory":
      if (route.screen === "play") return <MemoryPlay key={JSON.stringify(p)} mode={str(p?.mode, "4x4") as "4x4" | "4x5" | "6x6" | "timed"} />;
      if (route.screen === "result") return <MemoryResult params={p} />;
      return <MemoryIntro />;
    case "word": {
      const lang = str(p?.lang, "en") === "fa" ? "fa" : "en";
      if (route.screen === "play" && level) return <WordPlay key={JSON.stringify(p)} lang={lang} level={level} />;
      if (route.screen === "result") return <WordResult params={p} />;
      if (route.screen === "levels") {
        return <LevelsScreen game="word" track={lang === "fa" ? "level-fa" : "level"} name="gameWord" accent="#9ED98C" accentInk="#0E1F0A" maxLevel={wordLevelCount(lang)} params={{ lang }} />;
      }
      return <WordIntro />;
    }
    case "ladder":
      if (route.screen === "play") return <LadderPlay key={JSON.stringify(p)} mode={level ? "level" : "endless"} level={level} />;
      if (route.screen === "result") return <LadderResult params={p} />;
      if (route.screen === "levels") return <LadderLevels />;
      return <LadderIntro />;
    case "stack":
      if (route.screen === "play") return <StackPlay key={JSON.stringify(p)} mode={(["daily", "zen"].includes(str(p?.mode, "")) ? str(p?.mode, "") : "classic") as "classic" | "daily" | "zen"} />;
      if (route.screen === "result") return <StackResult params={p} />;
      return <StackIntro />;
    case "blocks":
      if (route.screen === "play") return <BlocksPlay key={JSON.stringify(p)} mode={(["daily", "adventure"].includes(str(p?.mode, "")) ? str(p?.mode, "") : "classic") as "classic" | "daily" | "adventure"} level={num(p?.level)} />;
      if (route.screen === "result") return <BlocksResult params={p} />;
      return <BlocksIntro />;
    case "snake":
      if (route.screen === "play") return <SnakePlay key={JSON.stringify(p)} mode={(["daily", "wrap"].includes(str(p?.mode, "")) ? str(p?.mode, "") : "classic") as "classic" | "daily" | "wrap"} />;
      if (route.screen === "result") return <SnakeResult params={p} />;
      return <SnakeIntro />;
    case "dooz":
      if (route.screen === "play") return <DoozPlay key={JSON.stringify(p)} mode={(["easy", "big", "friend"].includes(str(p?.mode, "")) ? str(p?.mode, "") : "smart") as "easy" | "smart" | "big" | "friend"} />;
      if (route.screen === "result") return <DoozResult params={p} />;
      return <DoozIntro />;
    case "spy":
      if (route.screen === "play") {
        const pack = str(p?.pack, "places");
        const players = clamp(num(p?.players) ?? 5, 3, 12);
        const names = (() => {
          try {
            const parsed: unknown = JSON.parse(str(p?.names, "[]"));
            return Array.isArray(parsed) ? parsed.slice(0, players).map((name) => String(name).slice(0, 24)) : [];
          } catch {
            return [];
          }
        })();
        return (
          <SpyPlay
            key={JSON.stringify(p)}
            pack={(["food", "jobs", "mixed"].includes(pack) ? pack : "places") as "places" | "food" | "jobs" | "mixed"}
            players={players}
            spies={clamp(num(p?.spies) ?? 1, 1, 3)}
            minutes={clamp(num(p?.minutes) ?? 5, 1, 15)}
            names={names}
          />
        );
      }
      if (route.screen === "result") return <SpyResult params={p} />;
      return <SpyIntro />;
    case "esmfamil": {
      const way = str(p?.way, "phone");
      if (route.screen === "play") return <EsmFamilPlay key={JSON.stringify(p)} />;
      if (route.screen === "setup") return <EsmFamilSetup way={way === "online" || way === "solo" ? way : "phone"} room={typeof p?.room === "string" ? p.room : undefined} />;
      if (route.screen === "lobby") return <EsmFamilLobby key={str(p?.code, "")} code={str(p?.code, "")} />;
      if (route.screen === "online") return <EsmFamilOnline key={str(p?.code, "")} code={str(p?.code, "")} />;
      if (route.screen === "solo") return <EsmFamilSolo key={JSON.stringify(p)} mode={str(p?.mode, "daily") === "practice" ? "practice" : "daily"} letters={str(p?.letters, "fa") === "en" ? "en" : "fa"} />;
      if (route.screen === "result") return <EsmFamilResult params={p} />;
      return <EsmFamilIntro />;
    }
    default:
      return null;
  }
}
