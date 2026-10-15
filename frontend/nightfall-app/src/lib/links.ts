/** Public link to the Mini App, optionally deep-linking with a start parameter. */
export function botLink(startParam?: string) {
  const base = import.meta.env.VITE_MINI_APP_URL?.replace(/\/$/, "");
  if (!base) {
    const url = new URL(window.location.href);
    url.search = startParam ? `?startapp=${encodeURIComponent(startParam)}` : "";
    return url.toString();
  }
  return startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base;
}

/** "Add the bot to a group" link (t.me/<bot>?startgroup=1), when the Mini App URL is configured. */
export function addToGroupLink() {
  const base = import.meta.env.VITE_MINI_APP_URL?.replace(/\/$/, "");
  const bot = base?.match(/^(https:\/\/t\.me\/[^/?]+)/)?.[1];
  return bot ? `${bot}?startgroup=1` : null;
}
