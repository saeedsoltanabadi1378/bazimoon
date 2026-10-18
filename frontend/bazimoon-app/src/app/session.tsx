import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, BazimoonApiClient } from "../api/client";
import type { AuthSession, AuthUser } from "../api/types";
import { useLanguage } from "../i18n/LanguageContext";
import { readLocal, removeLocal, writeLocal } from "../lib/storage";

export type SessionStatus = "loading" | "ready" | "signed-out" | "offline" | "error";

/** What happened when the player signed in with Google. */
export type GoogleOutcome = "linked" | "signed-in" | "exists";

interface Session {
  api: BazimoonApiClient;
  status: SessionStatus;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
  /** As a guest, links Google and keeps progress ("linked"), or reports that the Google account
   * already has a profile ("exists"). Signed out, it signs in with Google ("signed-in"). */
  signInWithGoogle(idToken: string): Promise<GoogleOutcome>;
  /** Leaves this guest for the Google account's existing profile; the guest's progress is dropped. */
  switchToGoogle(idToken: string): Promise<void>;
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

  useEffect(() => {
    const saved = readLocal<AuthSession | null>(STORAGE_KEY, null);
    if (saved?.refreshToken) {
      // Open straight away with the saved session; an expired access token refreshes on first use.
      api.useSession(saved);
      setStatus("ready");
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

  const signInWithGoogle = useCallback(async (idToken: string): Promise<GoogleOutcome> => {
    if (user?.isGuest) {
      try {
        api.useSession(await api.linkGoogle(idToken));
        return "linked";
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) return "exists";
        throw err;
      }
    }
    api.useSession(await api.signInWithGoogle(idToken, language));
    setStatus("ready");
    return "signed-in";
  }, [api, user, language]);

  const switchToGoogle = useCallback(async (idToken: string) => {
    const next = await api.signInWithGoogle(idToken, language);
    await api.logout().catch(() => undefined);
    api.useSession(next);
    setStatus("ready");
  }, [api, language]);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    await startGuest();
  }, [api, startGuest]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const value = useMemo<Session>(() => ({
    api,
    status,
    userId: user?.id ?? null,
    displayName: user?.displayName ?? "",
    isGuest: user?.isGuest ?? true,
    signInWithGoogle,
    switchToGoogle,
    continueAsGuest: startGuest,
    logout,
    retry,
  }), [api, status, user, signInWithGoogle, switchToGoogle, startGuest, logout, retry]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}
