import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { StateScreen } from "./StateScreen";
import { useLanguage } from "../i18n/LanguageContext";

/** Registers the service worker and, when a new version is ready, offers to switch to it
 * ("Update available" on the App states artboard). */
export function UpdatePrompt() {
  const { t } = useLanguage();
  const [later, setLater] = useState(false);
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Look for a new version every hour while the app stays open.
      if (registration) window.setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });

  if (!needRefresh || later) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40 }}>
      <StateScreen state="update" primaryLabel={t("updateNow")} onPrimary={() => void updateServiceWorker(true)} secondaryLabel={t("later")} onSecondary={() => setLater(true)} />
    </div>
  );
}
