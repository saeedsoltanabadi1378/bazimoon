import type { Route } from "../app/router";
import { ZipArchive, ZipIntro, ZipResult } from "./zip/ZipScreens";
import { ZipPlay } from "./zip/ZipPlay";
import { MergeIntro, MergePlay, MergeResult } from "./merge/MergeScreens";
import { MemoryIntro, MemoryPlay, MemoryResult } from "./memory/MemoryScreens";
import { MinesIntro, MinesPlay, MinesResult } from "./mines/MinesScreens";
import { NardIntro, NardPlay, NardResult } from "./nard/NardScreens";
import { LadderIntro, LadderPlay, LadderResult } from "./ladder/LadderScreens";
import { StackIntro, StackPlay, StackResult } from "./stack/StackScreens";
import { BlocksIntro, BlocksPlay, BlocksResult } from "./blocks/BlocksScreens";
import { WordIntro, WordPlay, WordResult } from "./word/WordScreens";
import { QueensIntro, QueensPlay, QueensResult } from "./queens/QueensScreens";

type GameRouteProps = { route: Extract<Route, { name: "game" }> };

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : undefined);
const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);

/** Picks the screen for a solo game route: intro, play, result (and Zip's archive). */
export function GameRoute({ route }: GameRouteProps) {
  const p = route.params;
  switch (route.game) {
    case "zip":
      if (route.screen === "play") {
        return <ZipPlay key={JSON.stringify(p)} mode={str(p?.mode, "daily") as "daily" | "practice" | "archive"} number={num(p?.number)} />;
      }
      if (route.screen === "result") return <ZipResult params={p} />;
      if (route.screen === "archive") return <ZipArchive />;
      return <ZipIntro />;
    case "queens":
      if (route.screen === "play") return <QueensPlay key={JSON.stringify(p)} mode={str(p?.mode, "daily") as "daily" | "practice"} size={num(p?.size)} />;
      if (route.screen === "result") return <QueensResult params={p} />;
      return <QueensIntro />;
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
    case "nard":
      if (route.screen === "play") return <NardPlay key={JSON.stringify(p)} resume={p?.resume === true} />;
      if (route.screen === "result") return <NardResult params={p} />;
      return <NardIntro />;
    case "word":
      if (route.screen === "play") return <WordPlay key={JSON.stringify(p)} lang={str(p?.lang, "en") === "fa" ? "fa" : "en"} />;
      if (route.screen === "result") return <WordResult params={p} />;
      return <WordIntro />;
    case "ladder":
      if (route.screen === "play") return <LadderPlay key={JSON.stringify(p)} mode={str(p?.mode, "daily") === "endless" ? "endless" : "daily"} />;
      if (route.screen === "result") return <LadderResult params={p} />;
      return <LadderIntro />;
    case "stack":
      if (route.screen === "play") return <StackPlay key={JSON.stringify(p)} mode={(["daily", "zen"].includes(str(p?.mode, "")) ? str(p?.mode, "") : "classic") as "classic" | "daily" | "zen"} />;
      if (route.screen === "result") return <StackResult params={p} />;
      return <StackIntro />;
    case "blocks":
      if (route.screen === "play") return <BlocksPlay key={JSON.stringify(p)} mode={(["daily", "adventure"].includes(str(p?.mode, "")) ? str(p?.mode, "") : "classic") as "classic" | "daily" | "adventure"} level={num(p?.level)} />;
      if (route.screen === "result") return <BlocksResult params={p} />;
      return <BlocksIntro />;
    default:
      return null;
  }
}
