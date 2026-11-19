// Draws a Brick Breaker board on a canvas: theme background, bricks with their numbers and symbols,
// +1 rings, balls with skins and trails, particles, blasts and beams, the aim guide and the line.
// The board always reads left to right, in both languages.
import { CELL, COLS, FLOOR, H, LINE, R, W, tierOf, type Aim, type GameEvent, type RunState, type Shot } from "./engine";
import { TIER_COLORS, TIER_COLORS_SAFE, ballOf, themeOf, trailOf, type BallSkin, type ThemeStyle, type TrailStyle } from "./cosmetics";

export interface Look {
  ball: string;
  trail: string;
  theme: string;
  colorblind: boolean;
  /** 0 off, 1 low, 2 full. */
  particles: number;
  trailLevel: number;
  reducedMotion: boolean;
  guide: boolean;
}

export interface View {
  aim: Aim | null;
  guide: { points: { x: number; y: number }[]; contacts: { x: number; y: number }[] } | null;
  targeting: "hlaser" | "vlaser" | "bomb" | null;
  hover: { row: number; col: number } | null;
  danger: boolean;
  over: boolean;
  /** Ball counter position on screen, for +1 rings to fly to. */
  digits: (n: number) => string;
  showCount: boolean;
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Effect { kind: "wave" | "beamH" | "beamV" | "spark" | "flashLaunch"; x: number; y: number; r: number; t: number; max: number }
interface Floater { x: number; y: number; tx: number; ty: number; text: string; color: string; t: number; max: number }

const PATTERNS = 7;

function luminance(hex: string) {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private dpr = 1;
  private shown = new Map<number, number>();
  private flash = new Map<number, number>();
  private particles: Particle[] = [];
  private effects: Effect[] = [];
  private floaters: Floater[] = [];
  private trails: { x: number; y: number }[][] = [];
  private dots: { x: number; y: number; s: number; v: number }[] = [];
  private time = 0;
  private lineFlash = 0;

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    for (let i = 0; i < 26; i++) this.dots.push({ x: Math.random() * W, y: Math.random() * LINE, s: 0.6 + Math.random() * 1.6, v: 0.05 + Math.random() * 0.15 });
  }

