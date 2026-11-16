import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { seatPoints, seatRingLength } from "../seatRing";
import { canUseWebGL } from "./context";

/** How one seat looks on the 3D table. */
export interface SeatLook {
  portrait: string;
  alive: boolean;
  /** Holds the floor: the coin grows, glows and the spotlight finds it. */
  now: boolean;
  /** Takes no part right now, or has already had their turn. */
  dim: boolean;
  /** The seat a verdict is about. */
  spot: boolean;
}

/** Where a seat's coin sits on screen, in the host element's pixels. */
export interface SeatSpot {
  x: number;
  y: number;
  /** Radius of the coin. */
  r: number;
}

export interface TableHooks {
  /** Height of the name plate under each coin, so the camera leaves room for it. */
  plate: number;
  /** The resting layout. Called again when the host is resized or the seats change. */
  onLayout(seats: SeatSpot[]): void;
  /** A CSS transform that keeps the HTML seats on their coins while the camera drifts. */
  onDrift(transform: string): void;
}

/** The front of the role card. */
export interface CardLook {
  image: string;
  name: string;
  /** Kicker above the name, such as "You are the". */
  kicker: string;
  font: string;
  dir: "ltr" | "rtl";
  accent: string;
  glow: string;
}

const TABLE_FPS = 30;
const CARD_FPS = 60;
const TABLE_Y = 1.0;
const LAMP_Y = 4.7;
const LAMP_DAY = 30;
const SEAT_Y = 1.42;
const RING_X = 3.75;
const RING_Z = 2.35;
const BASE_PHI = 1.0;
const FELT_W = 6.2;
const FELT_D = 6.2 * (356 / 834) * 1.5;
const CARD_W = 1.3;
const CARD_H = 1.82;

const isReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function stadium(w: number, d: number) {
  const r = d / 2;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -r);
  s.lineTo(w / 2 - r, -r);
  s.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-w / 2 + r, r);
  s.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  return s;
}

function roundRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** A flat card face whose texture spans the whole rounded rectangle. */
function cardFaceGeometry() {
  const g = new THREE.ShapeGeometry(roundRect(CARD_W, CARD_H, 0.1), 8);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / CARD_W + 0.5, p.getY(i) / CARD_H + 0.5);
  return g;
}

function canvasTexture(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx: canvas.getContext("2d")!, texture };
}

function glowTexture() {
  const { ctx, texture } = canvasTexture(128, 128);
  const r = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,210,140,1)");
  r.addColorStop(0.35, "rgba(255,180,90,.45)");
  r.addColorStop(1, "rgba(255,160,60,0)");
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, 128, 128);
  return texture;
}

interface Seat {
  root: THREE.Group;
  bill: THREE.Group;
  flip: THREE.Group;
  front: THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial>;
  back: THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial>;
  halo: THREE.Sprite;
  base: THREE.Vector3;
  portrait: string;
  scale: number;
}

/**
 * The 3D Mafia table: a wooden table with the painted felt, a hanging lamp and gold-coin seats, and
 * the role card. One renderer and one canvas live for the whole game; the canvas moves into
 * whichever screen is showing, so a phase change never makes a new WebGL context.
 */
export class TableWorld {
  readonly canvas = document.createElement("canvas");
  /** Set when the GPU drops the context; the app falls back to the flat table. */
  onLost: (() => void) | null = null;

  private renderer: THREE.WebGLRenderer;
  private loader = new THREE.TextureLoader();
  private textures = new Map<string, THREE.Texture>();
  private waiting = new Map<string, (() => void)[]>();
  private greyTextures = new Map<string, THREE.Texture>();
  private env: THREE.Texture;
  private glow = glowTexture();
  private reduced = isReducedMotion();

  private host: HTMLElement | null = null;
  private mode: "table" | "card" | null = null;
  private hooks: TableHooks | null = null;
  private observer = new ResizeObserver(() => this.resize());
  private w = 0;
  private h = 0;
  private raf = 0;
  private lastDrawn = 0;

