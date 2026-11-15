import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { useHub, useLoad } from "../hub/HubData";
import { Icon } from "../ui/Icon";
import { ClanEmblemTile } from "./shared";
import { formatWhen } from "./clanText";

/** Together tab: your clan at a glance (unread chat, join requests, next game night), or an
 * invitation to find one. */
export function ClanCard() {
  const { t, n, language } = useLanguage();
  const { push } = useNavigation();
  const { clans } = useHub();
  const { data } = useLoad(() => clans.me(), [clans]);

  if (!data) return <div className="skeleton" style={{ height: 76, borderRadius: 18 }} />;
  const clan = data.clan;

  if (!clan) {
    return (
      <button
        type="button"
        onClick={() => push({ name: "clan" })}
        className="row"
        style={{ gap: 14, width: "100%", padding: 14, borderRadius: 18, border: "1.5px dashed #3A3F5E", background: "transparent", color: "var(--text)", font: "inherit", textAlign: "start", cursor: "pointer" }}
      >
        <span style={{ width: 44, height: 44, flex: "none", borderRadius: 13, background: "#2E2340", color: "#B79CF2", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="people" size={22} />
        </span>
        <span className="grow stack" style={{ gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{t("clanCardJoin")}</span>
          <span className="small muted" style={{ lineHeight: 1.4 }}>{t("clanCardJoinSub")}</span>
        </span>
        <span className="flip-rtl" style={{ display: "flex", color: "var(--muted)" }}><Icon name="forward" size={18} /></span>
      </button>
    );
  }

  const next = clan.nextEvent;
  const badges = [
    clan.unread > 0 ? t("clanCardUnread", { count: clan.unread }) : null,
    clan.requests > 0 ? t("clanCardRequests", { count: clan.requests }) : null,
  ].filter(Boolean) as string[];

  return (
    <button
      type="button"
      onClick={() => push({ name: "clan" })}
      className="stack"
      style={{ gap: 10, width: "100%", padding: 14, borderRadius: 18, border: `1px solid ${clan.color}40`, background: `linear-gradient(135deg, ${clan.color}1F, var(--surface) 70%)`, color: "var(--text)", font: "inherit", textAlign: "start", cursor: "pointer" }}
    >
      <span className="row" style={{ gap: 12, width: "100%" }}>
        <ClanEmblemTile emblem={clan.emblem} color={clan.color} />
        <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
          <span className="tiny" style={{ color: clan.color, fontWeight: 700 }}>{t("clanCardTitle")}</span>
          <span style={{ fontSize: 17, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clan.name}</span>
          <span className="tiny muted">{t("clanCardMembers", { count: n(clan.members) })}</span>
        </span>
        <span className="flip-rtl" style={{ display: "flex", color: "var(--muted)" }}><Icon name="forward" size={18} /></span>
      </span>
      <span className="row" style={{ gap: 8, width: "100%", flexWrap: "wrap" }}>
        <span className="row small grow" style={{ gap: 6, color: "var(--text-2)", minWidth: 0 }}>
          <Icon name="calendar" size={14} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {next ? t("clanCardNext", { title: next.title, when: formatWhen(next.startsAt, language) }) : t("clanCardNoEvent")}
          </span>
        </span>
        {badges.map((b) => (
          <span key={b} style={{ padding: "2px 9px", borderRadius: 999, background: "#E5604D", color: "#1C0905", fontSize: 12, fontWeight: 700 }}>{b}</span>
        ))}
      </span>
    </button>
  );
}
