// Mirrors Bazimoon.Api.Lounge clan DTOs (camelCase JSON).
import type { BazimoonApiClient } from "./client";

export type ClanRole = "owner" | "admin" | "member";
export type RsvpAnswer = "yes" | "maybe" | "no";

export const CLAN_EMBLEMS = ["moon", "mafia", "godfather", "crown", "flame", "star", "bolt", "shield", "heart", "target", "detective", "dice"] as const;
export const CLAN_COLORS = ["#B79CF2", "#F0A83A", "#5FD0BE", "#8FA8FF", "#F08A7A", "#9ED98C", "#F2B8D0", "#E9D8A6"] as const;
export type ClanEmblem = (typeof CLAN_EMBLEMS)[number];

export interface ClanBadge {
  id: string;
  name: string;
  emblem: ClanEmblem;
  color: string;
  role: ClanRole;
  members: number;
  unread: number;
  /** Join requests waiting, for owners and admins. */
  requests: number;
  nextEvent: { id: number; title: string; startsAt: string } | null;
}

export interface ClanMe {
  clan: ClanBadge | null;
  requestedClanIds: string[];
}

export interface ClanSummary {
  id: string;
  name: string;
  bio: string | null;
  emblem: ClanEmblem;
  color: string;
  isListed: boolean;
  members: number;
  maxMembers: number;
  requested: boolean;
}

export interface ClanInvitePreview {
  clan: ClanSummary;
  isMember: boolean;
  inAnotherClan: boolean;
  banned: boolean;
}

export interface ClanMember {
  userId: string;
  name: string;
  role: ClanRole;
  level: number;
  online: boolean;
  isGuest: boolean;
  joinedAt: string;
}

export interface ClanRequest {
  userId: string;
  name: string;
  level: number;
  createdAt: string;
}

export interface ClanMessage {
  id: number;
  userId: string;
  name: string;
  text: string;
  isAnnouncement: boolean;
  createdAt: string;
  mine: boolean;
}

export interface ClanPerson {
  userId: string;
  name: string;
}

export interface ClanEvent {
  id: number;
  title: string;
  note: string | null;
  startsAt: string;
  seats: number;
  repeatWeekly: boolean;
  createdBy: string | null;
  yourAnswer: RsvpAnswer | null;
  /** In the order they said yes; the first `seats` have a seat, the rest wait. */
  going: ClanPerson[];
  maybe: ClanPerson[];
  notComing: number;
  /** From 15 minutes before the start until the night is over. */
  tableOpen: boolean;
  gameId: string | null;
}

export interface ClanTable {
  gameId: string;
  name: string | null;
  host: string;
  inLobby: boolean;
  seated: number;
  maxPlayers: number;
  youAreSeated: boolean;
}

export interface ClanDetail {
  id: string;
  name: string;
  bio: string | null;
  emblem: ClanEmblem;
  color: string;
  isListed: boolean;
  maxMembers: number;
  createdAt: string;
  yourRole: ClanRole;
  inviteCode: string;
  members: ClanMember[];
  requests: ClanRequest[];
  announcement: ClanMessage | null;
  events: ClanEvent[];
  tables: ClanTable[];
  unread: number;
}

export interface ClanRankRow {
  rank: number;
  userId: string;
  name: string;
  games: number;
  wins: number;
  mvps: number;
  points: number;
  isYou: boolean;
}

export interface ClanRanking {
  period: "all" | "month";
  clanGames: number;
  rows: ClanRankRow[];
  unranked: number;
}

export interface ClanEdit {
  name: string;
  bio: string | null;
  emblem: ClanEmblem;
  color: string;
  isListed: boolean;
}

export interface ClanEventEdit {
  title: string;
  note: string | null;
  startsAt: string;
  seats: number;
  repeatWeekly: boolean;
}

const base = (clanId: string) => `/api/clans/${clanId}`;

export const clansApi = (api: BazimoonApiClient) => ({
  me: () => api.request<ClanMe>("GET", "/api/clans/me"),
  search: (search: string) => api.request<ClanSummary[]>("GET", `/api/clans?search=${encodeURIComponent(search)}`),
  create: (edit: ClanEdit) => api.request<ClanDetail>("POST", "/api/clans", edit),
  previewCode: (code: string) => api.request<ClanInvitePreview>("GET", `/api/clans/code/${encodeURIComponent(code)}`),
  joinByCode: (code: string) => api.request<ClanDetail>("POST", `/api/clans/code/${encodeURIComponent(code)}`),
  get: (clanId: string) => api.request<ClanDetail>("GET", base(clanId)),
  update: (clanId: string, edit: ClanEdit) => api.request<ClanDetail>("PUT", base(clanId), edit),
  remove: (clanId: string) => api.request<void>("DELETE", base(clanId)),
  resetCode: (clanId: string) => api.request<ClanDetail>("POST", `${base(clanId)}/invite-code`),
  askToJoin: (clanId: string) => api.request<void>("POST", `${base(clanId)}/requests`),
  cancelRequest: (clanId: string) => api.request<void>("DELETE", `${base(clanId)}/requests`),
  acceptRequest: (clanId: string, userId: string) => api.request<void>("POST", `${base(clanId)}/requests/${userId}/accept`),
  declineRequest: (clanId: string, userId: string) => api.request<void>("POST", `${base(clanId)}/requests/${userId}/decline`),
  leave: (clanId: string) => api.request<void>("POST", `${base(clanId)}/leave`),
  kick: (clanId: string, userId: string) => api.request<void>("DELETE", `${base(clanId)}/members/${userId}`),
  setRole: (clanId: string, userId: string, role: "admin" | "member") => api.request<void>("PUT", `${base(clanId)}/members/${userId}/role`, { role }),
  makeOwner: (clanId: string, userId: string) => api.request<void>("POST", `${base(clanId)}/members/${userId}/owner`),
  messages: (clanId: string, after?: number) =>
    api.request<ClanMessage[]>("GET", `${base(clanId)}/messages${after !== undefined ? `?after=${after}` : ""}`),
  post: (clanId: string, text: string, announce: boolean) => api.request<ClanMessage>("POST", `${base(clanId)}/messages`, { text, announce }),
  deleteMessage: (clanId: string, messageId: number) => api.request<void>("DELETE", `${base(clanId)}/messages/${messageId}`),
  createEvent: (clanId: string, edit: ClanEventEdit) => api.request<ClanDetail>("POST", `${base(clanId)}/events`, edit),
  cancelEvent: (clanId: string, eventId: number) => api.request<void>("DELETE", `${base(clanId)}/events/${eventId}`),
  rsvp: (clanId: string, eventId: number, answer: RsvpAnswer) => api.request<void>("PUT", `${base(clanId)}/events/${eventId}/rsvp`, { answer }),
  takeSeat: (clanId: string, eventId: number) => api.request<{ gameId: string }>("POST", `${base(clanId)}/events/${eventId}/seat`),
  openTable: (clanId: string) => api.request<{ gameId: string }>("POST", `${base(clanId)}/tables`, {}),
  ranking: (clanId: string, period: "all" | "month") => api.request<ClanRanking>("GET", `${base(clanId)}/ranking?period=${period}`),
});

/** Start parameter of a clan invite link; the app opens it on the clan invite screen. */
export const clanLinkStart = (code: string) => `c_${code}`;
