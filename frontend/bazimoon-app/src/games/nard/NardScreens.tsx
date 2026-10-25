import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { Body, IconButton, Screen, Segmented, Switch, TopBar } from "../../ui/components";
import { haptic } from "../../lib/haptics";
import { readLocal, writeLocal } from "../../lib/storage";
import { XpCard } from "../shared/ResultScreen";
import { parseXp, useFinish, useSavedState, useTrackStarted, type ResultParams } from "../shared/play";
import { apply, botPlay, describeBotMove, legal, pips, roll, startPosition, type Difficulty, type Move, type Position } from "./logic";

const SETUP_KEY = "bazimoon-nard-setup";
const LIGHT = "#F4EEE4";
const DARK = "#2A1A12";

interface Setup {
  difficulty: Difficulty;
  length: 1 | 3 | 5;
  mars: boolean;
}

interface GameLog {
  winner: "you" | "bot";
  mars: boolean;
  points: number;
}

interface MatchState {
  setup: Setup;
  pos: Position;
  dice: number[];
  turn: "you" | "bot";
  note: string;
  botDice: number[];
  winner: "you" | "bot" | null;
  myScore: number;
  botScore: number;
  games: GameLog[];
  stats: { pipsMoved: number; hits: number; doubles: number; mySum: number; myRolls: number; botSum: number; botRolls: number };
}

function newMatch(setup: Setup): MatchState {
  return {
    setup, pos: startPosition(), dice: [], turn: "you", note: "", botDice: [], winner: null, myScore: 0, botScore: 0, games: [],
    stats: { pipsMoved: 0, hits: 0, doubles: 0, mySum: 0, myRolls: 0, botSum: 0, botRolls: 0 },
  };
}

function MiniBoard() {
  const top: Record<number, number> = { 0: 5, 4: 3, 6: 5, 11: 2 };
  const tri = (bottom: boolean) => Array.from({ length: 12 }, (_, i) => (
    <div key={i} style={{ position: "relative", flex: 1 }}>
      <div style={{ position: "absolute", left: 0, right: 0, [bottom ? "bottom" : "top"]: 0, height: 60, background: i % 2 ? "#6B3E22" : "#C27A3A", clipPath: bottom ? "polygon(50% 0, 100% 100%, 0 100%)" : "polygon(0 0, 100% 0, 50% 100%)" }} />
      <div style={{ position: bottom ? "absolute" : "relative", left: 0, right: 0, bottom: bottom ? 1 : undefined, display: "flex", flexDirection: bottom ? "column-reverse" : "column", alignItems: "center", gap: 1, paddingTop: bottom ? 0 : 1 }}>
        {Array.from({ length: Math.min(top[i] ?? 0, 4) }, (_, k) => (
          <span key={k} style={{ width: 14, height: 14, borderRadius: 999, background: bottom ? LIGHT : DARK, border: `1.5px solid ${bottom ? "#CFA77A" : "#8A6040"}` }} />
        ))}
      </div>
    </div>
  ));
  return (
    <div className="stack" style={{ gap: 6, padding: 10, borderRadius: 18, background: "#3B2716", border: "3px solid #5A3B22" }} aria-hidden="true">
      <div style={{ display: "flex", gap: 2, height: 64, padding: "0 4px", background: "#24301F", borderRadius: 8 }}>{tri(false)}</div>
      <div style={{ display: "flex", gap: 2, height: 64, padding: "0 4px", background: "#24301F", borderRadius: 8 }}>{tri(true)}</div>
    </div>
  );
}

