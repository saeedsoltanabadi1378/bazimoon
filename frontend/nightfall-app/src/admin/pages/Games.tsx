import { useEffect, useState } from "react";
import { adminApi, type LiveGame, type Page, type PastGame, type PlayerInGame } from "../adminApi";
import { useAdminI18n } from "../i18n";
import { AVATAR_COLORS, Header, PageState, PHASE_COLORS, Search, formatDuration, initial, roleName, useAdminData, useLiveDetail, usePhaseLabel } from "../ui";

type Selected = { kind: "live"; game: LiveGame } | { kind: "past"; game: PastGame };

export function GamesPage() {
  const { t, n, date, time, lang } = useAdminI18n();
  const [tab, setTab] = useState<0 | 1>(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const live = useAdminData<Page<LiveGame>>("/games?status=active");
  const past = useAdminData<Page<PastGame>>(tab === 1 ? `/games?status=history&pageSize=50&search=${encodeURIComponent(query)}` : null);
  const phaseLabel = usePhaseLabel();
  const liveDetail = useLiveDetail();

  // Search runs a moment after typing stops.
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  // Live tables change on their own; refresh them every 15 seconds.
  useEffect(() => {
    const id = window.setInterval(live.reload, 15_000);
    return () => window.clearInterval(id);
  }, [live.reload]);

  const liveItems = (live.data?.items ?? []).filter((g) => !query || matches(query, g.chatTitle, g.id, g.players));
  const pastItems = past.data?.items ?? [];
  const selected: Selected | null = tab === 0
    ? (() => { const g = liveItems.find((x) => x.id === selectedId) ?? liveItems[0]; return g ? { kind: "live", game: g } : null; })()
    : (() => { const g = pastItems.find((x) => x.id === selectedId) ?? pastItems[0]; return g ? { kind: "past", game: g } : null; })();
  const chatName = (title: string | null, id: number) => title ?? t("unnamedChat", { id: String(id) });

  const outcome = (g: PastGame): [string, string, string] =>
    g.status === "Cancelled" ? [t("outcomeCancelled"), "#1E2138", "#C9C8DC"]
      : g.result === "VillagersWin" ? [t("outcomeTown"), "#13302C", "#5FD0BE"]
        : g.result === "MafiaWin" ? [t("outcomeMafia"), "#2A1418", "#F08A7A"]
        : g.result === "JokerWins" ? [t("outcomeJoker"), "#2A1F33", "#B79CF2"]
          : [t("outcomeOther"), "#1E2138", "#C9C8DC"];

  const data = tab === 0 ? live : past;

  return (
    <main className="adm-main">
      <Header kicker={t("gamesKicker")} title={t("gamesTitle")}>
        <Search label={t("searchGames")} placeholder={t("searchGames")} value={search} onChange={setSearch} />
      </Header>

      <div role="tablist" aria-label={t("gamesTitle")} className="adm-tabs">
        <button type="button" role="tab" aria-selected={tab === 0} onClick={() => { setTab(0); setSelectedId(null); }}>{t("tabLive", { count: live.data?.total ?? 0 })}</button>
        <button type="button" role="tab" aria-selected={tab === 1} onClick={() => { setTab(1); setSelectedId(null); }}>{t("tabHistory")}</button>
      </div>

      {!data.data ? <PageState error={data.error} onRetry={data.reload} /> : (
        <div className="adm-split">
          <section className="adm-panel flush wide" aria-label={tab === 0 ? t("tabLive", { count: liveItems.length }) : t("tabHistory")}>
            {(tab === 0 ? liveItems.length : pastItems.length) === 0 ? <div className="adm-empty">{tab === 0 ? t("noLive") : t("noHistory")}</div> : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("colChat")}</th>
                      <th scope="col">{tab === 0 ? t("colPhase") : t("colOutcome")}</th>
                      <th scope="col">{t("colPlayers")}</th>
                      <th scope="col">{tab === 0 ? t("colStarted") : t("colEnded")}</th>
                      <th scope="col">{t("colDuration")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tab === 0 && liveItems.map((g) => {
                      const [bg, fg] = PHASE_COLORS[g.phase] ?? PHASE_COLORS.Lobby;
                      const on = selected?.game.id === g.id;
                      return (
                        <tr key={g.id} className={on ? "on" : undefined}>
                          <td>
                            <button type="button" className="adm-rowbtn" aria-pressed={on} onClick={() => setSelectedId(g.id)} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                              <span>{chatName(g.chatTitle, g.chatId)}</span>
                              <span className="tiny muted" style={{ fontWeight: 400 }} dir="ltr">{g.id.slice(0, 8)}</span>
                            </button>
                          </td>
                          <td><span className="adm-pill" style={{ background: bg, color: fg }}>{phaseLabel(g.phase, g.round)}</span></td>
                          <td className="num">{n(g.alive)}/{n(g.seated)}</td>
                          <td className="text-2">{time(g.startedAt)}</td>
                          <td className="text-2 num">{formatDuration(Date.now() - new Date(g.startedAt).getTime(), n)}</td>
                        </tr>
                      );
                    })}
                    {tab === 1 && pastItems.map((g) => {
                      const [label, bg, fg] = outcome(g);
                      const on = selected?.game.id === g.id;
                      return (
                        <tr key={g.id} className={on ? "on" : undefined}>
                          <td>
                            <button type="button" className="adm-rowbtn" aria-pressed={on} onClick={() => setSelectedId(g.id)} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                              <span>{chatName(g.chatTitle, g.chatId)}</span>
                              <span className="tiny muted" style={{ fontWeight: 400 }} dir="ltr">{g.id.slice(0, 8)}</span>
                            </button>
                          </td>
                          <td><span className="adm-pill" style={{ background: bg, color: fg }}>{label}</span></td>
                          <td className="num">{n(g.players.length)}</td>
                          <td className="text-2">{date(g.endedAt, true)}</td>
                          <td className="text-2 num">{formatDuration(new Date(g.endedAt).getTime() - new Date(g.startedAt).getTime(), n)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="adm-panel side" aria-labelledby="detail-title" style={{ gap: 14 }}>
            {!selected ? <div className="adm-empty">{t("selectGame")}</div> : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="tiny muted num" dir="ltr" style={{ textAlign: "start" }}>{selected.game.id}</span>
                  <h2 id="detail-title" className="display" style={{ fontSize: 22, fontWeight: 800 }}>{chatName(selected.game.chatTitle, selected.game.chatId)}</h2>
                  <span className="text-2">{selected.kind === "live" ? liveDetail(selected.game) : outcome(selected.game)[0]}</span>
                </div>
                <ol aria-label={t("timeline")} style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {timeline(selected, phaseLabel, t, outcome).map((step, i, all) => (
                    <li key={i} className="adm-pill" style={{ background: i === all.length - 1 ? "#F0A83A" : "#1E2138", color: i === all.length - 1 ? "#1A1206" : "#C9C8DC" }}>{step}</li>
                  ))}
                </ol>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 6 }} className="tiny muted">
                    <span>{t("playerRoleHeader")}</span><span>{t("status")}</span>
                  </div>
                  {selected.game.players.map((p, i) => <PlayerLine key={`${p.name}-${i}`} p={p} i={i} live={selected.kind === "live"} lang={lang} />)}
                </div>
                {selected.kind === "live" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button type="button" className="adm-btn danger" onClick={() => setCancelOpen(true)}>{t("cancelGame")}</button>
                    <span className="tiny muted">{t("cancelNote")}</span>
                  </div>
                )}
                {selected.kind === "past" && <PastNote game={selected.game} />}
              </>
            )}
          </aside>
        </div>
      )}

      {cancelOpen && selected?.kind === "live" && (
        <CancelDialog
          game={selected.game}
          name={chatName(selected.game.chatTitle, selected.game.chatId)}
          onClose={() => setCancelOpen(false)}
          onDone={() => { setCancelOpen(false); setSelectedId(null); live.reload(); }}
        />
      )}
    </main>
  );
}

function matches(q: string, title: string | null, id: string, players: PlayerInGame[]) {
  const s = q.toLowerCase();
  return (title ?? "").toLowerCase().includes(s) || id.toLowerCase().includes(s) || players.some((p) => p.name.toLowerCase().includes(s));
}

function timeline(selected: Selected, phaseLabel: (p: string, r: number) => string, t: ReturnType<typeof useAdminI18n>["t"], outcome: (g: PastGame) => [string, string, string]) {
  const steps = [t("phaseLobby")];
  const rounds = selected.kind === "live" ? selected.game.round : selected.game.rounds;
  for (let r = 1; r <= rounds; r++) {
    steps.push(phaseLabel("Night", r));
    if (selected.kind === "live" && r === rounds && (selected.game.phase === "Night" || selected.game.phase === "NightZero")) break;
    steps.push(phaseLabel("Day", r));
  }
  if (selected.kind === "live") {
    if (selected.game.phase === "Voting") steps.push(phaseLabel("Voting", rounds));
  } else {
    steps.push(outcome(selected.game)[0]);
  }
  return steps;
}

function PlayerLine({ p, i, live, lang }: { p: PlayerInGame; i: number; live: boolean; lang: "en" | "fa" }) {
  const { t } = useAdminI18n();
  const out = !p.alive;
  const status = out
    ? p.eliminatedBy === "Night" ? t("outNight", { round: p.eliminatedRound ?? 0 }) : p.eliminatedBy === "Vote" ? t("outVote", { round: p.eliminatedRound ?? 0 }) : t("outGone")
    : live ? t("alive") : t("survived");
  return (
    <div className="adm-row" style={{ minHeight: 40, gap: 10, opacity: out ? 0.6 : 1 }}>
      <span className="adm-avatar" style={{ width: 28, height: 28, fontSize: 12, background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: "#0B0D1A" }}>{initial(p.name)}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{p.name} <span className="muted">· {roleName(p.role, lang) ?? t("noRole")}</span></span>
      <span className="tiny" style={{ color: out ? "#F08A7A" : "#5FD0BE" }}>{status}</span>
    </div>
  );
}

function PastNote({ game }: { game: PastGame }) {
  const { t, n } = useAdminI18n();
  if (game.status === "Cancelled") return <div className="adm-note">{t("cancelledNote", { reason: game.cancellationReason ?? t("none") })}</div>;
  const won = game.players.find((p) => p.won && p.ratingDelta != null)?.ratingDelta;
  const lost = game.players.find((p) => p.won === false && p.ratingDelta != null)?.ratingDelta;
  if (won == null && lost == null) return null;
  const fmt = (v: number | null | undefined) => (v == null ? t("none") : `${v > 0 ? "+" : "−"}${n(Math.abs(v))}`);
  return <div className="adm-note">{t("ratedNote", { won: fmt(won), lost: fmt(lost) })}</div>;
}

function CancelDialog({ game, name, onClose, onDone }: { game: LiveGame; name: string; onClose(): void; onDone(): void }) {
  const { t } = useAdminI18n();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="adm-dialog-backdrop">
      <div role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="adm-dialog">
        <h2 id="cancel-title" style={{ fontSize: 20, fontWeight: 700 }}>{t("cancelTitle", { name })}</h2>
        <p className="text-2" style={{ fontSize: 14, lineHeight: 1.5 }}>{t("cancelBody", { count: game.seated })}</p>
        <label className="adm-label">
          {t("reasonLabel")}
          <textarea className="adm-textarea" rows={3} autoFocus placeholder={t("reasonPlaceholder")} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {error && <div className="adm-error" role="alert">{error}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          <button type="button" className="adm-btn" onClick={onClose}>{t("keepPlaying")}</button>
          <button
            type="button"
            className="adm-btn danger-fill"
            disabled={busy || !reason.trim()}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await adminApi.post(`/games/${game.id}/cancel`, { reason: reason.trim() });
                onDone();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("cancelGame")}
          </button>
        </div>
      </div>
    </div>
  );
}
