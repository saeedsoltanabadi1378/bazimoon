import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { Screen } from "../../ui/components";
import { formatClock, puzzleToday } from "../../lib/format";
import { dailyNumber } from "../../lib/rng";
import { readLocal, writeLocal } from "../../lib/storage";
import { haptic } from "../../lib/haptics";
import { IntroScreen } from "../shared/IntroScreen";
import { InGameHelp } from "../shared/InGameHelp";
import { ResultScreen } from "../shared/ResultScreen";
import { PlayHeader, parseXp, useFinish, useSavedState, useStopwatch, useTrackStarted, type ResultParams } from "../shared/play";
import { dailyLadder, endlessLadder, endlessShape, letterDiff, loadLadderDictionary, shortestPath, type Ladder } from "./logic";

const ACCENT = "#F0A83A";
const INK = "#1A1206";
const CHANGED = "#5A4120";
const ENDLESS_LEVEL_KEY = "bazimoon-ladder-endless-level";
const ENDLESS_KEY = "bazimoon-ladder-endless";

type LadderMode = "daily" | "endless";

interface Saved {
  ladder: Ladder;
  level: number;
  chain: string[];
  hints: number;
  elapsedMs: number;
  /** Result params once the ladder was finished (or given up), so it is never submitted twice. */
  result?: ResultParams;
}

const dailyKey = (number: number) => `bazimoon-ladder-daily-${number}`;

function dailyStatus(number: number) {
  const saved = readLocal<Saved | null>(dailyKey(number), null);
  if (!saved) return null;
  return saved.result ? "done" : saved.chain.length > 1 ? "playing" : null;
}