export function NardIntro() {
  const { t } = useLanguage();
  const { back, push } = useNavigation();
  const { api } = useHub();
  const stats = useLoad(() => api.stats("nard"), [api]).data;
  const [setup, setSetup] = useState<Setup>(() => readLocal<Setup>(SETUP_KEY, { difficulty: "medium", length: 3, mars: true }));
  const [opponent, setOpponent] = useState<Difficulty | "friend">(setup.difficulty);
  const update = (patch: Partial<Setup>) => {
    const next = { ...setup, ...patch };
    setSetup(next);
    writeLocal(SETUP_KEY, next);
  };
  const saved = readLocal<MatchState | null>("bazimoon-nard-match", null);
  const resumable = saved && !(saved.winner && (saved.myScore >= saved.setup.length || saved.botScore >= saved.setup.length));
  const oppDesc: Record<string, string> = { easy: t("nardEasyDesc"), medium: t("nardMediumDesc"), hard: t("nardHardDesc"), friend: t("nardFriendDesc") };
  const lengthLabel = (l: number) => (l === 1 ? t("nardOnePoint") : t("nardFirstTo", { n: l }));

  return (
    <Screen theme="day">
      <TopBar
        onBack={back}
        backLabel={t("backToSolo")}
        title={<span className="row row--baseline" style={{ gap: 8 }}>{t("gameNard")}<span lang="fa" style={{ fontFamily: "Vazirmatn, sans-serif", fontSize: 14, color: "#CFA77A", fontWeight: 500 }}>تخته نرد</span></span>}
        subtitle={t("nardTagline")}
      />
      <Body style={{ gap: 18, paddingBottom: 20 }}>
        <MiniBoard />
        <section className="stack">
          <h2 className="h2">{t("opponent")}</h2>
          <Segmented
            label={t("opponent")}
            value={opponent}
            onChange={(v) => {
              setOpponent(v);
              if (v !== "friend") update({ difficulty: v });
            }}
            options={[
              { value: "easy", label: t("nardEasy") },
              { value: "medium", label: t("nardMedium") },
              { value: "hard", label: t("nardHard") },
              { value: "friend", label: t("nardFriend") },
            ]}
          />
          <div className="small muted">{oppDesc[opponent]}</div>
        </section>
        <section className="stack">
          <h2 className="h2">{t("matchLength")}</h2>
          <Segmented label={t("matchLength")} value={setup.length} onChange={(v) => update({ length: v })} options={[1, 3, 5].map((l) => ({ value: l as 1 | 3 | 5, label: lengthLabel(l) }))} />
          <button
            type="button"
            role="switch"
            aria-checked={setup.mars}
            onClick={() => update({ mars: !setup.mars })}
            className="row row--between"
            style={{ minHeight: 48, padding: "0 14px", borderRadius: 14, border: 0, background: "var(--surface)", color: "var(--text)", fontSize: 14, cursor: "pointer" }}
          >
            <span>{t("marsScoresTwo")}</span>
            <Switch on={setup.mars} />
          </button>
        </section>
        <div className="stat-grid stat-grid--4">
          {[
            [stats?.played ?? "—", t("matches")],
            [stats ? `${stats.winRate}%` : "—", t("statWinRate")],
            // Each match stores 2 in Detail for a Mars win and 1 otherwise.
            [stats ? Math.max(0, stats.sumDetail - stats.played) : "—", t("marsWins")],
            [`${stats?.winsByMode?.hard ?? 0}`, t("winsVsHard")],
          ].map(([v, l]) => (
            <div key={String(l)} className="stat stat--center" style={{ padding: "10px 8px" }}>
              <div className="stat__value" style={{ fontSize: 18 }}>{v}</div>
              <div className="stat__label">{l}</div>
            </div>
          ))}
        </div>
        <section className="stack stack--lg" style={{ gap: 12 }}>
          <h2 className="h2">{t("rulesInShort")}</h2>
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 28, height: 28, flex: "none", borderRadius: 999, background: "var(--surface)", color: "#F0A83A", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{t(`nardRule${n}` as "nardRule1")}</div>
                <div className="small soft">{t(`nardRule${n}Text` as "nardRule1Text")}</div>
              </div>
            </div>
          ))}
        </section>
      </Body>
      <div className="screen__bar" style={{ gap: 8 }}>
        {resumable && opponent !== "friend" && (
          <button type="button" className="btn btn--outline" onClick={() => push({ name: "game", game: "nard", screen: "play", params: { resume: true } })}>
            {t("resumeMatch", { me: saved!.myScore, bot: saved!.botScore })}
          </button>
        )}
        <button
          type="button"
          className="btn btn--primary"
          disabled={opponent === "friend"}
          onClick={() => push({ name: "game", game: "nard", screen: "play", params: { resume: false } })}
        >
          {opponent === "friend" ? t("friendMatchesSoon") : t("playVsBot", { level: t(`nard${opponent[0].toUpperCase()}${opponent.slice(1)}` as "nardEasy"), length: lengthLabel(setup.length) })}
        </button>
      </div>
    </Screen>
  );
}

