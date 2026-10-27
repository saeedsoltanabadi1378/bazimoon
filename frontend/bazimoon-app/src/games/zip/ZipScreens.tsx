import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { formatClock, formatCountdown, msUntilNextPuzzle } from "../../lib/format";
import { IntroScreen, PreviewGrid } from "../shared/IntroScreen";
import { ResultScreen } from "../shared/ResultScreen";
import { parseXp, type ResultParams } from "../shared/play";
import { useLevelCopy, useLevelMode } from "../shared/levels";

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
  const levels = useLevelMode("zip", "level");

  return (
    <IntroScreen
      game="zip"
      title={t("gameZip")}
      tagline={levels.level === null ? t("zipTagline") : t("levelTagline", { n: levels.level })}
      accent={ACCENT}
      heroBg="#10251F"
      preview={<PreviewGrid cols={5} cells={previewPattern.map(([text, on]) => ({ text, bg: on ? ACCENT : "#262A44" }))} />}
      badge={levels.badge}
      heroTitle={t("zipHeroTitle")}
      heroSub={t("zipHeroSub")}
      modes={[
        levels.mode,
        { key: "practice", label: t("modePractice"), desc: t("zipPracticeDesc"), play: t("startPractice"), onPlay: () => push({ name: "game", game: "zip", screen: "play", params: { mode: "practice" } }) },
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
      rewards={[t("rewardLevel20"), t("rewardLevelStreak"), t("rewardLeagueXp")]}
      secondary={levels.all}
    />
  );
}

export function ZipResult({ params }: { params?: ResultParams }) {
  const { t, language, n } = useLanguage();
  const { replace, reset } = useNavigation();
  const copy = useLevelCopy();
  const xp = parseXp(params);
  const level = typeof params?.level === "number" ? params.level : null;
  const timeMs = Number(params?.timeMs ?? 0);
  const hints = Number(params?.hints ?? 0);
  const size = Number(params?.size ?? 6);
  const streak = xp?.streak ?? 0;
  const time = formatClock(timeMs, language);
  const title = level !== null ? copy.title("gameZip", level) : t("gameZip");
  const next = copy.nextLevel(xp, level);

  const sub = level !== null ? copy.next(xp, true, level) : t("practiceNoStreak");
  const grid = Array.from({ length: size }, () => "🟩".repeat(size)).join("\n");
  const shareText = [
    `${title} · ${time}`,
    `${t("streakDays", { count: streak })} · ${hints ? t("hintsUsed", { count: hints }) : t("noHints")}`,
    grid,
  ].join("\n");

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
      xpNote={xp?.percentile != null ? t("fasterThanLevel", { pct: xp.percentile }) : undefined}
      accent={ACCENT}
      share={{ text: shareText }}
      primary={level !== null
        ? { label: t("playLevelN", { n: next }), onClick: () => replace({ name: "game", game: "zip", screen: "play", params: { mode: "level", level: next } }) }
        : { label: t("practiceMore"), onClick: () => replace({ name: "game", game: "zip", screen: "play", params: { mode: "practice" } }) }}
      secondary={{ label: t("backToHome"), onClick: () => reset({ name: "home" }) }}
    >
      <div className="row" style={{ gap: 14, padding: 14, borderRadius: 18, border: "1.5px dashed #2E3252" }}>
        <div style={{ width: 66, flex: "none" }} aria-hidden="true">
          <PreviewGrid cols={size} gap={2} radius={2} cells={Array.from({ length: size * size }, () => ({ bg: ACCENT }))} />
        </div>
        <div className="small" style={{ color: "var(--text-2)", whiteSpace: "pre-line" }}>
          {`${title} · ${time}\n${hints ? t("hintsUsed", { count: hints }) : t("noHints")}`}
        </div>
      </div>
    </ResultScreen>
  );
}
