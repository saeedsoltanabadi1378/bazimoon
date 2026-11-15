import type { ClanEmblem, ClanRole } from "../api/clans";
import { useLanguage } from "../i18n/LanguageContext";
import { Icon, type IconName } from "../ui/Icon";
import { roleLabel } from "./clanText";

/** The clan's emblem on its colour: a rounded tile used in lists, cards and headers. */
export function ClanEmblemTile({ emblem, color, size = 44 }: { emblem: ClanEmblem; color: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, flex: "none", borderRadius: Math.round(size * 0.3),
        background: `${color}26`, border: `1.5px solid ${color}66`, color,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Icon name={emblem as IconName} size={Math.round(size * 0.5)} />
    </span>
  );
}

export function RoleChip({ role }: { role: ClanRole }) {
  const { t } = useLanguage();
  if (role === "member") return null;
  const owner = role === "owner";
  return (
    <span className="row" style={{ gap: 4, padding: "2px 8px", borderRadius: 999, background: owner ? "#2A2113" : "#1E2138", color: owner ? "#F0A83A" : "#B79CF2", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      <Icon name={owner ? "crown" : "shield"} size={11} strokeWidth={2.4} />
      {roleLabel(role, t)}
    </span>
  );
}
