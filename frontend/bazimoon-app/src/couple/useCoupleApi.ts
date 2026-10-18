import { useMemo } from "react";
import { useSession } from "../app/session";
import { coupleApi } from "../api/couple";

// Kept apart from CoupleRoute so the Home card doesn't pull the whole Couple Quiz into the first load.
export function useCoupleApi() {
  const session = useSession();
  return useMemo(() => coupleApi(session.api), [session.api]);
}
