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

export type InstallMode = "prompt" | "ios" | "installed" | "unsupported";

function currentMode(): InstallMode {
  if (isStandalone()) return "installed";
  if (deferred) return "prompt";
  // iOS has no install event; players add the app from Safari's share sheet.
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "ios";
  return "unsupported";
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
