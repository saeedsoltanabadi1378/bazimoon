import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage, type Language } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useSession } from "../../app/session";
import { useHub, useLoad } from "../../hub/HubData";
import { esmApi } from "../../api/esmfamil";
import { Body, IconButton, Screen, Segmented, TopBar } from "../../ui/components";
import { Icon, type IconName } from "../../ui/Icon";
import { formatClock } from "../../lib/format";
import { randomSeed, seeded, shuffle } from "../../lib/rng";
import { writeLocal } from "../../lib/storage";
import { haptic } from "../../lib/haptics";
import { shareLink } from "../../lib/platform";
import { appLink } from "../../lib/links";
import { ResultScreen } from "../shared/ResultScreen";
import { PassPhone, Stepper } from "../shared/party";
import { readPartyStats } from "../shared/partyStats";
import { parseXp, type ResultParams } from "../shared/play";
import {
  BUILT_IN, CLASSIC, LETTERS, MAX_CATEGORIES, MIN_CATEGORIES, QUICK, SECONDS,
  categoryLabel, readSettings, scoreCategory, startsWithLetter, writeSettings, type EsmSettings, type Verdict,
} from "./logic";
import { EsmLetterChip } from "./parts";
import { soloDoneToday } from "./solo";

const ACCENT = "#F6C377";
const INK = "#2A1A06";
const COLORS = ["#F6C377", "#5FD0BE", "#B79CF2", "#8FA8FF", "#F2A7C3", "#9ED98C", "#F08A7A", "#7FC8E8"];

type Way = "online" | "solo" | "phone";

/** One-phone players: the names typed in setup, or "Player n" for blanks. */
function playerNames(settings: EsmSettings, t: ReturnType<typeof useLanguage>["t"], n: ReturnType<typeof useLanguage>["n"]) {
  return settings.names.map((name, i) => name.trim() || t("partyPlayerN", { n: n(i + 1) }));
}

