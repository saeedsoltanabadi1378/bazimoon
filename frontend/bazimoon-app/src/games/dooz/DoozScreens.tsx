import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { IconButton, Screen } from "../../ui/components";
import { haptic } from "../../lib/haptics";
import { IntroScreen } from "../shared/IntroScreen";
import { ResultScreen } from "../shared/ResultScreen";
import { parseXp, useFinish, useTrackStarted, type ResultParams } from "../shared/play";
import { boardSize, botMove, full, MAX_ROUNDS, winner, WINS_NEEDED, type Cell, type DoozMode, type Mark } from "./logic";

const ACCENT = "#C3B9FF";
const INK = "#15112E";
const X_COLOR = "#F0A83A";
const O_COLOR = "#5FD0BE";

function MarkGlyph({ mark, size }: { mark: Mark; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={mark === "X" ? X_COLOR : O_COLOR} strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      {mark === "X" ? <path d="M6 6l12 12M18 6 6 18" /> : <circle cx="12" cy="12" r="7" />}
    </svg>
  );
}

function Preview() {
  const cells: Cell[] = ["X", null, "O", null, "X", "O", null, null, "X"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, padding: 8, borderRadius: 14, background: "#151829" }} dir="ltr">
      {cells.map((c, i) => (
        <span key={i} style={{ aspectRatio: "1", borderRadius: 8, background: [0, 4, 8].includes(i) ? "#2A2113" : "#1E2138", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {c && <MarkGlyph mark={c} size={22} />}
        </span>
      ))}
    </div>
  );
}

export function DoozIntro() {
  const { t, n } = useLanguage();
  const { push } = useNavigation();
  const { api } = useHub();
  const stats = useLoad(() => api.stats("dooz"), [api]).data;
  const play = (mode: DoozMode) => push({ name: "game", game: "dooz", screen: "play", params: { mode } });

  return (
    <IntroScreen
      game="dooz"
      title={t("gameDooz")}
      tagline={t("doozTagline")}
      accent={ACCENT}
      accentInk={INK}
      heroBg="#15182E"
      preview={<Preview />}
      heroTitle={t("doozHeroTitle")}
      heroSub={t("doozHeroSub", { wins: WINS_NEEDED })}
      modeTitle={t("opponent")}
      initialMode={1}
      modes={[
        { key: "easy", label: t("nardEasy"), desc: t("doozEasyDesc"), play: t("doozStart"), onPlay: () => play("easy") },
        { key: "smart", label: t("doozSmart"), desc: t("doozSmartDesc"), play: t("doozStart"), onPlay: () => play("smart") },
        { key: "big", label: t("doozBig"), desc: t("doozBigDesc"), play: t("doozStart"), onPlay: () => play("big") },
        { key: "friend", label: t("nardFriend"), desc: t("doozFriendDesc"), play: t("doozStartFriend"), onPlay: () => play("friend") },
      ]}
      stats={[
        { value: stats ? n(stats.played) : "—", label: t("matches") },
        { value: stats ? `${n(stats.winRate)}%` : "—", label: t("statWinRate") },
        { value: stats ? n(stats.winStreak) : "—", label: t("doozWinStreak") },
        { value: n(stats?.winsByMode?.big ?? 0), label: t("doozBigWins") },
      ]}
      steps={[
        { title: t("doozStep1"), text: t("doozStep1Text") },
        { title: t("doozStep2"), text: t("doozStep2Text") },
        { title: t("doozStep3"), text: t("doozStep3Text", { wins: WINS_NEEDED, rounds: MAX_ROUNDS }) },
      ]}
      rewards={[t("doozRewardEasy"), t("doozRewardSmart"), t("doozRewardBig")]}
    />
  );
}

interface Match {
  board: Cell[];
  turn: Mark;
  starter: Mark;
  round: number;
  x: number;
  o: number;
  draws: number;
  roundOver: { mark: Mark | null; line: number[] } | null;
}

function newRound(size: number, starter: Mark): Pick<Match, "board" | "turn" | "starter" | "roundOver"> {
  return { board: Array<Cell>(size * size).fill(null), turn: starter, starter, roundOver: null };
}

