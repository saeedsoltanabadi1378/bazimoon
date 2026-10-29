import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError } from "../api/client";
import { hubApi, type Profile, type PuzzleResult, type PuzzleSubmit, type Settings } from "../api/hub";
import { friendsApi } from "../api/friends";
import { useSession } from "../app/session";
import { readLocal, writeLocal } from "../lib/storage";
import { setHapticsEnabled } from "../lib/haptics";
import { useLanguage } from "../i18n/LanguageContext";

const QUEUE_KEY = "bazimoon-pending-results";
const CONTRAST_KEY = "bazimoon-high-contrast";
const DISABLED_KEY = "bazimoon-disabled-games";

interface HubData {
  api: ReturnType<typeof hubApi>;
  friends: ReturnType<typeof friendsApi>;
  profile: Profile | null;
  refreshProfile(): Promise<void>;
  highContrast: boolean;
  saveSettings(patch: Partial<Settings>): Promise<void>;
  /** Records a finished game. Offline results are kept on the device and sent later. */
  submitResult(result: PuzzleSubmit): Promise<PuzzleResult | null>;
  /** False for a game an admin switched off: it is hidden from Home, Games and Together. */
  isGameOn(game: string): boolean;
}

const HubDataContext = createContext<HubData | null>(null);

export function HubDataProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const { language, setLanguage, fromUrl } = useLanguage();
  const api = useMemo(() => hubApi(session.api), [session.api]);
  const friends = useMemo(() => friendsApi(session.api), [session.api]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [highContrast, setHighContrast] = useState(() => readLocal<boolean>(CONTRAST_KEY, false));
  const [disabledGames, setDisabledGames] = useState<string[]>(() => readLocal<string[]>(DISABLED_KEY, []));
  const languageRef = useRef(language);
  const savingLanguageRef = useRef<Settings["language"] | null>(null);
  const languageVersionRef = useRef(0);
  languageRef.current = language;

  // Switched-off games: read at start and whenever the app comes back to the foreground.
  useEffect(() => {
    const load = () => api.config().then((c) => {
      setDisabledGames(c.disabledGames);
      writeLocal(DISABLED_KEY, c.disabledGames);
    }).catch(() => undefined);
    void load();
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [api]);
  const isGameOn = useCallback((game: string) => !disabledGames.includes(game), [disabledGames]);

  const refreshProfile = useCallback(async () => {
    const languageVersion = languageVersionRef.current;
    try {
      const next = await api.profile();
      setProfile(next);
      // The server profile is authoritative unless this visit explicitly used ?lang=.
      if (!fromUrl && !savingLanguageRef.current && languageVersion === languageVersionRef.current && next.settings.language !== languageRef.current) {
        languageRef.current = next.settings.language;
        setLanguage(next.settings.language);
      }
      setHapticsEnabled(next.settings.haptics);
      setHighContrast(next.settings.highContrast);
      writeLocal(CONTRAST_KEY, next.settings.highContrast);
    } catch (err) {
      console.warn("[Bazimoon] Could not load profile", err);
    }
  }, [api, fromUrl, setLanguage]);

  const flushQueue = useCallback(async () => {
    const pending = readLocal<PuzzleSubmit[]>(QUEUE_KEY, []);
    if (!pending.length) return;
    const left: PuzzleSubmit[] = [];
    for (const item of pending) {
      try {
        await api.submit(item);
      } catch (err) {
        if (err instanceof ApiError && err.status === 0) left.push(item);
      }
    }
    writeLocal(QUEUE_KEY, left);
  }, [api]);

  useEffect(() => {
    void flushQueue().then(refreshProfile);
    const onOnline = () => void flushQueue().then(refreshProfile);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushQueue, refreshProfile]);

  useEffect(() => {
    document.documentElement.classList.toggle("high-contrast", highContrast);
  }, [highContrast]);

  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    const base: Settings = profile?.settings ?? { language, reminderEnabled: true, reminderTime: "09:00", highContrast, haptics: true };
    const next = { ...base, ...patch };
    if (patch.language) {
      languageVersionRef.current += 1;
      savingLanguageRef.current = patch.language;
      languageRef.current = patch.language;
      if (patch.language !== language) setLanguage(patch.language);
    }
    if (patch.haptics !== undefined) setHapticsEnabled(patch.haptics);
    if (patch.highContrast !== undefined) {
      setHighContrast(patch.highContrast);
      writeLocal(CONTRAST_KEY, patch.highContrast);
    }
    setProfile((p) => (p ? { ...p, settings: next } : p));
    try {
      await api.saveSettings(next);
    } catch (err) {
      console.warn("[Bazimoon] Could not save settings", err);
    } finally {
      if (patch.language && savingLanguageRef.current === patch.language) savingLanguageRef.current = null;
    }
  }, [api, profile, language, highContrast, setLanguage]);

  const submitResult = useCallback(async (result: PuzzleSubmit) => {
    try {
      const saved = await api.submit(result);
      void refreshProfile();
      return saved;
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        writeLocal(QUEUE_KEY, [...readLocal<PuzzleSubmit[]>(QUEUE_KEY, []), result]);
      } else {
        console.warn("[Bazimoon] Could not save result", err);
      }
      return null;
    }
  }, [api, refreshProfile]);

  const value = useMemo(() => ({ api, friends, profile, refreshProfile, highContrast, saveSettings, submitResult, isGameOn }), [api, friends, profile, refreshProfile, highContrast, saveSettings, submitResult, isGameOn]);
  return <HubDataContext.Provider value={value}>{children}</HubDataContext.Provider>;
}

export function useHub() {
  const hub = useContext(HubDataContext);
  if (!hub) throw new Error("useHub must be used inside HubDataProvider");
  return hub;
}

/** Small fetch hook for hub reads: data, loading, error and a reload function. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  return { data, error, loading, reload: () => setVersion((v) => v + 1), setData };
}
