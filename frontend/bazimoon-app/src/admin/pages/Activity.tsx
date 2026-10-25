import { useEffect, useState } from "react";
import { adminApi } from "../adminApi";
import type { ActivityFeedItem, Funnel, Page } from "../adminApi";
import { FEED_FLOWS, FUNNEL_FLOWS, type FeedFlow, type FunnelFlow } from "../adminApi";
import { useAdminI18n } from "../i18n";
import { Header, PageState, useAdminData } from "../ui";

const DAYS = [7, 30, 90] as const;
const FEED_PAGE = 25;

export function ActivityPage() {
  const { t } = useAdminI18n();
  const [flow, setFlow] = useState<FunnelFlow>("signup");
  const [days, setDays] = useState<(typeof DAYS)[number]>(30);
  const funnel = useAdminData<Funnel>(`/funnels/${flow}?days=${days}`);

  const flowLabel = (f: FunnelFlow) => t(`flow_${f}` as const);

  return (
    <main className="adm-main">
      <Header kicker={t("activityKicker")} title={t("activityTitle")}>
        <div role="radiogroup" aria-label={t("range")} className="adm-seg">
          {DAYS.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={days === d} onClick={() => setDays(d)}>{t("days", { count: d })}</button>
          ))}
        </div>
      </Header>

      <div role="tablist" aria-label={t("activityTitle")} className="adm-tabs">
        {FUNNEL_FLOWS.map((f) => (
          <button key={f} type="button" role="tab" aria-selected={flow === f} onClick={() => setFlow(f)}>{flowLabel(f)}</button>
        ))}
      </div>

      <section className="adm-panel" aria-label={t("funnelTitle")}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{t("funnelTitle", { flow: flowLabel(flow) })}</h2>
        {!funnel.data ? <PageState error={funnel.error} onRetry={funnel.reload} /> : (
          <FunnelChart funnel={funnel.data} />
        )}
      </section>

      <ActivityFeed />
    </main>
  );
}

/** Step/flow names come from the server as plain strings; the `step_<name>`/`flow_<name>` i18n keys
 * cover every one the backend can send (see ActivityEvents on the server), so this cast is safe. */
function dynamicLabel(t: ReturnType<typeof useAdminI18n>["t"], prefix: "step" | "flow", name: string): string {
  const key = `${prefix}_${name}` as unknown as Parameters<typeof t>[0];
  return t(key);
}
const stepLabel = (t: ReturnType<typeof useAdminI18n>["t"], name: string) => dynamicLabel(t, "step", name);

/** The event's own extra detail, compacted to "key: value, key: value" — not translated (it's raw
 * data from whatever step logged it), skipping anything falsy or too long to stay readable inline. */
function propertiesText(json: string | null): string | null {
  if (!json) return null;
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    const parts = Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${v}`);
    return parts.length > 0 ? parts.join(", ") : null;
  } catch {
    return null;
  }
}

function FunnelChart({ funnel }: { funnel: Funnel }) {
  const { t, n } = useAdminI18n();
  if (funnel.steps.length === 0) return <div className="adm-empty">{t("noActivity")}</div>;
  const max = funnel.steps[0]?.users || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 6 }}>
      {funnel.steps.map((s, i) => (
        <div key={s.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <span className="small" style={{ fontWeight: 600 }}>{stepLabel(t, s.name)}</span>
            <span className="small num">
              {n(s.users)}
              <span className="muted"> · {n(s.pctOfFirst)}%</span>
              {i > 0 && <span className="muted"> · {t("ofPrevious", { pct: n(s.pctOfPrevious) })}</span>}
            </span>
          </div>
          <div style={{ height: 14, borderRadius: 999, background: "#0B0D1A", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.max(2, Math.round((100 * s.users) / max))}%`, borderRadius: 999, background: "#F0A83A" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityFeed() {
  const { t, n, ago } = useAdminI18n();
  const [flow, setFlow] = useState<FeedFlow | null>(null);
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load(before: number | null) {
    try {
      const q = new URLSearchParams({ pageSize: String(FEED_PAGE) });
      if (flow) q.set("flow", flow);
      if (before) q.set("before", String(before));
      const page = await adminApi.get<Page<ActivityFeedItem>>(`/activity?${q}`);
      setItems((old) => (before ? [...old, ...page.items] : page.items));
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
  }, [flow]);

  const feedFlowLabel = (f: FeedFlow | null) => (f ? dynamicLabel(t, "flow", f) : t("filterAll"));

  return (
    <section className="adm-panel flush" aria-labelledby="activity-log-title">
      <div className="adm-panel-head" style={{ padding: "16px 18px", alignItems: "center" }}>
        <h2 id="activity-log-title">{t("activityLog")}</h2>
        <div role="radiogroup" aria-label={t("activityLog")} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button type="button" role="radio" className="adm-chip" aria-checked={flow === null} onClick={() => setFlow(null)}>{t("filterAll")}</button>
          {FEED_FLOWS.map((f) => (
            <button key={f} type="button" role="radio" className="adm-chip" aria-checked={flow === f} onClick={() => setFlow(f)}>{feedFlowLabel(f)}</button>
          ))}
        </div>
      </div>
      {!loaded ? <div className="adm-loading" style={{ padding: 18 }}>{t("loading")}</div> : error ? <div style={{ padding: 18 }}><PageState error={error} onRetry={() => void load(null)} /></div> : items.length === 0 ? <div className="adm-empty">{t("noActivity")}</div> : (
        <div className="adm-table-wrap">
          <table className="adm-table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th scope="col">{t("colTime")}</th>
                <th scope="col">{t("colType")}</th>
                <th scope="col">{t("colWhat")}</th>
                <th scope="col">{t("colPlayer")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td className="text-2 num" style={{ whiteSpace: "nowrap" }}>{ago(e.at)}</td>
                  <td><span className="adm-tag" style={{ background: "#1E2138", color: "#9C8CFF" }}>{dynamicLabel(t, "flow", e.flow)}</span></td>
                  <td dir="auto">
                    {stepLabel(t, e.name)}
                    {propertiesText(e.propertiesJson) && <div className="tiny muted" dir="ltr" style={{ marginTop: 2 }}>{propertiesText(e.propertiesJson)}</div>}
                  </td>
                  <td className="text-2" dir="auto">{e.userName ?? t("none")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderTop: "1px solid #1E2138" }} className="small muted">
        <span>{t("showingActivity", { shown: n(items.length), total: n(total) })}</span>
        <button type="button" className="adm-btn" style={{ minHeight: 40, fontSize: 13 }} disabled={items.length >= total} onClick={() => void load(items[items.length - 1]?.id ?? null)}>{t("loadOlder")}</button>
      </div>
    </section>
  );
}
