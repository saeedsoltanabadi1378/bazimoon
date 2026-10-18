/**
 * Google sign-in as a full-page redirect (OpenID Connect, response_type=id_token): the app goes to
 * Google's account chooser and Google sends the player back to /auth/google with an ID token in the
 * URL fragment. No popup and no Google-drawn button, so it works inside the installed app too.
 */

export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

const PENDING_KEY = "bazimoon-google-pending";
export const GOOGLE_RETURN_PATH = "/auth/google";

interface Pending {
  state: string;
  nonce: string;
}

export interface GoogleReturn {
  idToken: string;
  nonce: string;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Leaves the app for Google's sign-in page. */
export function startGoogleSignIn(language: string) {
  const pending: Pending = { state: randomToken(), nonce: randomToken() };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: `${window.location.origin}${GOOGLE_RETURN_PATH}`,
    response_type: "id_token",
    scope: "openid email profile",
    nonce: pending.nonce,
    state: pending.state,
    prompt: "select_account",
    hl: language,
  });
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

/**
 * Reads Google's answer when the app was opened at /auth/google, then puts the address back to "/".
 * Returns null when this isn't a Google return, "cancelled" when the player backed out or the
 * answer doesn't match the sign-in this browser started.
 */
export function readGoogleReturn(): GoogleReturn | "cancelled" | null {
  if (window.location.pathname !== GOOGLE_RETURN_PATH) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  window.history.replaceState(null, "", "/");
  const raw = sessionStorage.getItem(PENDING_KEY);
  sessionStorage.removeItem(PENDING_KEY);
  const pending = raw ? (JSON.parse(raw) as Pending) : null;
  const idToken = params.get("id_token");
  if (!pending || !idToken || params.get("state") !== pending.state) return "cancelled";
  return { idToken, nonce: pending.nonce };
}
