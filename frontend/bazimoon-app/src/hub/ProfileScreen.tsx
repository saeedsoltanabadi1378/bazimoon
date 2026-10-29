import { useState, type ReactNode } from "react";
import { useLanguage, type Language } from "../i18n/LanguageContext";
import { badgeMeta } from "./badges";
import { useNavigation } from "../app/router";
import { useSession } from "../app/session";
import { Body, ProgressBar, Screen, Segmented, Switch } from "../ui/components";
import { Icon } from "../ui/Icon";
import { TabBar } from "../ui/TabBar";
import { useHub, useLoad } from "./HubData";
import { roman } from "./HomeScreen";
import { formatClock } from "../lib/format";
import { shareLink } from "../lib/platform";
import { appLink } from "../lib/links";
import { haptic } from "../lib/haptics";
import { GoogleButton } from "../ui/GoogleButton";
import { InstallSheet } from "./InstallSheet";
import { useInstallMode } from "../lib/install";


export function ProfileScreen() {
  const { t, n, language } = useLanguage();
  const session = useSession();
  const { profile, saveSettings, friends: fapi } = useHub();
  const friendList = useLoad(() => fapi.list(), [fapi]);
  const { push } = useNavigation();
  const [editingTime, setEditingTime] = useState(false);
  const installMode = useInstallMode();
  const [showInstall, setShowInstall] = useState(false);

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
  const name = session.displayName || p.name;
  const incoming = friendList.data?.incoming.length ?? 0;
  const friendsValue = incoming > 0 ? t("profileFriendsNew", { count: incoming }) : t("profileFriendsCount", { count: friendList.data?.friends.length ?? 0 });
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

        {session.isGuest ? (
          <section className="stack" style={{ gap: 12, padding: 16, borderRadius: 18, background: "#2A2113", border: "1px solid #5A4120" }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ padding: "3px 10px", borderRadius: 999, background: "#3A2A16", color: "#F6C377", fontSize: 12, fontWeight: 700 }}>{t("guestBadge")}</span>
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>{t("guestCardTitle")}</h2>
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: "#E3D3B8" }}>{t("guestCardBody")}</p>
            <GoogleButton compact />
          </section>
        ) : (
          <section className="row" style={{ gap: 12, padding: "14px 16px", borderRadius: 18, background: "var(--surface)" }}>
            <span style={{ width: 36, height: 36, borderRadius: 999, background: "#13302C", color: "#5FD0BE", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={18} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{t("signedInWithGoogle")}</span>
          </section>
        )}

        <section className="row row--between row--wrap" style={{ minHeight: 68, padding: "10px 16px", borderRadius: 18, background: "var(--surface)" }}>
          <span className="row" style={{ fontSize: 15, fontWeight: 600 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: "#2A2113", color: "#F0A83A", display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true">
              <Icon name="globe" size={18} />
            </span>
            {t("languageSetting")}
          </span>
          <div style={{ width: 190, maxWidth: "100%" }}>
            <Segmented<Language>
              label={t("languageSetting")}
              value={language}
              options={[
                { value: "en", label: t("languageEnglish") },
                { value: "fa", label: t("languagePersian") },
              ]}
              onChange={(next) => {
                if (next === language) return;
                haptic.select();
                void saveSettings({ language: next });
              }}
              soft
            />
          </div>
        </section>

        <section className="stack" style={{ gap: 12, padding: 16, borderRadius: 18, background: "var(--surface)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{t("sectionPuzzles")}</h2>
          <div className="stat-grid">
            <MiniStat label={t("streak")} value={t("daysCount", { count: p.puzzles.streak })} muted />
            <MiniStat label={t("solved")} value={n(p.puzzles.solved)} muted />
            <MiniStat label={t("bestZip")} value={formatClock(p.puzzles.bestZipMs, language)} muted />
          </div>
        </section>

        <section className="stack" style={{ gap: 12, padding: 16, borderRadius: 18, background: "#22161A", border: "1px solid #3D2328" }}>
          <div className="row row--between row--baseline">
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>{t("sectionMafia")}</h2>
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
          <button type="button" className="row row--between" onClick={() => push({ name: "mafiaStats" })} style={{ minHeight: 44, padding: "0 12px", border: 0, borderRadius: 12, background: "#2E1C21", color: "var(--text)", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "start" }}>
            {t("mafiaStatsLink")}
            <Icon name="forward" size={16} color="#B9A6A9" className="flip-rtl" />
          </button>
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
          {(installMode === "prompt" || installMode === "ios") && (
            <SettingRow label={t("installApp")} value={t("addToHomeScreen")} onClick={() => setShowInstall(true)} />
          )}
          <SettingRow label={t("profileFriends")} value={friendsValue} onClick={() => push({ name: "friends" })} />
          <SettingRow label={t("inviteFriends")} value={t("share")} onClick={() => void shareLink(appLink(), t("inviteText"))} />
          {!session.isGuest && (
            <button type="button" onClick={() => void session.logout()} style={{ width: "100%", minHeight: 52, padding: "0 16px", border: 0, borderTop: "1px solid #232734", background: "transparent", color: "#F08A7A", fontSize: 15, fontWeight: 600, textAlign: "start", cursor: "pointer" }}>
              {t("logOut")}
            </button>
          )}
        </section>
      </Body>
      {showInstall && <InstallSheet mode={installMode} onClose={() => setShowInstall(false)} />}
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

function SettingRow({ label, value, toggle, onClick, expanded }: { label: string; value?: string; toggle?: boolean; onClick: () => void; expanded?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role={toggle !== undefined ? "switch" : undefined}
      aria-checked={toggle}
      aria-expanded={expanded}
      className="row row--between"
      style={{ minHeight: 52, padding: "0 16px", border: 0, borderTop: "1px solid #232734", background: "transparent", color: "var(--text)", fontSize: 15, textAlign: "start", cursor: "pointer", width: "100%" }}
    >
      <span>{label}</span>
      {toggle !== undefined ? <Switch on={toggle} /> : <span className="muted">{value}</span>}
    </button>
  );
}
