import * as signalR from "@microsoft/signalr";

/**
 * Connects to Bazimoon.Api's GameHub and joins a single game's broadcast group. The hub only
 * ever sends a lightweight "GameUpdated" ping (see Bazimoon.Api.Hubs.GameHub /
 * SignalRGameNotifier) — callers should re-fetch the filtered GET /api/games/{id} view in
 * response, never trust a payload pushed over the shared group channel.
 */
export async function connectToGameHub(
  baseUrl: string,
  /** Read on every (re)connect, so a refreshed access token is picked up. */
  getToken: () => string,
  gameId: string,
  onGameUpdated: () => void,
  onConnectionChange?: (state: "connected" | "reconnecting" | "closed") => void,
): Promise<signalR.HubConnection> {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${baseUrl}/hubs/game`, {
      accessTokenFactory: getToken,
    })
    .withAutomaticReconnect()
    .build();

  connection.on("GameUpdated", onGameUpdated);

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