function Checker({ mine, label, highlight }: { mine: boolean; label?: string; highlight?: boolean }) {
  return (
    <div style={{ width: 22, height: 22, borderRadius: 999, background: mine ? LIGHT : DARK, border: `2px solid ${mine ? (highlight ? "#F0A83A" : "#CFA77A") : "#8A6040"}`, color: mine ? DARK : LIGHT, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {label}
    </div>
  );
}

export function NardPlay({ resume }: { resume: boolean }) {
  const { t, n } = useLanguage();
  const { back } = useNavigation();
  const finish = useFinish("nard");
  useTrackStarted("nard");
  const setup = readLocal<Setup>(SETUP_KEY, { difficulty: "medium", length: 3, mars: true });
  useState(() => {
    if (!resume) writeLocal("bazimoon-nard-match", newMatch(setup));
  });
  const [state, setState, clearSaved] = useSavedState<MatchState>("bazimoon-nard-match", () => newMatch(setup));
  const s = state;
  const p = s.pos;
  const generation = useRef(0);

  const matchOver = s.myScore >= s.setup.length || s.botScore >= s.setup.length;
  const moves = s.turn === "you" && s.dice.length && !s.winner ? legal(p, s.dice) : [];
  const from = new Set(moves.map((m) => m.from));
  const to = new Set(moves.map((m) => m.to));
  const { mine: myPips, bot: botPips } = pips(p);

  // Resume an interrupted bot turn.
  useEffect(() => {
    if (s.turn === "bot" && !s.winner) runBot(s);
    const gen = generation;
    return () => {
      gen.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function endGame(next: MatchState, winner: "you" | "bot"): MatchState {
    const loserOff = winner === "you" ? next.pos.offK : next.pos.offW;
    const mars = next.setup.mars && loserOff === 0;
    const points = mars ? 2 : 1;
    haptic[winner === "you" ? "success" : "error"]();
    return {
      ...next, dice: [], winner,
      myScore: next.myScore + (winner === "you" ? points : 0),
      botScore: next.botScore + (winner === "bot" ? points : 0),
      games: [...next.games, { winner, mars, points }],
    };
  }

  function runBot(from: MatchState) {
    const gen = ++generation.current;
    window.setTimeout(() => {
      if (generation.current !== gen) return;
      const dice = roll();
      const { moves: played, position } = botPlay(from.pos, dice, from.setup.difficulty);
      const shown = dice.length === 4 ? [dice[0], dice[0]] : dice;
      const desc = played.map((m) => {
        const d = describeBotMove(m);
        return `${d.from}→${d.to}${d.hit ? ` (${t("hitWord")})` : ""}`;
      }).join(", ");
      let next: MatchState = {
        ...from, pos: position, turn: "you", botDice: shown,
        note: played.length
          ? t(dice.length === 4 ? "botRolledDouble" : "botRolled", { dice: shown.join("-"), moves: desc })
          : t("botCouldNotMove", { dice: shown.join("-") }),
        stats: { ...from.stats, botSum: from.stats.botSum + dice.reduce((a, b) => a + b, 0), botRolls: from.stats.botRolls + 1 },
      };
      if (played.some((m) => m.hit)) haptic.warn();
      if (position.offK === 15) next = endGame(next, "bot");
      setState(next);
    }, 900);
  }

  function rollDice() {
    if (s.dice.length || s.turn !== "you" || s.winner) return;
    haptic.tap();
    const dice = roll();
    const stats = { ...s.stats, mySum: s.stats.mySum + dice.reduce((a, b) => a + b, 0), myRolls: s.stats.myRolls + 1, doubles: s.stats.doubles + (dice.length === 4 ? 1 : 0) };
    if (!legal(p, dice).length) {
      const next: MatchState = { ...s, dice: [], botDice: dice.length === 4 ? [dice[0], dice[0]] : dice, turn: "bot", note: t("youHaveNoMove", { dice: dice.slice(0, 2).join("-") }), stats };
      setState(next);
      runBot(next);
      return;
    }
    setState({ ...s, dice, note: "", stats });
  }

  function play(m: Move) {
    haptic.tap();
    const pos = apply(p, m);
    const dice = [...s.dice];
    dice.splice(m.die, 1);
    const stats = { ...s.stats, pipsMoved: s.stats.pipsMoved + m.d, hits: s.stats.hits + (m.hit ? 1 : 0) };
    let next: MatchState = { ...s, pos, dice, note: "", stats };
    if (pos.offW === 15) {
      setState(endGame(next, "you"));
      return;
    }
    if (!dice.length || !legal(pos, dice).length) {
      next = { ...next, dice: [], turn: "bot", note: dice.length ? t("noMoveForDie") : "" };
      setState(next);
      runBot(next);
      return;
    }
    setState(next);
  }

  function nextGame() {
    setState({ ...s, pos: startPosition(), dice: [], turn: s.winner === "you" ? "bot" : "you", note: "", botDice: [], winner: null });
    if (s.winner === "you") runBot({ ...s, pos: startPosition(), dice: [], turn: "bot", winner: null });
  }

  async function seeResults() {
    clearSaved();
    const won = s.myScore > s.botScore;
    const luck = s.stats.myRolls && s.stats.botRolls
      ? Math.round(((s.stats.mySum / s.stats.myRolls - s.stats.botSum / s.stats.botRolls) / 8.17) * 100)
      : 0;
    await finish(
      { mode: s.setup.difficulty, solved: won, score: s.myScore, moves: s.stats.pipsMoved, detail: won && s.games.some((g) => g.winner === "you" && g.mars) ? 2 : 1 },
      {
        difficulty: s.setup.difficulty, length: s.setup.length, me: s.myScore, bot: s.botScore, games: JSON.stringify(s.games),
        pipsMoved: s.stats.pipsMoved, hits: s.stats.hits, doubles: s.stats.doubles, luck,
      },
    );
  }

  const point = (num: number, idx: number, top: boolean) => {
    const pt = p.pts[num]!;
    const count = pt.w || pt.k;
    const mine = pt.w > 0;
    const stack = Array.from({ length: Math.min(count, 5) }, (_, i) => (
      <Checker key={i} mine={mine} highlight={mine && from.has(num)} label={i === 4 && count > 5 ? `+${count - 4}` : undefined} />
    ));
    return (
      <div key={num} style={{ position: "relative", flex: 1, height: 180 }} aria-label={t("pointLabel", { n: num, count, side: count ? (mine ? t("yours") : t("bots")) : "" })}>
        <div style={{ position: "absolute", left: 1, right: 1, [top ? "top" : "bottom"]: 0, height: 160, background: idx % 2 ? "#6B3E22" : "#C27A3A", clipPath: top ? "polygon(0 0, 100% 0, 50% 100%)" : "polygon(50% 0, 100% 100%, 0 100%)", opacity: to.has(num) ? 1 : 0.75 }} />
        <div style={{ position: top ? "relative" : "absolute", left: 0, right: 0, bottom: top ? undefined : 2, display: "flex", flexDirection: top ? "column" : "column-reverse", alignItems: "center", gap: 1, paddingTop: top ? 2 : 0 }}>{stack}</div>
      </div>
    );
  };
  const half = (topNums: number[], bottomNums: number[]) => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#24301F", borderRadius: 10, padding: "0 2px" }}>
      <div style={{ display: "flex", height: 180 }}>{topNums.map((num, i) => point(num, i, true))}</div>
      <div style={{ display: "flex", height: 180 }}>{bottomNums.map((num, i) => point(num, i, false))}</div>
    </div>
  );

  const rolled = s.dice.length > 0;
  const shownDice = rolled ? s.dice : s.turn === "bot" ? [] : s.botDice;
  const hint = s.winner ? "" : s.turn === "bot" ? t("botThinking") : rolled ? (p.barW ? t("enterFromBar") : t("pickAMove")) : s.note || t("yourTurnRoll");
  const levelLabel = t(`nard${s.setup.difficulty[0].toUpperCase()}${s.setup.difficulty.slice(1)}` as "nardEasy");
  const lastGame = s.games[s.games.length - 1];

  return (
    <Screen theme="day">
      <header className="topbar" style={{ paddingBottom: 6 }}>
        <IconButton icon="back" label={t("backToGame", { game: t("gameNard") })} onClick={back} />
        <div className="topbar__text">
          <div className="row row--baseline" style={{ gap: 8 }}>
            <span className="display" style={{ fontSize: 22 }}>{t("gameNard")}</span>
            <span lang="fa" style={{ fontFamily: "Vazirmatn, sans-serif", fontSize: 14, color: "#CFA77A" }}>تخته نرد</span>
          </div>
          <div className="tiny muted">{t("nardPlaySub", { level: levelLabel, me: s.myScore, bot: s.botScore, length: s.setup.length })}</div>
        </div>
      </header>
      <div className="row" style={{ gap: 10, margin: "2px 16px 6px", padding: "7px 12px", borderRadius: 14, background: s.turn === "bot" ? "#2B241B" : "#1F1A14" }}>
        <span style={{ width: 22, height: 22, borderRadius: 999, background: DARK, border: "2px solid #8A6040" }} />
        <span className="grow" style={{ fontSize: 14, fontWeight: 600 }}>{t("botOff", { off: p.offK })}</span>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{t("pipsN", { n: botPips })}</span>
      </div>
      <Body style={{ padding: "0 16px 8px", gap: 8 }}>
        <div dir="ltr" style={{ position: "relative", height: 410, padding: 7, borderRadius: 18, background: "#3B2716", border: "3px solid #5A3B22" }}>
          <div style={{ display: "flex", height: "100%" }}>
            {half([13, 14, 15, 16, 17, 18], [12, 11, 10, 9, 8, 7])}
            <div style={{ width: 30, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "30px 0", background: "#5A3B22" }}>
              {p.barK > 0 ? <div aria-label={t("botOnBar", { n: p.barK })}><Checker mine={false} label={String(p.barK)} /></div> : <span />}
              <span />
              {p.barW > 0 ? <div aria-label={t("youOnBar", { n: p.barW })}><Checker mine highlight label={String(p.barW)} /></div> : <span />}
            </div>
            {half([19, 20, 21, 22, 23, 24], [6, 5, 4, 3, 2, 1])}
          </div>
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", display: "flex", gap: 6 }} aria-label={shownDice.length ? t("diceShow", { dice: shownDice.join(", ") }) : undefined}>
            {(shownDice.length ? shownDice : [5, 3]).map((v, i) => (
              <div key={i} className="display" style={{ width: 36, height: 36, borderRadius: 8, background: rolled ? LIGHT : DARK, color: rolled ? DARK : "#CFC5B5", boxShadow: "0 3px 0 #8A6040", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, opacity: shownDice.length ? 1 : 0.3 }}>{v}</div>
            ))}
          </div>
          {s.winner && (
            <div style={{ position: "absolute", inset: 0, borderRadius: 15, background: "rgba(18,15,11,0.86)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center" }}>
              <div className="display" style={{ fontSize: 30, color: s.winner === "you" ? "#5FD0BE" : "#F08A7A" }}>
                {s.winner === "you" ? (lastGame?.mars ? t("marsYouWin") : t("youWin")) : lastGame?.mars ? t("marsAgainstYou") : t("botWins")}
              </div>
              <div style={{ fontSize: 15, color: "var(--text-2)" }}>{t("scoreLine", { me: s.myScore, bot: s.botScore })}</div>
              {matchOver ? (
                <button type="button" className="btn btn--primary btn--pill" onClick={() => void seeResults()}>{t("seeResults")}</button>
              ) : (
                <button type="button" className="btn btn--primary btn--pill" onClick={nextGame}>{t("nextGame")}</button>
              )}
            </div>
          )}
        </div>
        <div role="status" style={{ minHeight: 20, fontSize: 14, color: s.note && !rolled ? "#CFA77A" : "var(--text-2)" }}>{hint}</div>
        <div className="row row--wrap">
          {moves.map((m, i) => (
            <button
              key={`${m.from}-${m.to}-${m.die}-${i}`}
              type="button"
              onClick={() => play(m)}
              style={{ minHeight: 44, padding: "0 12px", borderRadius: 12, border: `1.5px solid ${m.hit ? "#E5604D" : m.to === "off" ? "#5FD0BE" : "#4A3A22"}`, background: "#1F1A14", color: "var(--text)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              {`${m.from === "bar" ? t("bar") : m.from} → ${m.to === "off" ? t("borneOff") : m.to}${m.hit ? ` · ${t("hitWord")}` : ""}`}
            </button>
          ))}
        </div>
      </Body>
      <div className="screen__bar screen__bar--row" style={{ padding: "10px 16px calc(22px + var(--safe-bottom))" }}>
        <span style={{ width: 26, height: 26, borderRadius: 999, background: LIGHT, border: "2px solid #CFA77A" }} />
        <div className="grow">
          <div style={{ fontSize: 14, fontWeight: 600 }}>{t("youOff", { off: p.offW })}</div>
          <div className="tiny muted">{t("pipsN", { n: n(myPips) })}</div>
        </div>
        <button
          type="button"
          className="btn btn--auto"
          disabled={rolled || s.turn !== "you" || Boolean(s.winner)}
          onClick={rollDice}
          style={{ padding: "0 26px", background: rolled || s.turn !== "you" ? "#2B241B" : "#F0A83A", color: rolled || s.turn !== "you" ? "#8F8473" : "#1A1206" }}
        >
          {s.turn === "bot" ? t("botTurn") : rolled ? t("moving") : t("rollDice")}
        </button>
      </div>
    </Screen>
  );
}

export function NardResult({ params }: { params?: ResultParams }) {
  const { t, n } = useLanguage();
  const { replace } = useNavigation();
  const xp = parseXp(params);
  const difficulty = String(params?.difficulty ?? "medium") as Difficulty;
  const length = Number(params?.length ?? 1);
  const me = Number(params?.me ?? 0);
  const bot = Number(params?.bot ?? 0);
  const won = me > bot;
  const games: GameLog[] = (() => {
    try {
      return JSON.parse(String(params?.games ?? "[]"));
    } catch {
      return [];
    }
  })();
  const anyMars = games.some((g) => g.winner === "you" && g.mars);
  const levelLabel = t(`nard${difficulty[0].toUpperCase()}${difficulty.slice(1)}` as "nardEasy");
  const luck = Number(params?.luck ?? 0);
  const startNew = () => {
    writeLocal("bazimoon-nard-match", null);
    replace({ name: "game", game: "nard", screen: "play", params: { resume: false } });
  };

  return (
    <Screen theme="day">
      <div className="row" style={{ justifyContent: "flex-end", padding: "14px 16px 0" }}>
        <IconButton icon="close" label={t("close")} onClick={() => replace({ name: "game", game: "nard", screen: "intro" })} />
      </div>
      <Body style={{ paddingTop: 0, paddingBottom: 20 }}>
        <section className="stack center" style={{ gap: 8, textAlign: "center" }}>
          <div className="kicker" style={{ color: won ? "#5FD0BE" : "#F08A7A" }}>{t("nardKicker", { length: length === 1 ? t("nardOnePoint") : t("nardFirstTo", { n: length }), level: levelLabel })}</div>
          <div className="row" style={{ gap: 18 }}>
            <div className="stack center" style={{ gap: 6 }}>
              <span style={{ width: 44, height: 44, borderRadius: 999, background: LIGHT, border: "3px solid #CFA77A" }} />
              <span className="small soft">{t("you")}</span>
            </div>
            <div className="display num" style={{ fontSize: 56, lineHeight: 1 }} dir="ltr">{me}<span style={{ color: "#8F8473" }}> – </span>{bot}</div>
            <div className="stack center" style={{ gap: 6 }}>
              <span style={{ width: 44, height: 44, borderRadius: 999, background: DARK, border: "3px solid #8A6040" }} />
              <span className="small soft">{t("levelBot", { level: levelLabel })}</span>
            </div>
          </div>
          <h1 className="display" style={{ fontSize: 28 }}>{won ? (anyMars ? t("marsCleanSweep") : t("youWonMatch")) : t("botTakesIt")}</h1>
          <p style={{ fontSize: 15, color: "var(--text-2)" }}>{won ? t("nardWinSub") : t("nardLoseSub")}</p>
        </section>
        <section className="list">
          <div className="list__head">{t("gamesList")}</div>
          {games.map((g, i) => (
            <div key={i} className="list__row" style={{ gap: 10 }}>
              <span style={{ width: 22, fontSize: 13, color: "var(--muted)" }}>{i + 1}</span>
              <span className="grow" style={{ fontSize: 14 }}>
                {g.winner === "you" ? (g.mars ? t("gameMarsYou") : t("gameYouBoreOff")) : g.mars ? t("gameMarsBot") : t("gameBotBoreOff")}
              </span>
              <span style={{ padding: "3px 10px", borderRadius: 999, background: g.winner === "you" ? "#13302C" : "#3A1C1A", color: g.winner === "you" ? "#5FD0BE" : "#F08A7A", fontSize: 12, fontWeight: 700 }}>
                {g.winner === "you" ? t("pointsYou", { n: g.points }) : t("pointsBot", { n: g.points })}
              </span>
            </div>
          ))}
        </section>
        <div className="stat-grid stat-grid--4">
          {[
            [n(Number(params?.pipsMoved ?? 0)), t("pipsMoved")],
            [n(Number(params?.hits ?? 0)), t("hits")],
            [n(Number(params?.doubles ?? 0)), t("doubles")],
            [`${luck > 0 ? "+" : luck < 0 ? "−" : ""}${n(Math.abs(luck))}%`, t("diceLuck")],
          ].map(([v, l]) => (
            <div key={String(l)} className="stat stat--center" style={{ padding: "10px 6px" }}>
              <div className="stat__value" style={{ fontSize: 17 }}>{v}</div>
              <div className="stat__label">{l}</div>
            </div>
          ))}
        </div>
        {xp && <XpCard xp={xp} note={won ? undefined : t("nardTip")} />}
      </Body>
      <div className="screen__bar screen__bar--row" style={{ gap: 8 }}>
        <button type="button" className="btn btn--outline" style={{ flex: 1, fontSize: 15 }} onClick={() => replace({ name: "game", game: "nard", screen: "intro" })}>
          {won && difficulty !== "hard" ? t("tryHard") : t("changeBot")}
        </button>
        <button type="button" className="btn btn--primary" style={{ flex: 1.3, fontSize: 15 }} onClick={startNew}>{t("rematch")}</button>
      </div>
    </Screen>
  );
}
