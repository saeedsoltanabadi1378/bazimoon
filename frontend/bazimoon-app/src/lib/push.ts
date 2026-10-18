import type { BazimoonApiClient } from "../api/client";
import { isStandalone } from "./platform";
import { readLocal, writeLocal } from "./storage";

const ASKED_KEY = "bazimoon-push-asked";

export type PushSupport = "supported" | "ios-not-installed" | "unsupported";

export function pushSupport(): PushSupport {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  // iOS only offers Web Push to apps added to the Home Screen (iOS 16.4+).
  if (ios && !isStandalone()) return "ios-not-installed";
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "supported";
  return "unsupported";
}

/** Whether to ask now: once per device, never after the player already answered the browser. */
export function shouldAskForPush() {
  if (readLocal<boolean>(ASKED_KEY, false)) return false;
  const support = pushSupport();
  if (support === "unsupported") return false;
  return support === "ios-not-installed" || Notification.permission === "default";
}

export function markPushAsked() {
  writeLocal(ASKED_KEY, true);
}

function keyBytes(base64Url: string) {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** Asks the browser for permission and registers this device with the API. Returns whether it worked. */
export async function enablePush(api: BazimoonApiClient): Promise<boolean> {
  if (pushSupport() !== "supported") return false;
  const { publicKey } = await api.pushKey();
  if (!publicKey) return false;
  if ((await Notification.requestPermission()) !== "granted") return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = (await registration.pushManager.getSubscription())
    ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  const json = subscription.toJSON();
  await api.subscribePush(subscription.endpoint, json.keys?.p256dh ?? "", json.keys?.auth ?? "");
  return true;
}

/** Re-registers an already-allowed device, e.g. after signing in as another player. */
export async function refreshPushSubscription(api: BazimoonApiClient) {
  if (pushSupport() !== "supported" || Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const json = subscription.toJSON();
  await api.subscribePush(subscription.endpoint, json.keys?.p256dh ?? "", json.keys?.auth ?? "").catch(() => undefined);
}

/** Stops notifications to this device for the signed-in player (before logging out). */
export async function disablePush(api: BazimoonApiClient) {
  const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await api.unsubscribePush(subscription.endpoint).catch(() => undefined);
}
