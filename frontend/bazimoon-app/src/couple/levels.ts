// Couple levels (1 to 100, worked out by the API) are grouped into ten named tiers, and lifetime
// totals unlock badges. Both live here so the text stays in the i18n files.
import type { CoupleStats } from "../api/couple";
import type { TranslationKey } from "../i18n/LanguageContext";

export interface CoupleTier {
  name: TranslationKey;
  emoji: string;
  /** Gradient stops for the level ring and badge glow. */
  from: string;
  to: string;
}

const TIERS: CoupleTier[] = [
  { name: "coupleTier1", emoji: "✨", from: "#F8C9DA", to: "#F2A7C3" },
  { name: "coupleTier2", emoji: "💗", from: "#F7A8C4", to: "#E77AA5" },
  { name: "coupleTier3", emoji: "🕊️", from: "#B9C8FF", to: "#8FA8FF" },
  { name: "coupleTier4", emoji: "🎭", from: "#C9A7F2", to: "#9C7AE7" },
  { name: "coupleTier5", emoji: "🤝", from: "#9FE3D3", to: "#5FD0BE" },
  { name: "coupleTier6", emoji: "🚀", from: "#FFD39A", to: "#F0A83A" },
  { name: "coupleTier7", emoji: "🧩", from: "#FFB3A0", to: "#F08A7A" },
  { name: "coupleTier8", emoji: "💞", from: "#FF9EC4", to: "#D9508A" },
  { name: "coupleTier9", emoji: "🔮", from: "#D7B4FF", to: "#8A5CE6" },
  { name: "coupleTier10", emoji: "👑", from: "#FFE7A3", to: "#E8B33A" },
];

export function tierFor(level: number): CoupleTier {
  return TIERS[Math.min(TIERS.length - 1, Math.max(0, Math.floor((level - 1) / 10)))];
}

export interface CoupleBadge {
  id: string;
  emoji: string;
  name: TranslationKey;
  goal: TranslationKey;
  earned: (stats: CoupleStats, level: number) => boolean;
}

export const BADGES: CoupleBadge[] = [
  { id: "firstDay", emoji: "🌱", name: "coupleBadgeFirstDay", goal: "coupleBadgeFirstDayGoal", earned: (s) => s.daysPlayed >= 1 },
  { id: "streak3", emoji: "🔥", name: "coupleBadgeStreak3", goal: "coupleBadgeStreak3Goal", earned: (s) => s.bestStreak >= 3 },
  { id: "perfect", emoji: "🎯", name: "coupleBadgePerfect", goal: "coupleBadgePerfectGoal", earned: (s) => s.perfectDays >= 1 },
  { id: "streak7", emoji: "🌙", name: "coupleBadgeStreak7", goal: "coupleBadgeStreak7Goal", earned: (s) => s.bestStreak >= 7 },
  { id: "level10", emoji: "🥉", name: "coupleBadgeLevel10", goal: "coupleBadgeLevel10Goal", earned: (_, level) => level >= 10 },
  { id: "matches100", emoji: "💞", name: "coupleBadgeMatches100", goal: "coupleBadgeMatches100Goal", earned: (s) => s.totalMatches >= 100 },
  { id: "streak30", emoji: "🌹", name: "coupleBadgeStreak30", goal: "coupleBadgeStreak30Goal", earned: (s) => s.bestStreak >= 30 },
  { id: "days50", emoji: "📅", name: "coupleBadgeDays50", goal: "coupleBadgeDays50Goal", earned: (s) => s.daysPlayed >= 50 },
  { id: "level25", emoji: "🥈", name: "coupleBadgeLevel25", goal: "coupleBadgeLevel25Goal", earned: (_, level) => level >= 25 },
  { id: "perfect10", emoji: "🔮", name: "coupleBadgePerfect10", goal: "coupleBadgePerfect10Goal", earned: (s) => s.perfectDays >= 10 },
  { id: "matches500", emoji: "💎", name: "coupleBadgeMatches500", goal: "coupleBadgeMatches500Goal", earned: (s) => s.totalMatches >= 500 },
  { id: "level50", emoji: "🥇", name: "coupleBadgeLevel50", goal: "coupleBadgeLevel50Goal", earned: (_, level) => level >= 50 },
  { id: "streak100", emoji: "💯", name: "coupleBadgeStreak100", goal: "coupleBadgeStreak100Goal", earned: (s) => s.bestStreak >= 100 },
  { id: "level100", emoji: "👑", name: "coupleBadgeLevel100", goal: "coupleBadgeLevel100Goal", earned: (_, level) => level >= 100 },
];
