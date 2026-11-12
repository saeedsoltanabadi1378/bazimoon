import type { ReactNode } from "react";
import type { GameStats } from "../adminApi";
import { DayBars, FunnelChart, Kpi, Meter, Section, pct, useDwell, useDynamicLabel, useScreenLabel } from "../charts";
import { GAME_STYLE } from "../gameStyle";
import { useAdminI18n } from "../i18n";
import { PageState, Svg, formatDuration, gameName, openPlayer, roleName, useAdminData } from "../ui";

/** Everything recorded about one game over the chosen range. `children` (Mafia's live tables) sit under the charts. */
export function GameDetail({ game, days, children }: { game: string; days: number; children?: ReactNode }) {
  const { t, n, lang, date, ago } = useAdminI18n();
  const stats = useAdminData<GameStats>(`/game-stats/${game}?days=${days}`);
  const label = useDynamicLabel();
  const dwell = useDwell();
  const screenLabel = useScreenLabel();
  const s = stats.data;
  if (!s) return <PageState error={stats.error} onRetry={stats.reload} />;

  const [bg, fg, icon] = GAME_STYLE[game] ?? ["#1E2138", "#C9C8DC", ""];
  const mafia = game === "mafia";
  const couple = game === "couple";
  const solo = !mafia && !couple;
  const tt = s.totals;
  const time = (ms: number | null | undefined) => (ms == null ? t("none") : formatDuration(ms, n));
  const stepLabel = (name: string) => label("step", name);
  const modeLabel = (mode: string) => label("mode", mode);
  const outcomeLabel = (key: string) =>
    key === "VillagersWin" ? t("outcomeTown") : key === "MafiaWin" ? t("outcomeMafia") : key === "JokerWins" ? t("outcomeJoker") : key === "Cancelled" ? t("outcomeCancelled") : t("outcomeOther");
  const playerButton = (id: string, name: string) => (
    <button type="button" className="adm-rowbtn" style={{ minHeight: 32 }} onClick={() => openPlayer(id)} dir="auto">{name}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
        <span style={{ width: 48, height: 48, borderRadius: 14, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Svg d={icon} size={24} stroke={fg} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 200 }}>
          <h2 className="display" style={{ fontSize: 24, fontWeight: 800 }}>{gameName(game, lang)}</h2>
          <span className="small muted">
            {tt.firstPlayedAt ? t("gamePlayedSpan", { first: date(tt.firstPlayedAt), last: ago(tt.lastPlayedAt) }) : t("gameNeverPlayed")}
          </span>
        </div>
        <span className="adm-pill" style={s.enabled ? { background: "#13302C", color: "#5FD0BE" } : { background: "#2A1418", color: "#F08A7A" }}>
          {s.enabled ? t("gameOn") : t("gameSwitchedOff")}
        </span>
      </div>

      {game === "shelem" && <div className="adm-note">{t("shelemNotSaved")}</div>}

      <div className="adm-kpis">
        <Kpi label={mafia ? t("kpiGamesPlayed") : couple ? t("kpiAnswers") : t("kpiPlays")} value={n(tt.playsInRange)} note={t("kpiAllTime", { count: n(tt.plays) })} />
        <Kpi label={t("kpiGamePlayers")} value={n(tt.playersInRange)} note={t("kpiAllTimePlayers", { count: n(tt.players) })} />
        <Kpi label={t("kpiToday")} value={n(tt.playsToday)} note={t("kpiTodayPlayers", { count: n(tt.playersToday) })} />
        <Kpi label={mafia ? t("kpiTownWinRate") : couple ? t("kpiMatchRate") : t("kpiSolveRate")} value={pct(tt.winRate, lang, n)} />
        {!couple && <Kpi label={mafia ? t("kpiMedianLength") : t("kpiMedianTime")} value={time(tt.medianTimeMs)} note={solo && tt.bestTimeMs != null ? t("kpiBestTime", { time: time(tt.bestTimeMs) }) : undefined} />}
        {solo && <Kpi label={t("kpiMedianScore")} value={tt.medianScore == null ? t("none") : n(tt.medianScore)} note={tt.bestScore != null ? t("kpiBestScore", { score: n(tt.bestScore) }) : undefined} />}
        {!mafia && <Kpi label={t("kpiXp")} value={n(tt.xpAwarded)} note={solo ? t("kpiPoints", { count: n(tt.pointsAwarded) }) : undefined} />}
        {solo && tt.averageHints != null && <Kpi label={t("kpiHints")} value={n(tt.averageHints)} />}
        {mafia && s.mafia && <Kpi label={t("kpiTables")} value={n(s.mafia.tablesOpened)} note={t("kpiPublicTables", { count: n(s.mafia.publicTables) })} />}
      </div>

      <Section title={t("dailyTitle")}>
        <DayBars
          label={t("dailyTitle")}
          days={s.daily.map((d) => ({ date: d.date, values: [d.plays, d.wins, d.players] }))}
          series={[
            { label: mafia ? t("seriesGames") : couple ? t("seriesAnswers") : t("seriesPlays"), color: "#F0A83A" },
            { label: mafia ? t("outcomeTown") : couple ? t("seriesBothPlayed") : t("seriesSolved"), color: "#5FD0BE" },
            { label: t("seriesPlayers"), color: "#8FA8FF" },
          ]}
        />
      </Section>

      {children}

      {s.mafia && (
        <div className="adm-grid">
          <Section title={t("mafiaOutcomes")} sub={t("mafiaCompletedCancelled", { done: n(s.mafia.completed), cancelled: n(s.mafia.cancelled) })}>
            {s.mafia.outcomes.length === 0 ? <div className="adm-empty">{t("noActivity")}</div> : s.mafia.outcomes.map((o) => (
              <Meter key={o.key} label={outcomeLabel(o.key)} value={o.count} max={Math.max(...s.mafia!.outcomes.map((x) => x.count))} right={n(o.count)}
                color={o.key === "VillagersWin" ? "#5FD0BE" : o.key === "MafiaWin" ? "#F08A7A" : o.key === "JokerWins" ? "#B79CF2" : "#9A9CB8"} />
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, paddingTop: 6 }}>
              {[
                [n(s.mafia.averagePlayers), t("mafiaAvgPlayers")],
                [n(s.mafia.averageRounds), t("mafiaAvgRounds")],
                [n(s.mafia.leftEarly), t("mafiaLeftEarly")],
                [n(s.mafia.mvps), t("mafiaMvps")],
                [n(s.mafia.sniperGodfatherShots), t("mafiaSniperShots")],
                [n(s.mafia.godfatherVotedOut), t("mafiaGodfatherOut")],
              ].map(([v, l]) => <MiniStat key={l} value={v} label={l} />)}
            </div>
          </Section>
          <Section title={t("mafiaRoles")} flush>
            {s.mafia.roles.length === 0 ? <div className="adm-empty">{t("noActivity")}</div> : (
              <div className="adm-table-wrap">
                <table className="adm-table" style={{ minWidth: 320 }}>
                  <thead><tr><th scope="col">{t("colRole")}</th><th scope="col">{t("colSeats")}</th><th scope="col">{t("colWinRate")}</th></tr></thead>
                  <tbody>
                    {s.mafia.roles.map((r) => (
                      <tr key={r.role}><td>{roleName(r.role, lang)}</td><td className="num">{n(r.games)}</td><td className="num">{pct(r.winRate, lang, n)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}

      {s.couple && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            {[
              [n(s.couple.active), t("coupleActiveCount")],
              [n(s.couple.newInRange), t("coupleNew")],
              [n(s.couple.bothToday), t("coupleBothToday")],
              [n(s.couple.pendingInvites), t("coupleInvitesWaiting")],
              [n(s.couple.expiredInvites), t("coupleInvitesExpired")],
              [n(s.couple.answersWithSkips), t("coupleSkips")],
              ...s.couple.languages.map((l) => [n(l.count), l.key === "fa" ? "فارسی" : "English"]),
            ].map(([v, l]) => <MiniStat key={l} value={v} label={l} panel />)}
          </div>
          <Section title={t("coupleTop")} flush>
            {s.couple.topCouples.length === 0 ? <div className="adm-empty">{t("noActivity")}</div> : (
              <div className="adm-table-wrap">
                <table className="adm-table" style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th scope="col">{t("colCouple")}</th><th scope="col">{t("colLevel")}</th><th scope="col">{t("colCoupleStreak")}</th>
                      <th scope="col">{t("colBestStreak")}</th><th scope="col">{t("colMatched")}</th><th scope="col">{t("colTogetherSince")}</th><th scope="col">{t("colLastPlayed")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.couple.topCouples.map((c) => (
                      <tr key={c.id}>
                        <td dir="auto">{c.inviter} · {c.partner}</td>
                        <td className="num">{n(c.level)}</td>
                        <td className="num">{n(c.streak)}</td>
                        <td className="num">{n(c.bestStreak)}</td>
                        <td className="num">{n(c.matches)}/{n(c.questions)}</td>
                        <td className="text-2">{c.since ? date(c.since) : t("none")}</td>
                        <td className="text-2">{ago(c.lastPlayedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      <div className="adm-grid">
        {s.modes.length > 0 && (
          <Section title={t("modesTitle")} flush>
            <div className="adm-table-wrap">
              <table className="adm-table" style={{ minWidth: 520 }}>
                <thead>
                  <tr>
                    <th scope="col">{t("colMode")}</th><th scope="col">{t("seriesPlays")}</th><th scope="col">{t("seriesPlayers")}</th>
                    <th scope="col">{t("kpiSolveRate")}</th><th scope="col">{t("kpiMedianTime")}</th><th scope="col">{t("colMedianScore")}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.modes.map((m) => (
                    <tr key={m.mode}>
                      <td>{modeLabel(m.mode)}</td>
                      <td className="num">{n(m.plays)}</td>
                      <td className="num">{n(m.players)}</td>
                      <td className="num">{pct(m.plays ? Math.round((100 * m.solved) / m.plays) : null, lang, n)}</td>
                      <td className="num">{time(m.medianTimeMs)}</td>
                      <td className="num">{m.medianScore == null ? t("none") : n(m.medianScore)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
        <Section title={t("gameFunnel")} sub={t("rangeNote", { count: n(days) })}>
          <FunnelChart steps={s.funnel} stepLabel={stepLabel} />
        </Section>
      </div>

      {s.levels.length > 0 && (
        <div className="adm-grid">
          {s.levels.map((l) => (
            <Section key={l.track} title={t("levelSpread", { track: modeLabel(l.track) })}
              sub={t("levelSpreadNote", { players: n(l.players), median: l.medianLevel == null ? t("none") : n(l.medianLevel), top: n(l.topLevel), saved: n(l.savedBoards) })}>
              {l.buckets.length === 0 ? <div className="adm-empty">{t("noActivity")}</div> : l.buckets.map((b) => (
                <Meter key={b.from} label={b.from === b.to ? t("levelOne", { level: n(b.from) }) : t("levelRange", { from: n(b.from), to: n(b.to) })}
                  value={b.players} max={Math.max(...l.buckets.map((x) => x.players))} right={n(b.players)} color="#5FD0BE" />
              ))}
            </Section>
          ))}
        </div>
      )}

      {(game === "shelem" || game === "esmfamil") && (
        <Section title={t("liveRooms", { count: n(s.rooms.length) })} flush>
          {s.rooms.length === 0 ? <div className="adm-empty">{t("noRooms")}</div> : (
            <div className="adm-table-wrap">
              <table className="adm-table" style={{ minWidth: 680 }}>
                <thead>
                  <tr>
                    <th scope="col">{t("colRoom")}</th><th scope="col">{t("colPhase")}</th><th scope="col">{t("colRound")}</th>
                    <th scope="col">{t("colSeated")}</th><th scope="col">{t("colScore")}</th><th scope="col">{t("colStarted")}</th><th scope="col">{t("colLastMove")}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.rooms.map((r) => (
                    <tr key={r.code}>
                      <td className="num" dir="ltr" style={{ textAlign: "start" }}>{r.code}</td>
                      <td>{label("roomPhase", r.phase)}</td>
                      <td className="num">{n(r.round)}</td>
                      <td>
                        <span dir="auto">{r.seats.map((p) => `${p.name}${p.isHost ? " ★" : ""}${p.isBot ? ` (${t("botBadge")})` : ""}`).join("، ")}</span>
                        <span className="tiny muted" style={{ display: "block" }}>{t("roomHumans", { humans: n(r.humans), seated: n(r.seated) })}</span>
                      </td>
                      <td className="num" dir="ltr" style={{ textAlign: "start" }}>{r.score || t("none")}</td>
                      <td className="text-2">{ago(r.createdAt)}</td>
                      <td className="text-2">{ago(r.lastActivity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      <div className="adm-grid">
        <Section title={t("screensTitle")} sub={t("screensNote")} flush>
          {s.screens.length === 0 ? <div className="adm-empty">{t("noActivity")}</div> : <ScreenTable screens={s.screens} screenLabel={screenLabel} dwell={dwell} />}
        </Section>
        {!couple && <Section title={t("topPlayers")} flush>
          {s.topPlayers.length === 0 ? <div className="adm-empty">{t("noActivity")}</div> : (
            <div className="adm-table-wrap">
              <table className="adm-table" style={{ minWidth: 460 }}>
                <thead>
                  <tr>
                    <th scope="col">{t("colPlayer")}</th><th scope="col">{mafia ? t("seriesGames") : t("seriesPlays")}</th><th scope="col">{mafia ? t("colWins") : t("seriesSolved")}</th>
                    <th scope="col">{mafia ? t("colRatingChange") : t("colBest")}</th><th scope="col">{t("colLastPlayed")}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.topPlayers.map((p) => (
                    <tr key={p.userId}>
                      <td>{playerButton(p.userId, p.name)}</td>
                      <td className="num">{n(p.plays)}</td>
                      <td className="num">{n(p.wins)}</td>
                      <td className="num">
                        {mafia ? (p.bestScore == null ? t("none") : `${p.bestScore >= 0 ? "+" : "−"}${n(Math.abs(p.bestScore))}`)
                          : p.bestTimeMs != null ? time(p.bestTimeMs) : p.bestScore != null ? n(p.bestScore) : t("none")}
                      </td>
                      <td className="text-2">{ago(p.lastAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>}
      </div>

      {solo && (
        <Section title={t("recentResults")} flush>
          {s.recent.length === 0 ? <div className="adm-empty">{t("noActivity")}</div> : (
            <div className="adm-table-wrap">
              <table className="adm-table" style={{ minWidth: 860 }}>
                <thead>
                  <tr>
                    <th scope="col">{t("colPlayer")}</th><th scope="col">{t("colMode")}</th><th scope="col">{t("colResult")}</th><th scope="col">{t("colTimeTaken")}</th>
                    <th scope="col">{t("colScore")}</th><th scope="col">{t("colMoves")}</th><th scope="col">{t("colHints")}</th><th scope="col">{t("colXp")}</th><th scope="col">{t("colTime")}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recent.map((r, i) => (
                    <tr key={`${r.at}-${i}`}>
                      <td>{playerButton(r.userId, r.name)}</td>
                      <td>{modeLabel(r.mode)}{r.number != null && <span className="muted"> #{n(r.number)}</span>}</td>
                      <td><span className="adm-pill" style={r.solved ? { background: "#13302C", color: "#5FD0BE" } : { background: "#2A1418", color: "#F08A7A" }}>{r.solved ? t("resultSolved") : t("resultNotSolved")}</span></td>
                      <td className="num">{time(r.timeMs)}</td>
                      <td className="num">{r.score == null ? t("none") : n(r.score)}</td>
                      <td className="num">{r.moves == null ? t("none") : n(r.moves)}</td>
                      <td className="num">{n(r.hints)}</td>
                      <td className="num">{n(r.xp)}</td>
                      <td className="text-2" style={{ whiteSpace: "nowrap" }}>{ago(r.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

function MiniStat({ value, label, panel }: { value: string; label: string; panel?: boolean }) {
  return (
    <div style={{ padding: "10px 8px", borderRadius: 12, background: panel ? "#151829" : "#0B0D1A", textAlign: "center" }}>
      <div className="num" style={{ fontSize: 17, fontWeight: 700 }}>{value}</div>
      <div className="tiny muted">{label}</div>
    </div>
  );
}

export function ScreenTable({ screens, screenLabel, dwell }: { screens: GameStats["screens"]; screenLabel(key: string): string; dwell(ms: number | null): string }) {
  const { t, n } = useAdminI18n();
  return (
    <div className="adm-table-wrap">
      <table className="adm-table" style={{ minWidth: 480 }}>
        <thead>
          <tr>
            <th scope="col">{t("colScreen")}</th><th scope="col">{t("colViews")}</th><th scope="col">{t("seriesPlayers")}</th>
            <th scope="col">{t("colMedianDwell")}</th><th scope="col">{t("colTabClosed")}</th>
          </tr>
        </thead>
        <tbody>
          {screens.map((sc) => (
            <tr key={sc.screen}>
              <td title={sc.screen}>{screenLabel(sc.screen)}</td>
              <td className="num">{n(sc.views)}</td>
              <td className="num">{n(sc.users)}</td>
              <td className="num">{dwell(sc.medianDwellMs)}</td>
              <td className="num">{n(sc.exits)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
