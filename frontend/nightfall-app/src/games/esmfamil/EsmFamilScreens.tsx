import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage, type Language, type TranslationKey } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { IconButton, Screen, Segmented } from "../../ui/components";
import { formatClock } from "../../lib/format";
import { randomSeed, seeded, shuffle } from "../../lib/rng";
import { readLocal, writeLocal } from "../../lib/storage";
import { haptic } from "../../lib/haptics";
import { IntroScreen } from "../shared/IntroScreen";
import { ResultScreen } from "../shared/ResultScreen";
import { PassPhone, Stepper } from "../shared/party";
import { readPartyStats } from "../shared/partyStats";
import type { ResultParams } from "../shared/play";
import { CATEGORIES, LETTERS, scoreCategory, startsWithLetter, type EsmMode, type Verdict } from "./logic";

const ACCENT = "#F6C377";
const INK = "#2A1A06";
const SETUP_KEY = "nightfall-esmfamil-setup";
const SECONDS = [60, 90, 120];

interface EsmSetup {
  players: number;
  rounds: number;
  seconds: number;
  letters: Language;
}

const catKey = (cat: string) => `esmCat_${cat}` as TranslationKey;

export function EsmFamilIntro() {
  const { t, n, language } = useLanguage();
  const { push } = useNavigation();
  const [setup, setSetup] = useState<EsmSetup>(() => readLocal<EsmSetup>(SETUP_KEY, { players: 4, rounds: 3, seconds: 90, letters: language }));
  const stats = readPartyStats("esmfamil");
  const update = (patch: Partial<EsmSetup>) => {
    const next = { ...setup, ...patch };
    setSetup(next);
    writeLocal(SETUP_KEY, next);
  };
  const play = (mode: EsmMode) => push({ name: "game", game: "esmfamil", screen: "play", params: { mode, ...setup } });

  return (
    <IntroScreen
      title={t("gameEsmFamil")}
      tagline={t("esmTagline")}
      accent={ACCENT}
      accentInk={INK}
      heroBg="#241A0E"
      preview={
        <div className="stack" style={{ gap: 4, padding: 10, borderRadius: 14, background: "#151829" }}>
          <span className="display" style={{ alignSelf: "center", width: 40, height: 40, borderRadius: 12, background: ACCENT, color: INK, fontSize: 24, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {language === "fa" ? "م" : "M"}
          </span>
          {(["name", "city", "animal"] as const).map((c) => (
            <span key={c} className="row row--between" style={{ gap: 6, fontSize: 10 }}>
              <span className="muted">{t(catKey(c))}</span>
              <span style={{ width: 34, height: 6, borderRadius: 3, background: "#3A3F5E" }} />
            </span>
          ))}
        </div>
      }
      heroTitle={t("esmHeroTitle")}
      heroSub={t("esmHeroSub")}
      modes={(["classic", "quick"] as EsmMode[]).map((mode) => ({
        key: mode,
        label: t(mode === "classic" ? "esmClassic" : "esmQuick"),
        desc: t(mode === "classic" ? "esmClassicDesc" : "esmQuickDesc", { cats: CATEGORIES[mode].map((c) => t(catKey(c))).join(language === "fa" ? "، " : ", ") }),
        play: t("esmStart"),
        onPlay: () => play(mode),
      }))}
      extra={() => (
        <section className="stack" style={{ gap: 8 }}>
          <h2 className="h2">{t("partySetup")}</h2>
          <Stepper label={t("partyPlayers")} value={setup.players} min={2} max={8} onChange={(v) => update({ players: v })} />
          <Stepper label={t("esmRounds")} value={setup.rounds} min={1} max={8} onChange={(v) => update({ rounds: v })} />
          <Stepper
            label={t("esmTurnTime")}
            value={Math.max(0, SECONDS.indexOf(setup.seconds))}
            min={0}
            max={SECONDS.length - 1}
            onChange={(i) => update({ seconds: SECONDS[i] })}
            format={(i) => t("secondsShort", { count: n(SECONDS[i]) })}
          />
          <div className="row row--between" style={{ gap: 12, paddingInlineStart: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{t("esmLetters")}</span>
            <div style={{ width: 200 }}>
              <Segmented label={t("esmLetters")} value={setup.letters} onChange={(v) => update({ letters: v })} options={[{ value: "fa", label: "فارسی" }, { value: "en", label: "English" }]} />
            </div>
          </div>
        </section>
      )}
      stats={[
        { value: n(stats.played ?? 0), label: t("statGames") },
        { value: n(stats.rounds ?? 0), label: t("esmRoundsPlayed") },
        { value: n(stats.best ?? 0), label: t("esmBestScore") },
        { value: n(stats.answers ?? 0), label: t("esmAnswers") },
      ]}
      steps={[
        { title: t("esmStep1"), text: t("esmStep1Text") },
        { title: t("esmStep2"), text: t("esmStep2Text") },
        { title: t("esmStep3"), text: t("esmStep3Text") },
        { title: t("esmStep4"), text: t("esmStep4Text") },
      ]}
      rewards={[t("esmRewardUnique"), t("esmRewardShared"), t("esmRewardAlone")]}
    />
  );
}

type Phase =
  | { name: "letter" }
  | { name: "pass"; seat: number }
  | { name: "write"; seat: number }
  | { name: "review"; cat: number }
  | { name: "standings" };

export function EsmFamilPlay({ mode, players, rounds, seconds, letters }: EsmSetup & { mode: EsmMode }) {
  const { t, n, language } = useLanguage();
  const { back, replace } = useNavigation();
  const cats = CATEGORIES[mode];
  const order = useMemo(() => shuffle(seeded(`esm-${randomSeed()}`), LETTERS[letters]), [letters]);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>({ name: "letter" });
  const [answers, setAnswers] = useState<string[][]>(() => Array.from({ length: players }, () => cats.map(() => "")));
  const [valid, setValid] = useState<boolean[][]>([]);
  const [totals, setTotals] = useState<number[]>(() => Array(players).fill(0));
  const [rolling, setRolling] = useState(true);
  const [shown, setShown] = useState(order[0]);
  const [leftMs, setLeftMs] = useState(seconds * 1000);
  const answerCount = useRef(0);
  const letter = order[round % order.length];
  const seatName = (seat: number) => t("partyPlayerN", { n: n(seat + 1) });
  const fa = letters === "fa";

  // The letter "spins" through the alphabet for a moment before it lands.
  useEffect(() => {
    if (phase.name !== "letter") return;
    setRolling(true);
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setShown(LETTERS[letters][Math.floor(Math.random() * LETTERS[letters].length)]);
      if (i >= 12) {
        window.clearInterval(id);
        setShown(letter);
        setRolling(false);
        haptic.success();
      }
    }, 90);
    return () => window.clearInterval(id);
  }, [phase.name, letter, letters]);

  // Each player's turn clock.
  useEffect(() => {
    if (phase.name !== "write") return;
    const deadline = Date.now() + seconds * 1000;
    setLeftMs(seconds * 1000);
    const id = window.setInterval(() => setLeftMs(Math.max(0, deadline - Date.now())), 250);
    return () => window.clearInterval(id);
  }, [phase, seconds]);

  useEffect(() => {
    if (phase.name === "write" && leftMs === 0) {
      haptic.warn();
      finishTurn(phase.seat);
    }
    // finishTurn reads the latest answers on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftMs]);

  function finishTurn(seat: number) {
    if (seat < players - 1) {
      setPhase({ name: "pass", seat: seat + 1 });
      return;
    }
    setValid(answers.map((row) => row.map((a) => startsWithLetter(a, letter))));
    setPhase({ name: "review", cat: 0 });
  }

  const scores = useMemo(() => {
    if (!valid.length) return null;
    return cats.map((_, c) => scoreCategory(answers.map((row) => row[c]), valid.map((row) => row[c])));
  }, [answers, valid, cats]);
  const roundPoints = (seat: number) => scores?.reduce((sum, cat) => sum + cat[seat].points, 0) ?? 0;

  function nextRound() {
    const newTotals = totals.map((v, seat) => v + roundPoints(seat));
    answerCount.current += valid.flat().filter(Boolean).length;
    if (round + 1 >= rounds) {
      const stats = readPartyStats("esmfamil");
      writeLocal("nightfall-esmfamil-stats", {
        played: (stats.played ?? 0) + 1,
        rounds: (stats.rounds ?? 0) + rounds,
        best: Math.max(stats.best ?? 0, ...newTotals),
        answers: (stats.answers ?? 0) + answerCount.current,
      });
      haptic.success();
      replace({ name: "game", game: "esmfamil", screen: "result", params: { totals: newTotals.join(","), rounds, mode, players, seconds, letters } });
      return;
    }
    setTotals(newTotals);
    setAnswers(Array.from({ length: players }, () => cats.map(() => "")));
    setValid([]);
    setRound(round + 1);
    setPhase({ name: "letter" });
  }

  const header = (
    <div className="row row--between" style={{ padding: "14px 16px 8px" }}>
      <IconButton icon="back" label={t("backToGame", { game: t("gameEsmFamil") })} onClick={back} />
      <div style={{ textAlign: "center" }}>
        <div className="display" style={{ fontSize: 22, fontWeight: 700 }}>{t("gameEsmFamil")}</div>
        <div className="tiny muted">{t("esmRoundOf", { round: n(round + 1), rounds: n(rounds) })}</div>
      </div>
      <span className="display" aria-label={t("esmLetterIs", { letter })} style={{ width: 44, height: 44, borderRadius: 14, background: phase.name === "letter" ? "var(--surface)" : ACCENT, color: phase.name === "letter" ? "var(--faint)" : INK, fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {phase.name === "letter" ? "?" : letter}
      </span>
    </div>
  );

  if (phase.name === "letter") {
    return (
      <Screen theme="night">
        {header}
        <div className="stack center" style={{ flex: 1, justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <div className="kicker" style={{ color: ACCENT }}>{t("esmThisRoundsLetter")}</div>
          <div
            className="display"
            lang={fa ? "fa" : "en"}
            aria-live="polite"
            style={{ width: 160, height: 160, borderRadius: 40, background: rolling ? "var(--surface)" : ACCENT, color: rolling ? "var(--text-2)" : INK, fontSize: 96, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 200ms" }}
          >
            {shown}
          </div>
          <p className="small" style={{ color: "var(--text-2)", maxWidth: 300 }}>{rolling ? t("esmPicking") : t("esmLetterHint", { letter })}</p>
        </div>
        <div className="screen__bar">
          <button type="button" className="btn" disabled={rolling} style={{ background: rolling ? "var(--surface-2)" : ACCENT, color: rolling ? "var(--faint)" : INK }} onClick={() => setPhase({ name: "pass", seat: 0 })}>
            {t("esmStartRound")}
          </button>
        </div>
      </Screen>
    );
  }

  if (phase.name === "pass") {
    return (
      <Screen theme="night">
        {header}
        <PassPhone
          accent={ACCENT}
          ink={INK}
          kicker={t("partyTurnOf", { n: n(phase.seat + 1), total: n(players) })}
          name={t("partyPassTo", { name: seatName(phase.seat) })}
          hint={t("esmPassHint", { seconds: n(seconds), letter })}
          action={t("esmGo")}
          onReady={() => {
            haptic.tap();
            setPhase({ name: "write", seat: phase.seat });
          }}
        />
      </Screen>
    );
  }

  if (phase.name === "write") {
    const seat = phase.seat;
    const low = leftMs <= 10_000;
    return (
      <Screen theme="night">
        {header}
        <div className="row row--between" style={{ padding: "0 16px 8px" }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{seatName(seat)}</span>
          <span className="num" aria-live={low ? "polite" : "off"} style={{ padding: "6px 12px", borderRadius: 999, background: low ? "#2A1418" : "var(--surface)", color: low ? "#F08A7A" : "var(--text)", fontWeight: 700 }}>
            {formatClock(leftMs, language)}
          </span>
        </div>
        <div className="progress" style={{ margin: "0 16px 8px" }} aria-hidden="true">
          <span style={{ width: `${(leftMs / (seconds * 1000)) * 100}%`, background: low ? "#F08A7A" : ACCENT }} />
        </div>
        <form
          className="stack"
          style={{ flex: 1, gap: 8, padding: "4px 16px 16px", overflowY: "auto" }}
          onSubmit={(e) => {
            e.preventDefault();
            finishTurn(seat);
          }}
        >
          {cats.map((cat, c) => (
            <label key={cat} className="row" style={{ gap: 10, padding: "6px 6px", paddingInlineStart: 14, borderRadius: 14, background: "var(--surface)" }}>
              <span style={{ width: 92, flex: "none", fontSize: 14, fontWeight: 600, color: "var(--text-2)" }}>{t(catKey(cat))}</span>
              <input
                type="text"
                value={answers[seat][c]}
                dir="auto"
                lang={fa ? "fa" : "en"}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={40}
                placeholder={`${letter}…`}
                onChange={(e) => {
                  const value = e.target.value;
                  setAnswers((prev) => prev.map((row, s) => (s === seat ? row.map((a, i) => (i === c ? value : a)) : row)));
                }}
                className="text-field"
                style={{ flex: 1 }}
              />
            </label>
          ))}
          <button type="submit" className="btn" style={{ marginTop: 6, background: ACCENT, color: INK }}>{t("esmStop")}</button>
        </form>
      </Screen>
    );
  }

  if (phase.name === "review" && scores) {
    const c = phase.cat;
    const last = c === cats.length - 1;
    const verdictLabel: Record<Verdict, string> = { unique: t("esmUnique"), shared: t("esmShared"), alone: t("esmAlone"), invalid: t("esmRejected") };
    return (
      <Screen theme="night">
        {header}
        <div className="stack" style={{ flex: 1, gap: 12, padding: "4px 16px 16px", overflowY: "auto" }}>
          <div>
            <div className="kicker" style={{ color: ACCENT }}>{t("esmCheckOf", { n: n(c + 1), total: n(cats.length) })}</div>
            <h1 className="display" style={{ fontSize: 28 }}>{t(catKey(cats[c]))}</h1>
            <p className="small" style={{ color: "var(--text-2)" }}>{t("esmReviewHint")}</p>
          </div>
          {answers.map((row, seat) => {
            const ok = valid[seat][c];
            const result = scores[c][seat];
            const empty = row[c].trim() === "";
            return (
              <button
                key={seat}
                type="button"
                role="switch"
                aria-checked={ok}
                aria-label={t("esmToggleAnswer", { name: seatName(seat) })}
                disabled={empty}
                onClick={() => setValid((prev) => prev.map((r, s) => (s === seat ? r.map((v, i) => (i === c ? !v : v)) : r)))}
                className="row"
                style={{ gap: 10, minHeight: 56, padding: "8px 12px", borderRadius: 14, border: 0, background: "var(--surface)", color: "var(--text)", textAlign: "start", cursor: empty ? "default" : "pointer", opacity: ok || empty ? 1 : 0.75 }}
              >
                <span style={{ width: 76, flex: "none", fontSize: 13, color: "var(--muted)" }}>{seatName(seat)}</span>
                <span className="grow" dir="auto" style={{ fontSize: 16, fontWeight: 600, textDecoration: ok || empty ? "none" : "line-through", color: empty ? "var(--faint)" : undefined }}>
                  {empty ? t("esmNoAnswer") : row[c]}
                </span>
                <span className="tag" style={{ background: ok ? (result.verdict === "shared" ? "#2A2650" : "#13302C") : "#2A1418", color: ok ? (result.verdict === "shared" ? "#C3B9FF" : "#5FD0BE") : "#F08A7A" }}>
                  {empty ? "0" : `${verdictLabel[result.verdict]} · ${n(result.points)}`}
                </span>
              </button>
            );
          })}
        </div>
        <div className="screen__bar screen__bar--row" style={{ gap: 8 }}>
          {c > 0 && <button type="button" className="btn btn--outline" style={{ flex: 1 }} onClick={() => setPhase({ name: "review", cat: c - 1 })}>{t("esmPrevious")}</button>}
          <button type="button" className="btn" style={{ flex: 1.4, background: ACCENT, color: INK }} onClick={() => setPhase(last ? { name: "standings" } : { name: "review", cat: c + 1 })}>
            {last ? t("esmSeeScores") : t("esmNextCategory")}
          </button>
        </div>
      </Screen>
    );
  }

  const ranked = totals.map((v, seat) => ({ seat, round: roundPoints(seat), total: v + roundPoints(seat) })).sort((a, b) => b.total - a.total);
  return (
    <Screen theme="night">
      {header}
      <div className="stack" style={{ flex: 1, gap: 10, padding: "4px 16px 16px", overflowY: "auto" }}>
        <h1 className="display" style={{ fontSize: 28 }}>{t("esmScoresAfter", { round: n(round + 1) })}</h1>
        {ranked.map((r, i) => (
          <div key={r.seat} className="row" style={{ gap: 12, minHeight: 56, padding: "8px 14px", borderRadius: 14, background: i === 0 ? "#2A2113" : "var(--surface)" }}>
            <span className="num" style={{ width: 22, color: i === 0 ? ACCENT : "var(--muted)", fontWeight: 700 }}>{n(i + 1)}</span>
            <span className="grow" style={{ fontSize: 15, fontWeight: 600 }}>{seatName(r.seat)}</span>
            <span className="tiny" style={{ color: "#5FD0BE" }}>+{n(r.round)}</span>
            <span className="num" style={{ minWidth: 40, textAlign: "end", fontSize: 18, fontWeight: 700 }}>{n(r.total)}</span>
          </div>
        ))}
      </div>
      <div className="screen__bar">
        <button type="button" className="btn" style={{ background: ACCENT, color: INK }} onClick={nextRound}>
          {round + 1 >= rounds ? t("esmFinalResults") : t("esmNextRound")}
        </button>
      </div>
    </Screen>
  );
}

export function EsmFamilResult({ params }: { params?: ResultParams }) {
  const { t, n } = useLanguage();
  const { replace } = useNavigation();
  const totals = String(params?.totals ?? "").split(",").filter(Boolean).map(Number);
  const ranked = totals.map((v, seat) => ({ seat, total: v })).sort((a, b) => b.total - a.total);
  const top = ranked[0]?.total ?? 0;
  const winners = ranked.filter((r) => r.total === top);
  const seatName = (seat: number) => t("partyPlayerN", { n: n(seat + 1) });
  const again = () => replace({ name: "game", game: "esmfamil", screen: "play", params: { mode: String(params?.mode ?? "classic"), players: Number(params?.players ?? 4), rounds: Number(params?.rounds ?? 3), seconds: Number(params?.seconds ?? 90), letters: String(params?.letters ?? "fa"), at: Date.now() } });

  return (
    <ResultScreen
      win
      heroIcon="trophy"
      heroColors={["#2A2113", ACCENT]}
      kicker={t("esmKicker", { rounds: n(Number(params?.rounds ?? 0)) })}
      title={winners.length > 1 ? t("esmTie") : t("esmWinner", { name: seatName(winners[0]?.seat ?? 0) })}
      sub={t("esmWinnerSub", { points: n(top) })}
      metrics={[
        { value: n(top), label: t("esmTopScore"), color: ACCENT },
        { value: n(totals.length), label: t("partyPlayers") },
        { value: n(Number(params?.rounds ?? 0)), label: t("esmRounds") },
      ]}
      xp={null}
      hideXp
      accent={ACCENT}
      accentInk={INK}
      onClose={() => replace({ name: "game", game: "esmfamil", screen: "intro" })}
      primary={{ label: t("esmPlayAgain"), onClick: again }}
      secondary={{ label: t("spyChangeSetup"), onClick: () => replace({ name: "game", game: "esmfamil", screen: "intro" }) }}
    >
      <section className="stack" style={{ gap: 6, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{t("esmFinalTable")}</span>
        {ranked.map((r, i) => (
          <div key={r.seat} className="row" style={{ gap: 10, padding: "4px 6px", borderRadius: 10, background: r.total === top ? "#2A2113" : "transparent" }}>
            <span className="num" style={{ width: 20, fontSize: 13, color: "var(--muted)" }}>{n(i + 1)}</span>
            <span className="grow" style={{ fontSize: 14 }}>{seatName(r.seat)}</span>
            <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>{n(r.total)}</span>
          </div>
        ))}
      </section>
    </ResultScreen>
  );
}
