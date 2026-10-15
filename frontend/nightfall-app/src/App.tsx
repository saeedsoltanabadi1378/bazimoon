import { useEffect, useMemo } from "react";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";
import { SessionProvider, useSession } from "./app/session";
import { NavigationProvider, useNavigation, type Route } from "./app/router";
import { LoadingScreen, StateScreen } from "./app/StateScreen";
import { MafiaRoute } from "./mafia/MafiaRoute";
import { MafiaTablesScreen } from "./hub/MafiaTablesScreen";
import { HomeScreen } from "./hub/HomeScreen";
import { WelcomeScreen, WELCOMED_KEY } from "./hub/WelcomeScreen";
import { SoloScreen } from "./hub/SoloScreen";
import { LeagueScreen } from "./hub/LeagueScreen";
import { ProfileScreen } from "./hub/ProfileScreen";
import { GameRoute } from "./games/GameRoute";
import { CoupleRoute } from "./couple/CoupleRoute";
import { HubDataProvider } from "./hub/HubData";
import { initTelegramShell, openTelegramLink, telegram } from "./lib/telegram";
import { readLocal } from "./lib/storage";
import { botLink } from "./lib/links";

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where the app opens: a game deep link, a Couple Quiz invite, first-launch welcome, or home. */
function initialRoutes(): Route[] {
  const start = telegram.initDataUnsafe.start_param ?? "";
  if (GUID.test(start)) return [{ name: "home" }, { name: "mafia", gameId: start }];
  if (start.startsWith("couple_")) return [{ name: "home" }, { name: "couple", screen: "invite", token: start.slice("couple_".length) }];
  if (!readLocal<boolean>(WELCOMED_KEY, false)) return [{ name: "welcome" }];
  return [{ name: "home" }];
}

function CurrentScreen() {
  const { route } = useNavigation();
  switch (route.name) {
    case "welcome":
      return <WelcomeScreen />;
    case "home":
      return <HomeScreen />;
    case "solo":
      return <SoloScreen />;
    case "league":
      return <LeagueScreen />;
    case "profile":
      return <ProfileScreen />;
    case "mafia":
      return route.gameId ? <MafiaRoute gameId={route.gameId} /> : <MafiaTablesScreen />;
    case "game":
      return <GameRoute route={route} />;
    case "couple":
      return <CoupleRoute route={route} />;
  }
}

function SessionGate() {
  const session = useSession();
  const { t } = useLanguage();
  const routes = useMemo(initialRoutes, []);

  switch (session.status) {
    case "loading":
      return <LoadingScreen />;
    case "no-telegram":
      return <StateScreen state="no-telegram" primaryLabel={t("openNightfallBot")} onPrimary={() => openTelegramLink(botLink())} />;
    case "offline":
      return <StateScreen state="offline" primaryLabel={t("tryAgain")} onPrimary={session.retry} />;
    case "expired":
      return <StateScreen state="expired" primaryLabel={t("tryAgain")} onPrimary={session.retry} />;
    case "error":
      return <StateScreen state="error" primaryLabel={t("tryAgain")} onPrimary={session.retry} />;
    case "ready":
      return (
        <HubDataProvider>
          <NavigationProvider initial={routes}>
            <CurrentScreen />
          </NavigationProvider>
        </HubDataProvider>
      );
  }
}

export default function App() {
  useEffect(() => initTelegramShell(), []);
  return (
    <LanguageProvider>
      <SessionProvider>
        <SessionGate />
      </SessionProvider>
    </LanguageProvider>
  );
}
