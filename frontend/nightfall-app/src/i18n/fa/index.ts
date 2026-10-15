import type { en } from "../en";
import { core } from "./core";
import { mafia } from "./mafia";
import { hub } from "./hub";
import { games } from "./games";

export const fa: Record<keyof typeof en, string> = { ...core, ...mafia, ...hub, ...games };
