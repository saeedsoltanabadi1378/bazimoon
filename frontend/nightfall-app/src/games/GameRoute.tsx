import type { Route } from "../app/router";
import { ZipArchive, ZipIntro, ZipResult } from "./zip/ZipScreens";
import { ZipPlay } from "./zip/ZipPlay";
import { MergeIntro, MergePlay, MergeResult } from "./merge/MergeScreens";
import { MinesIntro, MinesPlay, MinesResult } from "./mines/MinesScreens";
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
    default:
      return null;
  }
}
