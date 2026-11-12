import { useEffect, useState } from "react";
import { adminApi } from "../adminApi";
import type { ActivityFeedItem, Funnel, Interactions, Page } from "../adminApi";
import { FEED_FLOWS, FUNNEL_FLOWS, type FeedFlow, type FunnelFlow } from "../adminApi";
import { DayBars, FunnelChart, Heatmap, Kpi, Meter, Section, flowColor, pct, useDwell, useDynamicLabel, useScreenLabel } from "../charts";
import { useAdminI18n } from "../i18n";
import { Header, PageState, gameName, openPlayer, roleName, useAdminData } from "../ui";
import { ScreenTable } from "./GameDetail";

const DAYS = [7, 30, 90] as const;
const FEED_PAGE = 25;
const JOURNEY_PAGE = 200;
const SESSION_GAP_MS = 30 * 60 * 1000;
const STEPS = [
  "screen_viewed", "screen_left", "signup_guest", "signup_google", "link_google",
  "mafia_lobby_joined", "mafia_game_started", "mafia_game_ended", "mafia_left_early",
  "puzzle_intro_viewed", "puzzle_started", "puzzle_completed",
  "couple_invite_sent", "couple_invite_accepted", "couple_question_answered",
  "friend_request_sent", "friend_added", "game_invite_sent", "game_invite_accepted",
] as const;

type Tab = "interactions" | "funnels" | "feed";
type Player = { id: string; name: string };

export function ActivityPage() {
  const { t, n } = useAdminI18n();
  const [tab, setTab] = useState<Tab>("interactions");
  const [days, setDays] = useState<(typeof DAYS)[number]>(7);
  const [player, setPlayer] = useState<Player | null>(null);

  const follow = (p: Player) => {
    setPlayer(p);
    setTab("feed");
    window.scrollTo(0, 0);
  };

  return (
    <main className="adm-main">
      <Header kicker={t("activityKicker")} title={t("activityTitle")}>
        {tab !== "feed" && (
          <div role="radiogroup" aria-label={t("range")} className="adm-seg">
            {DAYS.map((d) => (
              <button key={d} type="button" role="radio" aria-checked={days === d} onClick={() => setDays(d)}>{t("days", { count: n(d) })}</button>
            ))}
          </div>
        )}
      </Header>

      <div role="tablist" aria-label={t("activityTitle")} className="adm-tabs">
        {(["interactions", "funnels", "feed"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{t(`activityTab_${k}`)}</button>
        ))}
      </div>

      {tab === "interactions" && <InteractionsView days={days} onPlayer={follow} />}
      {tab === "funnels" && <Funnels days={days} />}
      {tab === "feed" && (player ? <Journey key={player.id} player={player} onClear={() => setPlayer(null)} /> : <ActivityFeed onPlayer={follow} />)}
    </main>
  );
}

// ------------------------------------------------------------------ interactions

