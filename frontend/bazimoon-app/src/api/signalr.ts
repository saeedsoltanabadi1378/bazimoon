import type { MafiaReaction } from "../mafia/reactionTypes";
import * as signalR from "@microsoft/signalr";
import type { GraveyardMessage } from "./types";

/**
 * Connects to Bazimoon.Api's GameHub and joins a single game's broadcast group. The hub only
 * sends a lightweight "GameUpdated" ping for state changes (see Bazimoon.Api.Hubs.GameHub /
 * SignalRGameNotifier) — callers should re-fetch the filtered GET /api/games/{id} view in
 * response. Ephemeral public reactions and audience-scoped graveyard chat use separate events.
 */
export async function connectToGameHub(
  baseUrl: string,
  /** Read on every (re)connect, so a refreshed access token is picked up. */
  getToken: () => string,
  gameId: string,
  onGameUpdated: () => void,
  onConnectionChange?: (state: "connected" | "reconnecting" | "closed") => void,
  onGraveyardMessage?: (message: GraveyardMessage) => void,
  onReaction?: (reaction: MafiaReaction) => void,
): Promise<signalR.HubConnection> {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${baseUrl}/hubs/game`, {
      accessTokenFactory: getToken,
    })
    .withAutomaticReconnect()
    .build();

  connection.on("GameUpdated", onGameUpdated);
  connection.on("MafiaReaction", (event: { gameId: string; reaction: MafiaReaction }) => {
    if (event.gameId === gameId) onReaction?.(event.reaction);
  });
  // Graveyard chat is the one payload pushed directly: the server sends it only to players who are out and spectators.
  connection.on("GraveyardMessage", (event: { gameId: string; message: GraveyardMessage }) => {
    if (event.gameId === gameId) onGraveyardMessage?.(event.message);
  });

  connection.onreconnecting(() => onConnectionChange?.("reconnecting"));
  connection.onclose(() => onConnectionChange?.("closed"));
  connection.onreconnected(() => {
    onConnectionChange?.("connected");
    connection.invoke("JoinGame", gameId).catch((err) => console.error("[Bazimoon] Failed to rejoin game group after reconnect", err));
    onGameUpdated();
  });

  await connection.start();
  await connection.invoke("JoinGame", gameId);

  return connection;
}

/**
 * Listens for a Shelem room's "ShelemUpdated" pings. Like the game hub, the ping carries no hands:
 * callers re-fetch GET /api/shelem/rooms/{code} for their own view.
 */
export async function connectToShelemRoom(
  baseUrl: string,
  getToken: () => string,
  code: string,
  onUpdated: () => void,
  onConnectionChange?: (state: "connected" | "reconnecting" | "closed") => void,
): Promise<signalR.HubConnection> {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${baseUrl}/hubs/game`, { accessTokenFactory: getToken })
    .withAutomaticReconnect()
    .build();

  connection.on("ShelemUpdated", (event: { code: string }) => { if (event.code === code) onUpdated(); });
  connection.onreconnecting(() => onConnectionChange?.("reconnecting"));
  connection.onclose(() => onConnectionChange?.("closed"));
  connection.onreconnected(() => {
    connection.invoke("JoinShelem", code)
      .then(() => onConnectionChange?.("connected"))
      .catch(() => onConnectionChange?.("closed"));
    onUpdated();
  });

  await connection.start();
  await connection.invoke("JoinShelem", code);
  onConnectionChange?.("connected");
  return connection;
}
