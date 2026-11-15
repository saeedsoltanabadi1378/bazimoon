import { core } from "./core";
import { mafia } from "./mafia";
import { hub } from "./hub";
import { games } from "./games";
import { party } from "./party";
import { friends } from "./friends";
import { clans } from "./clans";

export const en = { ...core, ...mafia, ...hub, ...games, ...party, ...friends, ...clans };