export function DoozPlay({ mode }: { mode: DoozMode }) {
  const { t, n } = useLanguage();
  const { back, replace } = useNavigation();
  const finish = useFinish("dooz");
  useTrackStarted("dooz");
  const size = boardSize(mode);
  const vsBot = mode !== "friend";
  const [m, setM] = useState<Match>(() => ({ ...newRound(size, "X"), round: 1, x: 0, o: 0, draws: 0 }));
  const matchOver = m.x >= WINS_NEEDED || m.o >= WINS_NEEDED || (m.roundOver !== null && m.round >= MAX_ROUNDS);

  function place(i: number) {
    if (m.roundOver || m.board[i]) return;
    const board = [...m.board];
    board[i] = m.turn;
    const win = winner(board, size);
    if (win) {
      if (vsBot && win.mark === "O") haptic.error();
      else haptic.success();
      setM({ ...m, board, roundOver: { mark: win.mark, line: win.line }, x: m.x + (win.mark === "X" ? 1 : 0), o: m.o + (win.mark === "O" ? 1 : 0) });
    } else if (full(board)) {
      haptic.warn();
      setM({ ...m, board, roundOver: { mark: null, line: [] }, draws: m.draws + 1 });
    } else {
      haptic.tap();
      setM({ ...m, board, turn: m.turn === "X" ? "O" : "X" });
    }
  }

  // The bot plays O after a short pause.
  useEffect(() => {
    if (!vsBot || m.turn !== "O" || m.roundOver) return;
    const id = window.setTimeout(() => place(botMove(m.board, size, "O", mode)), 450);
    return () => window.clearTimeout(id);
    // Re-armed whenever the board changes, so place sees the current match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.turn, m.roundOver, m.board, vsBot, size, mode]);

  function next() {
    if (matchOver) {
      const params: ResultParams = { mode, x: m.x, o: m.o, draws: m.draws, rounds: m.round };
      if (vsBot) {
        void finish({ mode, solved: m.x > m.o, score: m.x, moves: m.draws, detail: m.o, hints: 0 }, params);
      } else {
        replace({ name: "game", game: "dooz", screen: "result", params });
      }
      return;
    }
    const starter: Mark = m.starter === "X" ? "O" : "X";
    setM({ ...m, ...newRound(size, starter), round: m.round + 1 });
  }

  const nameOf = (mark: Mark) => (vsBot ? (mark === "X" ? t("doozYou") : t("doozBot")) : t("doozPlayer", { mark }));
  const status = m.roundOver
    ? m.roundOver.mark === null ? t("doozRoundDraw") : vsBot ? (m.roundOver.mark === "X" ? t("doozYouTookRound") : t("doozBotTookRound")) : t("doozPlayerTookRound", { mark: m.roundOver.mark })
    : vsBot ? (m.turn === "X" ? t("doozYourTurn") : t("doozBotThinking")) : t("doozPlayerTurn", { mark: m.turn });
  const locked = !!m.roundOver || (vsBot && m.turn === "O");

  const score = (mark: Mark) => (
    <div className="stack center" style={{ flex: 1, gap: 4, padding: "10px 8px", borderRadius: 16, background: "var(--surface)", border: `1.5px solid ${!m.roundOver && m.turn === mark ? (mark === "X" ? X_COLOR : O_COLOR) : "transparent"}` }}>
      <span className="row" style={{ gap: 6 }}><MarkGlyph mark={mark} size={16} /><span className="small">{nameOf(mark)}</span></span>
      <span className="display num" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{n(mark === "X" ? m.x : m.o)}</span>
    </div>
  );

  return (
    <Screen theme="night">
      <div className="row row--between" style={{ padding: "14px 16px 8px" }}>
        <IconButton icon="back" label={t("backToGame", { game: t("gameDooz") })} onClick={back} />
        <div style={{ textAlign: "center" }}>
          <div className="display" style={{ fontSize: 22, fontWeight: 700 }}>{t("gameDooz")}</div>
          <div className="tiny muted">{t("doozRoundOf", { round: n(m.round), wins: n(WINS_NEEDED) })}</div>
        </div>
        <span style={{ width: 44 }} />
      </div>

      <div className="row" style={{ gap: 10, padding: "4px 16px 0" }}>
        {score("X")}
        <span className="tiny muted" style={{ flex: "none" }}>{t("doozDrawsN", { count: n(m.draws) })}</span>
        {score("O")}
      </div>

      <div className="small" role="status" style={{ textAlign: "center", padding: "14px 16px 8px", fontWeight: 600, color: m.roundOver ? "var(--text)" : "var(--text-2)" }}>{status}</div>

      <div style={{ padding: "0 16px", display: "flex", justifyContent: "center" }}>
        <div
          dir="ltr"
          role="grid"
          aria-label={t("doozBoardLabel")}
          style={{ width: "min(100%, 420px, calc(100dvh - 330px))", aspectRatio: "1", display: "grid", gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gap: size === 3 ? 8 : 5 }}
        >
          {m.board.map((c, i) => {
            const onLine = m.roundOver?.line.includes(i);
            return (
              <button
                key={i}
                type="button"
                aria-label={c ? t("doozCellTaken", { mark: c }) : t("doozCellEmpty", { row: Math.floor(i / size) + 1, col: (i % size) + 1 })}
                disabled={locked || !!c}
                onClick={() => place(i)}
                className={c ? "dooz-pop" : undefined}
                style={{
                  border: 0, borderRadius: size === 3 ? 18 : 12, cursor: locked || c ? "default" : "pointer",
                  background: onLine ? (m.roundOver?.mark === "X" ? "#3A2A16" : "#13302C") : "#151829",
                  display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                }}
              >
                {c && <MarkGlyph mark={c} size={size === 3 ? 56 : 34} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="screen__bar" style={{ marginTop: "auto" }}>
        {m.roundOver ? (
          <button type="button" className="btn" style={{ background: ACCENT, color: INK }} onClick={next}>
            {matchOver ? t("seeResults") : t("doozNextRound")}
          </button>
        ) : (
          <div className="small muted" style={{ textAlign: "center", minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {size === 5 ? t("doozFourInARow") : t("doozThreeInARow")}
          </div>
        )}
      </div>
    </Screen>
  );
}

export function DoozResult({ params }: { params?: ResultParams }) {
  const { t, n } = useLanguage();
  const { replace } = useNavigation();
  const xp = parseXp(params);
  const mode = (params?.mode as DoozMode) ?? "smart";
  const x = Number(params?.x ?? 0);
  const o = Number(params?.o ?? 0);
  const draws = Number(params?.draws ?? 0);
  const friend = mode === "friend";
  const won = x > o;
  const tied = x === o;
  const level = { easy: t("nardEasy"), smart: t("doozSmart"), big: t("doozBig"), friend: t("nardFriend") }[mode];
  const title = tied ? t("doozMatchDrawn") : friend ? t("doozPlayerWins", { mark: won ? "X" : "O" }) : won ? t("doozYouWin") : t("doozBotWins");

  return (
    <ResultScreen
      win={friend ? !tied : won}
      heroIcon={won || friend ? "trophy" : "warning"}
      heroColors={["#1E2138", ACCENT]}
      kicker={t("doozKicker", { level })}
      title={title}
      sub={t("doozFinalScore", { x: n(x), o: n(o) })}
      metrics={[
        { value: n(x), label: friend ? t("doozPlayer", { mark: "X" }) : t("doozYou"), color: X_COLOR },
        { value: n(o), label: friend ? t("doozPlayer", { mark: "O" }) : t("doozBot"), color: O_COLOR },
        { value: n(draws), label: t("doozDraws") },
      ]}
      xp={xp}
      hideXp={friend}
      accent={ACCENT}
      accentInk={INK}
      onClose={() => replace({ name: "game", game: "dooz", screen: "intro" })}
      primary={{ label: t("doozRematch"), onClick: () => replace({ name: "game", game: "dooz", screen: "play", params: { mode, at: Date.now() } }) }}
      secondary={{ label: t("doozChangeOpponent"), onClick: () => replace({ name: "game", game: "dooz", screen: "intro" }) }}
    >
      {friend && <div className="card small muted">{t("doozFriendNoXp")}</div>}
    </ResultScreen>
  );
}
