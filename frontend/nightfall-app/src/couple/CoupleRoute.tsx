import type { Route } from "../app/router";

export function CoupleRoute({ route }: { route: Extract<Route, { name: "couple" }> }) {
  void route;
  return null;
}
