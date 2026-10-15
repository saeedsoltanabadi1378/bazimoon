import type { GameView, PlayerView, Role } from "../api/types";
import type { IconName } from "../ui/Icon";

export interface RoleMeta {
  icon: IconName;
  bg: string;
  fg: string;
  team: "town" | "mafia";
}

export const roleMeta: Record<Role, RoleMeta> = {
  Villager: { icon: "villager", bg: "#2A2113", fg: "#F0A83A", team: "town" },
  Detective: { icon: "detective", bg: "#1B2A44", fg: "#8FA8FF", team: "town" },
  Doctor: { icon: "doctor", bg: "#13302C", fg: "#5FD0BE", team: "town" },
  Mafia: { icon: "mafia", bg: "#3A1C1A", fg: "#F08A7A", team: "mafia" },
  Godfather: { icon: "godfather", bg: "#3A1C1A", fg: "#F08A7A", team: "mafia" },
};

export const eliminatedMeta: RoleMeta = { icon: "eliminated", bg: "#1E2138", fg: "#9A9CB8", team: "town" };

const palette = ["#F0A83A", "#5FD0BE", "#B79CF2", "#8FA8FF", "#E9D8A6", "#F08A7A", "#9ED98C", "#F2B8D0", "#C9C2B6", "#7FC8E8", "#D9A8E8", "#F6C377"];
export const youColor = "#EDEBF5";

/** Stable avatar color per seat; your own avatar is always the light "you" color. */
export function playerColor(view: GameView, playerId: string) {
  if (playerId === view.yourPlayerId) return youColor;
  const others = view.players.filter((p) => p.playerId !== view.yourPlayerId);
  const index = others.findIndex((p) => p.playerId === playerId);
  return palette[(index < 0 ? 0 : index) % palette.length];
}

export function findPlayer(view: GameView, playerId: string | null | undefined): PlayerView | undefined {
  return playerId ? view.players.find((p) => p.playerId === playerId) : undefined;
}

/** Mirrors the Domain's mafia count: one Mafia per three players, Godfather first. */
export function rolesFor(count: number): { role: Role; n: number }[] {
  if (count < 3) return [];
  const mafia = Math.floor(count / 3);
  const special = count === 3 ? 0 : 2;
  const roles: { role: Role; n: number }[] = [{ role: "Godfather", n: 1 }];
  if (mafia > 1) roles.push({ role: "Mafia", n: mafia - 1 });
  if (special) {
    roles.push({ role: "Detective", n: 1 }, { role: "Doctor", n: 1 });
  }
  const villagers = count - mafia - special;
  if (villagers > 0) roles.push({ role: "Villager", n: villagers });
  return roles;
}

/**
 * Round labels as the design shows them: the first night is "Night 0", the day after night N is
 * "Day N", and the Night phase that follows day N is shown as night N + 1 (the server only
 * increments its counter when a night resolves).
 */
export function nightLabelNumber(view: GameView) {
  return view.phase === "Night" ? view.nightNumber + 1 : view.nightNumber;
}

export const isMafiaRole = (role: Role | null | undefined) => role === "Mafia" || role === "Godfather";
