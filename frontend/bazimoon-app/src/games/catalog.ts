import type { GameKey } from "../app/router";
import type { IconName } from "../ui/Icon";
import type { TranslationKey } from "../i18n/LanguageContext";

export type GameCategory = "Puzzles" | "Words" | "Party" | "Couples" | "Classics" | "Arcade";
export type GameTag = "Daily" | "Levels" | "Endless" | "New" | "vsBot";

export interface CatalogEntry {
  key: GameKey | "couple";
  name: TranslationKey;
  sub: TranslationKey;
  category: GameCategory;
  tag: GameTag;
  icon: IconName;
  bg: string;
  fg: string;
  /** Accent used on the game's intro/result screens. */
  accent: string;
  /** Background of the game's card on Home and the Games tab. */
  tint: string;
}

export const catalog: CatalogEntry[] = [
  { key: "zip", name: "gameZip", sub: "subZip", category: "Puzzles", tag: "Levels", icon: "zip", bg: "#173A36", fg: "#5FD0BE", accent: "#5FD0BE", tint: "linear-gradient(160deg, #1F4F48, #14302D)" },
  { key: "merge", name: "gameMerge", sub: "subMerge", category: "Puzzles", tag: "Endless", icon: "merge", bg: "#2A2650", fg: "#9C8CFF", accent: "#9C8CFF", tint: "linear-gradient(160deg, #322D66, #1F1C40)" },
  { key: "mines", name: "gameMines", sub: "subMines", category: "Puzzles", tag: "Endless", icon: "mine", bg: "#2A1A1A", fg: "#F08A7A", accent: "#F08A7A", tint: "linear-gradient(160deg, #4A2622, #2A1614)" },
  { key: "memory", name: "gameMemory", sub: "subMemory", category: "Arcade", tag: "New", icon: "memory", bg: "#1B2A44", fg: "#8FA8FF", accent: "#8FA8FF", tint: "linear-gradient(160deg, #243A5E, #16223A)" },
  { key: "sudoku", name: "gameSudoku", sub: "subSudoku", category: "Puzzles", tag: "New", icon: "grid", bg: "#12304A", fg: "#7CC4FA", accent: "#7CC4FA", tint: "linear-gradient(160deg, #1A4466, #102A40)" },
  { key: "queens", name: "gameQueens", sub: "subQueens", category: "Puzzles", tag: "Levels", icon: "godfather", bg: "#2E2340", fg: "#B79CF2", accent: "#B79CF2", tint: "linear-gradient(160deg, #3D2F58, #261D36)" },
  { key: "word", name: "gameWord", sub: "subWord", category: "Words", tag: "Levels", icon: "word", bg: "#14241A", fg: "#9ED98C", accent: "#9ED98C", tint: "linear-gradient(160deg, #22432C, #13261A)" },
  { key: "ladder", name: "gameLadder", sub: "subLadder", category: "Words", tag: "Levels", icon: "ladder", bg: "#3A2A16", fg: "#F0A83A", accent: "#F0A83A", tint: "linear-gradient(160deg, #4A3418, #2A1F10)" },
  { key: "stack", name: "gameStack", sub: "subStack", category: "Arcade", tag: "Endless", icon: "stack", bg: "#13302C", fg: "#5FD0BE", accent: "#5FD0BE", tint: "linear-gradient(160deg, #1D4A50, #112C30)" },
  { key: "couple", name: "gameCouple", sub: "subCouple", category: "Couples", tag: "Daily", icon: "heart", bg: "#24121C", fg: "#F2A7C3", accent: "#F2A7C3", tint: "linear-gradient(160deg, #4A1F33, #2A121D)" },
  { key: "esmfamil", name: "gameEsmFamil", sub: "subEsmFamil", category: "Party", tag: "New", icon: "esmFamil", bg: "#2A2113", fg: "#F6C377", accent: "#F6C377", tint: "linear-gradient(160deg, #503A1E, #2C1F12)" },
  { key: "shelem", name: "gameShelem", sub: "subShelem", category: "Classics", tag: "New", icon: "cards", bg: "#24213D", fg: "#E2B86B", accent: "#E2B86B", tint: "linear-gradient(160deg, #1F4A33, #12291D)" },
  { key: "spy", name: "gameSpy", sub: "subSpy", category: "Party", tag: "New", icon: "spy", bg: "#2A1418", fg: "#F08A7A", accent: "#F08A7A", tint: "linear-gradient(160deg, #4A1C22, #2A1013)" },
  { key: "dooz", name: "gameDooz", sub: "subDooz", category: "Classics", tag: "vsBot", icon: "dooz", bg: "#1E2138", fg: "#C3B9FF", accent: "#C3B9FF", tint: "linear-gradient(160deg, #2C3160, #1A1D38)" },
  { key: "snake", name: "gameSnake", sub: "subSnake", category: "Arcade", tag: "Endless", icon: "snake", bg: "#14241A", fg: "#9ED98C", accent: "#9ED98C", tint: "linear-gradient(160deg, #2D4A1E, #17280F)" },
  { key: "blocks", name: "gameBlocks", sub: "subBlocks", category: "Arcade", tag: "Endless", icon: "blocks", bg: "#25141E", fg: "#F2B8D0", accent: "#F2B8D0", tint: "linear-gradient(160deg, #4A2240, #2A1324)" },
];

export const tagColors: Record<GameTag, [string, string]> = {
  Daily: ["#173A36", "#5FD0BE"],
  Levels: ["#173A36", "#5FD0BE"],
  Endless: ["#2A2650", "#C3B9FF"],
  New: ["#3A2A16", "#F0A83A"],
  vsBot: ["#3A2A16", "#F0A83A"],
};

export function entryFor(key: string) {
  return catalog.find((c) => c.key === key)!;
}
