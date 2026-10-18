import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type GameKey = "zip" | "queens" | "merge" | "mines" | "memory" | "nard" | "word" | "ladder" | "stack" | "blocks" | "sudoku" | "snake" | "dooz" | "spy" | "esmfamil";
export type GameScreen = "intro" | "play" | "result" | "archive" | "setup" | "lobby" | "online" | "solo";
export type CoupleScreen = "home" | "invite" | "quiz" | "reveal";
export type TabKey = "home" | "solo" | "mafia" | "league" | "profile";

export type Route =
  | { name: "welcome" }
  | { name: "home" }
  | { name: "solo" }
  | { name: "league" }
  | { name: "profile" }
  | { name: "mafia"; gameId?: string; code?: string }
  | { name: "createTable" }
  | { name: "mafiaStats" }
  | { name: "recap"; gameId: string }
  | { name: "game"; game: GameKey; screen: GameScreen; params?: Record<string, string | number | boolean | null> }
  | { name: "couple"; screen: CoupleScreen; token?: string; number?: number };

interface Navigation {
  route: Route;
  depth: number;
  push(route: Route): void;
  replace(route: Route): void;
  /** Switches to a top-level tab, dropping the history (tabs are siblings, not a stack). */
  reset(route: Route): void;
  back(): void;
}

const NavigationContext = createContext<Navigation | null>(null);

export function NavigationProvider({ initial, children }: { initial: Route[]; children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>(initial);

  // Each pushed screen gets a browser history entry, so the system back gesture (Android, browser
  // back button) pops it like the in-app back button does.
  const push = useCallback((route: Route) => {
    window.history.pushState({ bazimoon: true }, "");
    setStack((s) => [...s, route]);
  }, []);
  const replace = useCallback((route: Route) => setStack((s) => [...s.slice(0, -1), route]), []);
  const reset = useCallback((route: Route) => setStack([route]), []);
  const pop = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : [{ name: "home" }])), []);
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

  const value = useMemo(() => ({ route, depth, push, replace, reset, back }), [route, depth, push, replace, reset, back]);
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
      return "profile";
    default:
      return null;
  }
}
