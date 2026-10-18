import type { TranslationKey } from "../i18n/LanguageContext";
import type { IconName } from "../ui/Icon";

export interface BadgeMeta {
  icon: IconName;
  bg: string;
  fg: string;
  name: TranslationKey;
  /** How a Mafia achievement is earned. */
  how?: TranslationKey;
}

export const badgeMeta: Record<string, BadgeMeta> = {
  firstWin: { icon: "trophy", bg: "#3A2A16", fg: "#F0A83A", name: "badgeFirstWin" },
  lifeSaver: { icon: "shield", bg: "#3D2328", fg: "#F08A7A", name: "badgeLifeSaver" },
  sharpEye: { icon: "detective", bg: "#1B2A44", fg: "#8FA8FF", name: "badgeSharpEye", how: "howSharpEye" },
  guardianAngel: { icon: "doctor", bg: "#13302C", fg: "#5FD0BE", name: "badgeGuardianAngel", how: "howGuardianAngel" },
  theDon: { icon: "godfather", bg: "#3A1C1A", fg: "#F08A7A", name: "badgeTheDon", how: "howTheDon" },
  kingslayer: { icon: "crown", bg: "#2A2113", fg: "#F0A83A", name: "badgeKingslayer", how: "howKingslayer" },
  silverTongue: { icon: "scales", bg: "#232734", fg: "#C9C8DC", name: "badgeSilverTongue", how: "howSilverTongue" },
  survivor: { icon: "heart", bg: "#2A1F33", fg: "#B79CF2", name: "badgeSurvivor", how: "howSurvivor" },
  streak7: { icon: "flame", bg: "#2A2113", fg: "#F0A83A", name: "badgeStreak7" },
  streak30: { icon: "flame", bg: "#3A2A16", fg: "#F6C377", name: "badgeStreak30" },
  solved100: { icon: "zip", bg: "#13302C", fg: "#5FD0BE", name: "badgeSolved100" },
  gold: { icon: "star", bg: "#2A2113", fg: "#F0A83A", name: "badgeGold" },
};
