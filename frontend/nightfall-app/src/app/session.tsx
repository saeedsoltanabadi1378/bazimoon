import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, NightfallApiClient } from "../api/client";
import { telegram } from "../lib/telegram";

export type SessionStatus = "loading" | "ready" | "no-telegram" | "offline" | "expired" | "error";

interface Session {
  api: NightfallApiClient;
  status: SessionStatus;
  telegramUserId: number | null;
  username: string;
  firstName: string;
  retry(): void;
}

const SessionContext = createContext<Session | null>(null);

/** Signs in once with Telegram's initData and shares the authenticated API client app-wide. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const api = useMemo(() => new NightfallApiClient(import.meta.env.VITE_API_BASE_URL), []);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [telegramUserId, setTelegramUserId] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [attempt, setAttempt] = useState(0);
  const tgUser = telegram.initDataUnsafe.user;

  useEffect(() => {
    let cancelled = false;
    async function signIn() {
      if (!telegram.initData) {
        setStatus("no-telegram");
        return;
      }
      setStatus("loading");
      try {
        const auth = await api.authenticate(telegram.initData);
        if (cancelled) return;
        api.setToken(auth.token);
        setTelegramUserId(auth.telegramUserId);
        setUsername(auth.username);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 0) setStatus("offline");
        else if (err instanceof ApiError && err.status === 401) setStatus("expired");
        else setStatus("error");
      }
    }
    void signIn();
    return () => {
      cancelled = true;
    };
  }, [api, attempt]);

  // Coming back online re-attempts sign-in automatically.
  useEffect(() => {
    if (status !== "offline") return;
    const onOnline = () => setAttempt((a) => a + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [status]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const value = useMemo<Session>(() => ({
    api,
    status,
    telegramUserId,
    username: username || tgUser?.username || tgUser?.first_name || "",
    firstName: tgUser?.first_name || username,
    retry,
  }), [api, status, telegramUserId, username, tgUser, retry]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}