export function EsmFamilIntro() {
  const { t, n, language } = useLanguage();
  const { back, push } = useNavigation();
  const session = useSession();
  const { api } = useHub();
  const stats = useLoad(() => api.stats("esmfamil"), [api]).data;
  const [way, setWay] = useState<Way>("online");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settings = readSettings(language);
  const local = readPartyStats("esmfamil");
  const soloDone = soloDoneToday(settings.letters);
  const lettersName = settings.letters === "fa" ? t("esmLettersFa") : t("esmLettersEn");

  const ways: { key: Way; icon: IconName; title: string; desc: string; tag: string }[] = [
    { key: "online", icon: "people", title: t("esmWayOnline"), desc: t("esmWayOnlineDesc"), tag: t("esmPlayers2to8") },
    { key: "solo", icon: "clock", title: t("esmWaySolo"), desc: t("esmWaySoloDesc"), tag: t("tagDaily") },
    { key: "phone", icon: "phone", title: t("esmWayPhone"), desc: t("esmWayPhoneDesc"), tag: t("esmPlayers2to8") },
  ];
  const summary = way === "solo"
    ? t("esmSummarySolo", { cats: n(CLASSIC.length), seconds: n(90) })
    : way === "online"
      ? t("esmSummaryOnline", { cats: n(settings.categories.length), rounds: n(settings.rounds), seconds: n(settings.seconds), letters: lettersName })
      : t("esmSummaryPhone", { cats: n(settings.categories.length), rounds: n(settings.rounds), seconds: n(settings.seconds), players: n(settings.names.length) });

  async function play() {
    setError(null);
    if (way === "phone") {
      push({ name: "game", game: "esmfamil", screen: "play" });
    } else if (way === "solo") {
      push({ name: "game", game: "esmfamil", screen: "solo", params: { mode: soloDone ? "practice" : "daily", letters: settings.letters } });
    } else {
      setBusy(true);
      try {
        const room = await esmApi(session.api).create({ categories: settings.categories, rounds: settings.rounds, seconds: settings.seconds, letters: settings.letters });
        push({ name: "game", game: "esmfamil", screen: "lobby", params: { code: room.code } });
      } catch {
        setError(t("esmCreateFailed"));
      } finally {
        setBusy(false);
      }
    }
  }

  const playLabel = way === "online" ? t("esmCreateRoom") : way === "solo" ? (soloDone ? t("esmPracticeAnother") : t("esmPlayToday")) : t("esmStart");

  return (
    <Screen theme="night">
      <TopBar onBack={back} backLabel={t("backToSolo")} title={t("gameEsmFamil")} subtitle={t("esmTagline")} />
      <Body style={{ gap: 18, paddingBottom: 20 }}>
        <section className="row" style={{ gap: 16, padding: 16, borderRadius: 22, background: "#241A0E" }}>
          <div className="stack" style={{ width: 96, flex: "none", gap: 4, padding: 10, borderRadius: 14, background: "#151829" }} aria-hidden="true">
            <span className="display" style={{ alignSelf: "center", width: 40, height: 40, borderRadius: 12, background: ACCENT, color: INK, fontSize: 24, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {language === "fa" ? "م" : "M"}
            </span>
            {["name", "city", "animal"].map((c) => (
              <span key={c} className="row row--between" style={{ gap: 6, fontSize: 10 }}>
                <span className="muted">{categoryLabel(c, t)}</span>
                <span style={{ width: 26, height: 6, borderRadius: 3, background: "#3A3F5E" }} />
              </span>
            ))}
          </div>
          <div className="stack stack--sm">
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25 }}>{t("esmHeroTitle")}</div>
            <div className="small" style={{ color: "var(--text-2)" }}>{t("esmHeroSub")}</div>
          </div>
        </section>

        <section className="stack" style={{ gap: 10 }}>
          <h2 className="h2">{t("esmWaysTitle")}</h2>
          <div role="radiogroup" aria-label={t("esmWaysTitle")} className="stack" style={{ gap: 8 }}>
            {ways.map((w) => {
              const on = w.key === way;
              return (
                <button
                  key={w.key} type="button" role="radio" aria-checked={on} onClick={() => setWay(w.key)}
                  className="row" style={{ gap: 12, minHeight: 68, padding: "12px 14px", borderRadius: 16, border: `2px solid ${on ? ACCENT : "transparent"}`, background: on ? "#241A0E" : "var(--surface)", color: "var(--text)", textAlign: "start", cursor: "pointer" }}
                >
                  <span style={{ width: 42, height: 42, flex: "none", borderRadius: 12, background: "#2A2113", color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={w.icon} size={22} />
                  </span>
                  <span className="grow stack" style={{ gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{w.title}</span>
                    <span className="tiny muted">{w.desc}</span>
                  </span>
                  <span className="tag" style={{ background: "#1E2138", color: "var(--text-2)" }}>{w.tag}</span>
                </button>
              );
            })}
          </div>
        </section>

        <button
          type="button" onClick={() => push({ name: "game", game: "esmfamil", screen: "setup", params: { way } })}
          className="row" style={{ gap: 12, minHeight: 56, padding: "8px 14px", borderRadius: 14, border: 0, background: "var(--surface)", color: "var(--text)", textAlign: "start", cursor: "pointer" }}
        >
          <span className="grow stack" style={{ gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{t("esmSetupTitle")}</span>
            <span className="tiny muted">{summary}</span>
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: ACCENT }}>{t("esmEdit")}</span>
        </button>

        {way === "online" && (
          <form
            className="stack" style={{ gap: 8, padding: 14, borderRadius: 16, border: "1.5px dashed #2E3252" }}
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) push({ name: "game", game: "esmfamil", screen: "lobby", params: { code: code.trim().toUpperCase() } });
            }}
          >
            <label htmlFor="esm-code" style={{ fontSize: 14, fontWeight: 600 }}>{t("esmJoinTitle")}</label>
            <div className="row" style={{ gap: 8 }}>
              <input id="esm-code" type="text" dir="ltr" autoCapitalize="characters" autoComplete="off" placeholder="EF-4K7" value={code} onChange={(e) => setCode(e.target.value)} className="text-field" style={{ flex: 1, minHeight: 48, letterSpacing: 2, fontWeight: 600 }} />
              <button type="submit" className="btn btn--outline btn--auto" style={{ minHeight: 48, padding: "0 18px", fontSize: 15 }}>{t("esmJoin")}</button>
            </div>
          </form>
        )}

        {error && <div className="card small" role="alert" style={{ color: "#F08A7A" }}>{error}</div>}

        <div className="stat-grid stat-grid--4">
          {[
            [stats ? n(stats.played + (local.played ?? 0)) : "—", t("statGames")],
            [n(stats?.winsByMode?.online ?? 0), t("esmOnlineWins")],
            [stats?.bestScore != null ? n(stats.bestScore) : "—", t("esmSoloBest")],
            [n(stats?.dailyStreak ?? 0), t("esmDayStreak")],
          ].map(([v, l]) => (
            <div key={l} className="stat stat--center" style={{ padding: "10px 8px" }}>
              <div className="stat__value" style={{ fontSize: 18 }}>{v}</div>
              <div className="stat__label">{l}</div>
            </div>
          ))}
        </div>

        <section className="stack stack--lg" style={{ gap: 12 }}>
          <h2 className="h2">{t("howToPlay")}</h2>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 28, height: 28, flex: "none", borderRadius: 999, background: "var(--surface)", color: ACCENT, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{n(i)}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{t(`esmStep${i}` as "esmStep1")}</div>
                <div className="small" style={{ color: "var(--text-2)" }}>{t(`esmStep${i}Text` as "esmStep1Text")}</div>
              </div>
            </div>
          ))}
        </section>

        <div className="row row--wrap">
          {[t("esmRewardOnline"), t("esmRewardSolo"), t("esmRewardDaily")].map((r) => (
            <span key={r} style={{ padding: "6px 12px", borderRadius: 999, background: "#2A2113", color: "#F0A83A", fontSize: 12, fontWeight: 600 }}>{r}</span>
          ))}
        </div>
      </Body>
      <div className="screen__bar">
        <button type="button" className="btn" disabled={busy} style={{ background: ACCENT, color: INK }} onClick={() => void play()}>{playLabel}</button>
      </div>
    </Screen>
  );
}

