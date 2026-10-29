/** Public address of the app; defaults to wherever it is running. */
function appBase() {
  return (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, "");
}

/**
 * Shareable link into the app. Start parameters map to paths:
 * <c>t_CODE</c> → /t/CODE (Mafia table), <c>couple_TOKEN</c> → /couple/TOKEN, <c>couple</c> → /couple,
 * <c>ef_CODE</c> → /ef/CODE (Esm-Famil room), <c>f_CODE</c> → /f/CODE (friend link), a game id → /g/ID.
 */
export function appLink(startParam?: string) {
  return `${appBase()}${startPath(startParam)}`;
}

function startPath(start?: string) {
  if (!start) return "/";
  if (start.startsWith("t_")) return `/t/${encodeURIComponent(start.slice(2))}`;
  if (start.startsWith("couple_")) return `/couple/${encodeURIComponent(start.slice("couple_".length))}`;
  if (start === "couple") return "/couple";
  if (start.startsWith("ef_")) return `/ef/${encodeURIComponent(start.slice(3))}`;
  if (start.startsWith("sh_")) return `/sh/${encodeURIComponent(start.slice(3))}`;
  if (start.startsWith("f_")) return `/f/${encodeURIComponent(start.slice(2))}`;
  return `/g/${encodeURIComponent(start)}`;
}

export type DeepLink =
  | { kind: "table"; code: string }
  | { kind: "game"; gameId: string }
  | { kind: "coupleInvite"; token: string }
  | { kind: "couple" }
  | { kind: "esmfamil"; code: string }
  | { kind: "shelem"; code: string }
  | { kind: "friend"; code: string }
  | { kind: "friends" }
  | { kind: "play"; game: string };

/** Reads the deep link the app was opened with from its path. */
export function readDeepLink(pathname = window.location.pathname): DeepLink | null {
  const [first, second] = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (first === "t" && second) return { kind: "table", code: second };
  if (first === "g" && second) return { kind: "game", gameId: second };
  if (first === "couple") return second ? { kind: "coupleInvite", token: second } : { kind: "couple" };
  if (first === "ef" && second) return { kind: "esmfamil", code: second };
  if (first === "sh" && second) return { kind: "shelem", code: second };
  if (first === "f" && second) return { kind: "friend", code: second };
  // Friend notifications open /friends.
  if (first === "friends") return { kind: "friends" };
  // Play buttons on the search pages (/en/<game>/, /fa/<game>/) open /play/<game>.
  if (first === "play" && second) return { kind: "play", game: second };
  return null;
}
