import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { useHub, useLoad } from "./HubData";
import { Body, IconButton, ProgressBar, Screen } from "../ui/components";
import { Icon } from "../ui/Icon";
import { TabBar } from "../ui/TabBar";
import { roleMeta } from "../mafia/roles";
import { useRoleName } from "../mafia/parts";
import { badgeMeta } from "./badges";
import type { MafiaStats } from "../api/hub";

type Tab = "roles" | "achievements" | "games";

/** Profile → Mafia stats: win rate per role, skill numbers, achievements and recent games (each opens its recap). */
export function MafiaStatsScreen() {
  const { api } = useHub();
  const { t } = useLanguage();
  const { back } = useNavigation();
  const [tab, setTab] = useState<Tab>("roles");
  const stats = useLoad(() => api.mafiaStats(), [api]);
  const data = stats.data;
  const tabs: { key: Tab; label: string }[] = [
    { key: "roles", label: t("statsTabRoles") },
    { key: "achievements", label: t("statsTabAchievements") },
    { key: "games", label: t("statsTabGames") },
  ];

  return (
    <Screen theme="hub">
      <header className="topbar">
        <IconButton icon="back" label={t("back")} onClick={back} />
        <div className="topbar__text">
          <div className="tiny muted">{t("mafiaStatsSub", { count: data?.games ?? 0 })}</div>
          <h1 className="display" style={{ fontSize: 22 }}>{t("mafiaStatsTitle")}</h1>
        </div>
      </header>

      <Body style={{ gap: 16 }}>
        <div role="tablist" aria-label={t("mafiaStatsTitle")} style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4, padding: 4, borderRadius: 14, background: "var(--surface)" }}>
          {tabs.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={tab === x.key}
              onClick={() => setTab(x.key)}
              style={{ minHeight: 38, border: 0, borderRadius: 10, background: tab === x.key ? "#F2EEE6" : "transparent", color: tab === x.key ? "#101218" : "#C9C8DC", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              {x.label}
            </button>
          ))}
        </div>

        {!data && stats.loading && <div className="skeleton" style={{ height: 280, borderRadius: 18 }} />}
        {data && data.games === 0 && <p className="small muted" style={{ textAlign: "center", padding: "24px 8px" }}>{t("noMafiaGames")}</p>}
        {data && data.games > 0 && tab === "roles" && <ByRole data={data} />}
        {data && tab === "achievements" && <Achievements data={data} />}
        {data && data.games > 0 && tab === "games" && <RecentGames data={data} />}
        {stats.error && !data && <p className="small muted" style={{ textAlign: "center" }}>{t("genericError")}</p>}
      </Body>
      <TabBar />
    </Screen>
  );
}

