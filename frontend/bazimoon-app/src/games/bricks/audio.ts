// Brick Breaker sound: every effect and music track is synthesised with Web Audio, so the game
// ships no audio files. Music and effects have separate volumes. Repeated ball hits are thinned and
// softened so a hundred balls never turn into noise.

export type Sfx =
  | "hit" | "wall" | "break" | "ring" | "explode" | "laser" | "coin" | "combo" | "danger" | "launch"
  | "button" | "transition" | "unlock" | "achievement" | "levelComplete" | "levelFailed" | "gameOver" | "highScore" | "power" | "shield";

export type Track = "menu" | "play" | "victory" | "gameover" | `world${number}`;

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let sfxVolume = 0.7;
let musicVolume = 0.4;

function ac(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxVolume;
    sfxBus.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = musicVolume * 0.5;
    musicBus.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Browsers start audio suspended until the first tap; call from a pointer handler. */
export function unlockAudio() {
  const c = ac();
  if (c && c.state === "suspended") void c.resume();
}

export function setVolumes(sound: number, music: number) {
  sfxVolume = Math.max(0, Math.min(1, sound / 100));
  musicVolume = Math.max(0, Math.min(1, music / 100));
  if (sfxBus && ctx) sfxBus.gain.setTargetAtTime(sfxVolume, ctx.currentTime, 0.05);
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(musicVolume * 0.5, ctx.currentTime, 0.2);
  if (musicVolume === 0) stopMusic();
}

function tone(freq: number, at: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number; bus?: GainNode | null; attack?: number } = {}) {
  const c = ctx!;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, at);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), at + dur);
  const peak = opts.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + (opts.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(opts.bus ?? sfxBus!);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function burst(at: number, dur: number, opts: { gain?: number; freq?: number; q?: number; type?: BiquadFilterType } = {}) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = opts.type ?? "bandpass";
  f.frequency.value = opts.freq ?? 1200;
  f.Q.value = opts.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(opts.gain ?? 0.3, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(sfxBus!);
  src.start(at);
  src.stop(at + dur + 0.02);
}

// Hit thinning: at most one hit sound every 30 ms, quieter the busier it gets.
let lastHit = 0;
let recentHits = 0;
let lastWall = 0;

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export function play(sfx: Sfx, detail = 0) {
  if (sfxVolume <= 0) return;
  const c = ac();
  if (!c || c.state !== "running") return;
  const t = c.currentTime;
  switch (sfx) {
    case "hit": {
      const now = performance.now();
      recentHits = Math.max(0, recentHits - (now - lastHit) / 60) + 1;
      if (now - lastHit < 30) return;
      lastHit = now;
      const g = 0.12 / Math.sqrt(recentHits);
      tone(NOTE(76 + Math.min(12, detail * 2)), t, 0.06, { type: "triangle", gain: g });
      break;
    }
    case "wall": {
      const now = performance.now();
      if (now - lastWall < 60) return;
      lastWall = now;
      tone(1800, t, 0.03, { type: "sine", gain: 0.03 });
      break;
    }
    case "launch": tone(900, t, 0.04, { type: "sine", gain: 0.025, to: 1300 }); break;
    case "break":
      burst(t, 0.12, { gain: 0.18, freq: 2400, q: 0.8 });
      tone(NOTE(72 + Math.min(14, detail * 2)), t, 0.12, { type: "square", gain: 0.05, to: NOTE(60) });
      break;
    case "ring":
      tone(NOTE(84), t, 0.08, { type: "triangle", gain: 0.12 });
      tone(NOTE(91), t + 0.06, 0.12, { type: "triangle", gain: 0.12 });
      break;
    case "explode":
      burst(t, 0.45, { gain: 0.45, freq: 220, q: 0.7, type: "lowpass" });
      tone(110, t, 0.35, { type: "sine", gain: 0.3, to: 40 });
      break;
    case "laser":
      tone(1400, t, 0.28, { type: "sawtooth", gain: 0.07, to: 200 });
      tone(2100, t, 0.2, { type: "sine", gain: 0.05, to: 600 });
      break;
    case "power":
      tone(NOTE(67), t, 0.1, { type: "triangle", gain: 0.12 });
      tone(NOTE(74), t + 0.07, 0.14, { type: "triangle", gain: 0.12 });
      break;
    case "shield":
      [60, 64, 67, 72].forEach((n, i) => tone(NOTE(n), t + i * 0.06, 0.3, { type: "sine", gain: 0.12 }));
      break;
    case "coin":
      tone(NOTE(88), t, 0.07, { type: "square", gain: 0.05 });
      tone(NOTE(95), t + 0.07, 0.16, { type: "square", gain: 0.05 });
      break;
    case "combo": {
      const steps = Math.max(1, Math.min(5, detail));
      for (let i = 0; i < steps + 2; i++) tone(NOTE(72 + [0, 4, 7, 12, 16, 19, 24][i]), t + i * 0.05, 0.14, { type: "triangle", gain: 0.1 });
      break;
    }
    case "danger": tone(NOTE(45), t, 0.35, { type: "sine", gain: 0.2 }); tone(NOTE(45), t + 0.4, 0.35, { type: "sine", gain: 0.2 }); break;
    case "button": tone(NOTE(79), t, 0.04, { type: "triangle", gain: 0.06 }); break;
    case "transition": burst(t, 0.16, { gain: 0.05, freq: 3000, q: 0.5, type: "highpass" }); break;
    case "unlock": [76, 83, 88, 95].forEach((n, i) => tone(NOTE(n), t + i * 0.06, 0.2, { type: "triangle", gain: 0.09 })); break;
    case "achievement": [72, 76, 79, 84].forEach((n, i) => tone(NOTE(n), t + i * 0.09, 0.3, { type: "square", gain: 0.05 })); break;
    case "levelComplete": [72, 76, 79, 84, 88].forEach((n, i) => tone(NOTE(n), t + i * 0.1, 0.35, { type: "triangle", gain: 0.12 })); break;
    case "levelFailed": [67, 63, 60].forEach((n, i) => tone(NOTE(n), t + i * 0.16, 0.3, { type: "triangle", gain: 0.1 })); break;
    case "gameOver": [64, 60, 57, 52].forEach((n, i) => tone(NOTE(n), t + i * 0.18, 0.4, { type: "sine", gain: 0.14 })); break;
    case "highScore": [72, 79, 84, 88, 91, 96].forEach((n, i) => tone(NOTE(n), t + i * 0.08, 0.3, { type: "square", gain: 0.05 })); break;
  }
}

// ------------------------------------------------------------------ music

interface Song { bpm: number; root: number; chords: number[][]; lead: OscillatorType; arp: number[]; pad: boolean; once?: boolean }

const MINOR = [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-2, 2, 5]];
const MAJOR = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];

