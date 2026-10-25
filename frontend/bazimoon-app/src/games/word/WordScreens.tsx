import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { IconButton, Screen } from "../../ui/components";
import { formatShortDate, puzzleToday } from "../../lib/format";
import { dailyNumber } from "../../lib/rng";
import { readLocal } from "../../lib/storage";
import { haptic } from "../../lib/haptics";
import { IntroScreen, PreviewGrid } from "../shared/IntroScreen";
import { InGameHelp } from "../shared/InGameHelp";
import { XpCard } from "../shared/ResultScreen";
import { parseXp, useFinish, useSavedState, useTrackStarted, type ResultParams } from "../shared/play";
import { answerFor, keyboards, loadDictionary, score, type Score, type WordLang } from "./logic";

const ACCENT = "#9ED98C";
const FA_FONT = "Vazirmatn, sans-serif";

function palette(highContrast: boolean): Record<Score, [string, string]> {
  return highContrast
    ? { 0: ["#2B3042", "#9A9CB8"], 1: ["#85C0F9", "#0B1A2E"], 2: ["#F5793A", "#1C0905"] }
    : { 0: ["#2B3042", "#9A9CB8"], 1: ["#F0A83A", "#1A1206"], 2: ["#3FB8A6", "#0B1F1B"] };
}

interface Saved {
  guesses: string[][];
  cur: string[];
  submitted: boolean;
}

const storageKey = (lang: WordLang, number: number) => `bazimoon-word-${lang}-${number}`;

function savedOutcome(lang: WordLang, number: number) {
  const saved = readLocal<Saved | null>(storageKey(lang, number), null);
  if (!saved) return null;
  const answer = answerFor(lang, number).join("");
  if (saved.guesses.some((g) => g.join("") === answer)) return "won";
  if (saved.guesses.length >= 6) return "lost";
  return saved.guesses.length ? "playing" : null;
}

export function WordIntro() {
  const { t, language } = useLanguage();
  const { push } = useNavigation();
  const { api } = useHub();
  const stats = useLoad(() => api.stats("word"), [api]).data;
  const number = dailyNumber("word", puzzleToday());
  const [lang, setLang] = useState<WordLang>(language === "fa" ? "fa" : "en");
  const status = savedOutcome(lang, number);
  const rows: [string, Score][] = [["S", 0], ["T", 0], ["O", 0], ["R", 0], ["M", 0], ["L", 0], ["I", 1], ["G", 1], ["H", 1], ["T", 2], ["N", 2], ["I", 2], ["G", 2], ["H", 2], ["T", 2]];
  const colors = palette(false);
  const avgTries = stats && stats.solved ? stats.averageMoves.toFixed(1) : "—";

  return (
    <IntroScreen
      game="word"
      title={t("gameWord")}
      tagline={t("wordTagline", { number })}
      accent={ACCENT}
      accentInk="#0E1F0A"
      heroBg="#14241A"
      preview={<PreviewGrid cols={5} cells={rows.map(([ch, sc]) => ({ text: <span style={{ fontSize: 11 }}>{ch}</span>, bg: colors[sc][0], fg: colors[sc][1] }))} />}
      heroTitle={t("wordHeroTitle")}
      heroSub={t("wordHeroSub")}
      modeTitle={t("languageSetting")}
      modes={[
        {
          key: "en", label: "English", desc: t("wordEnDesc"),
          play: savedOutcome("en", number) === "won" || savedOutcome("en", number) === "lost" ? t("seeTodaysBoard") : t("playEnglish"),
          onPlay: () => push({ name: "game", game: "word", screen: "play", params: { lang: "en" } }),
        },
        {
          key: "fa", label: <span style={{ fontFamily: FA_FONT }}>فارسی</span>, desc: t("wordFaDesc"),
          play: savedOutcome("fa", number) === "won" || savedOutcome("fa", number) === "lost" ? t("seeTodaysBoard") : t("playPersian"),
          onPlay: () => push({ name: "game", game: "word", screen: "play", params: { lang: "fa" } }),
        },
      ]}
      initialMode={lang === "fa" ? 1 : 0}
      extra={(mode) => {
        if (mode !== lang) window.setTimeout(() => setLang(mode as WordLang), 0);
        return status === "playing" ? <div className="small" style={{ color: ACCENT }}>{t("wordInProgress")}</div> : null;
      }}
      stats={[
        { value: stats?.played ?? "—", label: t("statPlayed") },
        { value: stats ? `${stats.winRate}%` : "—", label: t("statWinRate") },
        { value: stats?.dailyStreak ?? "—", label: t("streak") },
        { value: avgTries, label: t("avgTries") },
      ]}
      steps={[
        { title: t("wordStep1"), text: t("wordStep1Text") },
        { title: t("wordStep2"), text: t("wordStep2Text") },
        { title: t("wordStep3"), text: t("wordStep3Text") },
      ]}
      rewards={[t("rewardDaily20"), t("wordReward2"), t("wordReward3")]}
      secondary={{ label: formatShortDate(puzzleToday(), language), onClick: () => push({ name: "league" }) }}
    />
  );
}

