import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { Screen } from "../../ui/components";
import { formatClock } from "../../lib/format";
import { readLocal, writeLocal } from "../../lib/storage";
import { haptic } from "../../lib/haptics";
import { IntroScreen } from "../shared/IntroScreen";
import { InGameHelp } from "../shared/InGameHelp";
import { ResultScreen } from "../shared/ResultScreen";
import { PlayHeader, parseXp, useFinish, useSavedState, useStopwatch, useTrackStarted, type ResultParams } from "../shared/play";
import { LevelLoading, LevelsScreen, levelTrack, rememberLevel, useLevelCopy, useLevelMode, useLevelState } from "../shared/levels";
import { dailyLadder, endlessLadder, endlessShape, letterDiff, loadLadderDictionary, shortestPath, type Ladder } from "./logic";

const ACCENT = "#F0A83A";
const INK = "#1A1206";
const CHANGED = "#5A4120";
const endlessLevelKey = (language: "en" | "fa") => `bazimoon-ladder-${language}-endless-level`;
const endlessKey = (language: "en" | "fa") => `bazimoon-ladder-${language}-endless`;

type LadderMode = "level" | "endless";

interface Saved {
  ladder: Ladder;
  level: number;
  chain: string[];
  hints: number;
  elapsedMs: number;
}

