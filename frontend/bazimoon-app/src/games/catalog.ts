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
}

export const catalog: CatalogEntry[] = [
  { key: "zip", name: "gameZip", sub: "subZip", category: "Puzzles", tag: "Levels", icon: "zip", bg: "#173A36", fg: "#5FD0BE", accent: "#5FD0BE" },
  { key: "merge", name: "gameMerge", sub: "subMerge", category: "Puzzles", tag: "Endless", icon: "merge", bg: "#2A2650", fg: "#9C8CFF", accent: "#9C8CFF" },
  { key: "mines", name: "gameMines", sub: "subMines", category: "Puzzles", tag: "Endless", icon: "mine", bg: "#2A1A1A", fg: "#F08A7A", accent: "#F08A7A" },
  { key: "memory", name: "gameMemory", sub: "subMemory", category: "Arcade", tag: "New", icon: "memory", bg: "#1B2A44", fg: "#8FA8FF", accent: "#8FA8FF" },
  { key: "sudoku", name: "gameSudoku", sub: "subSudoku", category: "Puzzles", tag: "New", icon: "grid", bg: "#12304A", fg: "#7CC4FA", accent: "#7CC4FA" },
  { key: "queens", name: "gameQueens", sub: "subQueens", category: "Puzzles", tag: "Levels", icon: "godfather", bg: "#2E2340", fg: "#B79CF2", accent: "#B79CF2" },
  { key: "word", name: "gameWord", sub: "subWord", category: "Words", tag: "Levels", icon: "word", bg: "#14241A", fg: "#9ED98C", accent: "#9ED98C" },
  { key: "ladder", name: "gameLadder", sub: "subLadder", category: "Words", tag: "Levels", icon: "ladder", bg: "#3A2A16", fg: "#F0A83A", accent: "#F0A83A" },
  { key: "stack", name: "gameStack", sub: "subStack", category: "Arcade", tag: "Endless", icon: "stack", bg: "#13302C", fg: "#5FD0BE", accent: "#5FD0BE" },
  { key: "couple", name: "gameCouple", sub: "subCouple", category: "Couples", tag: "Daily", icon: "heart", bg: "#24121C", fg: "#F2A7C3", accent: "#F2A7C3" },
  { key: "esmfamil", name: "gameEsmFamil", sub: "subEsmFamil", category: "Party", tag: "New", icon: "esmFamil", bg: "#2A2113", fg: "#F6C377", accent: "#F6C377" },
  { key: "shelem", name: "gameShelem", sub: "subShelem", category: "Classics", tag: "New", icon: "cards", bg: "#24213D", fg: "#E2B86B", accent: "#E2B86B" },
  { key: "spy", name: "gameSpy", sub: "subSpy", category: "Party", tag: "New", icon: "spy", bg: "#2A1418", fg: "#F08A7A", accent: "#F08A7A" },
  { key: "dooz", name: "gameDooz", sub: "subDooz", category: "Classics", tag: "vsBot", icon: "dooz", bg: "#1E2138", fg: "#C3B9FF", accent: "#C3B9FF" },
  { key: "snake", name: "gameSnake", sub: "subSnake", category: "Arcade", tag: "Endless", icon: "snake", bg: "#14241A", fg: "#9ED98C", accent: "#9ED98C" },
  { key: "blocks", name: "gameBlocks", sub: "subBlocks", category: "Arcade", tag: "Endless", icon: "blocks", bg: "#25141E", fg: "#F2B8D0", accent: "#F2B8D0" },
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
