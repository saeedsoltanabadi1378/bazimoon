import { useState } from "react";
import type { Overview } from "../adminApi";
import { useAdminI18n } from "../i18n";
import { Header, LEVEL_STYLE, PageState, PHASE_COLORS, StatusPill, Svg, gameName, useAdminData, useLiveDetail, type AdminPage } from "../ui";

const RANGES = [1, 7, 30] as const;

export function OverviewPage({ go }: { go(p: AdminPage): void }) {
  const { t, n, lang, date, time } = useAdminI18n();
  const [range, setRange] = useState<(typeof RANGES)[number]>(1);
  const { data, error, reload } = useAdminData<Overview>(`/overview?days=${range}`);
  const liveDetail = useLiveDetail();

  const header = (
    <Header kicker={t("tehranTime", { date: new Date().toLocaleDateString(lang === "fa" ? "fa-IR" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Tehran" }) })} title={t("overviewTitle")}>
      {data && (() => {
        const bot = data.services.find((s) => s.key === "bot");
        const up = bot?.status === "healthy";
        return (
          <span className="adm-pill" style={{ padding: "8px 12px", fontSize: 13, background: up ? "#13302C" : "#2A1418", color: up ? "#5FD0BE" : "#F08A7A" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "currentColor" }} />
            {up ? t("botConnected") : t("botOffline")}
          </span>
        );
      })()}
      <div role="radiogroup" aria-label={t("range")} className="adm-seg">
        {RANGES.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={range === r} onClick={() => setRange(r)}>
            {r === 1 ? t("rangeToday") : r === 7 ? t("range7") : t("range30")}
          </button>
        ))}
      </div>
    </Header>
  );

  if (!data) return <main className="adm-main">{header}<PageState error={error} onRetry={reload} /></main>;

  const change = data.activePlayersBefore ? Math.round(((data.activePlayers - data.activePlayersBefore) / data.activePlayersBefore) * 100) : 0;
  const kpis = [
    { label: t("kpiLive"), value: n(data.liveGames), note: t("kpiLiveNote", { count: data.nightGames }), color: "#C9C8DC", page: "games" as const },
    {
      label: t("kpiActive"), value: n(data.activePlayers),
      note: change > 0 ? t("kpiActiveUp", { pct: change }) : change < 0 ? t("kpiActiveDown", { pct: -change }) : t("kpiActiveSame"),
      color: change > 0 ? "#5FD0BE" : change < 0 ? "#F08A7A" : "#C9C8DC", page: "players" as const,
    },
    { label: t("kpiSolves"), value: n(data.dailySolves), note: data.topDailyGame ? t("kpiSolvesTop", { game: gameName(data.topDailyGame, lang) }) : t("none"), color: "#C9C8DC", page: "puzzles" as const },
    { label: t("kpiCouples"), value: n(data.activeCouples), note: t("kpiCouplesNote", { count: data.couplesBothToday }), color: "#C9C8DC", page: "puzzles" as const },
  ];
  const max = Math.max(1, ...data.activity.map((d) => d.mafia + d.puzzles));
  const first = data.activity[0]?.date;
  const last = data.activity[data.activity.length - 1]?.date;

  return (
    <main className="adm-main">
      {header}

      <div className="adm-kpis">
        {kpis.map((k) => (
          <a key={k.label} href={`/admin/${k.page}`} className="adm-kpi" onClick={(e) => { e.preventDefault(); go(k.page); }}>
            <span className="small text-2">{k.label}</span>
            <strong>{k.value}</strong>
            <span className="small" style={{ color: k.color }}>{k.note}</span>
          </a>
        ))}
      </div>

      <div className="adm-grid">
        <section className="adm-panel" aria-labelledby="chart-title" style={{ gap: 14 }}>
          <div className="adm-panel-head">
            <h2 id="chart-title">{t("activeTitle")}</h2>
            <div style={{ display: "flex", gap: 14, fontSize: 12 }} className="text-2">
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "#F0A83A" }} />{t("puzzles")}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "#4F5BB0" }} />{t("mafia")}</span>
            </div>
          </div>
          <div className="adm-bars" role="img" aria-label={t("chartAria")} dir="ltr">
            {data.activity.map((d) => (
              <div key={d.date} title={`${date(d.date)} · ${n(d.puzzles)} / ${n(d.mafia)}`}>
                <span style={{ height: `${(d.puzzles / max) * 100}%`, borderRadius: "4px 4px 0 0", background: "#F0A83A" }} />
                <span style={{ height: `${(d.mafia / max) * 100}%`, borderRadius: "0 0 4px 4px", background: "#4F5BB0" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }} className="tiny muted" dir="ltr">
            <span>{first && date(first)}</span>
            <span>{last && date(last)}</span>
          </div>
        </section>

        <section className="adm-panel" aria-labelledby="health-title">
          <div className="adm-panel-head">
            <h2 id="health-title">{t("healthTitle")}</h2>
            <a href="/admin/system" className="small" style={{ fontWeight: 600, textDecoration: "none" }} onClick={(e) => { e.preventDefault(); go("system"); }}>{t("details")}</a>
          </div>
          {data.services.map((s) => (
            <div key={s.key} className="adm-row">
              <span style={{ flex: 1 }}>{t(`svc_${s.key}`)}</span>
              {s.latencyMs != null && <span className="tiny muted num">{t("latency", { ms: s.latencyMs })}</span>}
              <StatusPill status={s.status} />
            </div>
          ))}
        </section>
      </div>

      <div className="adm-grid">
        <section className="adm-panel" aria-labelledby="live-title" style={{ gap: 6 }}>
          <div className="adm-panel-head" style={{ paddingBottom: 6 }}>
            <h2 id="live-title">{t("liveTitle")}</h2>
            <a href="/admin/games" className="small" style={{ fontWeight: 600, textDecoration: "none" }} onClick={(e) => { e.preventDefault(); go("games"); }}>{t("allGames")}</a>
          </div>
          {data.live.length === 0 && <div className="adm-empty">{t("noLive")}</div>}
          {data.live.map((g) => {
            const [bg, fg, icon] = PHASE_COLORS[g.phase] ?? PHASE_COLORS.Lobby;
            return (
              <a key={g.id} href="/admin/games" className="adm-row" style={{ minHeight: 56, color: "#EDEBF5", textDecoration: "none" }} onClick={(e) => { e.preventDefault(); go("games"); }}>
                <span style={{ width: 36, height: 36, flex: "none", borderRadius: 10, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center" }}><Svg d={icon} /></span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 600 }}>{g.chatTitle ?? t("unnamedChat", { id: String(g.chatId) })}</span>
                  <span className="tiny muted">{liveDetail(g)}</span>
                </span>
                <span className="small text-2 num">{n(g.alive)}/{n(g.seated)}</span>
              </a>
            );
          })}
        </section>

        <section className="adm-panel" aria-labelledby="events-title" style={{ gap: 6 }}>
          <div className="adm-panel-head" style={{ paddingBottom: 6 }}>
            <h2 id="events-title">{t("eventsTitle")}</h2>
            <a href="/admin/system" className="small" style={{ fontWeight: 600, textDecoration: "none" }} onClick={(e) => { e.preventDefault(); go("system"); }}>{t("allEvents")}</a>
          </div>
          {data.events.length === 0 && <div className="adm-empty">{t("noEvents")}</div>}
          {data.events.map((e) => {
            const [bg, fg] = LEVEL_STYLE[e.level];
            return (
              <div key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 4px", borderTop: "1px solid #1E2138" }}>
                <span className="adm-tag" style={{ background: bg, color: fg }}>{t(e.level === "warning" ? "levelWarning" : e.level === "audit" ? "levelAudit" : "levelInfo")}</span>
                <span style={{ flex: 1, lineHeight: 1.4 }} dir="auto">{e.message}{e.reason ? ` · ${e.reason}` : ""}</span>
                <span className="tiny muted num">{time(e.at)}</span>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
