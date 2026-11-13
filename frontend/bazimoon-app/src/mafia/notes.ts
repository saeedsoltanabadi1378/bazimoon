import { useCallback, useSyncExternalStore } from "react";
import type { Role } from "../api/types";
import { readLocal, writeLocal } from "../lib/storage";

/** A private note on another player: how far you trust them, and the role they claimed. */
export interface PlayerNote {
  mark?: "trust" | "suspect";
  claim?: Role;
}

type Notes = Record<string, PlayerNote>;

// Notes never leave the device: they are kept per game in local storage and shared between the
// screens through this small store.
const cache = new Map<string, Notes>();
const listeners = new Set<() => void>();
const key = (gameId: string) => `bazimoon-notes-${gameId}`;

function load(gameId: string): Notes {
  let notes = cache.get(gameId);
  if (!notes) {
    notes = readLocal<Notes>(key(gameId), {});
    cache.set(gameId, notes);
  }
  return notes;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function usePlayerNotes(gameId: string) {
  const notes = useSyncExternalStore(subscribe, () => load(gameId));
  const setNote = useCallback((playerId: string, note: PlayerNote) => {
    const next = { ...load(gameId) };
    if (note.mark || note.claim) next[playerId] = note;
    else delete next[playerId];
    cache.set(gameId, next);
    writeLocal(key(gameId), next);
    listeners.forEach((listener) => listener());
  }, [gameId]);
  return { notes, setNote };
}
