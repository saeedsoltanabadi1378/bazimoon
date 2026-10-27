/** Browser and installed-app (PWA) helpers: theme colour, sharing, vibration, display mode. */

/** The app never zooms: no pinch, no double-tap and no ctrl+wheel. */
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

export function initAppShell() {
  preventZoom();
}

/** Colours the browser / installed-app status bar to match the current screen. */
export function setThemeColor(color: string) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = color;
  document.documentElement.style.backgroundColor = color;
}

/** True when running as an installed app rather than in a browser tab. */
export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export type ShareOutcome = "shared" | "copied" | "failed";

/** Opens the system share sheet with a link and message, or copies the link where sharing isn't available. */
export async function shareLink(url: string, text: string): Promise<ShareOutcome> {
  if (navigator.share) {
    try {
      await navigator.share({ url, text });
      return "shared";
    } catch (err) {
      // Closing the share sheet is not a failure; anything else falls back to copying.
      if (err instanceof DOMException && err.name === "AbortError") return "shared";
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Short vibration patterns; iOS Safari has no vibration API, so these do nothing there. */
export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Some browsers throw when vibration is blocked by permissions policy.
  }
}
