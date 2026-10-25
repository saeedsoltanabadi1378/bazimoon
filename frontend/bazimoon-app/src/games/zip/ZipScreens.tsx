import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { Body, Screen, TopBar } from "../../ui/components";
import { Icon } from "../../ui/Icon";
import { formatClock, formatCountdown, formatMonth, msUntilNextPuzzle, puzzleToday } from "../../lib/format";
import { dailyNumber } from "../../lib/rng";
import { IntroScreen, PreviewGrid } from "../shared/IntroScreen";
import { GroupBoard, ResultScreen } from "../shared/ResultScreen";
import { parseXp, type ResultParams } from "../shared/play";

const ACCENT = "#5FD0BE";

export function useCountdown() {
  const { language } = useLanguage();
  const [ms, setMs] = useState(msUntilNextPuzzle());
  useEffect(() => {
    const id = window.setInterval(() => setMs(msUntilNextPuzzle()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return formatCountdown(ms, language);
}

const previewPattern: [string, boolean][] = [
  ["1", true], ["", true], ["", true], ["", true], ["", true], ["", false], ["", false], ["", false], ["", false], ["", true],
  ["", false], ["3", false], ["", false], ["", false], ["", true], ["", false], ["", false], ["", false], ["", false], ["2", true],
  ["", false], ["", false], ["", false], ["", false], ["", false],
];

export function ZipIntro() {
  const { t, language } = useLanguage();
  const { push } = useNavigation();
  const { api } = useHub();
  const stats = useLoad(() => api.stats("zip"), [api]).data;
  const countdown = useCountdown();
  const number = dailyNumber("zip", puzzleToday());
  const solvedToday = stats?.today?.solved;

  return (
    <IntroScreen
      game="zip"
      title={t("gameZip")}
      tagline={t("zipIntroTagline", { number })}
      accent={ACCENT}
      heroBg="#10251F"
      preview={<PreviewGrid cols={5} cells={previewPattern.map(([text, on]) => ({ text, bg: on ? ACCENT : "#262A44" }))} />}
      badge={t("newPuzzleIn", { time: countdown })}
      heroTitle={t("zipHeroTitle")}
      heroSub={t("zipHeroSub")}
      modes={[
        {
          key: "daily", label: t("modeDaily"), desc: t("zipDailyDesc"),
          play: solvedToday ? t("replayToday") : t("playToday"),
          onPlay: () => push({ name: "game", game: "zip", screen: "play", params: { mode: "daily" } }),
        },
        { key: "practice", label: t("modePractice"), desc: t("zipPracticeDesc"), play: t("startPractice"), onPlay: () => push({ name: "game", game: "zip", screen: "play", params: { mode: "practice" } }) },
        { key: "archive", label: t("modeArchive"), desc: t("zipArchiveDesc"), play: t("openArchive"), onPlay: () => push({ name: "game", game: "zip", screen: "archive" }) },
      ]}
      stats={[
        { value: stats?.played ?? "—", label: t("statPlayed") },
        { value: stats?.dailyStreak ?? "—", label: t("streak") },
        { value: formatClock(stats?.bestTimeMs, language), label: t("statBest") },
        { value: formatClock(stats?.averageTimeMs, language), label: t("statAverage") },
      ]}
      steps={[
        { title: t("zipStep1"), text: t("zipStep1Text") },
        { title: t("zipStep2"), text: t("zipStep2Text") },
        { title: t("zipStep3"), text: t("zipStep3Text") },
      ]}
      rewards={[t("rewardDaily20"), t("rewardStreak5"), t("rewardLeagueTime")]}
      secondary={{ label: t("leaderboard"), onClick: () => push({ name: "league" }) }}
    />
  );
}

export function ZipResult({ params }: { params?: ResultParams }) {
  const { t, language, n } = useLanguage();
  const { replace, push, reset } = useNavigation();
  const { api } = useHub();
  const xp = parseXp(params);
  const mode = String(params?.mode ?? "daily");
  const number = typeof params?.number === "number" ? params.number : null;
  const timeMs = Number(params?.timeMs ?? 0);
  const hints = Number(params?.hints ?? 0);
  const size = Number(params?.size ?? 6);
  const board = useLoad(() => (number && mode === "daily" ? api.board("zip", number) : Promise.resolve(null)), [api, number, mode]);
  const streak = xp?.streak ?? 0;
  const time = formatClock(timeMs, language);
  const title = number ? `${t("gameZip")} #${number}` : t("gameZip");

  const sub = mode === "daily" && xp?.countedAsDaily
    ? t("streakContinues", { count: streak })
    : mode === "archive" ? t("archiveNoStreak") : t("practiceNoStreak");

  const grid = Array.from({ length: size }, () => "🟩".repeat(size)).join("\n");
  const shareText = [
    `${title} · ${time}`,
    mode === "daily" ? `${t("streakDays", { count: streak })} · ${hints ? t("hintsUsed", { count: hints }) : t("noHints")}` : "",
    grid,
  ].filter(Boolean).join("\n");

  return (
    <ResultScreen
      win
      kicker={title}
      title={t("solvedIn", { time })}
      sub={sub}
      metrics={[
        { value: time, label: t("statTime") },
        { value: n(streak), label: t("streak"), color: "#F0A83A" },
        { value: n(hints), label: t("statHints") },
      ]}
      xp={xp}
      xpNote={xp?.percentile != null ? t("fasterThan", { pct: xp.percentile }) : undefined}
      accent={ACCENT}
      share={{ text: shareText }}
      primary={{ label: t("practiceMore"), onClick: () => replace({ name: "game", game: "zip", screen: "play", params: { mode: "practice" } }) }}
      secondary={{ label: t("backToHome"), onClick: () => reset({ name: "home" }) }}
    >
      {board.data && (
        <GroupBoard
          title={t("groupToday")}
          onSeeAll={() => push({ name: "league" })}
          rows={board.data.rows.slice(0, 5).map((r) => ({ rank: r.rank ?? "—", name: r.name, value: r.solved ? formatClock(r.timeMs, language) : t("dnf"), isYou: r.isYou }))}
        />
      )}
      <div className="row" style={{ gap: 14, padding: 14, borderRadius: 18, border: "1.5px dashed #2E3252" }}>
        <div style={{ width: 66, flex: "none" }} aria-hidden="true">
          <PreviewGrid cols={size} gap={2} radius={2} cells={Array.from({ length: size * size }, () => ({ bg: ACCENT }))} />
        </div>
        <div className="small" style={{ color: "var(--text-2)", whiteSpace: "pre-line" }}>
          {`${title} · ${time}\n${mode === "daily" ? t("streakDays", { count: streak }) + " · " : ""}${hints ? t("hintsUsed", { count: hints }) : t("noHints")}`}
        </div>
      </div>
    </ResultScreen>
  );
}

export function ZipArchive() {
  const { t, language } = useLanguage();
  const { back, push } = useNavigation();
  const { api } = useHub();
  const today = puzzleToday();
  const [ym, setYm] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }));
  const archive = useLoad(() => api.archive("zip", ym.year, ym.month), [api, ym.year, ym.month]).data;
  const [selected, setSelected] = useState<number | null>(null);
  const isCurrentMonth = ym.year === Number(today.slice(0, 4)) && ym.month === Number(today.slice(5, 7));
  const firstAvailable = { year: 2026, month: 5 };
  const canPrev = ym.year > firstAvailable.year || ym.month > firstAvailable.month;

  const days = archive?.days ?? [];
  const solvedCount = days.filter((d) => d.status === "solved").length;
  const missedCount = days.filter((d) => d.status === "missed").length;
  const playable = days.filter((d) => d.status !== "future" && d.status !== "unavailable").length;
  const selectedDay = days.find((d) => d.day === (selected ?? (isCurrentMonth ? Number(today.slice(8, 10)) : null)));
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 1, 1 + i)).toLocaleDateString(language === "fa" ? "fa-IR" : "en-GB", { weekday: "short", timeZone: "UTC" }));

  function shift(delta: number) {
    setSelected(null);
    setYm(({ year, month }) => {
      const m = month + delta;
      return m < 1 ? { year: year - 1, month: 12 } : m > 12 ? { year: year + 1, month: 1 } : { year, month: m };
    });
  }

  const status = selectedDay?.status;
  const ctaLabel = !selectedDay?.number ? t("pickADay")
    : status === "solved" ? t("replayN", { number: selectedDay.number })
      : status === "today" ? t("playToday") : t("playN", { number: selectedDay.number });

  return (
    <Screen theme="night">
      <TopBar onBack={back} backLabel={t("backToGame", { game: t("gameZip") })} title={t("zipArchive")} subtitle={t("zipArchiveSub")} titleSize={24} />
      <Body style={{ paddingBottom: 20 }}>
        <div className="row row--between">
          <button type="button" className="icon-btn" aria-label={t("previousMonth")} disabled={!canPrev} onClick={() => shift(-1)} style={{ borderRadius: 12 }}>
            <span className="flip-rtl" style={{ display: "flex" }}><Icon name="prev" size={18} /></span>
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{formatMonth(ym.year, ym.month, language)}</div>
            <div className="tiny muted">{t("archiveSummary", { solved: solvedCount, total: playable, missed: missedCount })}</div>
          </div>
          <button type="button" className="icon-btn" aria-label={t("nextMonth")} disabled={isCurrentMonth} onClick={() => shift(1)} style={{ borderRadius: 12 }}>
            <span className="flip-rtl" style={{ display: "flex" }}><Icon name="forward" size={18} /></span>
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
          {weekdays.map((w) => <div key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{w}</div>)}
          {Array.from({ length: archive?.firstWeekday ?? 0 }, (_, i) => <div key={`b${i}`} />)}
          {days.map((d) => {
            const off = d.status === "future" || d.status === "unavailable";
            const on = selectedDay?.day === d.day;
            const dot = d.status === "solved" ? "#5FD0BE" : d.status === "missed" ? "#F08A7A" : d.status === "today" ? "#F0A83A" : "transparent";
            return (
              <button
                key={d.day}
                type="button"
                disabled={off}
                onClick={() => setSelected(d.day)}
                aria-label={`${d.day}${d.status === "solved" ? `, ${t("solvedLabel")}` : d.status === "missed" ? `, ${t("missed")}` : d.status === "today" ? `, ${t("today")}` : ""}`}
                aria-pressed={on}
                style={{
                  height: 46, padding: 0, borderRadius: 12, border: `2px solid ${on ? ACCENT : d.status === "today" ? "#F0A83A" : "transparent"}`,
                  background: on ? "#1E2138" : d.status === "solved" ? "#10251F" : d.status === "missed" ? "#2A1418" : "var(--surface)",
                  color: off ? "#4A4E70" : "var(--text)", opacity: off ? 0.5 : 1, fontSize: 14, fontWeight: 600,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, cursor: off ? "default" : "pointer",
                }}
              >
                <span>{d.day}</span>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: dot }} />
              </button>
            );
          })}
        </div>

        <div className="row" style={{ gap: 14, fontSize: 12, color: "var(--muted)" }}>
          {[["#5FD0BE", t("solvedLabel")], ["#F08A7A", t("missed")], ["#F0A83A", t("today")]].map(([c, l]) => (
            <span key={l} className="row" style={{ gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: c }} />{l}</span>
          ))}
        </div>

        {selectedDay?.number && (
          <section className="stack" style={{ gap: 10, padding: 16, borderRadius: 18, background: "var(--surface)" }}>
            <div className="row row--between row--baseline">
              <span style={{ fontSize: 17, fontWeight: 700 }}>{t("zipNumberDate", { number: selectedDay.number, day: selectedDay.day })}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: status === "solved" ? ACCENT : status === "today" ? "#F0A83A" : "#F08A7A" }}>
                {status === "solved" ? t("solvedTime", { time: formatClock(selectedDay.timeMs, language) }) : status === "today" ? t("today") : t("missed")}
              </span>
            </div>
            <div className="small soft">{status === "solved" ? t("archiveReplayHint") : status === "today" ? t("archiveTodayHint") : t("archiveMissedHint")}</div>
          </section>
        )}

        <div className="row" style={{ gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 14, background: "#10251F", fontSize: 13, lineHeight: 1.45, color: "var(--text-2)" }}>
          <span style={{ marginTop: 1 }}><Icon name="snowflake" size={18} color={ACCENT} /></span>
          <span>{t("archiveFreezeNote")}</span>
        </div>
      </Body>
      <div className="screen__bar">
        <button
          type="button"
          className="btn"
          disabled={!selectedDay?.number}
          style={{ background: status === "solved" ? "#1E2138" : ACCENT, color: status === "solved" ? "var(--text)" : "#0B0D1A" }}
          onClick={() => {
            if (!selectedDay?.number) return;
            if (status === "today") push({ name: "game", game: "zip", screen: "play", params: { mode: "daily" } });
            else push({ name: "game", game: "zip", screen: "play", params: { mode: "archive", number: selectedDay.number } });
          }}
        >
          {ctaLabel}
        </button>
      </div>
    </Screen>
  );
}