/** Small letter rows used in the intro hero and the result paths. */
function MiniRungs({ words, end, size = 24, hidden = false }: { words: string[]; end: string; size?: number; hidden?: boolean }) {
  const { language } = useLanguage();
  return (
    <div className="stack" style={{ gap: 4 }} dir={language === "fa" ? "rtl" : "ltr"}>
      {words.map((w, i) => {
        const prev = words[i - 1];
        const edge = i === 0 || w === end;
        return (
          <div key={`${w}-${i}`} style={{ display: "flex", gap: 3, justifyContent: "center" }}>
            {w.split("").map((ch, j) => {
              const changed = !edge && !hidden && prev !== undefined && prev[j] !== ch;
              return (
                <span key={j} style={{ width: size, height: size, borderRadius: 5, background: edge ? ACCENT : changed ? CHANGED : "#2B3042", color: edge ? INK : "#EDEBF5", font: `800 ${Math.round(size * 0.52)}px var(--font-display)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {hidden && !edge ? "" : ch}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function LadderIntro() {
  const { t, n, language } = useLanguage();
  const { push } = useNavigation();
  const { api } = useHub();
  const stats = useLoad(() => api.stats("ladder"), [api]).data;
  const levels = useLevelMode("ladder", levelTrack("ladder", language));
  const today = dailyLadder(levels.level ?? 1, language);
  const level = readLocal<number>(endlessLevelKey(language), 1);
  const byDetail = stats?.solvedByDetail ?? {};
  const atOrUnder = Object.entries(byDetail).reduce((sum, [k, v]) => (Number(k) <= 0 ? sum + v : sum), 0);
  const under = Object.entries(byDetail).reduce((sum, [k, v]) => (Number(k) < 0 ? sum + v : sum), 0);
  const rungs = [today.start, ...Array.from({ length: Math.max(0, today.par - 1) }, () => "    ".slice(0, today.start.length)), today.end];

  return (
    <IntroScreen
      game="ladder"
      title={t("gameLadder")}
      tagline={t("ladderTagline")}
      accent={ACCENT}
      accentInk={INK}
      heroBg="#241A0E"
      preview={<MiniRungs words={rungs} end={today.end} hidden />}
      badge={levels.level === null ? undefined : t("ladderLevelPar", { n: levels.level, par: today.par })}
      heroTitle={t("ladderTurnInto", { from: today.start, to: today.end })}
      heroSub={t("ladderRealWords")}
      modes={[
        { ...levels.mode, desc: t("ladderLevelsDesc") },
        {
          key: "endless", label: t("modeEndless"), desc: t("ladderEndlessDesc"),
          play: level > 1 ? t("ladderContinueLevel", { level }) : t("ladderStartEndless"),
          onPlay: () => push({ name: "game", game: "ladder", screen: "play", params: { mode: "endless" } }),
        },
      ]}
      stats={[
        { value: stats ? n(stats.played) : "—", label: t("statPlayed") },
        { value: stats && stats.played ? `${n(Math.round((atOrUnder / stats.played) * 100))}%` : "—", label: t("atPar") },
        { value: stats ? n(stats.dailyStreak) : "—", label: t("streak") },
        { value: stats ? n(under) : "—", label: t("underPar") },
      ]}
      steps={[
        { title: t("ladderStep1"), text: t("ladderStep1Text") },
        { title: t("ladderStep2"), text: t("ladderStep2Text") },
        { title: t("ladderStep3"), text: t("ladderStep3Text") },
      ]}
      rewards={[t("ladderRewardPar"), t("ladderRewardUnder"), t("ladderRewardHint")]}
      secondary={levels.all}
    />
  );
}

export function LadderPlay({ mode, level }: { mode: LadderMode; level?: number }) {
  if (mode === "level" && level) return <LadderLevel level={level} />;
  return <LadderEndless />;
}

function LadderLevel({ level }: { level: number }) {
  const { language } = useLanguage();
  const track = levelTrack("ladder", language);
  const [saved, setSaved, clear, ready] = useLevelState<Saved>("ladder", track, level, () => {
    const ladder = dailyLadder(level, language);
    return { ladder, level, chain: [ladder.start], hints: 0, elapsedMs: 0 };
  });
  if (!ready) return <LevelLoading />;
  return <LadderGame mode="level" level={level} saved={saved} setSaved={setSaved} clear={clear} />;
}

function LadderEndless() {
  const { language } = useLanguage();
  const level = readLocal<number>(endlessLevelKey(language), 1);
  const [saved, setSaved, clear] = useSavedState<Saved | null>(endlessKey(language), () => null);
  // An endless save from another level is stale; start a fresh ladder for the current one.
  return <LadderGame mode="endless" level={level} saved={saved && saved.level === level ? saved : null} setSaved={setSaved} clear={clear} />;
}

function LadderGame({ mode, level, saved, setSaved, clear }: { mode: LadderMode; level: number; saved: Saved | null; setSaved: (s: Saved) => void; clear: () => void }) {
  const { t, language } = useLanguage();
  const { back } = useNavigation();
  const finish = useFinish("ladder");
  useTrackStarted("ladder");
  const levels = mode === "level";
  const length = levels ? 4 : endlessShape(level, language).length;
  const [dict, setDict] = useState<Set<string> | null>(null);

  useEffect(() => {
    let alive = true;
    void loadLadderDictionary(length, language).then((d) => {
      if (!alive) return;
      setDict(d);
      if (!levels && !saved) {
        const ladder = endlessLadder(level, d, Date.now(), language);
        setSaved({ ladder, level, chain: [ladder.start], hints: 0, elapsedMs: 0 });
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, language]);

  if (!saved || !dict) {
    return (
      <Screen theme="night">
        <div className="stack center" style={{ flex: 1, justifyContent: "center" }}>
          <span className="muted small">{t("loading")}</span>
        </div>
      </Screen>
    );
  }
  return (
    <LadderBoard
      key={`${saved.ladder.start}-${saved.ladder.end}`}
      saved={saved}
      setSaved={setSaved}
      dict={dict}
      mode={mode}
      onBack={back}
      onFinish={(won, chain, elapsedMs, hints) => {
        const steps = chain.length - 1;
        const best = shortestPath(saved.ladder.start, saved.ladder.end, dict) ?? [saved.ladder.start, saved.ladder.end];
        const params: ResultParams = { mode, level, start: saved.ladder.start, end: saved.ladder.end, par: saved.ladder.par, won, steps, timeMs: Math.round(elapsedMs), hints, path: JSON.stringify(chain), best: JSON.stringify(best) };
        clear();
        const track = levelTrack("ladder", language);
        if (levels) rememberLevel("ladder", track, level + 1);
        else if (won) writeLocal(endlessLevelKey(language), level + 1);
        void finish(
          { mode: levels ? track : mode, puzzleNumber: levels ? level : null, solved: won, timeMs: Math.round(elapsedMs), moves: steps, detail: won ? steps - saved.ladder.par : null, hints },
          params,
        );
      }}
    />
  );
}

function LadderBoard({ saved, setSaved, dict, mode, onBack, onFinish }: {
  saved: Saved;
  setSaved: (s: Saved) => void;
  dict: Set<string>;
  mode: LadderMode;
  onBack: () => void;
  onFinish: (won: boolean, chain: string[], elapsedMs: number, hints: number) => void;
}) {
  const { t, n, language } = useLanguage();
  const { ladder, chain, hints } = saved;
  const last = chain[chain.length - 1];
  const won = last === ladder.end;
  const over = won;
  const [draft, setDraft] = useState(last.split(""));
  const [sel, setSel] = useState(0);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [elapsed] = useStopwatch(!over, saved.elapsedMs);
  const steps = chain.length - 1;
  const wordLen = ladder.start.length;

  // Persist the clock every few seconds so leaving and coming back keeps the time.
  useEffect(() => {
    if (over) return;
    const id = window.setInterval(() => setSaved({ ...saved, elapsedMs: elapsed }), 3000);
    return () => window.clearInterval(id);
  });

  function update(next: Partial<Saved>) {
    setSaved({ ...saved, ...next, elapsedMs: elapsed });
  }

  function setLetter(ch: string) {
    if (over) return;
    const d = [...draft];
    d[sel] = ch;
    setDraft(d);
    setMsg(null);
    haptic.tap();
  }

  function submit() {
    if (over) return;
    const word = draft.join("");
    if (letterDiff(word, last) !== 1) return fail(t("ladderChangeOne"));
    if (!dict.has(word)) return fail(t("ladderNotWord", { word }));
    if (chain.includes(word)) return fail(t("ladderUsed", { word }));
    haptic.select();
    setMsg(null);
    update({ chain: [...chain, word] });
  }

  function fail(text: string) {
    haptic.warn();
    setMsg({ text, err: true });
  }

  function undo() {
    if (chain.length <= 1 || over) return;
    const c = chain.slice(0, -1);
    update({ chain: c });
    setDraft(c[c.length - 1].split(""));
    setMsg(null);
  }

  function hint() {
    if (over) return;
    const path = shortestPath(last, ladder.end, dict, new Set(chain));
    if (!path || path.length < 2) {
      setMsg({ text: t("ladderHintStuck"), err: false });
      return;
    }
    const next = path[1];
    const pattern = next.split("").map((ch, i) => (ch === last[i] ? ch : "_")).join("");
    update({ hints: hints + 1 });
    setMsg({ text: t("ladderHint", { pattern }), err: false });
  }

  // Physical keyboard: letters fill the selected cell, arrows move, Enter submits, Backspace resets the cell.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (language === "fa" ? /^[\u0600-\u06ff]$/.test(k) : /^[a-zA-Z]$/.test(k)) setLetter(language === "fa" ? k : k.toUpperCase());
      else if (k === "Enter") submit();
      else if (k === "ArrowLeft") setSel((s) => Math.max(0, s - 1));
      else if (k === "ArrowRight") setSel((s) => Math.min(wordLen - 1, s + 1));
      else if (k === "Backspace") setDraft(last.split(""));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const cell = wordLen >= 6 ? 44 : 52;
  const gapDots = Math.min(3, Math.max(1, ladder.par - steps));
  const title = `${ladder.start} → ${ladder.end}`;
  const sub = mode === "level" ? t("ladderLevelSub", { level: saved.level, par: ladder.par }) : t("ladderEndlessSub", { level: saved.level, par: ladder.par });

  return (
    <Screen theme="night">
      <div style={{ padding: "14px 16px 8px" }}>
        <PlayHeader
          title={<span dir={language === "fa" ? "rtl" : "ltr"}>{title}</span>}
          sub={sub}
          onBack={onBack}
          backLabel={t("backToGame", { game: t("gameLadder") })}
          right={(
            <div className="row" style={{ gap: 6 }}>
              <InGameHelp
                game="ladder"
                accent={ACCENT}
                steps={[
                  { title: t("ladderStep1"), text: t("ladderStep1Text") },
                  { title: t("ladderStep2"), text: t("ladderStep2Text") },
                  { title: t("ladderStep3"), text: t("ladderStep3Text") },
                ]}
                example={<div className="card center strong" dir="ltr" style={{ color: ACCENT, fontSize: 13 }}>{t("ladderHelpPath")}</div>}
              />
              <div className="num" style={{ minWidth: 44, padding: "8px 10px", borderRadius: 12, background: "var(--surface)", fontWeight: 600, textAlign: "center", fontSize: 14 }}><bdi>{n(steps)} / {n(ladder.par)}</bdi></div>
            </div>
          )}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 16px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        {chain.map((w, i) => {
          const prev = chain[i - 1];
          return (
            <div key={`${w}-${i}`} className="row" style={{ gap: 10 }} dir={language === "fa" ? "rtl" : "ltr"}>
              <span dir={language === "fa" ? "rtl" : "ltr"} style={{ width: 30, fontSize: 12, color: "var(--muted)", textAlign: "right" }}>{i === 0 ? t("ladderStart") : n(i)}</span>
              <div style={{ display: "flex", gap: 6 }}>
                {w.split("").map((ch, j) => {
                  const edge = i === 0 || w === ladder.end;
                  const changed = prev !== undefined && prev[j] !== ch;
                  return (
                    <span key={j} style={{ width: cell, height: cell, borderRadius: 10, background: edge ? ACCENT : changed ? CHANGED : "#1E2138", color: edge ? INK : "#EDEBF5", font: `800 ${cell * 0.46}px var(--font-display)`, display: "flex", alignItems: "center", justifyContent: "center" }}>{ch}</span>
                  );
                })}
              </div>
              <span style={{ width: 30 }} />
            </div>
          );
        })}

        {!over && (
          <div className="row" style={{ gap: 10 }} dir={language === "fa" ? "rtl" : "ltr"}>
            <span style={{ width: 30, fontSize: 12, color: ACCENT, textAlign: "right" }}>{n(steps + 1)}</span>
            <div style={{ display: "flex", gap: 6 }}>
              {draft.map((ch, i) => {
                const selected = i === sel;
                const changed = ch !== last[i];
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSel(i)}
                    aria-label={t("ladderLetter", { n: i + 1, letter: ch }) + (selected ? `, ${t("selected")}` : "")}
                    aria-pressed={selected}
                    style={{ width: cell, height: cell, padding: 0, boxSizing: "border-box", borderRadius: 10, border: `2px solid ${selected ? ACCENT : "#2E3252"}`, background: changed ? CHANGED : "var(--surface)", color: "#EDEBF5", font: `800 ${cell * 0.46}px var(--font-display)`, cursor: "pointer" }}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>
            <span style={{ width: 30 }} />
          </div>
        )}

        {!over && (
          <>
            <div className="stack center" style={{ gap: 4, margin: "2px 0" }} aria-hidden="true">
              {Array.from({ length: gapDots }, (_, i) => <span key={i} style={{ width: 4, height: 8, borderRadius: 999, background: "#2E3252" }} />)}
            </div>
            <div className="row" style={{ gap: 10 }} dir={language === "fa" ? "rtl" : "ltr"}>
              <span dir={language === "fa" ? "rtl" : "ltr"} style={{ width: 30, fontSize: 11, color: "var(--muted)", textAlign: "right" }}>{t("ladderGoal")}</span>
              <div style={{ display: "flex", gap: 6 }}>
                {ladder.end.split("").map((ch, j) => (
                  <span key={j} style={{ width: cell, height: cell, boxSizing: "border-box", borderRadius: 10, border: `2px dashed ${CHANGED}`, color: ACCENT, font: `800 ${cell * 0.46}px var(--font-display)`, display: "flex", alignItems: "center", justifyContent: "center" }}>{ch}</span>
                ))}
              </div>
              <span style={{ width: 30 }} />
            </div>
          </>
        )}

        <div role="status" style={{ minHeight: 22, fontSize: 13, color: msg?.err ? "#F08A7A" : ACCENT, textAlign: "center" }}>{msg?.text}</div>

        {over ? (
          <div className="stack center" style={{ width: "100%", boxSizing: "border-box", padding: 16, borderRadius: 20, background: "#241A0E", border: `1px solid ${CHANGED}`, gap: 8, textAlign: "center" }}>
            <div className="display" style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>
              {!won ? t("ladderRevealed") : steps < ladder.par ? t("ladderSolvedUnder", { steps }) : steps === ladder.par ? t("ladderSolvedPar", { steps }) : t("ladderSolvedIn", { steps })}
            </div>
            <button type="button" className="btn" style={{ minHeight: 46, padding: "0 22px", background: ACCENT, color: INK, fontSize: 15, width: "auto" }} onClick={() => onFinish(won, chain, elapsed, hints)}>
              {t("seeResults")}
            </button>
          </div>
        ) : (
          <button type="button" className="link-button small muted" style={{ background: "none", border: 0, color: "var(--muted)", textDecoration: "underline", cursor: "pointer" }} onClick={() => onFinish(false, chain, elapsed, hints)}>
            {t("ladderGiveUp")}
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "8px 6px calc(22px + env(safe-area-inset-bottom))", background: "#10122A", borderTop: "1px solid #1E2138" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, padding: "0 4px 4px" }}>
          <button type="button" onClick={undo} disabled={over || chain.length <= 1} style={actionStyle(false)}>{t("ladderUndo")}</button>
          <button type="button" onClick={hint} disabled={over} style={actionStyle(false)}>{t("hint")}</button>
          <button type="button" onClick={submit} disabled={over} style={actionStyle(true)}>{t("ladderSubmit")}</button>
        </div>
        {(language === "fa" ? ["ضصثقفغعهخحجچ", "شسیبلاتنمکگ", "ظطزرذدپوژ"] : ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]).map((row) => (
          <div key={row} style={{ display: "flex", gap: 5, justifyContent: "center" }} dir={language === "fa" ? "rtl" : "ltr"}>
            {row.split("").map((ch) => (
              <button key={ch} type="button" onClick={() => setLetter(ch)} aria-label={ch} style={{ flex: 1, maxWidth: 34, height: 48, padding: 0, borderRadius: 8, border: 0, background: "#2E3252", color: "#EDEBF5", font: "700 16px var(--font-body)", cursor: "pointer" }}>
                {ch}
              </button>
            ))}
          </div>
        ))}
      </div>
    </Screen>
  );
}

function actionStyle(primary: boolean) {
  return {
    minHeight: 44,
    borderRadius: 10,
    border: primary ? 0 : "1.5px solid #2E3252",
    background: primary ? ACCENT : "transparent",
    color: primary ? INK : "#EDEBF5",
    font: "600 14px var(--font-body)",
    cursor: "pointer",
  } as const;
}

function parseList(raw: unknown): string[] {
  try {
    const v = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function LadderResult({ params }: { params?: ResultParams }) {
  const { t, n, language } = useLanguage();
  const { replace } = useNavigation();
  const copy = useLevelCopy();
  const xp = parseXp(params);
  const mode = (params?.mode === "endless" ? "endless" : "level") as LadderMode;
  const level = Number(params?.level ?? 1);
  const par = Number(params?.par ?? 0);
  const end = String(params?.end ?? "");
  const won = Boolean(params?.won);
  const steps = Number(params?.steps ?? 0);
  const hints = Number(params?.hints ?? 0);
  const timeMs = Number(params?.timeMs ?? 0);
  const mine = parseList(params?.path);
  const best = parseList(params?.best);
  const streak = xp?.streak ?? 0;
  const next = copy.nextLevel(xp, level);

  const title = !won ? t("ladderRevealed") : steps < par ? t("ladderUnderTitle", { steps }) : steps === par ? t("ladderParTitle", { steps }) : t("ladderMadeIt", { steps });
  const sub = mode === "level"
    ? copy.next(xp, won, level)
    : !won ? t("ladderGaveSub", { steps }) : t("ladderEndlessDone", { level });
  const kicker = mode === "level" ? t("ladderLevelKicker", { level, par }) : t("ladderEndlessKicker", { level, par });

  return (
    <ResultScreen
      win={won}
      hero={<span />}
      kicker={kicker}
      title={title}
      sub={sub}
      metrics={[
        { value: won ? n(steps) : "—", label: t("ladderSteps"), color: won && steps <= par ? ACCENT : undefined },
        { value: formatClock(timeMs, language), label: t("statTime") },
        { value: n(hints), label: t("statHints") },
      ]}
      xp={xp}
      accent={ACCENT}
      accentInk={INK}
      share={{ text: `${mode === "level" ? copy.title("gameLadder", level) : t("gameLadder")} · ${mine[0] ?? ""} → ${end} · ${won ? `${steps}/${par}` : "X"}${mode === "level" ? ` · ${t("streakDays", { count: streak })}` : ""}` }}
      primary={mode === "level"
        ? { label: t("playLevelN", { n: next }), onClick: () => replace({ name: "game", game: "ladder", screen: "play", params: { mode: "level", level: next } }) }
        : {
          label: won ? t("ladderNextLevel") : t("ladderPlayEndless"),
          onClick: () => replace({ name: "game", game: "ladder", screen: "play", params: { mode: "endless", at: Date.now() } }),
        }}
      onClose={() => replace({ name: "game", game: "ladder", screen: "intro" })}
    >
      <div className="card" style={{ display: "flex", gap: 12, padding: 14 }} dir={language === "fa" ? "rtl" : "ltr"}>
        <div className="stack center" style={{ flex: 1, gap: 5 }}>
          <span className="tiny muted">{won ? t("ladderYourPath") : t("ladderYourAttempt")}</span>
          <MiniRungs words={mine} end={end} size={mine[0]?.length >= 6 ? 22 : 26} />
        </div>
        <div style={{ width: 1, background: "#262A44" }} />
        <div className="stack center" style={{ flex: 1, gap: 5 }}>
          <span className="tiny muted">{t("ladderShortestPath")}</span>
          <MiniRungs words={best} end={end} size={best[0]?.length >= 6 ? 22 : 26} />
        </div>
      </div>

    </ResultScreen>
  );
}

/** Ladder's level list follows the app language, like its levels. */
export function LadderLevels() {
  const { language } = useLanguage();
  return <LevelsScreen game="ladder" track={levelTrack("ladder", language)} name="gameLadder" accent={ACCENT} accentInk={INK} />;
}