/** Small letter rows used in the intro hero and the result paths. */
function MiniRungs({ words, end, size = 24, hidden = false }: { words: string[]; end: string; size?: number; hidden?: boolean }) {
  return (
    <div className="stack" style={{ gap: 4 }} dir="ltr">
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
  const { t, n } = useLanguage();
  const { push } = useNavigation();
  const { api } = useHub();
  const stats = useLoad(() => api.stats("ladder"), [api]).data;
  const number = dailyNumber("ladder", puzzleToday());
  const today = dailyLadder(number);
  const status = dailyStatus(number);
  const level = readLocal<number>(ENDLESS_LEVEL_KEY, 1);
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
      badge={t("ladderTodayPar", { par: today.par })}
      heroTitle={t("ladderTurnInto", { from: today.start, to: today.end })}
      heroSub={t("ladderRealWords")}
      modes={[
        {
          key: "daily", label: t("modeDaily"), desc: t("ladderDailyDesc"),
          play: status === "done" ? t("seeTodaysBoard") : status === "playing" ? t("continueGame") : t("ladderPlayDaily", { from: today.start, to: today.end }),
          onPlay: () => push({ name: "game", game: "ladder", screen: "play", params: { mode: "daily" } }),
        },
        {
          key: "endless", label: t("modeEndless"), desc: t("ladderEndlessDesc"),
          play: level > 1 ? t("ladderContinueLevel", { level }) : t("ladderStartEndless"),
          onPlay: () => push({ name: "game", game: "ladder", screen: "play", params: { mode: "endless" } }),
        },
        { key: "fa", label: <span style={{ fontFamily: "Vazirmatn, sans-serif" }}>فارسی</span>, desc: t("ladderFaDesc"), play: t("comingSoon"), disabled: true, onPlay: () => undefined },
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
      secondary={{ label: t("leaderboard"), onClick: () => push({ name: "league" }) }}
    />
  );
}

export function LadderPlay({ mode }: { mode: LadderMode }) {
  const { t } = useLanguage();
  const { back, replace } = useNavigation();
  const finish = useFinish("ladder");
  useTrackStarted("ladder");
  const number = dailyNumber("ladder", puzzleToday());
  const daily = mode === "daily";
  const level = daily ? 0 : readLocal<number>(ENDLESS_LEVEL_KEY, 1);
  const length = daily ? 4 : endlessShape(level).length;
  const [dict, setDict] = useState<Set<string> | null>(null);
  const [saved, setSaved, clear] = useSavedState<Saved | null>(daily ? dailyKey(number) : ENDLESS_KEY, () => {
    if (!daily) return null;
    const ladder = dailyLadder(number);
    return { ladder, level: 0, chain: [ladder.start], hints: 0, elapsedMs: 0 };
  });
  // An endless save from another level is stale; start a fresh ladder for the current one.
  const current = saved && (daily || saved.level === level) ? saved : null;

  useEffect(() => {
    let alive = true;
    void loadLadderDictionary(length).then((d) => {
      if (!alive) return;
      setDict(d);
      if (!daily && !current) {
        const ladder = endlessLadder(level, d);
        setSaved({ ladder, level, chain: [ladder.start], hints: 0, elapsedMs: 0 });
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length]);

  if (!current || !dict) {
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
      key={`${current.ladder.start}-${current.ladder.end}`}
      saved={current}
      setSaved={(next) => setSaved(next)}
      dict={dict}
      mode={mode}
      number={number}
      onBack={back}
      onFinish={(won, chain, elapsedMs, hints) => {
        if (current.result) {
          replace({ name: "game", game: "ladder", screen: "result", params: current.result });
          return;
        }
        const steps = chain.length - 1;
        const best = shortestPath(current.ladder.start, current.ladder.end, dict) ?? [current.ladder.start, current.ladder.end];
        const params: ResultParams = { mode, number, level, start: current.ladder.start, end: current.ladder.end, par: current.ladder.par, won, steps, timeMs: Math.round(elapsedMs), hints, path: JSON.stringify(chain), best: JSON.stringify(best) };
        if (daily) setSaved({ ...current, chain, hints, elapsedMs, result: params });
        else {
          clear();
          if (won) writeLocal(ENDLESS_LEVEL_KEY, level + 1);
        }
        void finish(
          { mode, puzzleNumber: daily ? number : null, solved: won, timeMs: Math.round(elapsedMs), moves: steps, detail: won ? steps - current.ladder.par : null, hints },
          params,
        );
      }}
    />
  );
}

function LadderBoard({ saved, setSaved, dict, mode, number, onBack, onFinish }: {
  saved: Saved;
  setSaved: (s: Saved) => void;
  dict: Set<string>;
  mode: LadderMode;
  number: number;
  onBack: () => void;
  onFinish: (won: boolean, chain: string[], elapsedMs: number, hints: number) => void;
}) {
  const { t, n, language } = useLanguage();
  const { ladder, chain, hints } = saved;
  const last = chain[chain.length - 1];
  const won = last === ladder.end;
  const over = won || saved.result !== undefined;
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
      if (/^[a-zA-Z]$/.test(k)) setLetter(k.toUpperCase());
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
  const sub = mode === "daily" ? t("ladderDailySub", { number, par: ladder.par }) : t("ladderEndlessSub", { level: saved.level, par: ladder.par });

  return (
    <Screen theme="night">
      <div style={{ padding: "14px 16px 8px" }}>
        <PlayHeader
          title={<span dir="ltr">{title}</span>}
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
            <div key={`${w}-${i}`} className="row" style={{ gap: 10 }} dir="ltr">
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
          <div className="row" style={{ gap: 10 }} dir="ltr">
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
            <div className="row" style={{ gap: 10 }} dir="ltr">
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
        {["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"].map((row) => (
          <div key={row} style={{ display: "flex", gap: 5, justifyContent: "center" }} dir="ltr">
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
  const { api } = useHub();
  const xp = parseXp(params);
  const mode = (params?.mode === "endless" ? "endless" : "daily") as LadderMode;
  const number = Number(params?.number ?? 0);
  const level = Number(params?.level ?? 1);
  const par = Number(params?.par ?? 0);
  const end = String(params?.end ?? "");
  const won = Boolean(params?.won);
  const steps = Number(params?.steps ?? 0);
  const hints = Number(params?.hints ?? 0);
  const timeMs = Number(params?.timeMs ?? 0);
  const mine = parseList(params?.path);
  const best = parseList(params?.best);
  const board = useLoad(() => (mode === "daily" ? api.board("ladder", number) : Promise.resolve(null)), [api, mode, number]).data;
  const streak = xp?.streak ?? 0;

  const dist = useMemo(() => {
    const rows = board?.rows ?? [];
    const total = rows.length;
    const buckets = [
      { key: "par", label: t("ladderDistPar", { par }), count: rows.filter((r) => r.solved && (r.moves ?? 0) <= par).length, mine: won && steps <= par },
      { key: "one", label: t("ladderDistSteps", { steps: par + 1 }), count: rows.filter((r) => r.solved && r.moves === par + 1).length, mine: won && steps === par + 1 },
      { key: "more", label: t("ladderDistMore", { steps: par + 2 }), count: rows.filter((r) => r.solved && (r.moves ?? 0) >= par + 2).length, mine: won && steps >= par + 2 },
      { key: "gave", label: t("ladderDistGaveUp"), count: rows.filter((r) => !r.solved).length, mine: !won },
    ];
    return buckets.map((b) => ({ ...b, pct: total ? Math.round((b.count / total) * 100) : 0 }));
  }, [board, par, steps, won, t]);

  const title = !won ? t("ladderRevealed") : steps < par ? t("ladderUnderTitle", { steps }) : steps === par ? t("ladderParTitle", { steps }) : t("ladderMadeIt", { steps });
  const sub = !won
    ? t("ladderGaveSub", { steps })
    : mode === "endless"
      ? t("ladderEndlessDone", { level })
      : steps <= par
        ? `${t("ladderShortest")} · ${t("streakDays", { count: streak })}`
        : t("ladderOverSub", { over: steps - par });
  const kicker = mode === "daily" ? t("ladderKicker", { number, par }) : t("ladderEndlessKicker", { level, par });

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
      share={{ text: `${t("gameLadder")} ${mode === "daily" ? `#${number}` : ""} · ${mine[0] ?? ""} → ${end} · ${won ? `${steps}/${par}` : "X"}` }}
      primary={{
        label: mode === "endless" && won ? t("ladderNextLevel") : t("ladderPlayEndless"),
        onClick: () => replace({ name: "game", game: "ladder", screen: "play", params: { mode: "endless", at: Date.now() } }),
      }}
      onClose={() => replace({ name: "game", game: "ladder", screen: "intro" })}
    >
      <div className="card" style={{ display: "flex", gap: 12, padding: 14 }} dir="ltr">
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

      {mode === "daily" && board && board.rows.length > 0 && (
        <div className="card stack" style={{ gap: 8, padding: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{t("ladderEveryone")}</span>
          {dist.map((d) => (
            <div key={d.key} className="row" style={{ gap: 8 }}>
              <span style={{ width: 72, fontSize: 13, color: "var(--text-2)" }}>{d.label}</span>
              <div style={{ flex: 1, height: 18, borderRadius: 4, background: "#1E2138", overflow: "hidden" }}>
                <div style={{ width: `${d.pct}%`, height: 18, background: d.mine ? (d.key === "gave" ? "#F08A7A" : ACCENT) : "#3A3F5E" }} />
              </div>
              <span className="num" style={{ width: 38, textAlign: "end", fontSize: 13, fontWeight: 600 }}>{n(d.pct)}%</span>
            </div>
          ))}
        </div>
      )}
    </ResultScreen>
  );
}
