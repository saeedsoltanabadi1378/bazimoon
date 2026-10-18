/** Minimal typings for Google Identity Services (https://accounts.google.com/gsi/client). */
interface GoogleIdApi {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    ux_mode?: "popup" | "redirect";
    use_fedcm_for_prompt?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

let loading: Promise<GoogleIdApi> | null = null;

export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

/** Loads the Google Identity Services script once. */
export function loadGoogle(): Promise<GoogleIdApi> {
  loading ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("Google sign-in unavailable")));
    script.onerror = () => {
      loading = null;
      reject(new Error("Google sign-in unavailable"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

let onCredential: ((idToken: string) => void) | null = null;
let initialized = false;

/** Draws Google's own "Sign in with Google" button into <paramref name="parent"/>; a successful
 * sign-in calls <paramref name="callback"/> with the Google ID token. */
export async function renderGoogleButton(parent: HTMLElement, callback: (idToken: string) => void, options: { locale: string; width: number }) {
  const id = await loadGoogle();
  onCredential = callback;
  if (!initialized) {
    id.initialize({ client_id: googleClientId, callback: (r) => onCredential?.(r.credential), ux_mode: "popup" });
    initialized = true;
  }
  parent.replaceChildren();
  id.renderButton(parent, { type: "standard", theme: "filled_black", size: "large", shape: "pill", text: "signin_with", width: options.width, locale: options.locale });
}

/** After logging out, stop Google from signing the player straight back in. */
export function forgetGoogleChoice() {
  window.google?.accounts?.id?.disableAutoSelect();
}