/** Categories, player names (one phone), rounds, time and letters. In a room, the host's changes go to the server. */
export function EsmFamilSetup({ way, room }: { way: Way; room?: string }) {
  const { t, n, language } = useLanguage();
  const { back } = useNavigation();
  const session = useSession();
  const [s, setS] = useState<EsmSettings>(() => readSettings(language));
  const [custom, setCustom] = useState("");
  const [error, setError] = useState(false);
  const count = s.categories.length;
  const presets: [string, string[]][] = [[t("esmPresetClassic"), CLASSIC], [t("esmPresetQuick"), QUICK], [t("esmPresetAll"), BUILT_IN.slice(0, MAX_CATEGORIES)]];
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

  function toggle(cat: string) {
    setS((p) => ({ ...p, categories: p.categories.includes(cat) ? p.categories.filter((c) => c !== cat) : p.categories.length < MAX_CATEGORIES ? [...p.categories, cat] : p.categories }));
  }

  function addCustom() {
    const label = custom.trim().slice(0, 20);
    if (!label || count >= MAX_CATEGORIES || s.categories.includes(`custom:${label}`)) return;
    setS((p) => ({ ...p, categories: [...p.categories, `custom:${label}`] }));
    setCustom("");
  }

  async function save() {
    if (count < MIN_CATEGORIES) return;
    const names = s.names.slice(0, 8);
    const next = { ...s, names: names.length >= 2 ? names : [...names, ""].slice(0, 2) };
    writeSettings(next);
    if (room) {
      try {
        await esmApi(session.api).settings(room, { categories: next.categories, rounds: next.rounds, seconds: next.seconds, letters: next.letters });
      } catch {
        setError(true);
        return;
      }
    }
    haptic.success();
    back();
  }

  const customs = s.categories.filter((c) => c.startsWith("custom:"));

  return (
    <Screen theme="night">
      <TopBar onBack={back} backLabel={t("backToGame", { game: t("gameEsmFamil") })} title={t("esmSetupTitle")} subtitle={t("gameEsmFamil")} titleSize={24} />
      <Body style={{ gap: 18, paddingBottom: 20 }}>
        <section className="stack" style={{ gap: 10 }}>
          <div className="row row--between row--baseline">
            <h2 className="h2">{t("esmCategories")}</h2>
            <span className="tiny" style={{ color: count < MIN_CATEGORIES ? "#F08A7A" : "var(--muted)" }}>{t("esmChosenN", { count: n(count) })}</span>
          </div>
          <Segmented
            label={t("esmPresets")}
            value={presets.findIndex(([, list]) => same(list, s.categories))}
            onChange={(i) => setS((p) => ({ ...p, categories: [...presets[i][1]] }))}
            options={presets.map(([label], i) => ({ value: i, label }))}
          />
          <div className="row row--wrap" style={{ gap: 8 }}>
            {[...BUILT_IN, ...customs].map((c) => {
              const on = s.categories.includes(c);
              return (
                <button key={c} type="button" aria-pressed={on} onClick={() => toggle(c)} className="row" style={{ gap: 6, minHeight: 40, padding: "0 12px", borderRadius: 999, border: `1.5px solid ${on ? ACCENT : "#2E3252"}`, background: on ? "#2A2113" : "transparent", color: on ? ACCENT : "var(--text-2)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <Icon name={on ? "check" : "plus"} size={14} />
                  {categoryLabel(c, t)}
                </button>
              );
            })}
          </div>
          <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); addCustom(); }}>
            <label htmlFor="esm-custom" className="visually-hidden">{t("esmCustomLabel")}</label>
            <input id="esm-custom" type="text" dir="auto" maxLength={20} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={t("esmCustomPlaceholder")} className="text-field" style={{ flex: 1, minHeight: 48 }} />
            <button type="submit" className="btn btn--outline btn--auto" style={{ minHeight: 48, padding: "0 16px", fontSize: 14 }} disabled={!custom.trim() || count >= MAX_CATEGORIES}>{t("esmAdd")}</button>
          </form>
          <div className="tiny muted">{t("esmCatsHint")}</div>
        </section>

        {way === "phone" && (
          <section className="stack" style={{ gap: 8 }}>
            <h2 className="h2">{t("esmNamesTitle")}</h2>
            {s.names.map((name, i) => (
              <div key={i} className="row" style={{ gap: 10, padding: 6, paddingInlineStart: 10, borderRadius: 14, background: "var(--surface)" }}>
                <span className="avatar" aria-hidden="true" style={{ width: 30, height: 30, fontSize: 13, background: COLORS[i % COLORS.length], color: "#0B0D1A" }}>{n(i + 1)}</span>
                <input
                  type="text" dir="auto" maxLength={16} value={name} aria-label={t("esmNameOf", { n: n(i + 1) })} placeholder={t("partyPlayerN", { n: n(i + 1) })}
                  onChange={(e) => { const v = e.target.value; setS((p) => ({ ...p, names: p.names.map((x, j) => (j === i ? v : x)) })); }}
                  className="text-field" style={{ flex: 1 }}
                />
                <IconButton icon="close" label={t("esmRemovePlayer", { name: name.trim() || t("partyPlayerN", { n: n(i + 1) }) })} disabled={s.names.length <= 2} onClick={() => setS((p) => ({ ...p, names: p.names.filter((_, j) => j !== i) }))} style={{ background: "transparent" }} />
              </div>
            ))}
            {s.names.length < 8 && (
              <button type="button" className="btn btn--md" style={{ background: "transparent", border: "1.5px dashed #2E3252", color: ACCENT, fontSize: 14 }} onClick={() => setS((p) => ({ ...p, names: [...p.names, ""] }))}>
                {t("esmAddPlayer")}
              </button>
            )}
          </section>
        )}

        <section className="stack" style={{ gap: 8 }}>
          <h2 className="h2">{t("esmGame")}</h2>
          <Stepper label={t("esmRounds")} value={s.rounds} min={1} max={8} onChange={(v) => setS((p) => ({ ...p, rounds: v }))} />
          <Stepper
            label={t("esmRoundTime")} value={Math.max(0, SECONDS.indexOf(s.seconds))} min={0} max={SECONDS.length - 1}
            onChange={(i) => setS((p) => ({ ...p, seconds: SECONDS[i] }))} format={(i) => t("secondsShort", { count: n(SECONDS[i]) })}
          />
          <div className="row row--between" style={{ gap: 12, paddingInlineStart: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{t("esmLetters")}</span>
            <div style={{ width: 200 }}>
              <Segmented label={t("esmLetters")} value={s.letters} onChange={(v: Language) => setS((p) => ({ ...p, letters: v }))} options={[{ value: "fa" as Language, label: <span lang="fa">فارسی</span> }, { value: "en" as Language, label: <span lang="en">English</span> }]} />
            </div>
          </div>
        </section>
        {error && <div className="card small" role="alert" style={{ color: "#F08A7A" }}>{t("esmSaveFailed")}</div>}
      </Body>
      <div className="screen__bar">
        <button type="button" className="btn" disabled={count < MIN_CATEGORIES} style={{ background: count < MIN_CATEGORIES ? "var(--surface-2)" : ACCENT, color: count < MIN_CATEGORIES ? "var(--faint)" : INK }} onClick={() => void save()}>
          {t("esmSave")}
        </button>
      </div>
    </Screen>
  );
}

type Phase =
  | { name: "letter" }
  | { name: "pass"; seat: number }
  | { name: "write"; seat: number }
  | { name: "timeup"; seat: number }
  | { name: "review"; cat: number }
  | { name: "standings" };

/** One phone passed round: each player writes in turn, then everyone checks the answers together. */
export function EsmFamilPlay() {
  const { t, n, language } = useLanguage();
  const { back, replace } = useNavigation();
  const settings = useMemo(() => readSettings(language), [language]);
  const { categories: cats, rounds, seconds, letters } = settings;
  const names = playerNames(settings, t, n);
  const players = names.length;
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

  // Each player's turn clock; when it runs out the "time's up" screen hands the phone on.
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
      setPhase({ name: "timeup", seat: phase.seat });
    }
    // Only the clock reaching zero matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftMs]);

  function afterTurn(seat: number) {
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
      writeLocal("bazimoon-esmfamil-stats", {
        played: (stats.played ?? 0) + 1,
        rounds: (stats.rounds ?? 0) + rounds,
        best: Math.max(stats.best ?? 0, ...newTotals),
        answers: (stats.answers ?? 0) + answerCount.current,
      });
      haptic.success();
      const standings = names.map((name, i) => [name, newTotals[i], false]).sort((a, b) => Number(b[1]) - Number(a[1]));
      replace({ name: "game", game: "esmfamil", screen: "result", params: { kind: "phone", rounds, standings: JSON.stringify(standings) } });
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
      <EsmLetterChip letter={letter} hidden={phase.name === "letter"} />
    </div>
  );

  if (phase.name === "letter") {
    return (
      <Screen theme="night">
        {header}
        <div className="stack center" style={{ flex: 1, justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <div className="kicker" style={{ color: ACCENT }}>{t("esmThisRoundsLetter")}</div>
          <div
            className="display" lang={fa ? "fa" : "en"} aria-live="polite"
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
          accent={ACCENT} ink={INK}
          kicker={t("partyTurnOf", { n: n(phase.seat + 1), total: n(players) })}
          name={t("partyPassTo", { name: names[phase.seat] })}
          hint={t("esmPassHint", { seconds: n(seconds), letter })}
          action={t("esmGo")}
          onReady={() => { haptic.tap(); setPhase({ name: "write", seat: phase.seat }); }}
        />
      </Screen>
    );
  }

  if (phase.name === "timeup") {
    const lastSeat = phase.seat === players - 1;
    return (
      <Screen theme="night">
        {header}
        <div className="stack center" style={{ flex: 1, justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
          <span style={{ width: 84, height: 84, borderRadius: 999, background: "#2A1418", color: "#F08A7A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="clock" size={38} />
          </span>
          <h1 className="display" style={{ fontSize: 34, lineHeight: 1.1 }}>{t("esmTimeUp")}</h1>
          <p className="small" style={{ color: "var(--text-2)" }}>{t("esmTimeUpSaved", { name: names[phase.seat] })}</p>
          <button type="button" className="btn" style={{ marginTop: 10, maxWidth: 320, background: ACCENT, color: INK }} onClick={() => afterTurn(phase.seat)}>
            {lastSeat ? t("esmCheckAnswers") : t("partyPassTo", { name: names[phase.seat + 1] })}
          </button>
        </div>
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
          <span style={{ fontSize: 15, fontWeight: 600 }}>{names[seat]}</span>
          <span className="num" aria-live={low ? "polite" : "off"} style={{ padding: "6px 12px", borderRadius: 999, background: low ? "#2A1418" : "var(--surface)", color: low ? "#F08A7A" : "var(--text)", fontWeight: 700 }}>
            {formatClock(leftMs, language)}
          </span>
        </div>
        <div className="progress" style={{ margin: "0 16px 8px" }} aria-hidden="true">
          <span style={{ width: `${(leftMs / (seconds * 1000)) * 100}%`, background: low ? "#F08A7A" : ACCENT }} />
        </div>
        <form className="stack" style={{ flex: 1, gap: 8, padding: "4px 16px 16px", overflowY: "auto" }} onSubmit={(e) => { e.preventDefault(); afterTurn(seat); }}>
          {cats.map((cat, c) => (
            <label key={cat} className="row" style={{ gap: 10, padding: 6, paddingInlineStart: 14, borderRadius: 14, background: "var(--surface)" }}>
              <span style={{ width: 92, flex: "none", fontSize: 14, fontWeight: 600, color: "var(--text-2)" }}>{categoryLabel(cat, t)}</span>
              <input
                type="text" value={answers[seat][c]} dir="auto" lang={fa ? "fa" : "en"} autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={40}
                placeholder={`${letter}…`} className="text-field" style={{ flex: 1 }}
                onChange={(e) => { const value = e.target.value; setAnswers((prev) => prev.map((row, s) => (s === seat ? row.map((a, i) => (i === c ? value : a)) : row))); }}
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
            <h1 className="display" style={{ fontSize: 28 }}>{categoryLabel(cats[c], t)}</h1>
            <p className="small" style={{ color: "var(--text-2)" }}>{t("esmReviewHint")}</p>
          </div>
          {answers.map((row, seat) => {
            const ok = valid[seat][c];
            const result = scores[c][seat];
            const empty = row[c].trim() === "";
            return (
              <button
                key={seat} type="button" role="switch" aria-checked={ok} aria-label={t("esmToggleAnswer", { name: names[seat] })} disabled={empty}
                onClick={() => setValid((prev) => prev.map((r, s) => (s === seat ? r.map((v, i) => (i === c ? !v : v)) : r)))}
                className="row" style={{ gap: 10, minHeight: 56, padding: "8px 12px", borderRadius: 14, border: 0, background: "var(--surface)", color: "var(--text)", textAlign: "start", cursor: empty ? "default" : "pointer", opacity: ok || empty ? 1 : 0.75 }}
              >
                <span style={{ width: 76, flex: "none", fontSize: 13, color: "var(--muted)" }}>{names[seat]}</span>
                <span className="grow" dir="auto" style={{ fontSize: 16, fontWeight: 600, textDecoration: ok || empty ? "none" : "line-through", color: empty ? "var(--faint)" : undefined }}>
                  {empty ? t("esmNoAnswer") : row[c]}
                </span>
                <span className="tag" style={{ background: ok ? (result.verdict === "shared" ? "#2A2650" : "#13302C") : "#2A1418", color: ok ? (result.verdict === "shared" ? "#C3B9FF" : "#5FD0BE") : "#F08A7A" }}>
                  {empty ? n(0) : `${verdictLabel[result.verdict]} · ${n(result.points)}`}
                </span>
              </button>
            );
          })}
        </div>
        <div className="screen__bar screen__bar--row" style={{ gap: 8 }}>
          <button type="button" className="btn btn--outline" disabled={c === 0} style={{ flex: 1 }} onClick={() => setPhase({ name: "review", cat: c - 1 })}>{t("esmPrevious")}</button>
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
            <span className="grow" style={{ fontSize: 15, fontWeight: 600 }}>{names[r.seat]}</span>
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

type Standing = [string, number, boolean];

function parseStandings(params?: ResultParams): Standing[] {
  try {
    return JSON.parse(String(params?.standings ?? "[]")) as Standing[];
  } catch {
    return [];
  }
}

export function EsmFamilResult({ params }: { params?: ResultParams }) {
  const { t, n } = useLanguage();
  const { replace } = useNavigation();
  const { api } = useHub();
  const kind = String(params?.kind ?? "phone") as "phone" | "online" | "solo";
  const xp = parseXp(params);
  const solo = kind === "solo";
  const number = Number(params?.number ?? 0);
  const letters = String(params?.letters ?? "fa") as Language;
  const board = useLoad(() => (solo && params?.mode === "daily" ? api.board("esmfamil", number, letters === "fa" ? "daily-fa" : "daily") : Promise.resolve(null)), [api, solo, number, letters]).data;
  const intro = () => replace({ name: "game", game: "esmfamil", screen: "intro" });

  if (solo) {
    const points = Number(params?.points ?? 0);
    const correct = Number(params?.correct ?? 0);
    const rows = board?.rows ?? [];
    return (
      <ResultScreen
        win={correct > 0}
        heroIcon="clock"
        heroColors={["#2A2113", ACCENT]}
        kicker={params?.mode === "daily" ? t("esmSoloKicker", { number: n(number), letter: String(params?.letter ?? "") }) : t("esmSoloPracticeKicker", { letter: String(params?.letter ?? "") })}
        title={t("esmPointsN", { count: n(points) })}
        sub={t("esmSoloSub", { correct: n(correct), total: n(CLASSIC.length) })}
        metrics={[
          { value: n(correct), label: t("esmCorrect"), color: ACCENT },
          { value: n(Number(params?.bonus ?? 0)), label: t("esmTimeBonus") },
          { value: n(Math.max(points, ...rows.filter((r) => r.isYou).map((r) => r.score ?? 0))), label: t("statBest") },
        ]}
        xp={xp}
        hideXp={params?.mode !== "daily"}
        accent={ACCENT}
        accentInk={INK}
        share={params?.mode === "daily" ? { text: t("esmSoloShare", { points, letter: String(params?.letter ?? "") }) } : undefined}
        onClose={intro}
        primary={{ label: t("esmPracticeAnother"), onClick: () => replace({ name: "game", game: "esmfamil", screen: "solo", params: { mode: "practice", letters, at: Date.now() } }) }}
        secondary={{ label: t("quitToMenu"), onClick: intro }}
      >
        {rows.length > 0 && (
          <section className="stack" style={{ gap: 6, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{t("groupToday")}</span>
            {rows.slice(0, 6).map((r, i) => (
              <div key={`${r.name}-${i}`} className="row" style={{ gap: 10, padding: "4px 6px", borderRadius: 10, background: r.isYou ? "#1E2138" : "transparent" }}>
                <span className="num" style={{ width: 20, fontSize: 13, color: "var(--muted)" }}>{n(i + 1)}</span>
                <span className="grow" style={{ fontSize: 14 }}>{r.isYou ? t("youName", { name: r.name }) : r.name}</span>
                <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>{n(r.score ?? 0)}</span>
              </div>
            ))}
          </section>
        )}
        {params?.mode !== "daily" && <div className="card small muted">{t("esmPracticeNoXp")}</div>}
      </ResultScreen>
    );
  }

  const standings = parseStandings(params);
  const top = standings[0]?.[1] ?? 0;
  const winners = standings.filter((s) => s[1] === top);
  const rounds = Number(params?.rounds ?? 0);
  const online = kind === "online";
  const myPlace = standings.findIndex((s) => s[2]) + 1;
  const myTotal = standings.find((s) => s[2])?.[1] ?? 0;
  const iWon = online && myTotal === top;
  const title = online
    ? (iWon ? (winners.length > 1 ? t("esmTie") : t("esmYouWon")) : t("esmYouPlaced", { place: n(myPlace) }))
    : winners.length > 1 ? t("esmTie") : t("esmWinner", { name: winners[0]?.[0] ?? "" });
  const onlineXp = iWon ? 30 : 10;

  return (
    <ResultScreen
      win
      heroIcon="trophy"
      heroColors={["#2A2113", ACCENT]}
      kicker={online ? t("esmOnlineKicker", { rounds: n(rounds) }) : t("esmKicker", { rounds: n(rounds) })}
      title={title}
      sub={online && !iWon ? t("esmWinnerWith", { name: winners[0]?.[0] ?? "", points: n(top) }) : t("esmWinnerSub", { points: n(top) })}
      metrics={online
        ? [{ value: n(myPlace), label: t("esmPlace"), color: ACCENT }, { value: n(myTotal), label: t("esmPointsWord") }, { value: n(standings.length), label: t("partyPlayers") }]
        : [{ value: n(top), label: t("esmTopScore"), color: ACCENT }, { value: n(standings.length), label: t("partyPlayers") }, { value: n(rounds), label: t("esmRounds") }]}
      xp={null}
      hideXp
      accent={ACCENT}
      accentInk={INK}
      onClose={intro}
      primary={online
        ? { label: t("esmNewRoom"), onClick: intro }
        : { label: t("esmPlayAgain"), onClick: () => replace({ name: "game", game: "esmfamil", screen: "play", params: { at: Date.now() } }) }}
      secondary={online
        ? { label: t("shareToGroup"), onClick: () => void shareLink(appLink(), t("esmOnlineShare", { place: myPlace, points: myTotal })) }
        : { label: t("spyChangeSetup"), onClick: () => replace({ name: "game", game: "esmfamil", screen: "setup", params: { way: "phone" } }) }}
    >
      {online && <XpCardStatic xp={onlineXp} />}
      <section className="stack" style={{ gap: 6, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{t("esmFinalTable")}</span>
        {standings.map(([name, total, isYou], i) => (
          <div key={`${name}-${i}`} className="row" style={{ gap: 10, padding: "4px 6px", borderRadius: 10, background: isYou ? "#1E2138" : total === top ? "#2A2113" : "transparent" }}>
            <span className="num" style={{ width: 20, fontSize: 13, color: "var(--muted)" }}>{n(i + 1)}</span>
            <span className="grow" style={{ fontSize: 14 }}>{isYou ? t("youName", { name }) : name}</span>
            <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>{n(total)}</span>
          </div>
        ))}
      </section>
      {!online && <div className="card small muted">{t("esmPhoneNoXp")}</div>}
    </ResultScreen>
  );
}

/** Online games are rewarded by the server; this shows what was awarded without the level bar. */
function XpCardStatic({ xp }: { xp: number }) {
  const { t, n } = useLanguage();
  return (
    <section className="row row--between" style={{ padding: 14, borderRadius: 18, background: "var(--surface)" }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{t("xpGained", { xp: n(xp) })}</span>
      <span className="tiny muted">{t("esmXpOnProfile")}</span>
    </section>
  );
}