function InteractionsView({ days, onPlayer }: { days: number; onPlayer(p: Player): void }) {
  const { t, n, lang, ago } = useAdminI18n();
  const data = useAdminData<Interactions>(`/interactions?days=${days}`);
  const label = useDynamicLabel();
  const dwell = useDwell();
  const screenLabel = useScreenLabel();
  const d = data.data;
  if (!d) return <PageState error={data.error} onRetry={data.reload} />;

  const flows = [...FEED_FLOWS.filter((f) => d.flows.some((x) => x.flow === f)), ...d.flows.map((f) => f.flow).filter((f) => !(FEED_FLOWS as readonly string[]).includes(f))];
  const maxFlow = Math.max(1, ...d.flows.map((f) => f.events));
  const s = d.social;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="adm-kpis">
        <Kpi label={t("ixEvents")} value={n(d.events)} note={t("ixEventsNote", { count: n(Math.round(d.events / Math.max(1, d.days))) })} />
        <Kpi label={t("ixPlayers")} value={n(d.users)} />
        <Kpi label={t("ixSessions")} value={n(d.sessions)} note={t("ixSessionNote", { time: dwell(d.medianSessionMs), count: n(d.medianEventsPerSession ?? 0) })} />
        <Kpi label={t("ixSignUps")} value={n(d.guestSignUps + d.googleSignUps)} note={t("ixSignUpsNote", { guest: n(d.guestSignUps), google: n(d.googleSignUps), links: n(d.googleLinks) })} />
      </div>

      <Section title={t("ixDaily")}>
        <DayBars mode="stack" label={t("ixDaily")}
          days={d.daily.map((day) => ({ date: day.date, values: flows.map((f) => day.flows.find((x) => x.key === f)?.count ?? 0) }))}
          series={flows.map((f) => ({ label: label("flow", f), color: flowColor(f) }))} />
      </Section>

      <div className="adm-grid">
        <Section title={t("heatmapTitle")} sub={t("heatmapNote")}>
          <Heatmap cells={d.heatmap} />
        </Section>
        <Section title={t("ixByFlow")}>
          {d.flows.length === 0 ? <div className="adm-empty">{t("noActivity")}</div> : d.flows.map((f) => (
            <Meter key={f.flow} label={label("flow", f.flow)} value={f.events} max={maxFlow} color={flowColor(f.flow)}
              right={t("ixFlowRight", { events: n(f.events), users: n(f.users) })} />
          ))}
        </Section>
      </div>

      <div className="adm-grid">
        <Section title={t("screensTitle")} sub={t("screensNote")} flush>
          {d.screens.length === 0 ? <div className="adm-empty">{t("noActivity")}</div> : <ScreenTable screens={d.screens} screenLabel={screenLabel} dwell={dwell} />}
        </Section>
        <Section title={t("ixSteps")} flush>
          {d.steps.length === 0 ? <div className="adm-empty">{t("noActivity")}</div> : (
            <div className="adm-table-wrap">
              <table className="adm-table" style={{ minWidth: 420 }}>
                <thead><tr><th scope="col">{t("colWhat")}</th><th scope="col">{t("colType")}</th><th scope="col">{t("ixEvents")}</th><th scope="col">{t("ixPlayers")}</th></tr></thead>
                <tbody>
                  {d.steps.map((st) => (
                    <tr key={`${st.flow}-${st.name}`}>
                      <td>{label("step", st.name)}</td>
                      <td><FlowTag flow={st.flow} /></td>
                      <td className="num">{n(st.events)}</td>
                      <td className="num">{n(st.users)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      <div className="adm-grid">
        <Section title={t("ixSocial")}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
            {[
              [n(s.friendshipsMade), t("ixFriendships")],
              [n(s.friendRequestsWaiting), t("ixRequestsWaiting")],
              [n(s.gameInvitesSent), t("ixInvitesSent")],
              [`${n(s.gameInvitesAccepted)} · ${pct(s.gameInvitesSent ? Math.round((100 * s.gameInvitesAccepted) / s.gameInvitesSent) : null, lang, n)}`, t("ixInvitesAccepted")],
              [n(s.couplesFormed), t("ixCouples")],
              [n(s.reports), t("ixReports")],
              [n(s.blocks), t("ixBlocks")],
            ].map(([v, l]) => (
              <div key={l} style={{ padding: "12px 8px", borderRadius: 12, background: "#0B0D1A", textAlign: "center" }}>
                <div className="num" style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>
                <div className="tiny muted">{l}</div>
              </div>
            ))}
          </div>
        </Section>
        <Section title={t("ixTopPlayers")} sub={t("ixTopPlayersNote")} flush>
          {d.topUsers.length === 0 ? <div className="adm-empty">{t("noActivity")}</div> : (
            <div className="adm-table-wrap">
              <table className="adm-table" style={{ minWidth: 480 }}>
                <thead><tr><th scope="col">{t("colPlayer")}</th><th scope="col">{t("ixEvents")}</th><th scope="col">{t("ixSessions")}</th><th scope="col">{t("colViews")}</th><th scope="col">{t("colLastSeen")}</th></tr></thead>
                <tbody>
                  {d.topUsers.map((u) => (
                    <tr key={u.userId}>
                      <td>
                        <button type="button" className="adm-rowbtn" style={{ minHeight: 32 }} onClick={() => onPlayer({ id: u.userId, name: u.name })}>
                          <span dir="auto">{u.name}</span>
                          {u.registered && <span className="adm-pill" style={{ padding: "1px 7px", fontSize: 11, background: "#13302C", color: "#5FD0BE" }}>{t("registeredBadge")}</span>}
                        </button>
                      </td>
                      <td className="num">{n(u.events)}</td>
                      <td className="num">{n(u.sessions)}</td>
                      <td className="num">{n(u.screens)}</td>
                      <td className="text-2">{ago(u.lastAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ funnels

function Funnels({ days }: { days: number }) {
  const { t } = useAdminI18n();
  const [flow, setFlow] = useState<FunnelFlow>("signup");
  const funnel = useAdminData<Funnel>(`/funnels/${flow}?days=${days}`);
  const label = useDynamicLabel();
  const flowLabel = (f: string) => label("flow", f);
  return (
    <>
      <div role="radiogroup" aria-label={t("funnelPick")} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {FUNNEL_FLOWS.map((f) => (
          <button key={f} type="button" role="radio" className="adm-chip" aria-checked={flow === f} onClick={() => setFlow(f)}>{flowLabel(f)}</button>
        ))}
      </div>
      <section className="adm-panel" aria-label={t("funnelTitle", { flow: flowLabel(flow) })}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{t("funnelTitle", { flow: flowLabel(flow) })}</h2>
        {!funnel.data ? <PageState error={funnel.error} onRetry={funnel.reload} /> : (
          <FunnelChart steps={funnel.data.steps} stepLabel={(name) => label("step", name)} />
        )}
      </section>
    </>
  );
}

// ------------------------------------------------------------------ feed

function FlowTag({ flow }: { flow: string }) {
  const label = useDynamicLabel();
  return <span className="adm-tag" style={{ background: "#1E2138", color: flowColor(flow) }}>{label("flow", flow)}</span>;
}

function parse(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    const v = JSON.parse(json) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The event's own detail, worded where we know the shape (screens, games, rounds…), raw "key: value" otherwise. */
function useEventDetail() {
  const { t, n, lang } = useAdminI18n();
  const label = useDynamicLabel();
  const dwell = useDwell();
  const screenLabel = useScreenLabel();
  return (e: ActivityFeedItem): string | null => {
    const p = parse(e.propertiesJson);
    const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : null);
    const num = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : null);
    const parts: string[] = [];
    switch (e.name) {
      case "screen_viewed": {
        const screen = str("screen");
        if (screen) parts.push(screenLabel(screen));
        const prev = str("previousScreen");
        if (prev) parts.push(t("detailFrom", { screen: screenLabel(prev), time: dwell(num("timeOnPreviousMs")) }));
        return parts.join(" · ") || null;
      }
      case "screen_left": {
        const screen = str("screen");
        return screen ? t("detailLeftAfter", { screen: screenLabel(screen), time: dwell(num("timeOnScreenMs")) }) : null;
      }
    }
    const game = str("game");
    if (game) parts.push(gameName(game, lang));
    const mode = str("mode");
    if (mode) parts.push(label("mode", mode));
    if (num("number") != null) parts.push(`#${n(num("number")!)}`);
    if (typeof p.solved === "boolean") parts.push(p.solved ? t("resultSolved") : t("resultNotSolved"));
    if (num("timeMs") != null) parts.push(dwell(num("timeMs")));
    if (num("moves") != null) parts.push(t("detailMoves", { count: n(num("moves")!) }));
    if (num("hints")) parts.push(t("detailHints", { count: n(num("hints")!) }));
    if (num("xp")) parts.push(t("detailXp", { count: n(num("xp")!) }));
    if (p.newBest === true) parts.push(t("detailNewBest"));
    if (p.host === true) parts.push(t("detailHost"));
    if (num("seats") != null) parts.push(t("detailSeats", { count: n(num("seats")!) }));
    if (num("round") != null) parts.push(t("detailRound", { round: n(num("round")!) }));
    const result = str("result");
    if (result) parts.push(result === "VillagersWin" ? t("outcomeTown") : result === "MafiaWin" ? t("outcomeMafia") : result === "JokerWins" ? t("outcomeJoker") : result);
    const role = str("role");
    if (role) parts.push(roleName(role, lang) ?? role);
    const kind = str("kind");
    if (kind) parts.push(gameName(kind, lang));
    if (num("count") != null) parts.push(t("detailPeople", { count: n(num("count")!) }));
    const via = str("via");
    if (via) parts.push(label("via", via));
    if (p.crawler === true) parts.push(t("botBadge"));
    return parts.length > 0 ? parts.join(" · ") : null;
  };
}

function ActivityFeed({ onPlayer }: { onPlayer(p: Player): void }) {
  const { t, n, ago, date } = useAdminI18n();
  const label = useDynamicLabel();
  const detail = useEventDetail();
  const [flow, setFlow] = useState<FeedFlow | null>(null);
  const [step, setStep] = useState("");
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load(before: number | null) {
    try {
      const q = new URLSearchParams({ pageSize: String(FEED_PAGE) });
      if (flow) q.set("flow", flow);
      if (step) q.set("name", step);
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
  }, [flow, step]);

  return (
    <section className="adm-panel flush" aria-labelledby="activity-log-title">
      <div className="adm-panel-head" style={{ padding: "16px 18px", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2 id="activity-log-title">{t("activityLog")}</h2>
          <span className="small muted">{t("feedHint")}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <div role="radiogroup" aria-label={t("activityLog")} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button type="button" role="radio" className="adm-chip" aria-checked={flow === null} onClick={() => setFlow(null)}>{t("filterAll")}</button>
            {FEED_FLOWS.map((f) => (
              <button key={f} type="button" role="radio" className="adm-chip" aria-checked={flow === f} onClick={() => setFlow(f)}>{label("flow", f)}</button>
            ))}
          </div>
          <label className="adm-label" style={{ minWidth: 180 }}>
            <span className="sr">{t("feedStep")}</span>
            <select className="adm-input" value={step} onChange={(e) => setStep(e.target.value)} style={{ minHeight: 36 }}>
              <option value="">{t("feedAllSteps")}</option>
              {STEPS.map((s) => <option key={s} value={s}>{label("step", s)}</option>)}
            </select>
          </label>
        </div>
      </div>
      {!loaded ? <div className="adm-loading" style={{ padding: 18 }}>{t("loading")}</div> : error ? <div style={{ padding: 18 }}><PageState error={error} onRetry={() => void load(null)} /></div> : items.length === 0 ? <div className="adm-empty">{t("noActivity")}</div> : (
        <div className="adm-table-wrap">
          <table className="adm-table" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th scope="col">{t("colTime")}</th>
                <th scope="col">{t("colType")}</th>
                <th scope="col">{t("colWhat")}</th>
                <th scope="col">{t("colPlayer")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => {
                const extra = detail(e);
                return (
                  <tr key={e.id}>
                    <td className="text-2 num" style={{ whiteSpace: "nowrap" }} title={date(e.at, true)}>{ago(e.at)}</td>
                    <td><FlowTag flow={e.flow} /></td>
                    <td>
                      {label("step", e.name)}
                      {extra && <div className="tiny muted" style={{ marginTop: 2 }} dir="auto">{extra}</div>}
                    </td>
                    <td>
                      {e.userId ? (
                        <button type="button" className="adm-rowbtn" style={{ minHeight: 32, fontWeight: 500 }} onClick={() => onPlayer({ id: e.userId!, name: e.userName ?? "?" })} title={t("feedFollow")}>
                          <span dir="auto">{e.userName ?? t("none")}</span>
                        </button>
                      ) : <span className="text-2">{t("none")}</span>}
                    </td>
                  </tr>
                );
              })}
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

// ------------------------------------------------------------------ one player's journey

/** One player's events, newest first, grouped into sessions (no gap longer than 30 minutes). */
function Journey({ player, onClear }: { player: Player; onClear(): void }) {
  const { t, n, date, time } = useAdminI18n();
  const label = useDynamicLabel();
  const detail = useEventDetail();
  const dwell = useDwell();
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load(before: number | null) {
    try {
      const q = new URLSearchParams({ pageSize: String(JOURNEY_PAGE), userId: player.id });
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
    void load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Newest first by time (ids are only roughly in time order), then split wherever the gap is over 30 minutes.
  const ordered = [...items].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const sessions: ActivityFeedItem[][] = [];
  for (const e of ordered) {
    const current = sessions[sessions.length - 1];
    const prev = current?.[current.length - 1];
    if (current && prev && new Date(prev.at).getTime() - new Date(e.at).getTime() <= SESSION_GAP_MS) current.push(e);
    else sessions.push([e]);
  }

  return (
    <section className="adm-panel" aria-labelledby="journey-title" style={{ gap: 14 }}>
      <div className="adm-panel-head" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2 id="journey-title" dir="auto">{t("journeyTitle", { name: player.name })}</h2>
          <span className="small muted">{t("journeyNote", { events: n(total), sessions: n(sessions.length) })}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="adm-btn" onClick={() => openPlayer(player.id)}>{t("journeyProfile")}</button>
          <button type="button" className="adm-btn" onClick={onClear}>{t("journeyBack")}</button>
        </div>
      </div>
      {!loaded ? <div className="adm-loading">{t("loading")}</div> : error ? <PageState error={error} onRetry={() => void load(null)} /> : items.length === 0 ? <div className="adm-empty">{t("noActivity")}</div> : (
        <>
          {sessions.map((session) => {
            const newest = session[0];
            const oldest = session[session.length - 1];
            const length = new Date(newest.at).getTime() - new Date(oldest.at).getTime();
            return (
              <div key={newest.id} className="adm-session">
                <div className="adm-session-head">
                  <b>{date(oldest.at, true)}</b>
                  <span className="small muted">{t("sessionLine", { time: dwell(length), count: n(session.length) })}</span>
                </div>
                <ol className="adm-timeline">
                  {session.map((e) => {
                    const extra = detail(e);
                    return (
                      <li key={e.id}>
                        <span className="adm-dot" style={{ background: flowColor(e.flow) }} aria-hidden="true" />
                        <span className="tiny muted num" style={{ minWidth: 48 }}>{time(e.at)}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          {label("step", e.name)}
                          {extra && <span className="tiny muted" dir="auto" style={{ display: "block" }}>{extra}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
          {items.length < total && (
            <button type="button" className="adm-btn" style={{ alignSelf: "center" }} onClick={() => void load(items[items.length - 1]?.id ?? null)}>{t("loadOlder")}</button>
          )}
        </>
      )}
    </section>
  );
}
