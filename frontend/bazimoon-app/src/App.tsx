import { useEffect, useMemo } from "react";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";
import { SessionProvider, useSession } from "./app/session";
import { NavigationProvider, useNavigation, type Route } from "./app/router";
import { LoadingScreen, StateScreen } from "./app/StateScreen";
import { MafiaRoute } from "./mafia/MafiaRoute";
import { MafiaTablesScreen } from "./hub/MafiaTablesScreen";
import { CreateTableScreen } from "./hub/CreateTableScreen";
import { HomeScreen } from "./hub/HomeScreen";
import { WelcomeScreen, WELCOMED_KEY } from "./hub/WelcomeScreen";
import { SoloScreen } from "./hub/SoloScreen";
import { LeagueScreen } from "./hub/LeagueScreen";
import { ProfileScreen } from "./hub/ProfileScreen";
import { MafiaStatsScreen } from "./hub/MafiaStatsScreen";
import { RecapScreen } from "./mafia/RecapScreen";
import { GameRoute } from "./games/GameRoute";
import { CoupleRoute } from "./couple/CoupleRoute";
import { HubDataProvider } from "./hub/HubData";
import { initAppShell } from "./lib/platform";
import { readLocal } from "./lib/storage";
import { readDeepLink } from "./lib/links";
import { GoogleButton } from "./ui/GoogleButton";
import { UpdatePrompt } from "./app/UpdatePrompt";

/** Where the app opens: an invite or game link (/t/CODE, /g/ID, /couple/TOKEN, /ef/CODE), first-launch welcome, or home. */
function initialRoutes(): Route[] {
  const link = readDeepLink();
  // The link has been read; keep the address bar on the app root so reloads open Home.
  if (link) window.history.replaceState(null, "", "/");
  switch (link?.kind) {
    case "game":
      return [{ name: "home" }, { name: "mafia", gameId: link.gameId }];
    case "table":
      return [{ name: "home" }, { name: "mafia", code: link.code }];
    case "coupleInvite":
      return [{ name: "home" }, { name: "couple", screen: "invite", token: link.token }];
    case "couple":
      return [{ name: "home" }, { name: "couple", screen: "home" }];
    case "esmfamil":
      return [{ name: "home" }, { name: "game", game: "esmfamil", screen: "lobby", params: { code: `EF-${link.code}` } }];
  }
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
      return route.gameId ? <MafiaRoute gameId={route.gameId} /> : <MafiaTablesScreen code={route.code} />;
    case "createTable":
      return <CreateTableScreen />;
    case "mafiaStats":
      return <MafiaStatsScreen />;
    case "recap":
      return <RecapScreen gameId={route.gameId} />;
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
    case "offline":
      return <StateScreen state="offline" primaryLabel={t("tryAgain")} onPrimary={session.retry} />;
    case "signed-out":
      return (
        <StateScreen state="expired" secondaryLabel={t("continueAsGuest")} onSecondary={() => void session.continueAsGuest()}>
          <div style={{ width: "100%", maxWidth: 358, paddingTop: 8 }}>
            <GoogleButton onCredential={(token) => void session.signInWithGoogle(token)} />
          </div>
        </StateScreen>
      );
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
  useEffect(() => initAppShell(), []);
  return (
    <LanguageProvider>
      <SessionProvider>
        <SessionGate />
      </SessionProvider>
      <UpdatePrompt />
    </LanguageProvider>
  );
}
