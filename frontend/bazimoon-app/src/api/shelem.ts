import type { BazimoonApiClient } from "./client";
import type { VoiceTokenResponse } from "./types";

export type ShelemPhase = "lobby" | "bidding" | "discard" | "trump" | "playing" | "roundresult" | "finished";
export type ShelemSuit = "clubs" | "diamonds" | "hearts" | "spades";

export interface ShelemPlayer {
  seat: number; name: string; isBot: boolean; ready: boolean; passed: boolean; cards: number; isYou: boolean; voiceUid: number;
}
export interface ShelemPlay { seat: number; card: string }
export interface ShelemRoom {
  code: string; gameId: string; version: number; phase: ShelemPhase; round: number; dealerSeat: number; turnSeat: number;
  highestBid: number | null; declarerSeat: number | null; shelemCalled: boolean; trump: ShelemSuit | null;
  teamScores: number[]; roundPoints: number[]; roundDelta: number[]; winnerTeam: number | null;
  yourSeat: number | null; youAreHost: boolean; hand: string[]; legalCards: string[]; players: ShelemPlayer[];
  trick: ShelemPlay[]; lastTrick: ShelemPlay[]; lastTrickWinner: number | null; zaminCount: number; discardCount: number; botThinking: boolean;
}

const base = (code: string) => `/api/shelem/rooms/${encodeURIComponent(code)}`;
export const shelemApi = (api: BazimoonApiClient) => ({
  create: (withBots: boolean) => api.request<ShelemRoom>("POST", "/api/shelem/rooms", { withBots }),
  get: (code: string) => api.request<ShelemRoom>("GET", base(code)),
  join: (code: string) => api.request<ShelemRoom>("POST", `${base(code)}/join`),
  ready: (code: string, ready: boolean) => api.request<ShelemRoom>("POST", `${base(code)}/ready`, { ready }),
  start: (code: string, fillBots: boolean) => api.request<ShelemRoom>("POST", `${base(code)}/start`, { fillBots }),
  bid: (code: string, bid: number | null, shelem = false) => api.request<ShelemRoom>("POST", `${base(code)}/bid`, { bid, shelem }),
  discard: (code: string, cards: string[]) => api.request<ShelemRoom>("POST", `${base(code)}/discard`, { cards }),
  trump: (code: string, suit: ShelemSuit) => api.request<ShelemRoom>("POST", `${base(code)}/trump`, { suit }),
  play: (code: string, card: string) => api.request<ShelemRoom>("POST", `${base(code)}/play`, { card }),
  next: (code: string) => api.request<ShelemRoom>("POST", `${base(code)}/next`),
  voice: (code: string) => api.request<VoiceTokenResponse>("GET", `${base(code)}/voice-token`),
});
