import type { useLanguage } from "../i18n/LanguageContext";
import type { Friend } from "../api/friends";

type T = ReturnType<typeof useLanguage>["t"];

/** "Online now", or when the friend last opened the app. */
export function seenText(friend: Friend, t: T) {
  if (friend.online) return t("friendsOnline");
  if (!friend.lastSeenAt) return null;
  const minutes = Math.max(0, Math.round((Date.now() - new Date(friend.lastSeenAt).getTime()) / 60000));
  const when = minutes < 2 ? t("agoJustNow")
    : minutes < 60 ? t("agoMinutes", { count: minutes })
    : minutes < 60 * 24 ? t("agoHours", { count: Math.round(minutes / 60) })
    : t("agoDays", { count: Math.round(minutes / 60 / 24) });
  return t("friendsSeen", { when });
}