export function WordPlay({ lang }: { lang: WordLang }) {
  const { t, n, language } = useLanguage();
  const { back } = useNavigation();
  const { highContrast } = useHub();
  const finish = useFinish("word");
  useTrackStarted("word");
  const today = puzzleToday();
  const number = dailyNumber("word", today);
  const answer = answerFor(lang, number);
  const [saved, setSaved] = useSavedState<Saved>(storageKey(lang, number), () => ({ guesses: [], cur: [], submitted: false }));
  const [msg, setMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const fa = lang === "fa";
  const C = palette(highContrast);
  const won = saved.guesses.some((g) => g.join("") === answer.join(""));
  const lost = !won && saved.guesses.length >= 6;
  const over = won || lost;
  const tries = saved.guesses.length;

  useEffect(() => {
    void loadDictionary(lang);
  }, [lang]);

  useEffect(() => {
    if (!msg) return;
    const id = window.setTimeout(() => setMsg(null), 1800);
    return () => window.clearTimeout(id);
  }, [msg]);

  async function press(key: string) {
    if (over) return;
    if (key === "DEL") {
      setSaved((s) => ({ ...s, cur: s.cur.slice(0, -1) }));
      return;
    }
    if (key === "ENTER") {
      if (saved.cur.length < 5) {
        haptic.warn();
        setMsg(t("notEnoughLetters"));
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
        return;
      }
      const dict = await loadDictionary(lang);
      if (!dict.has(fa ? saved.cur.join("") : saved.cur.join("").toLowerCase())) {
        haptic.warn();
        setMsg(t("notInWordList"));
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
        return;
      }
      const correct = saved.cur.join("") === answer.join("");
      if (correct) haptic.success();
      else haptic.tap();
      setSaved((s) => ({ ...s, guesses: [...s.guesses, s.cur], cur: [] }));
      return;
    }
    if (saved.cur.length < 5) {
      haptic.select();
      setSaved((s) => ({ ...s, cur: [...s.cur, key] }));
    }
  }

  // Physical keyboards (desktop, hardware keyboards).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") return void press("ENTER");
      if (e.key === "Backspace") return void press("DEL");
      const k = e.key.replace("ي", "ی").replace("ك", "ک");
      const letters = keyboards[lang].flat();
      const key = fa ? k : k.toUpperCase();
      if (key.length === 1 && letters.includes(key)) void press(key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!over || saved.submitted) return;
    setSaved((s) => ({ ...s, submitted: true }));
    window.setTimeout(() => {
      void finish(
        { mode: fa ? "daily-fa" : "daily", puzzleNumber: number, solved: won, moves: won ? tries : 7 },
        { lang, number, won, tries, answer: answer.join(""), pattern: JSON.stringify(saved.guesses.map((g) => score(g, answer))) },
      );
    }, 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  const keyState: Record<string, Score> = {};
  for (const g of saved.guesses) {
    score(g, answer).forEach((sc, i) => {
      keyState[g[i]] = Math.max(keyState[g[i]] ?? -1, sc) as Score;
    });
  }
  const tileFont = fa ? FA_FONT : "var(--font-display)";

  return (
    <Screen theme="night">
      <div className="row row--between" style={{ padding: "14px 16px 8px" }}>
        <IconButton icon="back" label={t("backToGame", { game: t("gameWord") })} onClick={back} />
        <div style={{ textAlign: "center", minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{t(fa ? "wordBoardPersian" : "wordBoardEnglish")}</div>
          <div className="tiny muted"><bdi>#{n(number)}</bdi> · {formatShortDate(today, language)}</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <InGameHelp
            game={`word-${lang}`}
            accent={ACCENT}
            steps={[
              { title: t("wordStep1"), text: t("wordStep1Text") },
              { title: t("wordStep2"), text: t("wordStep2Text") },
              { title: t("wordStep3"), text: t("wordStep3Text") },
            ]}
            example={(
              <div className="word-help-legend">
                <div style={{ background: C[2][0], color: C[2][1] }}>✓ {t("wordColorRight")}</div>
                <div style={{ background: C[1][0], color: C[1][1] }}>↔ {t("wordColorElsewhere")}</div>
                <div style={{ background: C[0][0], color: C[0][1] }}>× {t("wordColorMissing")}</div>
              </div>
            )}
          />
          <div className="num" style={{ minWidth: 44, padding: "8px 10px", borderRadius: 12, background: "var(--surface)", fontWeight: 600, textAlign: "center", fontSize: 14 }}><bdi>{n(tries)} / {n(6)}</bdi></div>
        </div>
      </div>

      <div style={{ minHeight: 34, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }} role="status">
        {msg && <span style={{ padding: "6px 14px", borderRadius: 999, background: "#EDEBF5", color: "#0B0D1A", fontSize: 13, fontWeight: 600 }}>{msg}</span>}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "4px 16px 10px", position: "relative" }}>
        {Array.from({ length: 6 }, (_, r) => {
          const guess = saved.guesses[r];
          const scores = guess ? score(guess, answer) : null;
          const current = r === saved.guesses.length;
          return (
            <div
              key={r}
              aria-label={guess ? t("guessRowLabel", { n: r + 1, word: guess.join("") }) : undefined}
              style={{ display: "grid", gridTemplateColumns: "repeat(5, 58px)", gap: 6, direction: fa ? "rtl" : "ltr", animation: current && shake ? "shake 300ms" : undefined }}
            >
              {Array.from({ length: 5 }, (_, i) => {
                const ch = guess ? guess[i] : current ? saved.cur[i] ?? "" : "";
                const sc = scores?.[i];
                const [bg, fg] = sc !== undefined ? C[sc] : ["transparent", "#EDEBF5"];
                return (
                  <div
                    key={i}
                    style={{
                      height: 58, borderRadius: 10, border: `2px solid ${sc !== undefined ? bg : ch ? "#6B6E8C" : current ? "#262A44" : "#1E2138"}`,
                      background: bg, color: fg, fontFamily: tileFont, fontSize: 26, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {ch}
                  </div>
                );
              })}
            </div>
          );
        })}
        {over && (
          <div className="fade-in" style={{ position: "absolute", left: 16, right: 16, bottom: 6, padding: 16, borderRadius: 20, background: "var(--surface)", border: "1px solid #2E3252", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
            <div className="display" style={{ fontSize: 22, color: won ? ACCENT : "#F08A7A" }}>{won ? t("gotItIn", { n: tries }) : t("outOfTries")}</div>
            <div style={{ fontSize: 14, color: "var(--text-2)" }}>{t("theWordWas", { word: answer.join("") })}</div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "8px 6px calc(22px + var(--safe-bottom))", background: "var(--bar)", borderTop: "1px solid var(--line)", direction: fa ? "rtl" : "ltr" }}>
        {keyboards[lang].map((row, ri) => (
          <div key={ri} style={{ display: "flex", gap: fa ? 4 : 5, justifyContent: "center" }}>
            {row.map((key) => {
              const special = key === "ENTER" || key === "DEL";
              const st = keyState[key];
              const [bg, fg] = special ? ["#3A3F5E", "#EDEBF5"] : st !== undefined ? C[st] : ["#2E3252", "#EDEBF5"];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => void press(key)}
                  aria-label={key === "DEL" ? t("deleteKey") : key === "ENTER" ? t("submitGuess") : key}
                  style={{
                    flex: special ? 1.6 : 1, minWidth: 0, height: 52, padding: 0, borderRadius: 8, border: 0, background: bg, color: fg,
                    fontFamily: fa ? FA_FONT : "var(--font-body)", fontWeight: 700, fontSize: special ? 13 : fa ? 17 : 16, cursor: "pointer",
                  }}
                >
                  {key === "DEL" ? "⌫" : key === "ENTER" ? t("ladderSubmit") : key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <style>{"@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}"}</style>
    </Screen>
  );
}

export function WordResult({ params }: { params?: ResultParams }) {
  const { t, n } = useLanguage();
  const { replace } = useNavigation();
  const { api, highContrast, profile } = useHub();
  const xp = parseXp(params);
  const stats = useLoad(() => api.stats("word"), [api]).data;
  const lang = String(params?.lang ?? "en") as WordLang;
  const number = Number(params?.number ?? 0);
  const won = Boolean(params?.won);
  const tries = Number(params?.tries ?? 0);
  const answer = String(params?.answer ?? "");
  const pattern: Score[][] = (() => {
    try {
      return JSON.parse(String(params?.pattern ?? "[]"));
    } catch {
      return [];
    }
  })();
  const C = palette(highContrast);
  const other: WordLang = lang === "en" ? "fa" : "en";
  const otherDone = savedOutcome(other, number);
  const title = won ? (tries <= 3 ? t("brilliantIn", { n: tries }) : tries === 6 ? t("phewIn6") : t("gotItIn", { n: tries })) : t("soClose");
  const sub = otherDone === "won" || otherDone === "lost" ? t("bothWordsDone") : other === "fa" ? t("playPersianForXp") : t("playEnglishForXp");
  const counts = [1, 2, 3, 4, 5, 6].map((k) => stats?.solvedByMoves?.[String(k)] ?? 0);
  const max = Math.max(1, ...counts);
  const emoji = (sc: Score) => (sc === 2 ? "🟩" : sc === 1 ? "🟨" : "⬛");
  const shareText = `${t("gameWord")} #${n(number)} · ${won ? n(tries) : "X"}/${n(6)}\n${pattern.map((row) => row.map(emoji).join("")).join("\n")}`;

  return (
    <Screen theme="night">
      <div className="row" style={{ justifyContent: "flex-end", padding: "14px 16px 0" }}>
        <IconButton icon="close" label={t("close")} onClick={() => replace({ name: "game", game: "word", screen: "intro" })} />
      </div>
      <div className="screen__body" style={{ paddingTop: 0, paddingBottom: 20 }}>
        <section className="stack center" style={{ gap: 8, textAlign: "center" }}>
          <div className="kicker" style={{ color: won ? ACCENT : "#F08A7A" }}>{t("dailyWordN", { number })}</div>
          <div className="row" style={{ gap: 5, direction: lang === "fa" ? "rtl" : "ltr" }}>
            {Array.from(answer).map((ch, i) => (
              <span key={i} style={{ width: 44, height: 44, borderRadius: 8, background: won ? C[2][0] : "#2B3042", color: won ? C[2][1] : "#EDEBF5", fontFamily: lang === "fa" ? FA_FONT : "var(--font-display)", fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{ch}</span>
            ))}
          </div>
          <h1 className="display" style={{ marginTop: 4, fontSize: 30, lineHeight: 1.05 }}>{title}</h1>
          <p style={{ fontSize: 14, color: "var(--text-2)" }}>{sub}</p>
        </section>
        <div className="stat-grid stat-grid--4">
          {[
            [stats?.played ?? "—", t("statPlayed"), undefined],
            [stats ? `${n(stats.winRate)}%` : "—", t("statWinRate"), undefined],
            [n(xp?.streak ?? stats?.dailyStreak ?? 0), t("streak"), won ? "#F0A83A" : "#F08A7A"],
            [n(profile?.puzzles.bestStreak ?? 0), t("bestStreak"), undefined],
          ].map(([v, l, c]) => (
            <div key={String(l)} className="stat stat--center" style={{ padding: "10px 6px" }}>
              <div className="stat__value" style={{ fontSize: 18, color: c as string | undefined }}>{v}</div>
              <div className="stat__label">{l}</div>
            </div>
          ))}
        </div>
        <section className="stack" style={{ gap: 7, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
          <span style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{t("guessDistribution", { lang: lang === "fa" ? "فارسی" : "English" })}</span>
          {counts.map((c, i) => {
            const mine = won && i === tries - 1;
            return (
              <div key={i} className="row" style={{ gap: 8 }}>
                <span style={{ width: 12, fontSize: 13, color: "var(--muted)" }}>{i + 1}</span>
                <div className="grow" style={{ height: 20 }}>
                  <div style={{ width: `${Math.round((c / max) * 100)}%`, minWidth: 24, height: 20, paddingInlineEnd: 6, borderRadius: 4, background: mine ? ACCENT : "#2E3252", color: mine ? "#0E1F0A" : "#EDEBF5", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{n(c)}</div>
                </div>
              </div>
            );
          })}
        </section>
        {xp && <XpCard xp={xp} />}
        <div className="row" style={{ gap: 14, padding: 14, borderRadius: 18, border: "1.5px dashed #2E3252" }}>
          <div style={{ width: 70, flex: "none", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 2 }} aria-hidden="true">
            {pattern.flat().map((sc, i) => <div key={i} style={{ aspectRatio: "1", borderRadius: 2, background: C[sc][0] }} />)}
          </div>
          <div className="small soft" style={{ whiteSpace: "pre-line" }}>
            {`${t("gameWord")} #${number} · ${won ? tries : "X"}/6\n${won ? t("streakDays", { count: xp?.streak ?? 0 }) : t("newWordTomorrow")}`}
          </div>
        </div>
      </div>
      <div className="screen__bar screen__bar--row" style={{ gap: 8 }}>
        <ShareButton text={shareText} />
        <button
          type="button"
          className="btn"
          style={{ flex: 1.3, fontSize: 15, background: ACCENT, color: "#0E1F0A" }}
          onClick={() => replace(otherDone === "won" || otherDone === "lost" ? { name: "solo" } : { name: "game", game: "word", screen: "play", params: { lang: other } })}
        >
          {otherDone === "won" || otherDone === "lost" ? t("moreGames") : other === "fa" ? t("playPersianWord") : t("playEnglishWord")}
        </button>
      </div>
    </Screen>
  );
}

function ShareButton({ text }: { text: string }) {
  const { t } = useLanguage();
  return (
    <button type="button" className="btn btn--outline" style={{ flex: 1, fontSize: 15 }} onClick={() => import("../../lib/platform").then(({ shareLink }) => import("../../lib/links").then(({ appLink }) => void shareLink(appLink(), text)))}>
      {t("shareToGroup")}
    </button>
  );
}