  // ---- table ----
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(24, 1, 0.1, 140);
  private target = new THREE.Vector3(0, 1.1, 0);
  private dist = 10;
  private offX = 0;
  private offY = 0;
  private seats: Seat[] = [];
  private coinR = 0.42;
  private coinGeo = { body: new THREE.CylinderGeometry(1, 1, 1, 48, 1, true), ring: new THREE.TorusGeometry(1, 0.075, 10, 48), face: new THREE.CircleGeometry(1, 48) };
  private brass = new THREE.MeshStandardMaterial({ color: 0xc9a25a, metalness: 1, roughness: 0.3 });
  private night = false;
  private nightK = 0;
  private spotIndex = -1;
  private baseSpots: SeatSpot[] = [];
  private lastDrift = "";
  private hemi = new THREE.HemisphereLight(0xffe2b8, 0x140a05, 0.45);
  private fill = new THREE.DirectionalLight(0xffd0a0, 0.55);
  private lamp = new THREE.SpotLight(0xffc27a, LAMP_DAY, 16, 0.8, 0.55, 1.6);
  private moon = new THREE.DirectionalLight(0x8fb0ff, 0);
  private speakerSpot = new THREE.SpotLight(0xffd59a, 0, 14, 0.24, 0.6, 1.4);
  private lampGroup = new THREE.Group();
  private bulb = new THREE.MeshBasicMaterial({ color: 0xffe0a8 });
  private lampGlow: THREE.Sprite;
  private dust: { geo: THREE.BufferGeometry; pos: Float32Array; seed: Float32Array; mat: THREE.PointsMaterial };

  // ---- role card ----
  private cardScene = new THREE.Scene();
  private cardCamera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private card = new THREE.Group();
  private cardFront = canvasTexture(512, 716);
  private cardBack = canvasTexture(512, 716);
  private cardShown = false;
  private cardAngle = Math.PI;
  private cardEnter = 0;
  private cardLook: CardLook | null = null;
  private cardKey = "";

  private constructor() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: "default" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas.className = "table-gl";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.addEventListener("webglcontextlost", this.lost);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();

