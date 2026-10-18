import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, BazimoonApiClient } from "../api/client";
import type { AuthSession, AuthUser } from "../api/types";
import { useLanguage } from "../i18n/LanguageContext";
import { readLocal, removeLocal, writeLocal } from "../lib/storage";
import { disablePush, refreshPushSubscription } from "../lib/push";
import { readGoogleReturn, startGoogleSignIn, type GoogleReturn } from "../lib/google";

export type SessionStatus = "loading" | "ready" | "signed-out" | "offline" | "error";

/** Where a Google sign-in stands after the player comes back from Google's page:
 * "linking" while the API checks it, "linked" (a guest kept their progress), "signed-in",
 * "exists" (that Google account already has a profile; the player chooses) or "error". */
export type GoogleStage = "linking" | "linked" | "signed-in" | "exists" | "error";

interface Session {
  api: BazimoonApiClient;
  status: SessionStatus;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
  /** Goes to Google's sign-in page; the app reopens at /auth/google and finishes there. A guest
   * links Google and keeps their progress; a signed-out player signs in. */
  startGoogle(): void;
  googleStage: GoogleStage | null;
  dismissGoogle(): void;
  /** After "exists": leaves this guest for the Google account's profile; the guest's progress is dropped. */
  switchToGoogleProfile(): Promise<void>;
  continueAsGuest(): Promise<void>;
  logout(): Promise<void>;
  retry(): void;
}

const STORAGE_KEY = "bazimoon-session";

const SessionContext = createContext<Session | null>(null);

/** Keeps the player signed in: a saved session, else a new guest. Tokens refresh on their own. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const api = useMemo(() => new BazimoonApiClient(import.meta.env.VITE_API_BASE_URL), []);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [googleStage, setGoogleStage] = useState<GoogleStage | null>(null);
  // The answer Google sent back, kept for "switch to that profile" after a 409.
  const googleReturn = useRef<GoogleReturn | null>(null);

  // Every new token pair is saved; a session the server ended sends the player to "signed out".
  useEffect(() => {
    api.onSessionChange = (session: AuthSession | null) => {
      if (session) {
        writeLocal(STORAGE_KEY, session);
        setUser(session.user);
      } else {
        removeLocal(STORAGE_KEY);
        setUser(null);
        setStatus("signed-out");
      }
    };
    return () => {
      api.onSessionChange = null;
    };
  }, [api]);

  const startGuest = useCallback(async () => {
    setStatus("loading");
    try {
      api.useSession(await api.signInAsGuest(language));
      setStatus("ready");
    } catch (err) {
      setStatus(err instanceof ApiError && err.status === 0 ? "offline" : "error");
    }
  }, [api, language]);

  // Finishes a Google sign-in the player started before leaving for Google's page.
  const finishGoogle = useCallback(async (ret: GoogleReturn, guest: boolean) => {
    googleReturn.current = ret;
    setGoogleStage("linking");
    try {
      if (guest) {
        api.useSession(await api.linkGoogle(ret.idToken, ret.nonce));
        setGoogleStage("linked");
      } else {
        api.useSession(await api.signInWithGoogle(ret.idToken, ret.nonce, language));
        setGoogleStage("signed-in");
      }
      setStatus("ready");
    } catch (err) {
      setGoogleStage(err instanceof ApiError && err.status === 409 ? "exists" : "error");
      // A signed-out player whose sign-in failed has no session to fall back on.
      if (!guest && !api.isAuthenticated) setStatus("signed-out");
    }
  }, [api, language]);

  useEffect(() => {
    const google = attempt === 0 ? readGoogleReturn() : null;
    const saved = readLocal<AuthSession | null>(STORAGE_KEY, null);
    if (saved?.refreshToken) {
      // Open straight away with the saved session; an expired access token refreshes on first use.
      api.useSession(saved);
      setStatus("ready");
      if (google && google !== "cancelled") void finishGoogle(google, saved.user.isGuest);
      return;
    }
    if (google && google !== "cancelled") {
      setStatus("ready");
      void finishGoogle(google, false);
      return;
    }
    void startGuest();
    // Language only matters for a brand-new guest, so changing it later must not sign in again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, attempt]);

  // Coming back online re-attempts sign-in automatically.
  useEffect(() => {
    if (status !== "offline") return;
    const onOnline = () => setAttempt((a) => a + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [status]);

  const startGoogle = useCallback(() => startGoogleSignIn(language), [language]);
  const dismissGoogle = useCallback(() => setGoogleStage(null), []);

  const switchToGoogleProfile = useCallback(async () => {
    const ret = googleReturn.current;
    if (!ret) return;
    setGoogleStage("linking");
    const next = await api.signInWithGoogle(ret.idToken, ret.nonce, language).catch(() => null);
    if (!next) {
      setGoogleStage("error");
      return;
    }
    await disablePush(api);
    await api.logout().catch(() => undefined);
    api.useSession(next);
    setStatus("ready");
    setGoogleStage("signed-in");
    void refreshPushSubscription(api);
  }, [api, language]);

  const logout = useCallback(async () => {
    // This device stops getting the signed-out player's notifications.
    await disablePush(api);
    await api.logout().catch(() => undefined);
    await startGuest();
    void refreshPushSubscription(api);
  }, [api, startGuest]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const value = useMemo<Session>(() => ({
    api,
    status,
    userId: user?.id ?? null,
    displayName: user?.displayName ?? "",
    isGuest: user?.isGuest ?? true,
    startGoogle,
    googleStage,
    dismissGoogle,
    switchToGoogleProfile,
    continueAsGuest: startGuest,
    logout,
    retry,
  }), [api, status, user, startGoogle, googleStage, dismissGoogle, switchToGoogleProfile, startGuest, logout, retry]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}
