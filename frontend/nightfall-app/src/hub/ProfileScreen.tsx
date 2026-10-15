import { useState, type ReactNode } from "react";
import { useLanguage, type TranslationKey } from "../i18n/LanguageContext";
import { useSession } from "../app/session";
import { Body, ProgressBar, Screen, Switch } from "../ui/components";
import { Icon, type IconName } from "../ui/Icon";
import { TabBar } from "../ui/TabBar";
import { useHub } from "./HubData";
import { roman } from "./HomeScreen";
import { formatClock } from "../lib/format";
import { shareToTelegram } from "../lib/telegram";
import { botLink } from "../lib/links";
import { haptic } from "../lib/haptics";

const badgeMeta: Record<string, { icon: IconName; bg: string; fg: string; name: TranslationKey }> = {
  firstWin: { icon: "trophy", bg: "#3A2A16", fg: "#F0A83A", name: "badgeFirstWin" },
  lifeSaver: { icon: "shield", bg: "#3D2328", fg: "#F08A7A", name: "badgeLifeSaver" },
  sharpEye: { icon: "detective", bg: "#1B2A44", fg: "#8FA8FF", name: "badgeSharpEye" },
  theDon: { icon: "godfather", bg: "#3A1C1A", fg: "#F08A7A", name: "badgeTheDon" },
  streak7: { icon: "flame", bg: "#2A2113", fg: "#F0A83A", name: "badgeStreak7" },
  streak30: { icon: "flame", bg: "#3A2A16", fg: "#F6C377", name: "badgeStreak30" },
  solved100: { icon: "zip", bg: "#13302C", fg: "#5FD0BE", name: "badgeSolved100" },
  gold: { icon: "star", bg: "#2A2113", fg: "#F0A83A", name: "badgeGold" },
};

