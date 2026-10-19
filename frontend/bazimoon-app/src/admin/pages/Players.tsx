import { useEffect, useState } from "react";
import { adminApi } from "../adminApi";
import type { AcquisitionSummary, ActivityItem, Page, PlayerDetail, PlayerRow } from "../adminApi";
import { useAdminI18n } from "../i18n";
import { AVATAR_COLORS, divisionName, Header, PageState, Search, Svg, ICONS, formatDuration, gameName, initial, roleName, useAdminData } from "../ui";

const ACTIVITY_FILTERS = [null, "mafia", "puzzle", "admin"] as const;
const ACTIVITY_PAGE = 10;

export function PlayersPage() {
  const { t, n, ago, lang } = useAdminI18n();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bots, setBots] = useState(false);
  const [source, setSource] = useState("");
  const [campaign, setCampaign] = useState("");
  const filters = new URLSearchParams({ pageSize: "50", bots: String(bots), search: query });
  if (source) filters.set("source", source);
  if (campaign) filters.set("campaign", campaign);
  const players = useAdminData<Page<PlayerRow>>(`/players?${filters}`);
  const acquisition = useAdminData<AcquisitionSummary>(`/players/acquisition?bots=${bots}`);

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const rows = players.data?.items ?? [];
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];
  const detail = useAdminData<PlayerDetail>(selected ? `/players/${selected.id}` : null);
  const data = players;

  return (
    <main className="adm-main">
      <Header kicker={t("peopleKicker")} title={t("playersTitle")}>
        <Search label={t("searchPlayers")} placeholder={t("searchPlayers")} value={search} onChange={setSearch} />
      </Header>

      <div role="tablist" aria-label={t("navPlayers")} className="adm-tabs">
        {[false, true].map((b) => {
          const count = players.data ? (b === bots ? players.data.total : players.data.otherTotal ?? 0) : 0;
          return (
            <button key={String(b)} type="button" role="tab" aria-selected={bots === b} onClick={() => { setBots(b); setSelectedId(null); setSource(""); setCampaign(""); }}>
              {t(b ? "tabBots" : "tabPlayers", { count: n(count) })}
            </button>
          );
        })}
      </div>

      {acquisition.data && (
        <section className="adm-panel" aria-labelledby="acquisition-title" style={{ gap: 12 }}>
          <div className="adm-panel-head">
            <div>
              <h2 id="acquisition-title">{t("acquisitionSources")}</h2>
              <span className="small muted">{t("acquisitionSummary", { count: n(acquisition.data.total) })}</span>
            </div>
            <label className="adm-label" style={{ minWidth: 190 }}>
              <span>{t("campaignFilter")}</span>
              <select className="adm-input" value={campaign} onChange={(e) => { setCampaign(e.target.value); setSelectedId(null); }}>
                <option value="">{t("allCampaigns")}</option>
                {acquisition.data.campaigns.map((item) => <option key={item.value} value={item.value}>{item.value} ({n(item.players)})</option>)}
              </select>
            </label>
          </div>
          <div role="radiogroup" aria-label={t("acquisitionSources")} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" role="radio" className="adm-chip" aria-checked={!source} onClick={() => { setSource(""); setSelectedId(null); }}>{t("allSources")}</button>
            {acquisition.data.sources.map((item) => (
              <button key={item.value} type="button" role="radio" className="adm-chip" aria-checked={source === item.value} onClick={() => { setSource(item.value); setSelectedId(null); }}>
                {sourceName(item.value, t)} · {n(item.players)}
              </button>
            ))}
          </div>
        </section>
      )}

      {!data.data ? <PageState error={data.error} onRetry={data.reload} /> : (
        <div className="adm-split">
          <section className="adm-panel flush wide" aria-label={t("navPlayers")}>
            {rows.length === 0 ? <div className="adm-empty">{t(bots && !query ? "noBots" : "noPlayers")}</div> : (
              <div className="adm-table-wrap">
                <table className="adm-table" style={{ minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th scope="col">{t("colPlayer")}</th>
                      <th scope="col">{t("colSource")}</th>
                      <th scope="col">{t("colLevel")}</th>
                      <th scope="col">{t("colRating")}</th>
                      <th scope="col">{t("colStreak")}</th>
                      <th scope="col">{t("colLanguage")}</th>
                      <th scope="col">{t("colLastSeen")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p, i) => {
                      const on = selected?.id === p.id;
                      return (
                        <tr key={p.id} className={on ? "on" : undefined}>
                          <td>
                            <button type="button" className="adm-rowbtn" aria-pressed={on} onClick={() => setSelectedId(p.id)}>
                              <span className="adm-avatar" style={{ width: 30, height: 30, fontSize: 12, background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: "#0B0D1A" }}>{initial(p.name)}</span>
                              <span style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {p.name}
                                  {p.isBot && <span className="adm-pill" style={{ padding: "1px 7px", fontSize: 11, background: "#1E2138", color: "#8FA8FF" }}>{t("botBadge")}</span>}
                                </span>
                                <span className="tiny muted num" style={{ fontWeight: 400 }} dir="ltr">{p.id}</span>
                              </span>
                            </button>
                          </td>
                          <td>
                            <span className="adm-pill" style={{ background: "#1E2138", color: "#C9C8DC" }} dir="ltr">{sourceName(p.source, t)} / {p.medium}</span>
                            {p.campaign && <span className="tiny muted" style={{ display: "block", paddingTop: 3 }} dir="auto">{p.campaign}</span>}
                          </td>
                          <td className="num">{n(p.level)}</td>
                          <td className="num">{n(p.rating)} <span className="muted">· {divisionName(p.division, lang)} {roman(p.tier)}</span></td>
                          <td className="num">{p.streak ? t("days", { count: p.streak }) : t("none")}</td>
                          <td className="text-2">{p.language === "fa" ? "فارسی" : "English"}</td>
                          <td className="text-2">{ago(p.lastSeen)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="adm-panel side" aria-labelledby="player-title" style={{ gap: 14 }}>
            {!detail.data || detail.data.id !== selected?.id ? <PageState error={detail.error} onRetry={detail.reload} /> : (
              <PlayerPanel d={detail.data} onBotChanged={() => { setSelectedId(null); players.reload(); }} color={AVATAR_COLORS[Math.max(0, rows.findIndex((r) => r.id === detail.data!.id)) % AVATAR_COLORS.length]} />
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

const roman = (tier: number) => ["", "I", "II", "III"][tier] ?? "";

function sourceName(source: string, t: ReturnType<typeof useAdminI18n>["t"]) {
  if (source === "direct") return t("sourceDirect");
  if (source === "unknown") return t("sourceUnknown");
  if (source === "chatgpt") return "ChatGPT";
  if (source === "gemini") return "Gemini";
  if (source === "google") return "Google";
  return source;
}

function PlayerPanel({ d, color, onBotChanged }: { d: PlayerDetail; color: string; onBotChanged: () => void }) {
  const { t, n, date, lang } = useAdminI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggleBot = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.put(`/players/${d.id}/bot`, { isBot: !d.isBot });
      onBotChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const stats: [string, string][] = [
    [n(d.mafiaGames), t("statMafiaGames")],
    [`${n(d.mafiaWinRate)}${lang === "fa" ? "٪" : "%"}`, t("statWinRate")],
    [n(d.puzzlesSolved), t("statSolved")],
    [n(d.bestStreak), t("statBestStreak")],
    [n(d.freezes), t("statFreezes")],
    [n(d.xp), t("statXp")],
  ];
  const pct = (part: number, whole: number) => (whole === 0 ? t("none") : `${n(Math.round((100 * part) / whole))}${lang === "fa" ? "٪" : "%"}`);
  const couple = d.couple.status === "active" ? t("coupleActive", { name: d.couple.partnerName ?? "?", date: d.couple.since ? date(d.couple.since) : t("none") })
    : d.couple.status === "pending" ? t("couplePending") : t("coupleNone");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="adm-avatar display" style={{ width: 52, height: 52, fontSize: 22, fontWeight: 800, background: color, color: "#0B0D1A" }}>{initial(d.name)}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <h2 id="player-title" className="display" style={{ fontSize: 22, fontWeight: 800 }}>{d.name}</h2>
          <span className="small muted">{t("playerId", { id: d.id, date: date(d.joined) })}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 12, background: "#0B0D1A" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{d.isBot ? t("botMarked") : t("botReal")}</span>
          <button type="button" className={d.isBot ? "adm-btn" : "adm-btn primary"} disabled={busy} onClick={toggleBot}>{d.isBot ? t("unmarkBot") : t("markBot")}</button>
        </div>
        {d.isBot && d.botReason && (
          <span className="small text-2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8FA8FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}><rect x="5" y="8" width="14" height="11" rx="2" /><path d="M12 4v4M9 13h.01M15 13h.01" /></svg>
            <span>{d.botReason === "crawler"
              ? t("botAuto", { date: d.botMarkedAt ? date(d.botMarkedAt) : t("none") })
              : t("botByAdmin", { name: d.botMarkedBy ?? "admin", date: d.botMarkedAt ? date(d.botMarkedAt) : t("none") })}</span>
          </span>
        )}
        <span className="tiny muted" style={{ lineHeight: 1.45 }}>{t("botNote")}</span>
        {error && <span className="tiny" role="alert" style={{ color: "#F08A7A" }}>{error}</span>}
      </div>
      {d.acquisition && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 12, background: "#0B0D1A" }}>
          <span className="small" style={{ fontWeight: 600 }}>{t("acquisitionTitle")}</span>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span className="adm-pill" style={{ background: "#262A44", color: "#F0A83A" }} dir="ltr">{sourceName(d.acquisition.source, t)} / {d.acquisition.medium}</span>
            <span className="tiny muted">{t("firstTouch")}: {date(d.acquisition.firstSeenAt, true)}</span>
          </div>
          {d.acquisition.campaign && <AcquisitionLine label={t("campaign")} value={d.acquisition.campaign} />}
          {d.acquisition.term && <AcquisitionLine label={t("utmTerm")} value={d.acquisition.term} />}
          {d.acquisition.content && <AcquisitionLine label={t("utmContent")} value={d.acquisition.content} />}
          {d.acquisition.landingPath && <AcquisitionLine label={t("landingPath")} value={d.acquisition.landingPath} ltr />}
          {d.acquisition.referrer && <AcquisitionLine label={t("referrer")} value={d.acquisition.referrer} ltr />}
          {d.acquisition.gclid && <AcquisitionLine label={t("googleClickId")} value={d.acquisition.gclid} ltr />}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {stats.map(([v, l]) => (
          <div key={l} style={{ padding: "10px 8px", borderRadius: 12, background: "#0B0D1A", textAlign: "center" }}>
            <div className="num" style={{ fontSize: 17, fontWeight: 700 }}>{v}</div>
            <div className="tiny muted">{l}</div>
          </div>
        ))}
      </div>
      {d.mafiaByRole && d.mafiaByRole.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span className="small" style={{ fontWeight: 600, paddingBottom: 6 }}>{t("mafiaByRole")}</span>
          {d.mafiaByRole.map((r) => (
            <div key={r.role} className="adm-row num" style={{ minHeight: 34, justifyContent: "space-between", fontSize: 13 }}>
              <span>{roleName(r.role, lang) ?? r.role}</span>
              <span className="muted">{t("roleGamesWon", { games: n(r.games), rate: n(r.winRate) })}</span>
            </div>
          ))}
          {d.mafiaSkills && d.mafiaSkills.trackedGames > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, paddingTop: 8 }}>
              {[
                [pct(d.mafiaSkills.mafiaFound, d.mafiaSkills.checksMade), t("skillDetective")],
                [n(d.mafiaSkills.killsBlocked), t("skillDoctor")],
                [pct(d.mafiaSkills.votesOnMafia, d.mafiaSkills.votesCast), t("skillVote")],
              ].map(([v, l]) => (
                <div key={l} style={{ padding: 8, borderRadius: 10, background: "#0B0D1A", textAlign: "center" }}>
                  <div className="num" style={{ fontSize: 15, fontWeight: 700 }}>{v}</div>
                  <div className="tiny muted">{l}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <ActivityLog playerId={d.id} />
      <div className="adm-note">
        <Svg d={ICONS.lock} size={16} stroke="#F2A7C3" />
        <span>{couple}</span>
      </div>
    </>
  );
}

function AcquisitionLine({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="small" style={{ display: "grid", gridTemplateColumns: "minmax(90px, auto) minmax(0, 1fr)", gap: 8 }}>
      <span className="muted">{label}</span>
      <span style={{ overflowWrap: "anywhere" }} dir={ltr ? "ltr" : "auto"}>{value}</span>
    </div>
  );
}

function ActivityLog({ playerId }: { playerId: string }) {
  const { t, n, ago, lang } = useAdminI18n();
  const [kind, setKind] = useState<(typeof ACTIVITY_FILTERS)[number]>(null);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load(nextPage: number) {
    try {
      const q = new URLSearchParams({ page: String(nextPage), pageSize: String(ACTIVITY_PAGE) });
      if (kind) q.set("kind", kind);
      const res = await adminApi.get<Page<ActivityItem>>(`/players/${playerId}/activity?${q}`);
      setItems((old) => (nextPage === 1 ? res.items : [...old, ...res.items]));
      setTotal(res.total);
      setPage(nextPage);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    setLoaded(false);
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, kind]);

  const filterLabel = (f: (typeof ACTIVITY_FILTERS)[number]) =>
    f === "mafia" ? t("mafia") : f === "puzzle" ? t("puzzles") : f === "admin" ? t("activityAdmin") : t("filterAll");

  const describe = (a: ActivityItem) => {
    if (a.kind === "puzzle") {
      const label = { game: gameName(a.game, lang), number: a.number ? ` #${n(a.number)}` : "" };
      const text = a.won ? t("actPuzzleSolved", label) : t("actPuzzleFailed", label);
      return a.won && a.timeMs ? `${text} · ${formatDuration(a.timeMs, n)}` : text;
    }
    if (a.kind === "mafia") {
      const delta = a.ratingDelta == null ? t("none") : `${a.ratingDelta >= 0 ? "+" : "−"}${n(Math.abs(a.ratingDelta))}`;
      return a.won ? t("actMafiaWon", { role: roleName(a.role, lang) ?? "", delta }) : t("actMafiaLost", { role: roleName(a.role, lang) ?? "", delta });
    }
    return a.message ?? "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span className="small" style={{ fontWeight: 600 }}>{t("activityLog")}</span>
        <div role="radiogroup" aria-label={t("activityLog")} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ACTIVITY_FILTERS.map((f) => (
            <button key={f ?? "all"} type="button" role="radio" className="adm-chip" aria-checked={kind === f} onClick={() => setKind(f)}>{filterLabel(f)}</button>
          ))}
        </div>
      </div>
      {!loaded ? <span className="small muted">{t("loading")}</span> : error ? <PageState error={error} onRetry={() => void load(1)} /> : items.length === 0 ? <span className="small muted">{t("noActivity")}</span> : (
        <>
          {items.map((a, i) => (
            <div key={i} className="adm-row" style={{ minHeight: 38, justifyContent: "space-between", gap: 10, fontSize: 13 }}>
              <span dir="auto">{describe(a)}{a.kind === "admin" && a.actor ? ` · ${a.actor}` : ""}</span>
              <span className="muted" style={{ whiteSpace: "nowrap" }}>{ago(a.at)}</span>
            </div>
          ))}
          {items.length < total && (
            <button type="button" className="adm-btn" style={{ alignSelf: "center", minHeight: 36, fontSize: 13 }} onClick={() => void load(page + 1)}>{t("loadOlder")}</button>
          )}
        </>
      )}
    </div>
  );
}
