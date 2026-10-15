import type { Route } from "../app/router";

export function GameRoute({ route }: { route: Extract<Route, { name: "game" }> }) {
  void route;
  return null;
}
