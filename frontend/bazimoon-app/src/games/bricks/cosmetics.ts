// Ball skins, trails and board themes. Looks only: none of them changes how the game plays.
import type { PowerKey } from "./engine";

export type CosmeticKind = "ball" | "trail" | "theme";

export interface BallSkin {
  id: string;
  price: number;
  /** World whose level 20 gives it for free (1-based), if any. */
  world?: number;
  /** Fill stops from the centre out, and a glow colour. */
  stops: string[];
  glow: string;
  rim?: string;
}

export interface TrailStyle { id: string; price: number; world?: number; colors: string[]; sparkle?: boolean }

export interface ThemeStyle {
  id: string;
  price: number;
  world?: number;
  /** Background gradient top → bottom, and the colour of its drifting particles. */
  top: string;
  bottom: string;
  dot: string;
  line: string;
}

export const BALLS: BallSkin[] = [
  { id: "classic", price: 0, stops: ["#FFFFFF", "#FFFFFF"], glow: "rgba(255,255,255,0.7)" },
  { id: "golden", price: 400, world: 1, stops: ["#FFF1B8", "#E0A81E"], glow: "rgba(255,209,102,0.8)" },
  { id: "neon", price: 300, stops: ["#BFEFFF", "#4FC3F7"], glow: "#4FC3F7" },
  { id: "ruby", price: 300, stops: ["#FF9DB0", "#E0244A"], glow: "rgba(255,77,109,0.7)" },
  { id: "emerald", price: 300, stops: ["#9FF5C6", "#1FA85E"], glow: "rgba(46,212,122,0.7)" },
  { id: "rainbow", price: 2000, world: 10, stops: ["#FF5C7A", "#FFD166", "#5BD69A", "#4FC3F7", "#B07CFF"], glow: "rgba(255,255,255,0.5)" },
  { id: "fire", price: 900, world: 4, stops: ["#FFF3B0", "#FF9A62", "#E0243A"], glow: "#FF7A4A" },
  { id: "ice", price: 700, world: 3, stops: ["#FFFFFF", "#9FE3FF"], glow: "#9FE3FF" },
  { id: "electric", price: 800, stops: ["#FFFFFF", "#F4FF6B", "#7FE3F0"], glow: "#F4FF6B" },
  { id: "galaxy", price: 1200, world: 8, stops: ["#E3C9FF", "#6B3FD9", "#1E1050"], glow: "#B07CFF" },
  { id: "diamond", price: 1500, world: 7, stops: ["#FFFFFF", "#BFE8FF", "#FFFFFF"], glow: "#DFF6FF" },
  { id: "shadow", price: 1600, world: 9, stops: ["#4A4A60", "#12121C"], glow: "rgba(0,0,0,0)", rim: "#9A9CB8" },
];

export const TRAILS: TrailStyle[] = [
  { id: "none", price: 0, colors: [] },
  { id: "glow", price: 0, colors: ["#FFFFFF"] },
  { id: "sparkles", price: 250, colors: ["#FFFFFF", "#FFD166"], sparkle: true },
  { id: "rainbow", price: 1200, world: 10, colors: ["#FF5C7A", "#FFD166", "#5BD69A", "#4FC3F7", "#B07CFF"] },
  { id: "fire", price: 600, world: 4, colors: ["#FFD166", "#FF9A62", "#E0243A"] },
  { id: "ice", price: 500, world: 5, colors: ["#FFFFFF", "#9FE3FF"] },
  { id: "electric", price: 600, colors: ["#F4FF6B", "#7FE3F0"], sparkle: true },
  { id: "stars", price: 900, world: 8, colors: ["#FFD166", "#FFFFFF"], sparkle: true },
];

export const THEMES: ThemeStyle[] = [
  { id: "classic", price: 0, top: "#161A36", bottom: "#0B0D1A", dot: "#3A3E5C", line: "#3A3E5C" },
  { id: "neon", price: 500, world: 2, top: "#2A0F3A", bottom: "#0B0D1A", dot: "#FF7AD9", line: "#5A2A6A" },
  { id: "space", price: 600, top: "#2A1B5C", bottom: "#05060F", dot: "#FFFFFF", line: "#3A3266" },
  { id: "ocean", price: 600, world: 6, top: "#0C2C48", bottom: "#050E1C", dot: "#4FC3F7", line: "#1E4466" },
  { id: "crystal", price: 700, top: "#123844", bottom: "#0A1218", dot: "#7FE3F0", line: "#245060" },
  { id: "sunset", price: 800, top: "#3A1A30", bottom: "#120A14", dot: "#FF9A62", line: "#5A2A3A" },
];

export const POWER_PRICE: Record<PowerKey, number> = { hlaser: 60, vlaser: 60, bomb: 80, double: 50, shield: 150 };

export const STARTING_OWNED = ["ball:classic", "trail:none", "trail:glow", "theme:classic"];

export function ballOf(id: string) { return BALLS.find((b) => b.id === id) ?? BALLS[0]; }
export function trailOf(id: string) { return TRAILS.find((t) => t.id === id) ?? TRAILS[1]; }
export function themeOf(id: string) { return THEMES.find((t) => t.id === id) ?? THEMES[0]; }

/** Price of a cosmetic by its "kind:id" key. */
export function priceOf(key: string) {
  const [kind, id] = key.split(":");
  const list: { id: string; price: number }[] = kind === "ball" ? BALLS : kind === "trail" ? TRAILS : THEMES;
  return list.find((x) => x.id === id)?.price ?? 0;
}

/** Brick colours by health tier, normal and colourblind-friendly (Okabe–Ito based). */
export const TIER_COLORS = ["#5BD69A", "#4FC3F7", "#6E8BFF", "#FFD166", "#FF9A62", "#FF5C7A", "#B07CFF"];
export const TIER_COLORS_SAFE = ["#F0E442", "#56B4E9", "#0072B2", "#E69F00", "#D55E00", "#CC79A7", "#FFFFFF"];
