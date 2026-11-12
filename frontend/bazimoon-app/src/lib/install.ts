import { useEffect, useState } from "react";
import { isStandalone } from "./platform";

/** Chrome's install event (not in the TypeScript DOM library yet). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

// Chrome fires this once, early; keep it so the Install button can show the prompt later.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  listeners.forEach((l) => l());
});
window.addEventListener("appinstalled", () => {
  deferred = null;
  listeners.forEach((l) => l());
});

/**
 * How this device installs the app right now:
 * - `installed`: already running from the home screen.
 * - `prompt`: the browser has its own one-tap install dialog (Chrome, Edge, most Android browsers).
 * - anything else names the step-by-step guide to show, because the browser has no install dialog.
 */
export type InstallMode = "installed" | "prompt" | InstallGuide;

/**
 * - `ios`: Safari on iPhone/iPad up to iOS 18 (Share button in the toolbar).
 * - `ios26`: Safari on iOS 26 and later (Share lives in the ••• menu next to the address bar).
 * - `iosOther`: Chrome, Edge, Firefox… on iPhone (Share is in the address bar or the menu).
 * - `inApp`: Telegram, Instagram and other apps' built-in browsers, which can't install apps.
 * - `android`: Chrome-like Android browsers before (or without) their install dialog.
 * - `samsung`: Samsung Internet.
 * - `mac`: Safari on a Mac (File › Add to Dock).
 * - `desktop`: other desktop browsers.
 */
export type InstallGuide = "ios" | "ios26" | "iosOther" | "inApp" | "android" | "samsung" | "mac" | "desktop";

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Telegram|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|BytedanceWebview|Twitter|LinkedInApp|Pinterest|GSA\/|; wv\)/i;

export function installGuide(ua = navigator.userAgent): InstallGuide {
  const iPadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || iPadOs;
  if (IN_APP.test(ua)) return "inApp";
  if (ios) {
    if (/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/.test(ua)) return "iosOther";
    // iOS 26 Safari freezes the OS version in its user agent, but its own Version/ keeps counting.
    const safari = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0);
    if (!/Safari\//.test(ua)) return "inApp"; // a web view inside another app
    return safari >= 26 ? "ios26" : "ios";
  }
  if (/Android/.test(ua)) return /SamsungBrowser/.test(ua) ? "samsung" : "android";
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|Firefox/.test(ua)) return "mac";
  return "desktop";
}

/** iPad's Safari keeps its Share button at the top; iPhone's is at the bottom. */
export function isIpad(ua = navigator.userAgent) {
  return /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function currentMode(): InstallMode {
  if (isStandalone()) return "installed";
  const guide = installGuide();
  if (guide === "inApp") return guide;
  if (deferred) return "prompt";
  return guide;
}

/** How this device can install the app right now. */
export function useInstallMode(): InstallMode {
  const [mode, setMode] = useState(currentMode);
  useEffect(() => {
    const update = () => setMode(currentMode());
    listeners.add(update);
    return () => void listeners.delete(update);
  }, []);
  return mode;
}

/** Shows the browser's own install dialog; returns whether the player accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  listeners.forEach((l) => l());
  return outcome === "accepted";
}
