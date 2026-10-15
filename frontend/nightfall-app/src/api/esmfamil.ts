// Mirrors Nightfall.Api.EsmFamil DTOs (camelCase JSON).
import type { NightfallApiClient } from "./client";

export interface EsmRoomSettings {
  categories: string[];
  rounds: number;
  seconds: number;
  letters: "fa" | "en";
}

export type EsmPhase = "lobby" | "writing" | "judging" | "scores" | "finished";

export interface EsmPlayer {
  seat: number;
  name: string;
  ready: boolean;
  isHost: boolean;
  isYou: boolean;
  left: boolean;
  filled: number;
  votesDone: boolean;
  total: number;
  roundPoints: number;
  /** Shown once writing is over. */
  answers: string[] | null;
  categoryPoints: number[] | null;
  accepted: boolean[] | null;
}

export interface EsmVoteTally {
  seat: number;
  category: number;
  rejects: number;
  accepts: number;
  myReject: boolean | null;
}

export interface EsmRoom {
  code: string;
  version: number;
  phase: EsmPhase;
  settings: EsmRoomSettings;
  round: number;
  letter: string | null;
  msLeft: number;
  stoppedBy: string | null;
  yourSeat: number | null;
  youAreHost: boolean;
  yourAnswers: string[] | null;
  players: EsmPlayer[];
  votes: EsmVoteTally[] | null;
}

const base = (code: string) => `/api/esmfamil/rooms/${encodeURIComponent(code)}`;

export const esmApi = (api: NightfallApiClient) => ({
  create: (settings: EsmRoomSettings) => api.request<EsmRoom>("POST", "/api/esmfamil/rooms", settings),
  get: (code: string) => api.request<EsmRoom>("GET", base(code)),
  join: (code: string) => api.request<EsmRoom>("POST", `${base(code)}/join`),
  ready: (code: string, ready: boolean) => api.request<EsmRoom>("POST", `${base(code)}/ready`, { ready }),
  settings: (code: string, settings: EsmRoomSettings) => api.request<EsmRoom>("PUT", `${base(code)}/settings`, settings),
  start: (code: string) => api.request<EsmRoom>("POST", `${base(code)}/start`),
  answers: (code: string, answers: string[]) => api.request<EsmRoom>("PUT", `${base(code)}/answers`, { answers }),
  stop: (code: string, answers: string[]) => api.request<EsmRoom>("POST", `${base(code)}/stop`, { answers }),
  vote: (code: string, votes: { seat: number; category: number; reject: boolean }[], done: boolean) =>
    api.request<EsmRoom>("POST", `${base(code)}/votes`, { votes, done }),
  next: (code: string) => api.request<EsmRoom>("POST", `${base(code)}/next`),
  leave: (code: string) => api.request<EsmRoom>("POST", `${base(code)}/leave`),
});
