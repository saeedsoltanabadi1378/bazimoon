import type { GameView, PlayerView, Role, RolePreset } from "../api/types";
import type { IconName } from "../ui/Icon";

export interface RoleMeta {
  icon: IconName;
  bg: string;
  fg: string;
  team: "town" | "mafia" | "independent";
}

export const roleMeta: Record<Role, RoleMeta> = {
  Villager: { icon: "villager", bg: "#2A2113", fg: "#F0A83A", team: "town" },
  Detective: { icon: "detective", bg: "#1B2A44", fg: "#8FA8FF", team: "town" },
  Doctor: { icon: "doctor", bg: "#13302C", fg: "#5FD0BE", team: "town" },
  Mafia: { icon: "mafia", bg: "#3A1C1A", fg: "#F08A7A", team: "mafia" },
  Godfather: { icon: "godfather", bg: "#3A1C1A", fg: "#F08A7A", team: "mafia" },
  Sniper: { icon: "target", bg: "#1B2A44", fg: "#8FA8FF", team: "town" },
  DieHard: { icon: "shield", bg: "#13302C", fg: "#5FD0BE", team: "town" },
  Silencer: { icon: "mute", bg: "#3A1C1A", fg: "#F08A7A", team: "mafia" },
  Joker: { icon: "star", bg: "#2A1F33", fg: "#B79CF2", team: "independent" },
  Mayor: { icon: "townHall", bg: "#2A2113", fg: "#F0A83A", team: "town" },
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

/** A revealed Mayor's vote counts twice. */
export function voteWeight(view: GameView, voterId: string) {
  return findPlayer(view, voterId)?.revealed ? 2 : 1;
}

export function findPlayer(view: GameView, playerId: string | null | undefined): PlayerView | undefined {
  return playerId ? view.players.find((p) => p.playerId === playerId) : undefined;
}

/** Roles a custom setup can switch on. */
export const OPTIONAL_ROLES: Role[] = ["Silencer", "Detective", "Doctor", "Sniper", "DieHard", "Mayor", "Joker"];

/** Mirrors the Domain's RoleSetup.RolesFor: the special roles for this many players, or null when the setup doesn't fit. */
export function dealRoles(preset: RolePreset, mafiaCount: number, optional: Role[], players: number): Role[] | null {
  let roles: Role[];
  if (preset === "Classic") {
    const mafia = Math.floor(players / 3);
    roles = ["Godfather", ...Array<Role>(Math.max(0, mafia - 1)).fill("Mafia")];
    if (players > 3) roles.push("Detective", "Doctor");
  } else if (preset === "Iranian") {
    roles = ["Godfather", "Silencer", "Detective", "Doctor", "Sniper", "DieHard"];
  } else {
    const mafia = Math.max(1, mafiaCount);
    roles = ["Godfather"];
    if (optional.includes("Silencer") && mafia > 1) roles.push("Silencer");
    while (roles.length < mafia) roles.push("Mafia");
    roles.push(...OPTIONAL_ROLES.filter((r) => r !== "Silencer" && optional.includes(r)));
  }
  const mafiaTeam = roles.filter((r) => roleMeta[r].team === "mafia").length;
  if (roles.length > players || mafiaTeam * 2 >= players) return null;
  return roles;
}

/** The fewest players a setup can start with. */
export function minimumPlayers(preset: RolePreset, mafiaCount: number, optional: Role[]) {
  for (let n = 3; n <= 30; n++) if (dealRoles(preset, mafiaCount, optional, n)) return n;
  return Infinity;
}

/** Groups the setup's dealt roles (from the server) for the lobby list, Villagers filling the other seats. */
export function rolesFor(count: number, setup: Role[] | null | undefined): { role: Role; n: number }[] {
  if (!setup) return [];
  const roles: { role: Role; n: number }[] = [];
  for (const role of setup) {
    const found = roles.find((r) => r.role === role);
    if (found) found.n++;
    else roles.push({ role, n: 1 });
  }
  const villagers = count - setup.length;
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

export const isMafiaRole = (role: Role | null | undefined) => role === "Mafia" || role === "Godfather" || role === "Silencer";
