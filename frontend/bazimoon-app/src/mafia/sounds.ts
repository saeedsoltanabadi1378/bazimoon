import { useEffect, useRef } from "react";
import type { GameView } from "../api/types";
import { haptic, hapticsEnabled } from "../lib/haptics";

/**
 * Short synthesised cues for a voice game where people look away from the screen: night falling,
 * morning, the vote opening, your turn to speak, and ten seconds left on your turn. They follow the
 * profile's "Haptics and sound" switch.
 */
let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!hapticsEnabled() || typeof AudioContext === "undefined") return null;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

function play(notes: number[], step = 0.16, type: OscillatorType = "sine") {
  const ctx = audio();
  if (!ctx) return;
  notes.forEach((frequency, i) => {
    const start = ctx.currentTime + i * step;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + step * 1.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + step * 1.7);
  });
}

const cue = {
  night: () => play([392, 330, 262], 0.22),
  morning: () => play([330, 392, 523], 0.18),
  voting: () => play([523, 523], 0.14, "triangle"),
  yourTurn: () => play([660, 880], 0.13, "triangle"),
  hurry: () => play([740, 740, 740], 0.11, "triangle"),
};

export function useMafiaSounds(view: GameView | null) {
  const phase = view?.phase;
  const lastPhase = useRef(phase);

  // Browsers only let sound start after a touch, so wake the audio on the first one.
  useEffect(() => {
    const unlock = () => void audio();
    window.addEventListener("pointerdown", unlock, { passive: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    const from = lastPhase.current;
    lastPhase.current = phase;
    if (!from || !phase || from === phase) return;
    if (phase === "Night") cue.night();
    else if ((from === "Night" || from === "NightZero") && (phase === "Day" || phase === "LastWords")) cue.morning();
    else if (phase === "Voting") cue.voting();
  }, [phase]);

  // Your turn on the floor: a chime when it starts and a warning ten seconds before it ends.
  const yourDeadline = view?.lastWords?.youAreSpeaking ? view.lastWords.deadline
    : view?.discussion && view.discussion.activePlayerId === view.yourPlayerId && (phase === "Day" || phase === "Defence") ? view.discussion.deadline
    : null;
  useEffect(() => {
    if (!yourDeadline) return;
    cue.yourTurn();
    haptic.success();
    const wait = new Date(yourDeadline).getTime() - Date.now() - 10_000;
    if (wait <= 0) return;
    const id = window.setTimeout(() => {
      cue.hurry();
      haptic.warn();
    }, wait);
    return () => window.clearTimeout(id);
  }, [yourDeadline]);
}