export function ProfileScreen() {
  const { t, n, language, setLanguage } = useLanguage();
  const session = useSession();
  const { profile, saveSettings } = useHub();
  const [editingTime, setEditingTime] = useState(false);

  if (!profile) {
    return (
      <Screen theme="hub">
        <Body style={{ padding: "20px 16px 24px" }}>
          <div className="skeleton" style={{ height: 72 }} />
          <div className="skeleton" style={{ height: 160, borderRadius: 18 }} />
          <div className="skeleton" style={{ height: 100, borderRadius: 18 }} />
        </Body>
        <TabBar />
      </Screen>
    );
  }

  const p = profile;
  const s = p.settings;
  const name = session.firstName || p.name;
  const badges = [...p.badges].sort((a, b) => Number(b.earned) - Number(a.earned));
  const sides = [
    { label: t("asTown"), pct: p.mafia.asTown.winRate, games: p.mafia.asTown.games, color: "#5FD0BE" },
    { label: t("asMafia"), pct: p.mafia.asMafia.winRate, games: p.mafia.asMafia.games, color: "#E5604D" },
  ];

  return (
    <Screen theme="hub">
      <Body style={{ padding: "20px 16px 24px", gap: 18 }}>
        <header className="row" style={{ gap: 14 }}>
          <span className="avatar display" aria-hidden="true" style={{ width: 72, height: 72, fontSize: 30, background: "#2B3042", color: "var(--text)", border: "3px solid #F0A83A" }}>
            {Array.from(name)[0]?.toUpperCase()}
          </span>
          <div className="grow stack stack--sm">
            <div>
              <h1 className="display" style={{ fontSize: 24 }}>{name}</h1>
              <div className="small muted">{t("levelDivision", { level: p.level, division: t(`division${p.division}` as "divisionGold"), tier: roman(p.tier) })}</div>
            </div>
            <ProgressBar value={(p.xpIntoLevel / p.xpForNext) * 100} track="#2B3042" label={t("xpToLevel", { xp: n(p.xpIntoLevel), next: n(p.xpForNext), level: p.level + 1 })} />
            <div className="tiny muted">{t("xpToLevel", { xp: n(p.xpIntoLevel), next: n(p.xpForNext), level: p.level + 1 })}</div>
          </div>
        </header>

        <section className="stack" style={{ gap: 12, padding: 16, borderRadius: 18, background: "#22161A", border: "1px solid #3D2328" }}>
          <div className="row row--between row--baseline">
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>{t("tabMafia")}</h2>
            <span className="small" style={{ color: "#B9A6A9" }}>{t("gamesThisSeason", { count: p.mafia.gamesThisSeason })}</span>
          </div>
          <div className="stat-grid">
            <MiniStat label={t("rating")} value={n(p.mafia.rating, { useGrouping: false })} />
            <MiniStat label={t("winRate")} value={`${n(p.mafia.winRate)}%`} />
            <MiniStat label={t("bestRole")} value={p.mafia.bestRole ? t(`role${p.mafia.bestRole}`) : "—"} />
          </div>
          {sides.map((side) => (
            <div key={side.label} className="row">
              <span style={{ width: 74, fontSize: 13, color: "#E7D9DB" }}>{side.label}</span>
              <div className="grow"><ProgressBar value={side.pct} color={side.color} track="#3D2328" height={8} /></div>
              <span className="num" style={{ width: 78, textAlign: "end", fontSize: 13 }}>{t("pctGames", { pct: side.pct, games: side.games })}</span>
            </div>
          ))}
        </section>

        <section className="stack" style={{ gap: 12, padding: 16, borderRadius: 18, background: "var(--surface)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{t("tabPuzzles")}</h2>
          <div className="stat-grid">
            <MiniStat label={t("streak")} value={t("daysCount", { count: p.puzzles.streak })} muted />
            <MiniStat label={t("solved")} value={n(p.puzzles.solved)} muted />
            <MiniStat label={t("bestZip")} value={formatClock(p.puzzles.bestZipMs, language)} muted />
          </div>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{t("badges")}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {badges.map((b) => {
              const meta = badgeMeta[b.key];
              if (!meta) return null;
              return (
                <div key={b.key} className="stack center" style={{ gap: 8, padding: "14px 6px", borderRadius: 16, background: "var(--surface)", opacity: b.earned ? 1 : 0.5 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 999, background: b.earned ? meta.bg : "#232734", color: b.earned ? meta.fg : "#9CA3B4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={meta.icon} />
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, textAlign: "center" }}>{t(meta.name)}</span>
                  {!b.earned && <span className="visually-hidden">{t("locked")}</span>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="list">
          <SettingRow first label={t("languageSetting")} value={t("language")} onClick={() => setLanguage(language === "en" ? "fa" : "en")} />
          <SettingRow
            label={t("dailyReminder")}
            value={s.reminderEnabled ? s.reminderTime : t("off")}
            onClick={() => setEditingTime((e) => !e)}
            expanded={editingTime}
          />
          {editingTime && (
            <div className="row" style={{ gap: 12, padding: "8px 16px 14px", borderTop: 0 }}>
              <label className="row grow" style={{ gap: 8, fontSize: 14, color: "var(--text-2)" }}>
                {t("time")}
                <input
                  type="time"
                  value={s.reminderTime}
                  disabled={!s.reminderEnabled}
                  onChange={(e) => e.target.value && void saveSettings({ reminderTime: e.target.value })}
                  style={{ minHeight: 44, borderRadius: 12, border: "1px solid #3A3F52", background: "#101218", color: "var(--text)", padding: "0 10px", font: "inherit" }}
                />
              </label>
              <button type="button" role="switch" aria-checked={s.reminderEnabled} aria-label={t("dailyReminder")} onClick={() => void saveSettings({ reminderEnabled: !s.reminderEnabled })} style={{ border: 0, background: "transparent", minHeight: 44, cursor: "pointer" }}>
                <Switch on={s.reminderEnabled} />
              </button>
            </div>
          )}
          <SettingRow label={t("highContrast")} toggle={s.highContrast} onClick={() => void saveSettings({ highContrast: !s.highContrast })} />
          <SettingRow label={t("hapticsSound")} toggle={s.haptics} onClick={() => {
            void saveSettings({ haptics: !s.haptics });
            haptic.tap();
          }} />
          <SettingRow label={t("inviteFriends")} value={t("share")} onClick={() => shareToTelegram(botLink(), t("inviteText"))} />
        </section>
      </Body>
      <TabBar />
    </Screen>
  );
}

function MiniStat({ label, value, muted }: { label: string; value: ReactNode; muted?: boolean }) {
  return (
    <div>
      <div className="tiny" style={{ color: muted ? "var(--muted)" : "#B9A6A9" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function SettingRow({ label, value, toggle, onClick, expanded, first }: { label: string; value?: string; toggle?: boolean; onClick: () => void; expanded?: boolean; first?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role={toggle !== undefined ? "switch" : undefined}
      aria-checked={toggle}
      aria-expanded={expanded}
      className="row row--between"
      style={{ minHeight: 52, padding: "0 16px", border: 0, borderTop: first ? 0 : "1px solid #232734", background: "transparent", color: "var(--text)", fontSize: 15, textAlign: "start", cursor: "pointer", width: "100%" }}
    >
      <span>{label}</span>
      {toggle !== undefined ? <Switch on={toggle} /> : <span className="muted">{value}</span>}
    </button>
  );
}