function ByRole({ data }: { data: MafiaStats }) {
  const { t, n } = useLanguage();
  const roleName = useRoleName();
  const s = data.skills;
  const pct = (part: number, whole: number) => (whole === 0 ? "—" : `${n(Math.round((100 * part) / whole))}%`);
  const skills = [
    { label: t("skillDetective"), value: pct(s.mafiaFound, s.checksMade), text: t("skillDetectiveText", { found: s.mafiaFound, checks: s.checksMade }), color: "#8FA8FF" },
    { label: t("skillDoctor"), value: n(s.killsBlocked), text: t("skillDoctorText", { blocked: s.killsBlocked, nights: s.doctorNights }), color: "#5FD0BE" },
    { label: t("skillVote"), value: pct(s.votesOnMafia, s.votesCast), text: t("skillVoteText", { onMafia: s.votesOnMafia, cast: s.votesCast }), color: "#F0A83A" },
    { label: t("skillNights"), value: s.trackedGames === 0 ? "—" : n(Math.round((10 * s.nightsSurvived) / s.trackedGames) / 10), text: t("skillNightsText"), color: "#B79CF2" },
  ];
  return (
    <>
      <section className="stack" style={{ gap: 0, borderRadius: 18, background: "#22161A", border: "1px solid #3D2328", overflow: "hidden" }}>
        <div className="row row--between tiny" style={{ padding: "12px 14px", color: "#B9A6A9" }}>
          <span>{t("statsColRole")}</span>
          <span>{t("statsColWinRate")}</span>
        </div>
        {data.byRole.map((r) => {
          const meta = roleMeta[r.role];
          return (
            <div key={r.role} className="row" style={{ gap: 10, padding: "10px 14px", borderTop: "1px solid #3D2328" }}>
              <span style={{ width: 30, height: 30, flex: "none", borderRadius: 999, background: meta.bg, color: meta.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={meta.icon} size={15} />
              </span>
              <span className="stack" style={{ width: 96, gap: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{roleName(r.role)}</span>
                <span className="tiny" style={{ color: "#B9A6A9" }}>{t("statsGames", { count: r.games })}</span>
              </span>
              <div className="grow"><ProgressBar value={r.winRate} color={meta.fg} track="#3D2328" height={8} /></div>
              <span className="num" style={{ width: 44, textAlign: "end", fontSize: 14, fontWeight: 700 }}>{n(r.winRate)}%</span>
            </div>
          );
        })}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        {skills.map((k) => (
          <div key={k.label} className="stack" style={{ gap: 4, padding: 14, borderRadius: 16, background: "var(--surface)" }}>
            <span className="tiny strong" style={{ color: k.color }}>{k.label}</span>
            <span className="num" style={{ fontSize: 24, fontWeight: 800 }}>{k.value}</span>
            <span className="tiny muted">{k.text}</span>
          </div>
        ))}
      </div>
      <p className="tiny muted" style={{ lineHeight: 1.5 }}>{t("statsOldNote")}</p>
    </>
  );
}

function Achievements({ data }: { data: MafiaStats }) {
  const { t, language } = useLanguage();
  const earned = data.achievements.filter((a) => a.earnedAt).length;
  const date = (iso: string) => new Date(iso).toLocaleDateString(language === "fa" ? "fa-IR" : "en-GB", { day: "numeric", month: "short" });
  return (
    <>
      <div className="small muted">{t("achievementsEarned", { earned, total: data.achievements.length })}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        {data.achievements.map((a) => {
          const meta = badgeMeta[a.key];
          if (!meta) return null;
          const on = !!a.earnedAt;
          return (
            <div key={a.key} className="stack" style={{ gap: 8, padding: 14, borderRadius: 16, background: "var(--surface)", opacity: on ? 1 : 0.55 }}>
              <div className="row row--between">
                <span style={{ width: 40, height: 40, borderRadius: 999, background: on ? meta.bg : "#2B3042", color: on ? meta.fg : "#9CA3B4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={meta.icon} size={20} />
                </span>
                {a.earnedAt && <span className="tiny muted">{date(a.earnedAt)}</span>}
              </div>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{t(meta.name)}</span>
              {meta.how && <span className="tiny muted" style={{ lineHeight: 1.4 }}>{t(meta.how)}</span>}
              {!on && a.progress !== null && a.target !== null && (
                <ProgressBar value={(100 * a.progress) / a.target} color="#F0A83A" track="#2B3042" label={t("achievementProgress", { progress: a.progress, target: a.target })} />
              )}
              {!on && <span className="visually-hidden">{t("locked")}</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function RecentGames({ data }: { data: MafiaStats }) {
  const { t, n, language } = useLanguage();
  const { push } = useNavigation();
  const roleName = useRoleName();
  const date = (iso: string) => new Date(iso).toLocaleDateString(language === "fa" ? "fa-IR" : "en-GB", { day: "numeric", month: "short" });
  return (
    <ul className="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {data.recent.map((g) => {
        const meta = g.role ? roleMeta[g.role] : null;
        const color = g.won ? "#5FD0BE" : "#F08A7A";
        const content = (
          <>
            {meta && (
              <span style={{ width: 34, height: 34, flex: "none", borderRadius: 999, background: meta.bg, color: meta.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={meta.icon} size={16} />
              </span>
            )}
            <span className="grow stack" style={{ gap: 0, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {g.role ? roleName(g.role) : "—"} · <span style={{ color }}>{g.won ? t("win") : t("loss")}</span>{g.isMvp ? t("recentMvp") : ""}
              </span>
              <span className="tiny muted">
                {g.tableName ? t("recentMeta", { table: g.tableName, count: g.players, date: date(g.endedAt) }) : t("recentMetaNoTable", { count: g.players, date: date(g.endedAt) })}
              </span>
            </span>
            {g.ratingDelta !== null && (
              <span className="num" dir="ltr" style={{ fontSize: 13, fontWeight: 700, color }}>{g.ratingDelta >= 0 ? "+" : "−"}{n(Math.abs(g.ratingDelta))}</span>
            )}
            {g.hasRecap && <Icon name="forward" size={16} color="#9CA3B4" className="flip-rtl" />}
          </>
        );
        return (
          <li key={g.gameId} className="list__row" style={{ padding: 0 }}>
            {g.hasRecap ? (
              <button type="button" className="row grow" onClick={() => push({ name: "recap", gameId: g.gameId })} style={{ gap: 12, minHeight: 62, padding: "8px 14px", border: 0, background: "transparent", color: "inherit", font: "inherit", textAlign: "start", cursor: "pointer" }}>
                {content}
              </button>
            ) : (
              <div className="row grow" style={{ gap: 12, minHeight: 62, padding: "8px 14px" }}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
