import { useEffect, useRef, useState } from 'react';
import type { ShelemRoom } from '../../api/shelem';
import { haptic } from '../../lib/haptics';

export function useGameFeedback(room: ShelemRoom | null) {
  const [sound, setSound] = useState(false);
  const [vibration, setVibration] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const previous = useRef<ShelemRoom | null>(null);
  useEffect(() => () => { void audio.current?.close(); }, []);
  useEffect(() => {
    const old = previous.current;
    previous.current = room;
    if (!old || !room) return;
    const deal = old.round !== room.round;
    const win = room.trick.length === 4 && old.trick.length !== 4;
    const turn = room.turnSeat === room.yourSeat && old.turnSeat !== room.turnSeat;
    const card = room.trick.length > old.trick.length;
    if (!deal && !win && !turn && !card) return;
    if (vibration) { if (win && room.lastTrickWinner === room.yourSeat) haptic.success(); else if (turn) haptic.tap(); }
    const ctx = audio.current;
    if (!sound || !ctx || ctx.state !== 'running') return;
    const pitches = win ? [440, 660] : turn ? [520] : deal ? [220, 260, 300, 340] : [180];
    pitches.forEach((frequency, i) => {
      const at = ctx.currentTime + i * .07;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(.035, at + .008);
      gain.gain.exponentialRampToValueAtTime(.001, at + .1);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(at); oscillator.stop(at + .12);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }, [room, sound, vibration]);
  async function toggleSound() {
    if (sound) { setSound(false); return; }
    try { audio.current ??= new AudioContext(); await audio.current.resume(); setSound(true); } catch { setSound(false); }
  }
  return { sound, vibration, toggleSound, toggleVibration: () => setVibration(value => !value) };
}
