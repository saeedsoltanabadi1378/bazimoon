import { useEffect, useState } from "react";
import { adminApi, type AdminEvent, type ServiceStatus } from "../adminApi";
import { useAdminI18n } from "../i18n";
import { Header, LEVEL_STYLE, PageState, StatusPill, useAdminData, useServiceText } from "../ui";

const FILTERS = [null, "warning", "audit", "info"] as const;
const PAGE = 25;

export function SystemPage() {
  const { t, n, date } = useAdminI18n();
  const health = useAdminData<ServiceStatus[]>("/health");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(null);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const serviceText = useServiceText();

  useEffect(() => {
    const id = window.setInterval(health.reload, 30_000);
    return () => window.clearInterval(id);
  }, [health.reload]);

  async function load(before: number | null) {
    try {
      const q = new URLSearchParams({ pageSize: String(PAGE) });
      if (filter) q.set("level", filter);
      if (before) q.set("before", String(before));
      const page = await adminApi.get<{ items: AdminEvent[]; total: number }>(`/events?${q}`);
      setEvents((old) => (before ? [...old, ...page.items] : page.items));
      setTotal(page.total);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    setLoaded(false);
    void load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const filterLabel = (f: (typeof FILTERS)[number]) => (f === "warning" ? t("filterWarnings") : f === "audit" ? t("filterAudit") : f === "info" ? t("filterInfo") : t("filterAll"));
  const levelLabel = (l: AdminEvent["level"]) => (l === "warning" ? t("levelWarning") : l === "audit" ? t("levelAudit") : t("levelInfo"));
  const target = (e: AdminEvent) => (e.targetType ? `${e.targetType}${e.targetId ? ` · ${e.targetId.slice(0, 8)}` : ""}` : t("none"));

  return (
    <main className="adm-main">
      <Header kicker={t("opsKicker")} title={t("systemTitle")}>
        <span className="small text-2">{t("checkedAgo")}</span>
      </Header>

      {!health.data ? <PageState error={health.error} onRetry={health.reload} /> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(230px, 100%), 1fr))", gap: 12 }}>
          {health.data.map((s) => (
            <article key={s.key} className="adm-panel" style={{ gap: 8, padding: 16, borderRadius: 18, border: `1px solid ${s.status === "healthy" ? "#1E2138" : s.status === "degraded" ? "#5A4120" : "#5A2A2A"}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600 }}>{t(`svc_${s.key}`)}</h2>
                <StatusPill status={s.status} />
              </div>
              <span className="small text-2" style={{ lineHeight: 1.4 }}>{serviceText(s)}</span>
            </article>
          ))}
        </div>
      )}

      <section className="adm-panel flush" aria-labelledby="log-title">
        <div className="adm-panel-head" style={{ padding: "16px 18px", alignItems: "center" }}>
          <h2 id="log-title">{t("logTitle")}</h2>
          <div role="radiogroup" aria-label={t("filterEvents")} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {FILTERS.map((f) => (
              <button key={f ?? "all"} type="button" role="radio" className="adm-chip" aria-checked={filter === f} onClick={() => setFilter(f)}>{filterLabel(f)}</button>
            ))}
          </div>
        </div>
        {!loaded ? <div className="adm-loading" style={{ padding: 18 }}>{t("loading")}</div> : error ? <div style={{ padding: 18 }}><PageState error={error} onRetry={() => void load(null)} /></div> : events.length === 0 ? <div className="adm-empty">{t("noEvents")}</div> : (
          <div className="adm-table-wrap">
            <table className="adm-table" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th scope="col">{t("colTime")}</th>
                  <th scope="col">{t("colType")}</th>
                  <th scope="col">{t("colWhat")}</th>
                  <th scope="col">{t("colTarget")}</th>
                  <th scope="col">{t("colBy")}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const [bg, fg] = LEVEL_STYLE[e.level];
                  return (
                    <tr key={e.id}>
                      <td className="text-2 num" style={{ whiteSpace: "nowrap" }}>{date(e.at, true)}</td>
                      <td><span className="adm-tag" style={{ background: bg, color: fg }}>{levelLabel(e.level)}</span></td>
                      <td style={{ lineHeight: 1.4 }} dir="auto">{e.message}{e.reason ? ` · ${e.reason}` : ""}</td>
                      <td className="text-2" style={{ whiteSpace: "nowrap" }} dir="ltr">{target(e)}</td>
                      <td className="text-2">{e.actor ?? t("system")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderTop: "1px solid #1E2138" }} className="small muted">
          <span>{t("showing", { shown: n(events.length), total: n(total) })}</span>
          <button type="button" className="adm-btn" style={{ minHeight: 40, fontSize: 13 }} disabled={events.length >= total} onClick={() => void load(events[events.length - 1]?.id ?? null)}>{t("loadOlder")}</button>
        </div>
      </section>
    </main>
  );
}
