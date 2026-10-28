import { lazy, Suspense, useEffect, useMemo } from "react";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";
import { SessionProvider, useSession } from "./app/session";
import { NavigationProvider, useNavigation, type GameKey, type Route } from "./app/router";
import { LoadingScreen, StateScreen } from "./app/StateScreen";
import { HomeScreen } from "./hub/HomeScreen";
import { HubDataProvider } from "./hub/HubData";
import { initAppShell } from "./lib/platform";
import { readDeepLink } from "./lib/links";
import { GoogleButton } from "./ui/GoogleButton";
import { UpdatePrompt } from "./app/UpdatePrompt";
import { GoogleResultSheet } from "./hub/SaveProgress";
import { InviteBanner } from "./hub/InviteBanner";

// Screens past Home load on demand so the first paint only needs the hub.
const MafiaRoute = lazy(() => import("./mafia/MafiaRoute").then((m) => ({ default: m.MafiaRoute })));
const MafiaTablesScreen = lazy(() => import("./hub/MafiaTablesScreen").then((m) => ({ default: m.MafiaTablesScreen })));
const CreateTableScreen = lazy(() => import("./hub/CreateTableScreen").then((m) => ({ default: m.CreateTableScreen })));
const SoloScreen = lazy(() => import("./hub/SoloScreen").then((m) => ({ default: m.SoloScreen })));
const LeagueScreen = lazy(() => import("./hub/LeagueScreen").then((m) => ({ default: m.LeagueScreen })));
const ProfileScreen = lazy(() => import("./hub/ProfileScreen").then((m) => ({ default: m.ProfileScreen })));
const MafiaStatsScreen = lazy(() => import("./hub/MafiaStatsScreen").then((m) => ({ default: m.MafiaStatsScreen })));
const RecapScreen = lazy(() => import("./mafia/RecapScreen").then((m) => ({ default: m.RecapScreen })));
const GameRoute = lazy(() => import("./games/GameRoute").then((m) => ({ default: m.GameRoute })));
const FriendsScreen = lazy(() => import("./hub/FriendsScreen").then((m) => ({ default: m.FriendsScreen })));
const FriendLinkScreen = lazy(() => import("./hub/FriendsScreen").then((m) => ({ default: m.FriendLinkScreen })));
const CoupleRoute = lazy(() => import("./couple/CoupleRoute").then((m) => ({ default: m.CoupleRoute })));

const gameKeys: GameKey[] = ["zip", "queens", "merge", "mines", "memory", "word", "ladder", "stack", "blocks", "sudoku", "snake", "dooz", "spy", "esmfamil"];
const isGameKey = (key: string): key is GameKey => (gameKeys as string[]).includes(key);

/** Where the app opens: an invite or game link (/t/CODE, /g/ID, /couple/TOKEN, /ef/CODE, /f/CODE, /friends, /play/GAME), or home. */
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
    case "friend":
      return [{ name: "home" }, { name: "friendLink", code: link.code }];
    case "friends":
      return [{ name: "home" }, { name: "friends" }];
    case "play":
      if (link.game === "mafia") return [{ name: "home" }, { name: "mafia" }];
      if (link.game === "couple") return [{ name: "home" }, { name: "couple", screen: "home" }];
      if (isGameKey(link.game)) return [{ name: "home" }, { name: "game", game: link.game, screen: "intro" }];
      break;
  }
  return [{ name: "home" }];
}

function CurrentScreen() {
  const { route } = useNavigation();
  switch (route.name) {
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
    case "friends":
      return <FriendsScreen />;
    case "friendLink":
      return <FriendLinkScreen code={route.code} />;
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
            <GoogleButton />
          </div>
        </StateScreen>
      );
    case "error":
      return <StateScreen state="error" primaryLabel={t("tryAgain")} onPrimary={session.retry} />;
    case "ready":
      return (
        <HubDataProvider>
          <NavigationProvider initial={routes}>
            <Suspense fallback={<LoadingScreen />}>
              <CurrentScreen />
            </Suspense>
            <InviteBanner />
          </NavigationProvider>
          <GoogleResultSheet />
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