  resize(cssWidth: number) {
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.scale = cssWidth / W;
    this.canvas.width = Math.round(cssWidth * this.dpr);
    this.canvas.height = Math.round(H * this.scale * this.dpr);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${H * this.scale}px`;
  }

  /** Board coordinates of a pointer position. */
  toBoard(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  }

  /** Forgets where bricks were drawn (a new board: no slide-in from the old one). */
  reset() {
    this.shown.clear();
    this.flash.clear();
    this.particles = [];
    this.effects = [];
    this.floaters = [];
    this.trails = [];
  }

  /** Turns game events into flashes, particles, blasts and floating rewards. */
  feed(events: GameEvent[], s: RunState, look: Look, ringTarget: { x: number; y: number }) {
    const amount = look.particles;
    for (const e of events) {
      switch (e.type) {
        case "hit": {
          const b = s.bricks.find((o) => Math.abs(o.col * CELL + CELL / 2 - e.x) < CELL / 2 + R && Math.abs(o.row * CELL + CELL / 2 - e.y) < CELL / 2 + R);
          if (b) this.flash.set(b.id, 1);
          if (amount > 1) this.effects.push({ kind: "spark", x: e.x, y: e.y, r: 4, t: 8, max: 8 });
          break;
        }
        case "wall":
          if (amount > 0) this.effects.push({ kind: "spark", x: e.x, y: e.y, r: 3, t: 6, max: 6 });
          break;
        case "break": {
          const colors = look.colorblind ? TIER_COLORS_SAFE : TIER_COLORS;
          const n = amount === 0 ? 0 : amount === 1 ? 5 : 12;
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3.5;
            this.particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 26, max: 26, color: colors[e.color], size: 3 + Math.random() * 4 });
          }
          if (amount > 0) this.effects.push({ kind: "wave", x: e.x, y: e.y, r: 30, t: 14, max: 14 });
          break;
        }
        case "explode":
          this.effects.push({ kind: "wave", x: e.x, y: e.y, r: e.radius * 1.4, t: look.reducedMotion ? 12 : 24, max: look.reducedMotion ? 12 : 24 });
          break;
        case "beamH":
          this.effects.push({ kind: "beamH", x: 0, y: e.row * CELL + CELL / 2, r: 0, t: look.reducedMotion ? 12 : 22, max: look.reducedMotion ? 12 : 22 });
          break;
        case "beamV":
          this.effects.push({ kind: "beamV", x: e.col * CELL + CELL / 2, y: 0, r: 0, t: look.reducedMotion ? 12 : 22, max: look.reducedMotion ? 12 : 22 });
          break;
        case "ring":
          this.floaters.push({ x: e.x, y: e.y, tx: ringTarget.x, ty: ringTarget.y, text: "+1", color: "#B8F24A", t: 36, max: 36 });
          if (amount > 0) this.effects.push({ kind: "wave", x: e.x, y: e.y, r: 26, t: 12, max: 12 });
          break;
        case "mystery":
          this.floaters.push({ x: e.x, y: e.y, tx: e.x, ty: e.y - 40, text: e.reward === "coins" ? `+${e.amount}` : e.reward === "balls" ? `+${e.amount}` : "⟷", color: e.reward === "coins" ? "#FFD166" : "#B8F24A", t: 44, max: 44 });
          break;
        case "launch":
          if (amount > 1) this.effects.push({ kind: "flashLaunch", x: s.lx, y: FLOOR - R, r: 10, t: 6, max: 6 });
          break;
      }
    }
  }

  flashLine() {
    this.lineFlash = 60;
  }

  /** Whether anything is still moving (effects, bricks sliding), so the loop keeps drawing. */
  animating(s: RunState) {
    if (this.particles.length || this.effects.length || this.floaters.length || this.flash.size || this.lineFlash > 0) return true;
    for (const b of s.bricks) if (Math.abs((this.shown.get(b.id) ?? -CELL) - b.row * CELL) > 0.5) return true;
    return false;
  }

  draw(s: RunState, shot: Shot | null, view: View, look: Look, dt: number) {
    const ctx = this.ctx;
    const k = Math.min(3, dt / 16.67);
    this.time += dt;
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
    const theme = themeOf(look.theme);
    this.background(theme, look, k);

    // The line and the launch area.
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(0, LINE + 2, W, H - LINE);
    const pulse = view.danger || view.over || this.lineFlash > 0;
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = pulse ? `rgba(255,92,122,${0.55 + 0.45 * Math.sin(this.time / 140)})` : theme.line;
    ctx.beginPath();
    ctx.moveTo(0, LINE + 1);
    ctx.lineTo(W, LINE + 1);
    ctx.stroke();
    ctx.restore();
    if (this.lineFlash > 0) this.lineFlash -= k;

    this.drawTargeting(view);

    // Rings.
    for (const r of s.rings) {
      if (r.row < 0) continue;
      const x = r.col * CELL + CELL / 2, y = r.row * CELL + CELL / 2;
      const p = look.reducedMotion ? 1 : 0.88 + 0.12 * Math.sin(this.time / 180 + r.id);
      ctx.beginPath();
      ctx.arc(x, y, 11 * p, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#B8F24A";
      ctx.shadowColor = "rgba(184,242,74,0.5)";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#B8F24A";
      ctx.font = "700 9px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+1", x, y + 0.5);
    }

    // Bricks, sliding to their rows.
    const colors = look.colorblind ? TIER_COLORS_SAFE : TIER_COLORS;
    for (const b of s.bricks) {
      const target = b.row * CELL;
      let y = this.shown.get(b.id);
      if (y === undefined) y = s.shots === 0 && s.round === s.startRound ? target : target - CELL;
      y += (target - y) * Math.min(1, (look.reducedMotion ? 0.5 : 0.22) * k);
      if (Math.abs(target - y) < 0.4) y = target;
      this.shown.set(b.id, y);
      const f = this.flash.get(b.id) ?? 0;
      this.brick(b, b.col * CELL + 2, y + 2, colors, look, f, view.digits);
      if (f > 0) {
        const nf = f - 0.12 * k;
        if (nf <= 0) this.flash.delete(b.id); else this.flash.set(b.id, nf);
      }
    }
    if (this.shown.size > s.bricks.length * 2 + 20) {
      const ids = new Set(s.bricks.map((b) => b.id));
      for (const id of this.shown.keys()) if (!ids.has(id)) this.shown.delete(id);
    }

    this.drawEffects(k);
    if (view.guide && look.guide) this.drawGuide(view.guide);
    this.drawBalls(s, shot, look);
    this.drawParticles(k);
    this.drawFloaters(k);

    // Launcher and ball count.
    if (view.showCount) {
      const left = shot ? Math.max(0, s.balls - shot.launched) : s.balls;
      const label = `×${view.digits(left)}`;
      ctx.font = "700 12px 'IBM Plex Sans', sans-serif";
      const w = ctx.measureText(label).width + 12;
      const x = Math.max(2, Math.min(W - w - 2, s.lx + 10));
      ctx.fillStyle = "rgba(11,13,26,0.85)";
      roundRect(ctx, x, FLOOR - 9, w, 16, 8);
      ctx.fill();
      ctx.fillStyle = "#EDEBF5";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + 6, FLOOR - 1);
    }
  }

  private background(theme: ThemeStyle, look: Look, k: number) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, theme.top);
    g.addColorStop(0.75, theme.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (look.reducedMotion || look.particles === 0) return;
    ctx.fillStyle = theme.dot;
    for (const d of this.dots) {
      d.y += d.v * k;
      if (d.y > LINE) { d.y = 0; d.x = Math.random() * W; }
      ctx.globalAlpha = 0.18;
      ctx.fillRect(d.x, d.y, d.s, d.s);
    }
    ctx.globalAlpha = 1;
  }

  private brick(b: RunState["bricks"][number], x: number, y: number, colors: string[], look: Look, flash: number, digits: (n: number) => string) {
    const ctx = this.ctx;
    const size = CELL - 4;
    const tier = tierOf(b.hp);
    const fill = b.type === "mystery" ? "#C9B8FF" : b.target ? "#FFD166" : colors[tier];
    roundRect(ctx, x, y, size, size, 9);
    ctx.fillStyle = fill;
    ctx.fill();
    // Colourblind mode adds a pattern per tier so health never reads by colour alone.
    if (look.colorblind && b.type !== "mystery") {
      ctx.save();
      roundRect(ctx, x, y, size, size, 9);
      ctx.clip();
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = 2;
      const p = tier % PATTERNS;
      ctx.beginPath();
      for (let i = -size; i < size * 2; i += 8) {
        if (p === 1 || p === 6) { ctx.moveTo(x + i, y); ctx.lineTo(x + i + size, y + size); }
        if (p === 2 || p === 6) { ctx.moveTo(x + i + size, y); ctx.lineTo(x + i, y + size); }
        if (p === 3) { ctx.moveTo(x, y + i); ctx.lineTo(x + size, y + i); }
        if (p === 4) { ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + size); }
      }
      ctx.stroke();
      if (p === 5) for (let i = 6; i < size; i += 9) for (let j = 6; j < size; j += 9) { ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(x + i, y + j, 2, 2); }
      ctx.restore();
    }
    // Soft highlight on top, shade at the bottom.
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    roundRect(ctx, x + 3, y + 3, size - 6, 6, 3);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x + 4, y + size - 5, size - 8, 3);
    if (b.armor > 0) {
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "#D9E2F2";
      roundRect(ctx, x + 1.5, y + 1.5, size - 3, size - 3, 8);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#7D879E";
      roundRect(ctx, x + 4.5, y + 4.5, size - 9, size - 9, 6);
      ctx.stroke();
    }
    if (b.target) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#7A4E00";
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2 - 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (b.mark) {
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#FFFFFF";
      roundRect(ctx, x - 1, y - 1, size + 2, size + 2, 10);
      ctx.stroke();
      ctx.restore();
    }
    const ink = luminance(fill) > 0.3 ? "#0B0D1A" : "#FFFFFF";
    const hasIcon = b.type !== "std" && b.type !== "armor";
    const text = digits(b.hp);
    ctx.fillStyle = ink;
    ctx.font = `800 ${text.length >= 4 ? 13 : text.length === 3 ? 15 : 18}px 'Bricolage Grotesque', 'Vazirmatn', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + size / 2, y + size / 2 - (hasIcon ? 6 : 0) + 1);
    if (hasIcon) this.icon(b.type, x + size / 2, y + size / 2 + 11, ink);
    if (b.armor > 0) {
      const label = digits(b.armor);
      ctx.font = "700 9px 'IBM Plex Sans', 'Vazirmatn', sans-serif";
      const w = Math.max(16, ctx.measureText(label).width + 6);
      ctx.fillStyle = "#D9E2F2";
      roundRect(ctx, x + size - w + 4, y - 5, w, 15, 5);
      ctx.fill();
      ctx.strokeStyle = "#0D1024";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#1A1F33";
      ctx.fillText(label, x + size - w / 2 + 4, y + 3);
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.6})`;
      roundRect(ctx, x, y, size, size, 9);
      ctx.fill();
    }
  }

  private icon(type: string, cx: number, cy: number, color: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (type === "bomb") {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, r = i % 2 ? 3 : 6.5;
        if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    } else if (type === "hlaser") {
      ctx.moveTo(cx - 9, cy); ctx.lineTo(cx + 9, cy);
      ctx.moveTo(cx - 5, cy - 4); ctx.lineTo(cx - 9, cy); ctx.lineTo(cx - 5, cy + 4);
      ctx.moveTo(cx + 5, cy - 4); ctx.lineTo(cx + 9, cy); ctx.lineTo(cx + 5, cy + 4);
      ctx.stroke();
    } else if (type === "vlaser") {
      ctx.moveTo(cx, cy - 7); ctx.lineTo(cx, cy + 7);
      ctx.moveTo(cx - 4, cy - 3); ctx.lineTo(cx, cy - 7); ctx.lineTo(cx + 4, cy - 3);
      ctx.moveTo(cx - 4, cy + 3); ctx.lineTo(cx, cy + 7); ctx.lineTo(cx + 4, cy + 3);
      ctx.stroke();
    } else if (type === "mystery") {
      ctx.font = "800 12px 'Bricolage Grotesque', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", cx, cy + 1);
    }
    ctx.restore();
  }

  private drawTargeting(view: View) {
    if (!view.targeting) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,154,98,0.55)";
    ctx.fillStyle = "rgba(255,154,98,0.16)";
    const h = view.hover;
    if (view.targeting === "hlaser") {
      for (let r = 0; r < LINE / CELL; r++) { roundRect(ctx, 3, r * CELL + 4, W - 6, CELL - 8, 9); ctx.stroke(); }
      if (h) { roundRect(ctx, 3, h.row * CELL + 4, W - 6, CELL - 8, 9); ctx.fill(); }
    } else if (view.targeting === "vlaser") {
      for (let c = 0; c < COLS; c++) { roundRect(ctx, c * CELL + 4, 3, CELL - 8, LINE - 6, 9); ctx.stroke(); }
      if (h) { roundRect(ctx, h.col * CELL + 4, 3, CELL - 8, LINE - 6, 9); ctx.fill(); }
    } else {
      roundRect(ctx, 3, 3, W - 6, LINE - 6, 12);
      ctx.stroke();
      if (h) {
        ctx.beginPath();
        ctx.arc(h.col * CELL + CELL / 2, h.row * CELL + CELL / 2, CELL * 1.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawGuide(g: NonNullable<View["guide"]>) {
    const ctx = this.ctx;
    let dist = 0, carry = 0;
    for (let i = 1; i < g.points.length; i++) {
      const a = g.points[i - 1], b = g.points[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const after = i > 1;
      for (let d = carry; d < len; d += 15) {
        const t = d / len;
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        if (y > FLOOR - 14 && i === 1) continue;
        ctx.globalAlpha = after ? Math.max(0.15, 0.7 - (dist + d) / 900) : 0.95;
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(x, y, after ? 2.2 : 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      carry = (15 - ((len - carry) % 15)) % 15;
      dist += len;
    }
    ctx.globalAlpha = 1;
    const c = g.contacts[0];
    if (c) {
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawBalls(s: RunState, shot: Shot | null, look: Look) {
    const skin = ballOf(look.ball);
    const trail = trailOf(look.trail);
    const many = (shot?.balls.length ?? 1) > 80;
    if (shot) {
      const len = look.trailLevel === 0 || !trail.colors.length ? 0 : look.trailLevel === 1 ? 4 : 9;
      shot.balls.forEach((b, i) => {
        if (len) {
          const path = (this.trails[i] ??= []);
          if (!b.done) {
            path.push({ x: b.x, y: b.y });
            if (path.length > len) path.splice(0, path.length - len);
          } else path.length = 0;
          this.drawTrail(path, trail, len);
        }
        this.ball(b.x, b.y, skin, !many);
      });
      if (shot.launched < s.balls) this.ball(s.lx, FLOOR - R, skin, true);
    } else {
      this.trails = [];
      this.ball(s.lx, FLOOR - R, skin, true);
    }
  }

  private drawTrail(path: { x: number; y: number }[], trail: TrailStyle, len: number) {
    const ctx = this.ctx;
    for (let j = 0; j < path.length - 1; j++) {
      const p = path[j], a = (j + 1) / (len + 1);
      const c = trail.colors[j % trail.colors.length];
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = c;
      if (trail.sparkle && j % 2) {
        ctx.fillRect(p.x - 1.5, p.y - 1.5 + Math.sin(this.time / 60 + j) * 2, 3, 3);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, R * (0.4 + 0.6 * a), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private ball(x: number, y: number, skin: BallSkin, glow: boolean) {
    const ctx = this.ctx;
    if (skin.stops.length > 2 || skin.stops[0] !== skin.stops[skin.stops.length - 1]) {
      const g = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, R);
      skin.stops.forEach((c, i) => g.addColorStop(i / (skin.stops.length - 1), c));
      ctx.fillStyle = g;
    } else ctx.fillStyle = skin.stops[0];
    if (glow) {
      ctx.shadowColor = skin.glow;
      ctx.shadowBlur = 8;
    }
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (skin.rim) {
      ctx.strokeStyle = skin.rim;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  private drawEffects(k: number) {
    const ctx = this.ctx;
    for (const e of this.effects) {
      const p = e.t / e.max;
      if (e.kind === "wave") {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * (1 - p * 0.7), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,154,98,${p})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = `rgba(255,154,98,${p * 0.15})`;
        ctx.fill();
      } else if (e.kind === "beamH" || e.kind === "beamV") {
        const thick = 8 + p * 10;
        ctx.shadowColor = e.kind === "beamH" ? "#FFD166" : "#4FC3F7";
        ctx.shadowBlur = 22;
        ctx.fillStyle = e.kind === "beamH" ? `rgba(255,243,176,${p})` : `rgba(201,246,255,${p})`;
        if (e.kind === "beamH") ctx.fillRect(0, e.y - thick / 2, W, thick);
        else ctx.fillRect(e.x - thick / 2, 0, thick, LINE);
        ctx.shadowBlur = 0;
      } else if (e.kind === "spark") {
        ctx.fillStyle = `rgba(255,255,255,${p * 0.7})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * (1.5 - p), 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "flashLaunch") {
        ctx.fillStyle = `rgba(255,255,255,${p * 0.5})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * (1.6 - p), 0, Math.PI * 2);
        ctx.fill();
      }
      e.t -= k;
    }
    this.effects = this.effects.filter((e) => e.t > 0);
  }

  private drawParticles(k: number) {
    const ctx = this.ctx;
    for (const p of this.particles) {
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.vy += 0.15 * k;
      p.life -= k;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private drawFloaters(k: number) {
    const ctx = this.ctx;
    for (const f of this.floaters) {
      const t = 1 - f.t / f.max;
      const ease = 1 - Math.pow(1 - t, 3);
      const x = f.x + (f.tx - f.x) * ease, y = f.y + (f.ty - f.y) * ease;
      ctx.globalAlpha = f.t / f.max < 0.25 ? (f.t / f.max) * 4 : 1;
      ctx.font = "800 13px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(11,13,26,0.8)";
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
      f.t -= k;
    }
    ctx.globalAlpha = 1;
    this.floaters = this.floaters.filter((f) => f.t > 0);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A small static picture of a board for menus (level details, daily card). */
export function boardThumb(bricks: { row: number; col: number; hp: number; type: string; target?: boolean }[], rows = 6): string[] {
  const cells: string[] = Array(rows * COLS).fill("#1A1E38");
  for (const b of bricks) {
    if (b.row >= rows) continue;
    cells[b.row * COLS + b.col] = b.target ? "#FFD166" : b.type === "mystery" ? "#C9B8FF" : TIER_COLORS[Math.min(6, tierOf(b.hp))];
  }
  return cells;
}
