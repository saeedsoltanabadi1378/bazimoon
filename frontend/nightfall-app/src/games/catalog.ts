import type { GameKey } from "../app/router";
import type { IconName } from "../ui/Icon";
import type { TranslationKey } from "../i18n/LanguageContext";

export type GameCategory = "Puzzles" | "Words" | "Couples" | "Classics" | "Arcade";
export type GameTag = "Daily" | "Endless" | "New" | "vsBot" | "Soon";

export interface CatalogEntry {
  key: GameKey | "couple" | "hokm" | "mafiaBots" | "liar";
  name: TranslationKey;
  sub: TranslationKey;
  category: GameCategory;
  tag: GameTag;
  icon: IconName;
  bg: string;
  fg: string;
  /** Accent used on the game's intro/result screens. */
  accent: string;
  soon?: boolean;
}

export const catalog: CatalogEntry[] = [
  { key: "zip", name: "gameZip", sub: "subZip", category: "Puzzles", tag: "Daily", icon: "zip", bg: "#173A36", fg: "#5FD0BE", accent: "#5FD0BE" },
  { key: "merge", name: "gameMerge", sub: "subMerge", category: "Puzzles", tag: "Endless", icon: "merge", bg: "#2A2650", fg: "#9C8CFF", accent: "#9C8CFF" },
  { key: "mines", name: "gameMines", sub: "subMines", category: "Puzzles", tag: "Endless", icon: "mine", bg: "#2A1A1A", fg: "#F08A7A", accent: "#F08A7A" },
  { key: "memory", name: "gameMemory", sub: "subMemory", category: "Arcade", tag: "New", icon: "memory", bg: "#1B2A44", fg: "#8FA8FF", accent: "#8FA8FF" },
  { key: "nard", name: "gameNard", sub: "subNard", category: "Classics", tag: "vsBot", icon: "nard", bg: "#3A2A16", fg: "#F0A83A", accent: "#F0A83A" },
  { key: "queens", name: "gameQueens", sub: "subQueens", category: "Puzzles", tag: "Daily", icon: "godfather", bg: "#2E2340", fg: "#B79CF2", accent: "#B79CF2" },
  { key: "hokm", name: "gameHokm", sub: "subHokm", category: "Classics", tag: "Soon", icon: "cards", bg: "#3A1C1A", fg: "#F08A7A", accent: "#F08A7A", soon: true },
  { key: "mafiaBots", name: "gameMafiaBots", sub: "subMafiaBots", category: "Classics", tag: "Soon", icon: "moon", bg: "#1E2138", fg: "#9C8CFF", accent: "#9C8CFF", soon: true },
  { key: "liar", name: "gameLiar", sub: "subLiar", category: "Puzzles", tag: "Soon", icon: "detective", bg: "#1B2A44", fg: "#8FA8FF", accent: "#8FA8FF", soon: true },
  { key: "word", name: "gameWord", sub: "subWord", category: "Words", tag: "Daily", icon: "word", bg: "#14241A", fg: "#9ED98C", accent: "#9ED98C" },
  { key: "ladder", name: "gameLadder", sub: "subLadder", category: "Words", tag: "Daily", icon: "ladder", bg: "#3A2A16", fg: "#F0A83A", accent: "#F0A83A" },
  { key: "stack", name: "gameStack", sub: "subStack", category: "Arcade", tag: "Endless", icon: "stack", bg: "#13302C", fg: "#5FD0BE", accent: "#5FD0BE" },
  { key: "couple", name: "gameCouple", sub: "subCouple", category: "Couples", tag: "Daily", icon: "heart", bg: "#24121C", fg: "#F2A7C3", accent: "#F2A7C3" },
  { key: "blocks", name: "gameBlocks", sub: "subBlocks", category: "Arcade", tag: "Endless", icon: "blocks", bg: "#25141E", fg: "#F2B8D0", accent: "#F2B8D0" },
];

export const tagColors: Record<GameTag, [string, string]> = {
  Daily: ["#173A36", "#5FD0BE"],
  Endless: ["#2A2650", "#C3B9FF"],
  New: ["#3A2A16", "#F0A83A"],
  vsBot: ["#3A2A16", "#F0A83A"],
  Soon: ["#1E2138", "#9A9CB8"],
};

export function entryFor(key: string) {
  return catalog.find((c) => c.key === key)!;
}
