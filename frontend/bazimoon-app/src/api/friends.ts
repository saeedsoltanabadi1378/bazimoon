// Mirrors Bazimoon.Api.Lounge friend and game-invite DTOs (camelCase JSON).
import type { BazimoonApiClient } from "./client";

export interface Friend {
  userId: string;
  name: string;
  level: number;
  division: string;
  tier: number;
  online: boolean;
  lastSeenAt: string | null;
}

export interface FriendRequest {
  id: number;
  player: Friend;
}

export interface Friends {
  code: string;
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  /** People you finished a Mafia game with lately who are not friends yet. */
  suggestions: Friend[];
}

export interface FriendCodePreview {
  name: string;
  level: number;
  isYou: boolean;
  alreadyFriends: boolean;
}

export type InviteKind = "mafia" | "esmfamil";

export interface GameInvite {
  id: number;
  kind: InviteKind;
  fromName: string;
  expiresAt: string;
}

export interface SentInvite {
  userId: string;
  status: "pending" | "accepted" | "declined" | "expired";
}

export interface AcceptedInvite {
  kind: InviteKind;
  gameId: string | null;
  code: string | null;
}

export const friendsApi = (api: BazimoonApiClient) => ({
  list: () => api.request<Friends>("GET", "/api/friends"),
  previewCode: (code: string) => api.request<FriendCodePreview>("GET", `/api/friends/code/${encodeURIComponent(code)}`),
  addByCode: (code: string) => api.request<Friend>("POST", `/api/friends/code/${encodeURIComponent(code)}`),
  request: (userId: string) => api.request<void>("POST", "/api/friends/requests", { userId }),
  accept: (requestId: number) => api.request<void>("POST", `/api/friends/requests/${requestId}/accept`),
  /** Declines a request, cancels one you sent, or removes a friend. */
  remove: (userId: string) => api.request<void>("DELETE", `/api/friends/${userId}`),
  invites: () => api.request<GameInvite[]>("GET", "/api/invites"),
  invite: (kind: InviteKind, target: string, friendIds: string[]) =>
    api.request<{ sent: number }>("POST", "/api/invites", { kind, target, friendIds }),
  sent: (kind: InviteKind, target: string) =>
    api.request<SentInvite[]>("GET", `/api/invites/sent?kind=${kind}&target=${encodeURIComponent(target)}`),
  acceptInvite: (id: number) => api.request<AcceptedInvite>("POST", `/api/invites/${id}/accept`),
  declineInvite: (id: number) => api.request<void>("POST", `/api/invites/${id}/decline`),
});

/** Path of a friend link; the app opens it on the "add friend" screen. */
export const friendLinkStart = (code: string) => `f_${code}`;
