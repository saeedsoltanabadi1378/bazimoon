import { Icon, type IconName } from "./Icon";
import { useNavigation, tabFor, type Route, type TabKey } from "../app/router";
import { useLanguage } from "../i18n/LanguageContext";
import { haptic } from "../lib/haptics";

const tabs: { key: TabKey; icon: IconName; route: Route }[] = [
  { key: "home", icon: "home", route: { name: "home" } },
  { key: "solo", icon: "grid", route: { name: "solo" } },
  { key: "mafia", icon: "moon", route: { name: "mafia" } },
  { key: "league", icon: "trophyFull", route: { name: "league" } },
  { key: "profile", icon: "user", route: { name: "profile" } },
];

export function TabBar() {
  const { route, reset } = useNavigation();
  const { t } = useLanguage();
  const active = tabFor(route);
  const labels: Record<TabKey, string> = { home: t("tabHome"), solo: t("tabPuzzles"), mafia: t("tabMafia"), league: t("tabLeague"), profile: t("tabProfile") };
  return (
    <nav className="tabbar" aria-label={t("mainNav")}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          aria-current={active === tab.key ? "page" : undefined}
          onClick={() => {
            haptic.select();
            reset(tab.route);
          }}
        >
          <Icon name={tab.icon} />
          {labels[tab.key]}
        </button>
      ))}
    </nav>
  );
}