    this.lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
    this.dust = this.makeDust();
    this.buildTable();
    this.buildCard();
  }

  /** Makes the world, or returns null when this device has no usable WebGL. */
  static create(): TableWorld | null {
    if (!canUseWebGL()) return null;
    try {
      return new TableWorld();
    } catch {
      return null;
    }
  }

  /** Loads the art up front, so the table never appears half drawn. */
  preload(urls: string[]) {
    return Promise.all(urls.map((url) => new Promise<void>((resolve) => {
      this.texture(url, resolve);
      window.setTimeout(resolve, 10_000);
    }))).then(() => undefined);
  }

  // ------------------------------------------------------------------ hosts

  /** Shows the table inside `host`, behind its HTML seats. */
  attachTable(host: HTMLElement, hooks: TableHooks) {
    this.attach(host, "table");
    this.hooks = hooks;
    this.resize();
  }

  /** Shows the role card inside `host`. */
  attachCard(host: HTMLElement, look: CardLook, shown: boolean) {
    this.attach(host, "card");
    this.cardEnter = this.reduced ? 1 : 0;
    this.cardShown = shown;
    this.cardAngle = shown ? 0 : Math.PI;
    this.setCardLook(look);
    this.resize();
  }

  detach(host: HTMLElement) {
    if (this.host !== host) return;
    this.observer.disconnect();
    this.canvas.remove();
    this.host = null;
    this.mode = null;
    this.hooks = null;
    this.lastDrift = "";
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose() {
    if (this.host) this.detach(this.host);
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    for (const tex of [...this.textures.values(), ...this.greyTextures.values()]) tex.dispose();
    this.env.dispose();
    this.renderer.dispose();
  }

  private attach(host: HTMLElement, mode: "table" | "card") {
    if (this.host && this.host !== host) this.detach(this.host);
    this.host = host;
    this.mode = mode;
    host.prepend(this.canvas);
    this.observer.disconnect();
    this.observer.observe(host);
    this.lastDrawn = 0;
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  private lost = (event: Event) => {
    event.preventDefault();
    if (this.host) this.detach(this.host);
    this.onLost?.();
  };

  /** The texture for `url`, loading it once. `onLoad` runs when it has loaded (or failed), or now if it already has. */
  private texture(url: string, onLoad?: () => void) {
    let tex = this.textures.get(url);
    if (!tex) {
      this.waiting.set(url, []);
      const done = () => {
        const queue = this.waiting.get(url) ?? [];
        this.waiting.delete(url);
        for (const run of queue) run();
      };
      tex = this.loader.load(url, done, undefined, done);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      this.textures.set(url, tex);
    }
    if (onLoad) {
      const queue = this.waiting.get(url);
      if (queue) queue.push(onLoad);
      else onLoad();
    }
    return tex;
  }

  /** The portrait in grey with a red cross, for the back of an eliminated player's coin. */
  private greyTexture(url: string) {
    let grey = this.greyTextures.get(url);
    if (grey) return grey;
    const { ctx, texture } = canvasTexture(192, 192);
    grey = texture;
    this.greyTextures.set(url, grey);
    const draw = () => {
      const image = this.textures.get(url)?.image as CanvasImageSource | undefined;
      if (!image) return;
      ctx.drawImage(image, 0, 0, 192, 192);
      try {
        const data = ctx.getImageData(0, 0, 192, 192);
        for (let i = 0; i < data.data.length; i += 4) {
          const l = (data.data[i] * 0.3 + data.data[i + 1] * 0.59 + data.data[i + 2] * 0.11) * 0.45;
          data.data[i] = data.data[i + 1] = data.data[i + 2] = l;
        }
        ctx.putImageData(data, 0, 0);
      } catch {
        ctx.fillStyle = "rgba(20,16,12,.7)";
        ctx.fillRect(0, 0, 192, 192);
      }
      ctx.strokeStyle = "#d23a30";
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(52, 52);
      ctx.lineTo(140, 140);
      ctx.moveTo(140, 52);
      ctx.lineTo(52, 140);
      ctx.stroke();
      texture.needsUpdate = true;
    };
    this.texture(url, draw);
    return grey;
  }

  // ------------------------------------------------------------------ table

  private buildTable() {
    const s = this.scene;
    s.environment = this.env;
    s.environmentIntensity = 0.35;
    this.fill.position.set(0, 5, 9);
    this.lamp.position.set(0, LAMP_Y - 0.15, 0);
    this.lamp.target.position.set(0, TABLE_Y, 0);
    this.lamp.castShadow = true;
    this.lamp.shadow.mapSize.set(1024, 1024);
    this.lamp.shadow.bias = -0.0004;
    this.moon.position.set(-7, 5, 2);
    this.speakerSpot.position.set(0, 6, 4);
    s.add(this.hemi, this.fill, this.lamp, this.lamp.target, this.moon, this.speakerSpot, this.speakerSpot.target);

    // Shadows fall on an invisible floor, over the painted room behind the canvas.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.ShadowMaterial({ opacity: 0.55 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);

    // The painted felt laid flat, stretched so the camera's own tilt restores the painting's look.
    const felt = new THREE.Mesh(new THREE.PlaneGeometry(FELT_W, FELT_D), new THREE.MeshStandardMaterial({ map: this.texture("/images/mafia-table/table.webp"), alphaTest: 0.5, roughness: 0.9 }));
    felt.rotation.x = -Math.PI / 2;
    felt.position.y = TABLE_Y + 0.02;
    felt.receiveShadow = true;
    s.add(felt);

    const wood = new THREE.MeshStandardMaterial({ color: 0x2b130b, roughness: 0.42, metalness: 0.1 });
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(stadium(5.85, 3.25), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 3, curveSegments: 40 }), wood);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, TABLE_Y - 0.05, -0.08);
    body.castShadow = true;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, TABLE_Y - 0.08, 32), wood);
    post.position.y = (TABLE_Y - 0.08) / 2;
    post.castShadow = true;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 0.08, 40), wood);
    foot.position.y = 0.04;
    s.add(body, post, foot);

    // The hanging lamp: high enough to clear the far seats, so it reads as the light over the table.
    this.lampGroup.position.set(0, LAMP_Y, 0);
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.75, 0.42, 40, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x0f4a2a, roughness: 0.35, metalness: 0.25, side: THREE.DoubleSide, emissive: 0x0a3a1e, emissiveIntensity: 0.4 }),
    );
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.018, 8, 64), this.brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.21;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 6, 6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    cord.position.y = 3.2;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), this.bulb);
    bulb.position.y = -0.12;
    this.lampGlow.scale.set(1.6, 1.6, 1);
    this.lampGlow.position.y = -0.2;
    this.lampGroup.add(shade, rim, cord, bulb, this.lampGlow);
    s.add(this.lampGroup, new THREE.Points(this.dust.geo, this.dust.mat));
  }

  private makeDust() {
    const count = this.reduced ? 0 : 180;
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 7;
      pos[i * 3 + 1] = 1.1 + Math.random() * 2.6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4.5;
      seed[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ size: 0.035, map: this.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a0, opacity: 0.85 });
    return { geo, pos, seed, mat };
  }

  /** Seats the players. Cheap to call on every render: only what changed is touched. */
  setSeats(looks: SeatLook[]) {
    if (looks.length !== this.seats.length) this.buildSeats(looks.length);
    let relayout = false;
    looks.forEach((look, i) => {
      const seat = this.seats[i];
      if (seat.portrait !== look.portrait) {
        seat.portrait = look.portrait;
        const tex = this.texture(look.portrait);
        seat.front.material.map = tex;
        seat.front.material.emissiveMap = tex;
        seat.front.material.needsUpdate = true;
        seat.back.material.map = this.greyTexture(look.portrait);
        seat.back.material.needsUpdate = true;
      }
      const scale = look.now ? 1.14 : 1;
      if (scale !== seat.scale) {
        seat.scale = scale;
        relayout = true;
      }
      seat.root.userData = look;
    });
    this.spotIndex = looks.findIndex((l) => l.now) >= 0 ? looks.findIndex((l) => l.now) : looks.findIndex((l) => l.spot);
    if (relayout) this.emitLayout();
  }

  setNight(night: boolean) {
    this.night = night;
  }

  private buildSeats(count: number) {
    for (const seat of this.seats) this.scene.remove(seat.root);
    for (const seat of this.seats) {
      seat.front.material.dispose();
      seat.back.material.dispose();
      (seat.halo.material as THREE.SpriteMaterial).dispose();
    }
    const spacing = seatRingLength(RING_X, RING_Z) / Math.max(1, count);
    this.coinR = Math.min(0.42, spacing * 0.36);
    const r = this.coinR;
    this.seats = seatPoints(count, RING_X, RING_Z).map(([x, z]) => {
      const root = new THREE.Group();
      root.position.set(x, SEAT_Y, z);
      const bill = new THREE.Group();
      const flip = new THREE.Group();
      root.add(bill);
      bill.add(flip);
      const side = new THREE.Mesh(this.coinGeo.body, this.brass);
      side.scale.set(r + 0.02, 0.06, r + 0.02);
      side.rotation.x = Math.PI / 2;
      side.castShadow = true;
      const ringF = new THREE.Mesh(this.coinGeo.ring, this.brass);
      ringF.scale.setScalar(r + 0.005);
      ringF.position.z = 0.03;
      const ringB = ringF.clone();
      ringB.position.z = -0.03;
      const front = new THREE.Mesh(this.coinGeo.face, new THREE.MeshStandardMaterial({ roughness: 0.65, emissive: 0xffffff, emissiveIntensity: 0.22 }));
      front.scale.setScalar(r);
      front.position.z = 0.031;
      const back = new THREE.Mesh(this.coinGeo.face, new THREE.MeshStandardMaterial({ roughness: 0.8 }));
      back.scale.setScalar(r);
      back.rotation.x = Math.PI;
      back.position.z = -0.031;
      flip.add(side, ringF, ringB, front, back);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
      halo.scale.setScalar(r * 5);
      halo.position.z = -0.08;
      bill.add(halo);
      this.scene.add(root);
      return { root, bill, flip, front, back, halo, base: root.position.clone(), portrait: "", scale: 1 };
    });
    this.fit();
  }

  private pose(dist: number, theta: number, phi: number) {
    const offset = new THREE.Vector3().setFromSphericalCoords(dist, phi, theta);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  private project(point: THREE.Vector3, out: SeatSpot, radius: number) {
    const centre = point.clone().project(this.camera);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).multiplyScalar(radius).add(point).project(this.camera);
    out.x = (centre.x * 0.5 + 0.5) * this.w;
    out.y = (-centre.y * 0.5 + 0.5) * this.h;
    out.r = Math.hypot((right.x - centre.x) * 0.5 * this.w, (right.y - centre.y) * 0.5 * this.h);
    return out;
  }

  /** Finds the camera distance that fits every seat, its badges and its name plate in the host. */
  private fit() {
    if (!this.w || !this.h || !this.seats.length) return;
    const plate = this.hooks?.plate ?? 30;
    const pad = 8;
    this.camera.clearViewOffset();
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    const spot: SeatSpot = { x: 0, y: 0, r: 0 };
    const box = (dist: number) => {
      this.pose(dist, 0, BASE_PHI);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const seat of this.seats) {
        this.project(seat.base, spot, this.coinR * 1.14);
        minX = Math.min(minX, spot.x - spot.r * 1.2);
        maxX = Math.max(maxX, spot.x + spot.r * 1.2);
        minY = Math.min(minY, spot.y - spot.r * 1.3);
        maxY = Math.max(maxY, spot.y + spot.r + plate);
      }
      return { minX, maxX, minY, maxY };
    };
    let lo = 4;
    let hi = 60;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const b = box(mid);
      if (b.maxX - b.minX <= this.w - 2 * pad && b.maxY - b.minY <= this.h - 2 * pad) hi = mid;
      else lo = mid;
    }
    this.dist = hi;
    const b = box(hi);
    this.offX = (b.minX + b.maxX) / 2 - this.w / 2;
    this.offY = (b.minY + b.maxY) / 2 - this.h / 2;
    this.camera.setViewOffset(this.w, this.h, this.offX, this.offY, this.w, this.h);
    this.emitLayout();
  }

  private emitLayout() {
    if (this.mode !== "table" || !this.hooks || !this.w) return;
    this.pose(this.dist, 0, BASE_PHI);
    this.baseSpots = this.seats.map((seat) => this.project(seat.base, { x: 0, y: 0, r: 0 }, this.coinR * seat.scale));
    this.lastDrift = "";
    this.hooks.onLayout(this.baseSpots.map((s) => ({ ...s })));
  }

  /** The scale and shift that best carry the resting seat positions onto where the coins are now. */
  private drift() {
    const n = this.baseSpots.length;
    if (!this.hooks || !n) return;
    const now = this.seats.map((seat) => this.project(seat.base, { x: 0, y: 0, r: 0 }, 0));
    let px = 0, py = 0, qx = 0, qy = 0;
    for (let i = 0; i < n; i++) {
      px += this.baseSpots[i].x;
      py += this.baseSpots[i].y;
      qx += now[i].x;
      qy += now[i].y;
    }
    px /= n; py /= n; qx /= n; qy /= n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      const ax = this.baseSpots[i].x - px, ay = this.baseSpots[i].y - py;
      num += ax * (now[i].x - qx) + ay * (now[i].y - qy);
      den += ax * ax + ay * ay;
    }
    const s = den > 0 ? num / den : 1;
    const transform = `matrix(${s.toFixed(4)},0,0,${s.toFixed(4)},${(qx - s * px).toFixed(1)},${(qy - s * py).toFixed(1)})`;
    if (transform !== this.lastDrift) {
      this.lastDrift = transform;
      this.hooks.onDrift(transform);
    }
  }

  private updateTable(now: number, dt: number) {
    const k = Math.min(1, dt * 2.2);
    this.nightK += ((this.night ? 1 : 0) - this.nightK) * k;
    const n = this.nightK;
    const lerp = THREE.MathUtils.lerp;
    this.lamp.intensity = lerp(LAMP_DAY, LAMP_DAY * 0.32, n);
    this.lamp.color.setRGB(1, lerp(0.76, 0.6, n), lerp(0.48, 0.32, n));
    this.bulb.color.setRGB(1, lerp(0.88, 0.65, n), lerp(0.66, 0.35, n));
    (this.lampGlow.material as THREE.SpriteMaterial).opacity = lerp(0.8, 0.5, n);
    this.hemi.intensity = lerp(0.45, 0.12, n);
    this.fill.intensity = lerp(0.55, 0.14, n);
    this.moon.intensity = lerp(0, 1.3, n);
    this.scene.environmentIntensity = lerp(0.35, 0.12, n);
    this.dust.mat.color.setRGB(lerp(1, 0.72, n), lerp(0.85, 0.8, n), lerp(0.63, 1, n));

    // A slow drift, and a lean in when night falls.
    const theta = this.reduced ? 0 : Math.sin(now / 5200) * 0.07;
    this.pose(this.dist * (1 - 0.05 * n), theta, BASE_PHI + 0.03 * n);
    this.drift();

    const step = Math.min(1, dt * 6);
    this.seats.forEach((seat, i) => {
      const look = seat.root.userData as SeatLook | undefined;
      if (!look) return;
      seat.bill.quaternion.copy(this.camera.quaternion);
      seat.root.scale.setScalar(seat.root.scale.x + (seat.scale - seat.root.scale.x) * step);
      const flipped = !look.alive && !look.now;
      seat.flip.rotation.x += ((flipped ? Math.PI : 0) - seat.flip.rotation.x) * Math.min(1, dt * 4.5);
      const dimmed = look.dim && !look.now;
      seat.front.material.emissiveIntensity += ((dimmed ? 0.06 : 0.22) - seat.front.material.emissiveIntensity) * step;
      seat.front.material.color.setScalar(dimmed ? 0.55 : 1);
      const lit = look.now || look.spot;
      const pulse = this.reduced ? 0 : Math.sin(now / 260) * 0.12;
      const halo = seat.halo.material as THREE.SpriteMaterial;
      halo.color.set(look.spot && !look.now ? 0xff6a50 : 0xffffff);
      halo.opacity += ((lit ? 0.55 + pulse : 0) - halo.opacity) * step;
      if (i === this.spotIndex) this.speakerSpot.target.position.lerp(seat.root.position, step);
    });
    this.speakerSpot.intensity += ((this.spotIndex >= 0 ? 26 : 0) - this.speakerSpot.intensity) * Math.min(1, dt * 3);

    const { pos, seed, geo } = this.dust;
    for (let i = 0; i < seed.length; i++) {
      pos[i * 3 + 1] += Math.sin(now / 1700 + seed[i]) * 0.0018 + 0.0012;
      pos[i * 3] += Math.cos(now / 2300 + seed[i]) * 0.0016;
      if (pos[i * 3 + 1] > 3.8) pos[i * 3 + 1] = 1.1;
    }
    if (seed.length) geo.attributes.position.needsUpdate = true;
    this.lampGroup.rotation.z = this.reduced ? 0 : Math.sin(now / 1900) * 0.012;
  }

  // ------------------------------------------------------------------ role card

  private buildCard() {
    const s = this.cardScene;
    s.environment = this.env;
    s.environmentIntensity = 0.6;
    const key = new THREE.DirectionalLight(0xffe6c0, 1.4);
    key.position.set(2, 3, 5);
    s.add(new THREE.HemisphereLight(0xffe2b8, 0x140a05, 0.6), key);
    const edge = new THREE.Mesh(new THREE.ExtrudeGeometry(roundRect(CARD_W, CARD_H, 0.1), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 8 }), this.brass);
    edge.geometry.translate(0, 0, -0.015);
    const faceGeo = cardFaceGeometry();
    const front = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: this.cardFront.texture, roughness: 0.45, metalness: 0.1, emissive: 0xffffff, emissiveMap: this.cardFront.texture, emissiveIntensity: 0.5 }));
    front.position.z = 0.0235;
    const back = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: this.cardBack.texture, roughness: 0.45, metalness: 0.1, emissive: 0xffffff, emissiveMap: this.cardBack.texture, emissiveIntensity: 0.45 }));
    back.rotation.y = Math.PI;
    back.position.z = -0.0235;
    this.card.add(edge, front, back);
    s.add(this.card);
    this.drawCardBack();
  }

  setCardShown(shown: boolean) {
    this.cardShown = shown;
    if (this.reduced) this.cardAngle = shown ? 0 : Math.PI;
  }

  setCardLook(look: CardLook) {
    const key = JSON.stringify(look);
    if (key === this.cardKey) return;
    this.cardKey = key;
    this.cardLook = look;
    this.drawCardFront();
    // Draw again once the role art and the card's font have arrived.
    const redraw = () => {
      if (this.cardKey === key) this.drawCardFront();
    };
    void document.fonts?.load(`700 60px ${look.font}`).then(redraw).catch(() => undefined);
    this.texture(look.image, redraw);
  }

  private drawFrame(g: CanvasRenderingContext2D, w: number, h: number) {
    g.strokeStyle = "#c9a25a";
    g.lineWidth = 5;
    g.strokeRect(16, 16, w - 32, h - 32);
    g.lineWidth = 1.5;
    g.strokeRect(30, 30, w - 60, h - 60);
  }

  private drawCardBack() {
    const { ctx: g, canvas, texture } = this.cardBack;
    const { width: w, height: h } = canvas;
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#2a1b11");
    bg.addColorStop(1, "#0c0806");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    for (let k = 0; k < 72; k++) {
      g.rotate(Math.PI / 36);
      g.strokeStyle = k % 2 ? "rgba(201,162,90,.18)" : "rgba(201,162,90,.4)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 120);
      g.lineTo(0, 420);
      g.stroke();
    }
    g.fillStyle = "#120c08";
    g.beginPath();
    g.arc(0, 0, 118, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#c9a25a";
    g.lineWidth = 4;
    g.stroke();
    g.beginPath();
    g.arc(0, 0, 104, 0, Math.PI * 2);
    g.lineWidth = 1.5;
    g.stroke();
    // A crescent moon: the night every game starts with, and no letters to translate.
    g.fillStyle = "#f1d79a";
    g.beginPath();
    g.arc(0, 0, 62, 0, Math.PI * 2);
    g.arc(24, -18, 54, 0, Math.PI * 2, true);
    g.fill("evenodd");
    g.restore();
    this.drawFrame(g, w, h);
    texture.needsUpdate = true;
  }

  private drawCardFront() {
    const look = this.cardLook;
    if (!look) return;
    const { ctx: g, canvas, texture } = this.cardFront;
    const { width: w, height: h } = canvas;
    const bg = g.createRadialGradient(w / 2, 260, 20, w / 2, 300, 520);
    bg.addColorStop(0, look.glow);
    bg.addColorStop(1, "#0d0907");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const image = this.textures.get(look.image)?.image as CanvasImageSource | undefined;
    if (image) {
      const art = document.createElement("canvas");
      art.width = art.height = 440;
      const a = art.getContext("2d")!;
      a.drawImage(image, 0, 0, 440, 440);
      a.globalCompositeOperation = "destination-in";
      const mask = a.createRadialGradient(220, 220, 150, 220, 220, 220);
      mask.addColorStop(0, "#000");
      mask.addColorStop(1, "rgba(0,0,0,0)");
      a.fillStyle = mask;
      a.fillRect(0, 0, 440, 440);
      g.drawImage(art, 36, 40);
    }
    // Canvas text is shaped by the browser, so Persian joins and runs right to left on the card too.
    g.direction = look.dir;
    g.textAlign = "center";
    g.fillStyle = "#cdbfa6";
    g.font = `500 26px ${look.font}`;
    g.fillText(look.kicker, w / 2, 532);
    g.fillStyle = look.accent;
    let size = 64;
    g.font = `700 ${size}px ${look.font}`;
    while (size > 30 && g.measureText(look.name).width > w - 90) {
      size -= 4;
      g.font = `700 ${size}px ${look.font}`;
    }
    g.fillText(look.name, w / 2, 600);
    g.strokeStyle = "#7a5a2a";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(150, 636);
    g.lineTo(362, 636);
    g.stroke();
    g.fillStyle = "#c9a25a";
    g.beginPath();
    g.moveTo(256, 626);
    g.lineTo(266, 636);
    g.lineTo(256, 646);
    g.lineTo(246, 636);
    g.fill();
    this.drawFrame(g, w, h);
    texture.needsUpdate = true;
  }

  private updateCard(now: number, dt: number) {
    const aspect = this.w / this.h;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.cardCamera.fov / 2));
    const fitH = CARD_H / 2 / tan / 0.9;
    const fitW = CARD_W / 2 / (tan * aspect) / 0.9;
    this.cardCamera.position.set(0, 0, Math.max(fitH, fitW));
    this.cardCamera.lookAt(0, 0, 0);

    this.cardEnter = Math.min(1, this.cardEnter + dt / 0.9);
    const e = 1 - Math.pow(1 - this.cardEnter, 3);
    const goal = this.cardShown ? 0 : Math.PI;
    this.cardAngle += (goal - this.cardAngle) * Math.min(1, dt * 7);
    const turning = Math.abs(goal - this.cardAngle) / Math.PI;
    const idle = this.reduced ? 0 : 1;
    this.card.position.set(0, (1 - e) * -2.4 + Math.sin(now / 700) * 0.03 * idle, Math.sin(turning * Math.PI) * 0.35);
    this.card.rotation.set(Math.sin(now / 1300) * 0.05 * idle + (1 - e) * 0.9, this.cardAngle + Math.sin(now / 1700) * 0.08 * idle + (1 - e) * Math.PI, 0);
  }

  // ------------------------------------------------------------------ loop

  private resize() {
    if (!this.host) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    if (this.mode === "table") {
      this.fit();
    } else {
      this.cardCamera.aspect = w / h;
      this.cardCamera.updateProjectionMatrix();
    }
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    if (!this.host || !this.w || document.hidden) return;
    const fps = this.mode === "card" ? CARD_FPS : TABLE_FPS;
    if (this.lastDrawn && now - this.lastDrawn < 1000 / fps - 2) return;
    const dt = this.lastDrawn ? Math.min(0.1, (now - this.lastDrawn) / 1000) : 1 / fps;
    this.lastDrawn = now;
    if (this.mode === "table") {
      this.updateTable(now, dt);
      this.renderer.render(this.scene, this.camera);
    } else if (this.mode === "card") {
      this.updateCard(now, dt);
      this.renderer.render(this.cardScene, this.cardCamera);
    }
  };
}
