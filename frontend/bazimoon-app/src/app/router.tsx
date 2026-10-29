import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useHub } from "../hub/HubData";

export type GameKey = "zip" | "queens" | "merge" | "mines" | "memory" | "word" | "ladder" | "stack" | "blocks" | "sudoku" | "snake" | "dooz" | "spy" | "esmfamil";
export type GameScreen = "intro" | "play" | "result" | "levels" | "setup" | "lobby" | "online" | "solo";
export type CoupleScreen = "home" | "invite" | "quiz" | "reveal";
export type TabKey = "home" | "solo" | "mafia" | "league" | "profile";

export type Route =
  | { name: "home" }
  | { name: "solo" }
  | { name: "league" }
  | { name: "profile" }
  | { name: "friends" }
  | { name: "friendLink"; code: string }
  | { name: "mafia"; gameId?: string; code?: string }
  | { name: "createTable" }
  | { name: "mafiaStats" }
  | { name: "recap"; gameId: string }
  | { name: "game"; game: GameKey; screen: GameScreen; params?: Record<string, string | number | boolean | null> }
  | { name: "couple"; screen: CoupleScreen; token?: string; number?: number };

/** A stable, human-readable key for a route, used only for tracking (never for routing logic). */
function screenKey(route: Route): string {
  switch (route.name) {
    case "game": return `game_${route.game}_${route.screen}`;
    case "couple": return `couple_${route.screen}`;
    case "mafia": return route.gameId ? "mafia_table" : "mafia_lobby_list";
    default: return route.name;
  }
}

interface Navigation {
  route: Route;
  depth: number;
  transition: "forward" | "back" | "replace" | "tab";
  push(route: Route): void;
  replace(route: Route): void;
  /** Switches to a top-level tab, dropping the history (tabs are siblings, not a stack). */
  reset(route: Route): void;
  back(): void;
}

const NavigationContext = createContext<Navigation | null>(null);

export function NavigationProvider({ initial, children }: { initial: Route[]; children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>(initial);
  const [transition, setTransition] = useState<Navigation["transition"]>("replace");

  // Each pushed screen gets a browser history entry, so the system back gesture (Android, browser
  // back button) pops it like the in-app back button does.
  const push = useCallback((route: Route) => {
    window.history.pushState({ bazimoon: true }, "");
    setTransition("forward");
    setStack((s) => [...s, route]);
  }, []);
  const replace = useCallback((route: Route) => {
    setTransition("replace");
    setStack((s) => [...s.slice(0, -1), route]);
  }, []);
  const reset = useCallback((route: Route) => {
    setTransition("tab");
    setStack([route]);
  }, []);
  const pop = useCallback(() => {
    setTransition("back");
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : [{ name: "home" }]));
  }, []);
  const back = useCallback(() => {
    if (window.history.state?.bazimoon) window.history.back();
    else pop();
  }, [pop]);

  useEffect(() => {
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [pop]);

  // Dev-only hook so screenshot/e2e scripts can open any screen directly.
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __nav?: (r: Route) => void }).__nav = push;
  }, [push]);

  const route = stack[stack.length - 1];
  const depth = stack.length;


  // Every navigation starts the new screen at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  // Every screen view, app-wide, logged from this one place rather than from each screen — with how
  // long the player spent on the screen they just left, so drop-off and dwell time are both visible.
  const { api } = useHub();
  const left = useRef<{ screen: string; at: number } | null>(null);
  useEffect(() => {
    const screen = screenKey(route);
    const now = performance.now();
    api.trackEvent("screen_viewed", "navigation", {
      screen,
      previousScreen: left.current?.screen ?? null,
      timeOnPreviousMs: left.current ? Math.round(now - left.current.at) : null,
    });
    left.current = { screen, at: now };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // The player backgrounding or closing the tab never shows up as a navigation, so the current
  // screen's own view never gets a "previous screen" dwell time from the effect above — this is
  // also the only signal that a game screen was abandoned (closed without finishing or leaving).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== "hidden" || !left.current) return;
      api.trackEvent("screen_left", "navigation", {
        screen: left.current.screen,
        timeOnScreenMs: Math.round(performance.now() - left.current.at),
      });
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ route, depth, transition, push, replace, reset, back }), [route, depth, transition, push, replace, reset, back]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const nav = useContext(NavigationContext);
  if (!nav) throw new Error("useNavigation must be used inside NavigationProvider");
  return nav;
}

export function tabFor(route: Route): TabKey | null {
  switch (route.name) {
    case "home":
      return "home";
    case "couple":
      return "home";
    case "solo":
    case "game":
      return "solo";
    case "mafia":
    case "createTable":
      return "mafia";
    case "league":
      return "league";
    case "profile":
    case "mafiaStats":
    case "friends":
      return "profile";
    default:
      return null;
  }
}
