import { useEffect, useState } from "react";
import type { Daily, Puzzles } from "../adminApi";
import { useAdminI18n } from "../i18n";
import { Header, PageState, Svg, ICONS, divisionName, formatDuration, gameName, useAdminData } from "../ui";
import { answerFor } from "../../games/word/logic";
import { dailyLadder } from "../../games/ladder/logic";
import { questionSet } from "../../couple/questions";
import { formatCountdown, msUntilNextPuzzle } from "../../lib/format";

const GAME_COLORS: Record<string, string> = {
  zip: "#5FD0BE", queens: "#B79CF2", word: "#9ED98C", ladder: "#F0A83A", mines: "#8FA8FF", stack: "#7FC8E8", blocks: "#F2B8D0",
};

const DIVISION_COLORS: Record<string, string> = {
  Bronze: "#C08A5B", Silver: "#A9B0C8", Gold: "#F0A83A", Platinum: "#5FD0BE", Diamond: "#8FA8FF",
};

export function PuzzlesPage() {
  const { t, n, lang, date } = useAdminI18n();
  const { data, error, reload } = useAdminData<Puzzles>("/puzzles");
  const [showAnswers, setShowAnswers] = useState(false);
  const [left, setLeft] = useState(msUntilNextPuzzle());

  useEffect(() => {
    const id = window.setInterval(() => setLeft(msUntilNextPuzzle()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const header = (
    <Header kicker={t("soloKicker")} title={t("puzzlesTitle")}>
      <span className="small text-2">{t("newDailiesIn", { time: formatCountdown(left, lang) })}</span>
    </Header>
  );
  if (!data) return <main className="adm-main">{header}<PageState error={error} onRetry={reload} /></main>;

  const label = (d: Daily) => d.game === "word" ? `${gameName("word", lang)} (${d.mode === "daily-fa" ? (lang === "fa" ? "فارسی" : "Persian") : (lang === "fa" ? "انگلیسی" : "English")})` : gameName(d.game, lang);
  const median = (d: Daily) => {
    switch (d.game) {
      case "word": return d.medianMoves != null ? t("tries", { count: d.medianMoves }) : t("none");
      case "ladder": return d.medianMoves != null ? t("steps", { count: d.medianMoves }) : t("none");
      case "stack": return d.medianScore != null ? t("floors", { count: d.medianScore }) : t("none");
      case "blocks": return d.medianScore != null ? t("pts", { count: d.medianScore }) : t("none");
      default: return d.medianTimeMs != null ? formatDuration(d.medianTimeMs, n) : t("none");
    }
  };
  const answer = (d: Daily) => {
    if (d.game === "word") return answerFor(d.mode === "daily-fa" ? "fa" : "en", d.number).join("");
    if (d.game === "ladder") { const l = dailyLadder(d.number); return `${l.start} → ${l.end} · par ${l.par}`; }
    return null;
  };
  const totalDivisions = data.divisions.reduce((s, v) => s + v.count, 0);
  const couples = data.couples;

  return (
    <main className="adm-main">
      {header}

      <section className="adm-panel flush" aria-labelledby="daily-title">
        <div className="adm-panel-head" style={{ padding: "16px 18px 8px", alignItems: "center" }}>
          <h2 id="daily-title">{t("dailiesTitle")}</h2>
          <button type="button" className="adm-btn" aria-pressed={showAnswers} onClick={() => setShowAnswers((v) => !v)} style={{ minHeight: 40, fontSize: 13 }}>
            {showAnswers ? t("hideAnswers") : t("showAnswers")}
          </button>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th scope="col">{t("colGame")}</th>
                <th scope="col">{t("colPuzzle")}</th>
                <th scope="col">{t("colPlayers")}</th>
                <th scope="col">{t("colSolveRate")}</th>
                <th scope="col">{t("colMedian")}</th>
                <th scope="col">{t("colAnswer")}</th>
              </tr>
            </thead>
            <tbody>
              {data.dailies.map((d) => {
                const rate = d.players ? Math.round((d.solved / d.players) * 100) : 0;
                const color = GAME_COLORS[d.game] ?? "#9C8CFF";
                const a = answer(d);
                return (
                  <tr key={`${d.game}-${d.mode}`}>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 32, fontWeight: 600 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />{label(d)}
                      </span>
                    </td>
                    <td className="text-2 num">#{n(d.number)}</td>
                    <td className="num">{n(d.players)}</td>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 90, height: 8, borderRadius: 999, background: "#262A44", overflow: "hidden", display: "flex" }}>
                          <span style={{ width: `${rate}%`, background: color }} />
                        </span>
                        <span className="num">{d.players ? `${n(rate)}${lang === "fa" ? "٪" : "%"}` : t("none")}</span>
                      </span>
                    </td>
                    <td className="text-2 num">{median(d)}</td>
                    <td className="num" style={{ color: showAnswers && a ? "#EDEBF5" : "#9A9CB8" }}>
                      {!a ? t("noAnswer") : showAnswers ? <bdi dir={d.mode === "daily-fa" ? "rtl" : "ltr"}>{a}</bdi> : t("hidden")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="adm-grid">
        <section className="adm-panel" aria-labelledby="season-title" style={{ gap: 14 }}>
          <div className="adm-panel-head">
            <h2 id="season-title">{t("seasonTitle", { number: data.season.number })}</h2>
            <span className="small text-2">{t("seasonDay", { day: data.season.day, length: data.season.length, date: date(data.season.endsOn) })}</span>
          </div>
          <div role="img" aria-label={`${t("divisionsAria")}: ${data.divisions.map((d) => `${d.name} ${d.count}`).join(", ")}`} style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", gap: 2, background: "#1E2138" }}>
            {totalDivisions > 0 && data.divisions.map((d) => <span key={d.name} style={{ flex: d.count, background: DIVISION_COLORS[d.name] }} />)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
            {data.divisions.map((d) => (
              <div key={d.name} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "10px 12px", borderRadius: 12, background: "#0B0D1A" }}>
                <span className="tiny text-2" style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: DIVISION_COLORS[d.name] }} />{divisionName(d.name, lang)}</span>
                <span className="num" style={{ fontSize: 18, fontWeight: 700 }}>{n(d.count)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="small" style={{ fontWeight: 600, paddingBottom: 6 }}>{t("leadersTitle")}</span>
            {data.leaders.length === 0 && <span className="small muted">{t("noLeaders")}</span>}
            {data.leaders.map((l) => (
              <div key={l.rank} className="adm-row" style={{ minHeight: 40, gap: 10 }}>
                <span className="muted num" style={{ width: 26 }}>#{n(l.rank)}</span>
                <span style={{ flex: 1 }}>{l.name}</span>
                <span className="num" style={{ fontWeight: 600 }}>{t("points", { count: l.points })}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="adm-panel" aria-labelledby="couple-title" style={{ gap: 14 }}>
          <div className="adm-panel-head"><h2 id="couple-title">{t("coupleTitle")}</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            {[
              [n(couples.active), t("coupleActiveCount")],
              [n(couples.bothToday), t("coupleBoth")],
              [`${n(couples.averageMatch)}${lang === "fa" ? "٪" : "%"}`, t("coupleMatch")],
              [n(couples.invitesWaiting), t("coupleInvites")],
            ].map(([v, l]) => (
              <div key={l} style={{ display: "flex", flexDirection: "column", gap: 2, padding: 12, borderRadius: 12, background: "#24121C" }}>
                <span className="num" style={{ fontSize: 20, fontWeight: 800, color: "#F2A7C3" }}>{v}</span>
                <span className="tiny" style={{ color: "#D9C9D1" }}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="small" style={{ fontWeight: 600, paddingBottom: 6 }}>{t("skippedTitle")}</span>
            {couples.skipped.length === 0 && <span className="small muted">{t("noSkipped")}</span>}
            {couples.skipped.map((q) => (
              <div key={`${q.setId}-${q.question}`} className="adm-row" style={{ minHeight: 40, gap: 10 }}>
                <span style={{ flex: 1 }}>{questionSet(q.setId, lang).questions[q.question]?.you ?? `#${q.setId}.${q.question}`}</span>
                <span className="num" style={{ fontWeight: 600, color: "#F0A83A" }}>{n(q.rate)}{lang === "fa" ? "٪" : "%"}</span>
              </div>
            ))}
          </div>
          <div className="adm-note">
            <Svg d={ICONS.lock} size={16} stroke="#F2A7C3" />
            <span>{t("couplePrivacy")}</span>
          </div>
        </section>
      </div>
    </main>
  );
}
