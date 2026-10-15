/** Short, speakable table name derived from the game id ("Room A7"). */
export function roomCode(gameId: string) {
  return gameId.replace(/-/g, "").slice(0, 2).toUpperCase();
}
