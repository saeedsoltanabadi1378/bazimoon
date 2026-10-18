import { useEffect, useState } from "react";
import type { ActivityItem, ChatRow, Page, PlayerDetail, PlayerRow } from "../adminApi";
import { useAdminI18n } from "../i18n";
import { AVATAR_COLORS, divisionName, Header, PageState, PHASE_COLORS, Search, Svg, ICONS, formatDuration, gameName, initial, roleName, useAdminData, usePhaseLabel } from "../ui";

export function PlayersPage() {
  const { t, n, ago, date, lang } = useAdminI18n();
  const [tab, setTab] = useState<0 | 1>(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const players = useAdminData<Page<PlayerRow>>(`/players?pageSize=50&search=${encodeURIComponent(query)}`);
  const chats = useAdminData<Page<ChatRow>>(`/chats?pageSize=50&search=${encodeURIComponent(query)}`);
  const phaseLabel = usePhaseLabel();
  const phaseShort = (phase: string) => (phase === "Night" || phase === "NightZero" ? t("phaseNightShort") : phase === "Day" ? t("phaseDayShort") : phaseLabel(phase, 0));

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const rows = players.data?.items ?? [];
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];
  const detail = useAdminData<PlayerDetail>(selected ? `/players/${selected.id}` : null);
  const data = tab === 0 ? players : chats;

  return (
    <main className="adm-main">
      <Header kicker={t("peopleKicker")} title={t("playersTitle")}>
        <Search label={t("searchPlayers")} placeholder={t("searchPlayers")} value={search} onChange={setSearch} />
      </Header>

      <div role="tablist" aria-label={t("playersTitle")} className="adm-tabs">
        <button type="button" role="tab" aria-selected={tab === 0} onClick={() => setTab(0)}>{t("tabPlayers", { count: players.data?.total ?? 0 })}</button>
        <button type="button" role="tab" aria-selected={tab === 1} onClick={() => setTab(1)}>{t("tabChats", { count: chats.data?.total ?? 0 })}</button>
      </div>

      {!data.data ? <PageState error={data.error} onRetry={data.reload} /> : tab === 0 ? (
        <div className="adm-split">
          <section className="adm-panel flush wide" aria-label={t("navPlayers")}>
            {rows.length === 0 ? <div className="adm-empty">{t("noPlayers")}</div> : (
              <div className="adm-table-wrap">
                <table className="adm-table" style={{ minWidth: 640 }}>
                  <thead>
                    <tr>
                      <th scope="col">{t("colPlayer")}</th>
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
                                <span>{p.name}</span>
                                <span className="tiny muted num" style={{ fontWeight: 400 }} dir="ltr">{p.id}</span>
                              </span>
                            </button>
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
              <PlayerPanel d={detail.data} color={AVATAR_COLORS[Math.max(0, rows.findIndex((r) => r.id === detail.data!.id)) % AVATAR_COLORS.length]} />
            )}
          </aside>
        </div>
      ) : (
        <section className="adm-panel flush" aria-label={t("tabChats", { count: chats.data?.total ?? 0 })}>
          {(chats.data?.items.length ?? 0) === 0 ? <div className="adm-empty">{t("noChats")}</div> : (
            <div className="adm-table-wrap">
              <table className="adm-table" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th scope="col">{t("colChat")}</th>
                    <th scope="col">{t("colMembers")}</th>
                    <th scope="col">{t("colMafiaGames")}</th>
                    <th scope="col">{t("colTableNow")}</th>
                    <th scope="col">{t("colLastGame")}</th>
                  </tr>
                </thead>
                <tbody>
                  {chats.data!.items.map((c) => {
                    const [bg, fg] = c.livePhase ? PHASE_COLORS[c.livePhase] ?? PHASE_COLORS.Lobby : ["#1E2138", "#C9C8DC"];
                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontWeight: 600 }}>{c.title ?? t("unnamedChat", { id: String(c.id) })}</span>
                            <span className="tiny muted num" dir="ltr" style={{ textAlign: "start" }}>{c.id}</span>
                          </div>
                        </td>
                        <td className="num">{n(c.members)}</td>
                        <td className="num">{n(c.games)}</td>
                        <td><span className="adm-pill" style={{ background: bg, color: fg }}>{c.livePhase ? phaseShort(c.livePhase) : t("noTable")}</span></td>
                        <td className="text-2">{c.lastGame ? date(c.lastGame) : t("none")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

const roman = (tier: number) => ["", "I", "II", "III"][tier] ?? "";

function PlayerPanel({ d, color }: { d: PlayerDetail; color: string }) {
  const { t, n, date, ago, lang } = useAdminI18n();
  const stats: [string, string][] = [
    [n(d.mafiaGames), t("statMafiaGames")],
    [`${n(d.mafiaWinRate)}${lang === "fa" ? "٪" : "%"}`, t("statWinRate")],
    [n(d.puzzlesSolved), t("statSolved")],
    [n(d.bestStreak), t("statBestStreak")],
    [n(d.freezes), t("statFreezes")],
    [n(d.xp), t("statXp")],
  ];
  const activity = (a: ActivityItem) => {
    if (a.kind === "puzzle") {
      const label = { game: gameName(a.game, lang), number: a.number ? ` #${n(a.number)}` : "" };
      const text = a.won ? t("actPuzzleSolved", label) : t("actPuzzleFailed", label);
      return a.won && a.timeMs ? `${text} · ${formatDuration(a.timeMs, n)}` : text;
    }
    const delta = a.ratingDelta == null ? t("none") : `${a.ratingDelta >= 0 ? "+" : "−"}${n(Math.abs(a.ratingDelta))}`;
    return (a.won ? t("actMafiaWon", { role: roleName(a.role, lang) ?? "", delta }) : t("actMafiaLost", { role: roleName(a.role, lang) ?? "", delta }));
  };
  const pct = (part: number, whole: number) => (whole === 0 ? t("none") : `${n(Math.round((100 * part) / whole))}${lang === "fa" ? "٪" : "%"}`);
  const couple = d.couple.status === "active" ? t("coupleActive", { name: d.couple.partnerName ?? "?", date: d.couple.since ? date(d.couple.since) : t("none") })
    : d.couple.status === "pending" ? t("couplePending") : t("coupleNone");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="adm-avatar display" style={{ width: 52, height: 52, fontSize: 22, fontWeight: 800, background: color, color: "#0B0D1A" }}>{initial(d.name)}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <h2 id="player-title" className="display" style={{ fontSize: 22, fontWeight: 800 }}>{d.name}</h2>
          <span className="small muted">{t("telegramId", { id: String(d.id), date: date(d.joined) })}</span>
        </div>
      </div>
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
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span className="small" style={{ fontWeight: 600, paddingBottom: 6 }}>{t("recentActivity")}</span>
        {d.recent.length === 0 && <span className="small muted">{t("noActivity")}</span>}
        {d.recent.map((a, i) => (
          <div key={i} className="adm-row" style={{ minHeight: 38, justifyContent: "space-between", fontSize: 13 }}>
            <span>{activity(a)}</span>
            <span className="muted" style={{ whiteSpace: "nowrap" }}>{ago(a.at)}</span>
          </div>
        ))}
      </div>
      <div className="adm-note">
        <Svg d={ICONS.lock} size={16} stroke="#F2A7C3" />
        <span>{couple}</span>
      </div>
    </>
  );
}
