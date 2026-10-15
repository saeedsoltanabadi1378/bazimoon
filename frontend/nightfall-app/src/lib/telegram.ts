export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

type HapticImpact = "light" | "medium" | "heavy" | "rigid" | "soft";
type HapticNotification = "error" | "success" | "warning";

interface TelegramBackButton {
  isVisible: boolean;
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
    chat?: { id: number };
  };
  version?: string;
  colorScheme: "light" | "dark";
  ready(): void;
  expand(): void;
  close(): void;
  isVersionAtLeast?(version: string): boolean;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  setBottomBarColor?(color: string): void;
  disableVerticalSwipes?(): void;
  enableVerticalSwipes?(): void;
  openTelegramLink?(url: string): void;
  openLink?(url: string): void;
  BackButton?: TelegramBackButton;
  HapticFeedback?: {
    impactOccurred(style: HapticImpact): void;
    notificationOccurred(type: HapticNotification): void;
    selectionChanged(): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

/**
 * Outside Telegram (plain browser dev), window.Telegram is undefined. This mock lets the app
 * render for local UI development — it can't produce a real initData signature (that requires
 * the bot's secret token), so auth against a real backend will correctly 401 unless the backend
 * is configured with a matching known dev bot token and this initData is generated to match
 * (see the frontend README / Phase 5 smoke-test notes for how to do that for a genuine E2E check).
 */
function createMockWebApp(): TelegramWebApp {
  console.warn("[Nightfall] Not running inside Telegram — using a mock WebApp for local UI development.");
  const params = new URLSearchParams(window.location.search);
  return {
    initData: params.get("mockInitData") ?? "",
    initDataUnsafe: {
      user: { id: 111111111, first_name: "Dev", username: "dev_user" },
      start_param: params.get("gameId") ?? params.get("startapp") ?? undefined,
    },
    colorScheme: "dark",
    ready() {},
    expand() {},
    close() {
      console.warn("[Nightfall] WebApp.close() called (mock).");
    },
  };
}

function resolveWebApp(): TelegramWebApp {
  const params = new URLSearchParams(window.location.search);
  // An explicit dev override always wins, since the real telegram-web-app.js script defines
  // window.Telegram.WebApp even outside an actual Telegram client — as an inert stub with an
  // empty initData — so a plain `?? createMockWebApp()` fallback would never actually trigger.
  if (params.has("mockInitData") || params.has("gameId") || params.has("startapp")) {
    return createMockWebApp();
  }

  const real = window.Telegram?.WebApp;
  return real?.initData ? real : createMockWebApp();
}

export const telegram: TelegramWebApp = resolveWebApp();

/** True only inside a real Telegram client (initData is signed there). */
export const isInsideTelegram = Boolean(window.Telegram?.WebApp?.initData);

function supports(version: string) {
  return telegram.isVersionAtLeast?.(version) ?? false;
}

/** One-time setup: tell Telegram we're ready, go full height, and stop swipe-to-close stealing drags. */
/** The Mini App never zooms: no pinch, no double-tap and no ctrl+wheel (Telegram Desktop). */
function preventZoom() {
  const stop = (e: Event) => e.preventDefault();
  // iOS ignores user-scalable=no, so cancel its gesture events too.
  document.addEventListener("gesturestart", stop, { passive: false });
  document.addEventListener("gesturechange", stop, { passive: false });
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  window.addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) e.preventDefault();
  });
}

export function initTelegramShell() {
  preventZoom();
  try {
    telegram.ready();
    telegram.expand();
    if (supports("7.7")) telegram.disableVerticalSwipes?.();
  } catch (err) {
    console.warn("[Nightfall] Telegram shell setup failed", err);
  }
}

/** Matches Telegram's header and background to the current screen so the app feels edge to edge. */
export function setTelegramColors(color: string) {
  try {
    if (supports("6.1")) {
      telegram.setHeaderColor?.(color);
      telegram.setBackgroundColor?.(color);
    }
    if (supports("7.10")) telegram.setBottomBarColor?.(color);
  } catch {
    // Older clients reject custom colors; the app still works with Telegram's defaults.
  }
}

export function showBackButton(onBack: () => void): () => void {
  const back = supports("6.1") ? telegram.BackButton : undefined;
  if (!back) return () => {};
  back.onClick(onBack);
  back.show();
  return () => {
    back.offClick(onBack);
    back.hide();
  };
}

/** Opens Telegram's "share to chat" picker with a link and message. */
export function shareToTelegram(url: string, text: string) {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (telegram.openTelegramLink) {
    telegram.openTelegramLink(shareUrl);
  } else {
    window.open(shareUrl, "_blank", "noopener");
  }
}

export function openTelegramLink(url: string) {
  if (telegram.openTelegramLink) telegram.openTelegramLink(url);
  else window.open(url, "_blank", "noopener");
}
