import { Icon, type IconName } from "./Icon";
import { useNavigation, tabFor, type Route, type TabKey } from "../app/router";
import { useLanguage } from "../i18n/LanguageContext";
import { haptic } from "../lib/haptics";
import { useHub } from "../hub/HubData";

const tabs: { key: TabKey; icon: IconName; route: Route }[] = [
  { key: "home", icon: "home", route: { name: "home" } },
  { key: "solo", icon: "grid", route: { name: "solo" } },
  { key: "mafia", icon: "people", route: { name: "mafia" } },
  { key: "league", icon: "trophyFull", route: { name: "league" } },
  { key: "profile", icon: "user", route: { name: "profile" } },
];

export function TabBar() {
  const { route, reset } = useNavigation();
  const { t } = useLanguage();
  const { isGameOn } = useHub();
  const active = tabFor(route);
  // Together goes away only when both of its games are switched off.
  const shown = tabs.filter((tab) => tab.key !== "mafia" || isGameOn("mafia") || isGameOn("couple"));
  const labels: Record<TabKey, string> = { home: t("tabHome"), solo: t("tabPuzzles"), mafia: t("tabMafia"), league: t("tabLeague"), profile: t("tabProfile") };
  return (
    <nav className="tabbar" aria-label={t("mainNav")}>
      {shown.map((tab) => (
        <button
          key={tab.key}
          type="button"
          aria-current={active === tab.key ? "page" : undefined}
          onClick={() => {
            haptic.select();
            reset(tab.route);
          }}
        >
          <span className="tabbar__icon"><Icon name={tab.icon} /></span>
          <span className="tabbar__label">{labels[tab.key]}</span>
        </button>
      ))}
    </nav>
  );
}
