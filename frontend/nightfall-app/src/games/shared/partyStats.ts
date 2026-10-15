import { readLocal, writeLocal } from "../../lib/storage";

/** Same-phone games keep a few counts on the device for their intro stats. */
export function readPartyStats(game: string) {
  return readLocal<Record<string, number>>(`nightfall-${game}-stats`, {});
}

export function bumpPartyStats(game: string, keys: string[]) {
  const stats = readPartyStats(game);
  for (const key of keys) stats[key] = (stats[key] ?? 0) + 1;
  writeLocal(`nightfall-${game}-stats`, stats);
}