const SONGS: Record<string, Song> = {
  menu: { bpm: 92, root: 57, chords: MAJOR, lead: "triangle", arp: [0, 1, 2, 1], pad: true },
  play: { bpm: 104, root: 55, chords: MINOR, lead: "triangle", arp: [0, 2, 1, 2, 0, 1, 2, 1], pad: true },
  victory: { bpm: 140, root: 60, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19]], lead: "square", arp: [0, 1, 2, 1], pad: false, once: true },
  gameover: { bpm: 80, root: 52, chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]], lead: "sine", arp: [2, 1, 0], pad: false, once: true },
};

/** Each adventure world gets its own key, tempo and voice over the gameplay theme. */
function worldSong(w: number): Song {
  const roots = [55, 58, 61, 52, 62, 50, 57, 59, 49, 60];
  const leads: OscillatorType[] = ["triangle", "square", "sine", "sawtooth", "sine", "triangle", "square", "sine", "triangle", "square"];
  return { bpm: 96 + (w % 5) * 6, root: roots[w % 10], chords: w % 2 ? MINOR : MAJOR, lead: leads[w % 10], arp: w % 3 ? [0, 1, 2, 1, 2, 1] : [0, 2, 1, 2], pad: true };
}

let current: string | null = null;
let timer: number | null = null;
let step = 0;
let nextAt = 0;

export function playMusic(track: Track) {
  if (current === track) return;
  stopMusic();
  if (musicVolume <= 0) return;
  const c = ac();
  if (!c) return;
  const song = track.startsWith("world") ? worldSong(Number(track.slice(5))) : SONGS[track];
  if (!song) return;
  current = track;
  step = 0;
  nextAt = c.currentTime + 0.1;
  const beat = 60 / song.bpm / 2;
  const totalSteps = song.chords.length * 8;
  const tick = () => {
    if (!ctx || current !== track) return;
    if (ctx.state !== "running") return;
    while (nextAt < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % song.chords.length;
      const chord = song.chords[bar];
      const inBar = step % 8;
      if (inBar === 0) {
        tone(NOTE(song.root - 12 + chord[0]), nextAt, beat * 7.5, { type: "triangle", gain: 0.12, bus: musicBus, attack: 0.04 });
        if (song.pad) chord.forEach((n) => tone(NOTE(song.root + n), nextAt, beat * 7.8, { type: "sine", gain: 0.035, bus: musicBus, attack: 0.3 }));
      }
      const note = chord[song.arp[step % song.arp.length]];
      tone(NOTE(song.root + 12 + note), nextAt, beat * 0.9, { type: song.lead, gain: song.lead === "square" || song.lead === "sawtooth" ? 0.02 : 0.045, bus: musicBus });
      step++;
      nextAt += beat;
      if (song.once && step >= totalSteps) {
        current = null;
        return;
      }
    }
  };
  tick();
  timer = window.setInterval(tick, 100);
}

export function stopMusic() {
  current = null;
  if (timer !== null) window.clearInterval(timer);
  timer = null;
}
