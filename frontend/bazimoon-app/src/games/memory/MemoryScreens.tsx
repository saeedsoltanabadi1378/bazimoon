import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage, type TranslationKey } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub, useLoad } from "../../hub/HubData";
import { Body, IconButton, Screen } from "../../ui/components";
import { Icon, type IconName } from "../../ui/Icon";
import { formatClock } from "../../lib/format";
import { readLocal, writeLocal } from "../../lib/storage";
import { shuffle } from "../../lib/rng";
import { haptic } from "../../lib/haptics";
import { IntroScreen } from "../shared/IntroScreen";
import { ResultScreen } from "../shared/ResultScreen";
import { parseXp, useFinish, useStopwatch, useTrackStarted, type ResultParams } from "../shared/play";

const ACCENT = "#8FA8FF";
type MemoryMode = "4x4" | "4x5" | "6x6" | "timed";

const boards: Record<MemoryMode, { cols: number; pairs: number; three: number }> = {
  "4x4": { cols: 4, pairs: 8, three: 12 },
  "4x5": { cols: 4, pairs: 10, three: 16 },
  "6x6": { cols: 6, pairs: 18, three: 30 },
  timed: { cols: 4, pairs: 8, three: 12 },
};
const TIMED_MS = 45_000;
const TIMED_BONUS_MS = 2_000;

const faces: { key: TranslationKey; icon: IconName; bg: string; fg: string }[] = [
  { key: "roleGodfather", icon: "godfather", bg: "#3A1C1A", fg: "#F08A7A" },
  { key: "roleMafia", icon: "mafia", bg: "#3A1C1A", fg: "#F08A7A" },
  { key: "roleDetective", icon: "detective", bg: "#1B2A44", fg: "#8FA8FF" },
  { key: "roleDoctor", icon: "doctor", bg: "#13302C", fg: "#5FD0BE" },
  { key: "roleVillager", icon: "villager", bg: "#2A2113", fg: "#F0A83A" },
  { key: "cardNight", icon: "moon", bg: "#1E2138", fg: "#9C8CFF" },
  { key: "cardDay", icon: "sun", bg: "#2A2113", fg: "#F6C377" },
  { key: "cardVote", icon: "scales", bg: "#2E2340", fg: "#B79CF2" },
  { key: "cardFlame", icon: "flame", bg: "#3A2A16", fg: "#F0A83A" },
  { key: "cardShield", icon: "shield", bg: "#3D2328", fg: "#F08A7A" },
  { key: "cardTrophy", icon: "trophy", bg: "#2A2113", fg: "#F6C377" },
  { key: "cardHeart", icon: "heart", bg: "#24121C", fg: "#F2A7C3" },
  { key: "cardStar", icon: "star", bg: "#2A2650", fg: "#C3B9FF" },
  { key: "cardBolt", icon: "bolt", bg: "#14241A", fg: "#9ED98C" },
  { key: "cardBell", icon: "bell", bg: "#1B2A44", fg: "#7FC8E8" },
  { key: "cardDice", icon: "dice", bg: "#13302C", fg: "#5FD0BE" },
  { key: "cardMic", icon: "mic", bg: "#2E2340", fg: "#D9A8E8" },
  { key: "cardLock", icon: "lock", bg: "#25141E", fg: "#F2B8D0" },
];

interface CardBack {
  key: string;
  icon: IconName;
  bg: string;
  fg: string;
  stars?: number;
  season?: number;
}

const backs: CardBack[] = [
  { key: "moon", icon: "moon", bg: "#262A44", fg: "#9C8CFF" },
  { key: "crown", icon: "godfather", bg: "#3A1C1A", fg: "#F08A7A", stars: 1 },
  { key: "sun", icon: "sun", bg: "#2A2113", fg: "#F6C377", stars: 15 },
  { key: "doctor", icon: "doctor", bg: "#13302C", fg: "#5FD0BE", stars: 30 },
  { key: "detective", icon: "detective", bg: "#1B2A44", fg: "#8FA8FF", season: 4 },
  { key: "scales", icon: "scales", bg: "#2E2340", fg: "#B79CF2", stars: 50 },
];

const BACK_KEY = "bazimoon-memory-back";

function currentSeason() {
  const start = Date.parse("2026-06-22T00:00:00Z");
  return Math.floor((Date.now() - start) / (28 * 86_400_000)) + 1;
}

function owned(back: CardBack, stars: number) {
  if (back.season) return currentSeason() >= back.season;
  return stars >= (back.stars ?? 0);
}

export function starsFor(mode: MemoryMode, moves: number, complete: boolean) {
  if (!complete) return 0;
  const { three } = boards[mode];
  if (moves <= three) return 3;
  if (moves <= Math.round(three * 1.5)) return 2;
  return 1;
}

export function MemoryIntro() {
  const { t, language } = useLanguage();
  const { push } = useNavigation();
  const { api } = useHub();
  const stats = useLoad(() => api.stats("memory"), [api]).data;
  const stars = stats?.sumDetail ?? 0;
  const [selected, setSelected] = useState(() => readLocal<string>(BACK_KEY, "moon"));
  const go = (mode: MemoryMode) => () => push({ name: "game", game: "memory", screen: "play", params: { mode } });
  const preview = ["", "G", "", "", "D", "", "", "G", "", "", "S", "", "", "", "", "D"];
  const previewFaces: Record<string, (typeof faces)[number]> = { G: faces[0], D: faces[3], S: faces[2] };

  return (
    <IntroScreen
      game="memory"
      title={t("gameMemory")}
      tagline={t("memoryTagline")}
      accent={ACCENT}
      heroBg="#141F33"
      preview={
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3 }}>
          {preview.map((k, i) => {
            const f = k ? previewFaces[k] : null;
            return (
              <div key={i} style={{ aspectRatio: "0.75", borderRadius: 4, background: f ? f.bg : "#262A44", color: f ? f.fg : "#4A4E78", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={f ? f.icon : "moon"} size={12} />
              </div>
            );
          })}
        </div>
      }
      badge={t("memoryBadge")}
      heroTitle={t("memoryHeroTitle")}
      heroSub={t("memoryHeroSub")}
      modeTitle={t("board")}
      modes={[
        { key: "4x4", label: "4×4", desc: t("memory44Desc"), play: t("playBoard", { board: "4×4" }), onPlay: go("4x4") },
        { key: "4x5", label: "4×5", desc: t("memory45Desc"), play: t("playBoard", { board: "4×5" }), onPlay: go("4x5") },
        { key: "6x6", label: "6×6", desc: t("memory66Desc"), play: t("playBoard", { board: "6×6" }), onPlay: go("6x6") },
        { key: "timed", label: t("memoryTimed"), desc: t("memoryTimedDesc"), play: t("startTimedRun"), onPlay: go("timed") },
      ]}
      extra={() => (
        <section className="stack">
          <div className="row row--between row--baseline">
            <h2 className="h2">{t("cardBacks")}</h2>
            <span className="tiny muted">{t("backsUnlocked", { count: backs.filter((b) => owned(b, stars)).length, total: backs.length })}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 }}>
            {backs.map((b) => {
              const has = owned(b, stars);
              const inUse = selected === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  disabled={!has}
                  aria-pressed={inUse}
                  aria-label={has ? t("useCardBack") : b.season ? t("seasonN", { season: b.season }) : t("starsNeeded", { count: b.stars ?? 0 })}
                  onClick={() => {
                    writeLocal(BACK_KEY, b.key);
                    setSelected(b.key);
                    haptic.select();
                  }}
                  className="stack center"
                  style={{ gap: 4, border: 0, background: "transparent", padding: 0, color: "inherit", cursor: has ? "pointer" : "default" }}
                >
                  <span style={{ width: "100%", height: 58, borderRadius: 10, background: b.bg, border: `2px solid ${inUse ? ACCENT : "transparent"}`, color: b.fg, display: "flex", alignItems: "center", justifyContent: "center", opacity: has ? 1 : 0.4 }}>
                    <Icon name={b.icon} size={18} />
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
                    {inUse ? t("inUse") : has ? t("owned") : b.season ? t("seasonN", { season: b.season }) : t("starsNeeded", { count: b.stars ?? 0 })}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      stats={[
        { value: stats?.played ?? "—", label: t("statPlayed") },
        { value: stats?.bestMoves ?? "—", label: t("bestMoves") },
        { value: stars, label: t("stars") },
        { value: formatClock(stats?.bestTimeMs, language), label: t("bestTime") },
      ]}
      steps={[
        { title: t("memoryStep1"), text: t("memoryStep1Text") },
        { title: t("memoryStep2"), text: t("memoryStep2Text") },
        { title: t("memoryStep3"), text: t("memoryStep3Text") },
      ]}
    />
  );
}

export function MemoryPlay({ mode }: { mode: MemoryMode }) {
  const { t, language, n } = useLanguage();
  const { back } = useNavigation();
  const finish = useFinish("memory");
  useTrackStarted("memory");
  const { cols, pairs, three } = boards[mode];
  const deal = () => shuffle(Math.random, shuffle(Math.random, faces.map((_, i) => i)).slice(0, pairs).flatMap((f) => [f, f]));
  const [deck, setDeck] = useState(deal);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [bonus, setBonus] = useState(0);
  const lock = useRef(false);
  const done = matched.length === deck.length;
  const [ms, setMs] = useStopwatch(!done && (moves > 0 || open.length > 0));
  const timeLeft = mode === "timed" ? Math.max(0, TIMED_MS + bonus - ms) : 0;
  const timeUp = mode === "timed" && timeLeft <= 0 && !done;
  const backKey = readLocal<string>(BACK_KEY, "moon");
  const cardBack = backs.find((b) => b.key === backKey) ?? backs[0];
  const ended = done || timeUp;
  const stars = starsFor(mode, moves, done);
  const finished = useRef(false);

  useEffect(() => {
    if (!ended || finished.current) return;
    finished.current = true;
    const accuracy = moves ? Math.round((matched.length / 2 / moves) * 100) : 0;
    const timeMs = Math.round(Math.min(ms, mode === "timed" ? TIMED_MS + bonus : ms));
    window.setTimeout(() => {
      void finish(
        { mode, solved: done, moves, timeMs, detail: stars, score: matched.length / 2 },
        { mode, done, moves, timeMs, stars, pairsFound: matched.length / 2, pairs, accuracy },
      );
    }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  function flip(i: number) {
    if (lock.current || ended || open.includes(i) || matched.includes(i)) return;
    haptic.tap();
    const next = [...open, i];
    if (next.length < 2) {
      setOpen(next);
      return;
    }
    setMoves((m) => m + 1);
    if (deck[next[0]] === deck[next[1]]) {
      setMatched((m) => [...m, ...next]);
      setOpen([]);
      if (mode === "timed") setBonus((b) => b + TIMED_BONUS_MS);
      haptic.success();
    } else {
      setOpen(next);
      lock.current = true;
      window.setTimeout(() => {
        setOpen([]);
        lock.current = false;
      }, 800);
    }
  }

  function restart() {
    setDeck(deal());
    setOpen([]);
    setMatched([]);
    setMoves(0);
    setBonus(0);
    setMs(0);
    finished.current = false;
  }

  const cardHeight = cols === 6 ? 70 : pairs === 10 ? 84 : 104;
  const iconSize = cols === 6 ? 22 : 30;

  return (
    <Screen theme="night">
      <header className="topbar">
        <IconButton icon="back" label={t("backToGame", { game: t("gameMemory") })} onClick={back} />
        <div className="topbar__text">
          <div className="display" style={{ fontSize: 24 }}>{t("gameMemory")}</div>
          <div className="tiny muted">{mode === "timed" ? t("timeLeft", { time: formatClock(timeLeft, language) }) : t("memoryTagline")}</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {[[t("movesLabel"), n(moves)], [t("pairs"), `${n(matched.length / 2)}/${n(pairs)}`]].map(([label, value]) => (
            <div key={label} style={{ minWidth: 58, padding: "6px 10px", borderRadius: 12, background: "var(--surface)", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: "var(--muted)" }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
      </header>

      <Body tight style={{ paddingTop: 12 }}>
        <div style={{ position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: cols === 6 ? 6 : 10 }}>
            {deck.map((faceIndex, i) => {
              const f = faces[faceIndex];
              const up = open.includes(i);
              const isDone = matched.includes(i);
              const show = up || isDone;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => flip(i)}
                  aria-label={show ? t(f.key) + (isDone ? `, ${t("matched")}` : "") : t("faceDownCard")}
                  style={{
                    height: cardHeight, padding: 0, borderRadius: cols === 6 ? 12 : 16, border: `2px solid ${up ? f.fg : isDone ? "transparent" : "#2E3252"}`,
                    background: show ? f.bg : cardBack.bg, color: show ? f.fg : "#4A4E78", opacity: isDone ? 0.55 : 1,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer",
                    transition: "background 150ms ease, transform 150ms ease", transform: up ? "scale(1.03)" : "none",
                  }}
                >
                  <Icon name={show ? f.icon : cardBack.icon} size={iconSize} strokeWidth={1.8} color={show ? undefined : cardBack.key === "moon" ? "#4A4E78" : cardBack.fg} />
                  {show && cols !== 6 && <span style={{ fontSize: 11, fontWeight: 600 }}>{t(f.key)}</span>}
                </button>
              );
            })}
          </div>
          {ended && (
            <div style={{ position: "absolute", inset: 0, borderRadius: 18, background: "rgba(11,13,26,0.86)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center" }}>
              <div className="display" style={{ fontSize: 30, color: done ? "#5FD0BE" : "#F08A7A" }}>{done ? t("allPairsFound") : t("timeIsUp")}</div>
              <div style={{ fontSize: 15, color: "var(--text-2)" }}>{t("movesStars", { moves: n(moves), stars })}</div>
            </div>
          )}
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 14, background: "var(--surface)", fontSize: 13, lineHeight: 1.45, color: "var(--text-2)" }}>
          {mode === "timed" ? t("memoryTimedHint") : t("memoryStarHint", { moves: three })}
        </div>
      </Body>
      <div className="screen__bar">
        <button type="button" className="btn btn--primary" style={{ minHeight: 50, fontSize: 15, background: "#9C8CFF" }} onClick={restart}>{t("shuffleNewBoard")}</button>
      </div>
    </Screen>
  );
}

export function MemoryResult({ params }: { params?: ResultParams }) {
  const { t, language, n } = useLanguage();
  const { replace } = useNavigation();
  const { api } = useHub();
  const xp = parseXp(params);
  const totalStars = useLoad(() => api.stats("memory"), [api]).data?.sumDetail ?? 0;
  const mode = String(params?.mode ?? "4x4") as MemoryMode;
  const done = Boolean(params?.done);
  const moves = Number(params?.moves ?? 0);
  const timeMs = Number(params?.timeMs ?? 0);
  const stars = Number(params?.stars ?? 0);
  const pairsFound = Number(params?.pairsFound ?? 0);
  const pairs = Number(params?.pairs ?? 8);
  const accuracy = Number(params?.accuracy ?? 0);
  const { three } = boards[mode];
  const boardLabel = mode === "timed" ? "4×4" : mode.replace("x", "×");
  const nextBack = useMemo(() => backs.find((b) => b.stars && totalStars < b.stars), [totalStars]);
  const timeUp = mode === "timed" && !done;

  return (
    <ResultScreen
      win={done}
      heroIcon={done ? "star" : "clock"}
      hero={
      <div className="row" style={{ justifyContent: "center", gap: 6 }} role="img" aria-label={t("starsOfThree", { count: stars })}>
        {[0, 1, 2].map((i) => (
          <svg key={i} width={i === 1 ? 56 : 44} height={i === 1 ? 56 : 44} viewBox="0 0 24 24" fill={i < stars ? "#F6C377" : "transparent"} stroke={i < stars ? "#F6C377" : "#3A3F5E"} strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
            <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
          </svg>
        ))}
      </div>
      }
      kicker={mode === "timed" ? t("memoryKickerTimed") : t("memoryKicker", { board: boardLabel })}
      title={timeUp ? t("timeIsUp") : stars === 3 ? t("sharpMemory") : t("allPairsFound")}
      sub={timeUp ? t("matchedOf", { found: pairsFound, pairs }) : stars === 3 ? t("movesCount", { count: moves }) : t("threeStarsNeeds", { moves: n(moves), three })}
      metrics={timeUp
        ? [{ value: `${n(pairsFound)}/${n(pairs)}`, label: t("pairs") }, { value: formatClock(timeMs, language), label: t("statTime"), color: "#F08A7A" }, { value: `${n(accuracy)}%`, label: t("accuracy") }]
        : [{ value: n(moves), label: t("movesLabel"), color: stars === 3 ? "#5FD0BE" : undefined }, { value: formatClock(timeMs, language), label: t("statTime") }, { value: `${n(accuracy)}%`, label: t("accuracy") }]}
      xp={xp}
      accent={ACCENT}
      primary={{ label: t("playAgainGame"), onClick: () => replace({ name: "game", game: "memory", screen: "play", params: { mode } }) }}
      secondary={{ label: t("biggerBoard"), onClick: () => replace({ name: "game", game: "memory", screen: "intro" }) }}
    >
      {nextBack && (
        <section className="row" style={{ gap: 14, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
          <span style={{ width: 52, height: 72, flex: "none", borderRadius: 12, background: nextBack.bg, color: nextBack.fg, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.45 }}>
            <Icon name={nextBack.icon} size={24} />
          </span>
          <div className="grow stack stack--sm">
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t("nextCardBack")}</div>
            <div className="progress progress--8" style={{ background: "#262A44" }}><span style={{ width: `${Math.min(100, (totalStars / nextBack.stars!) * 100)}%`, background: "#5FD0BE" }} /></div>
            <div className="tiny muted">{t("starsProgress", { count: totalStars, total: nextBack.stars! })}</div>
          </div>
        </section>
      )}
      {mode !== "timed" && (
        <section className="stack" style={{ gap: 8, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{t("starTargets", { board: boardLabel })}</span>
          {[
            [t("starsN", { count: 3 }), t("movesOrFewer", { moves: three }), stars === 3],
            [t("starsN", { count: 2 }), t("movesRange", { from: three + 1, to: Math.round(three * 1.5) }), stars === 2],
            [t("starOne"), t("movesOrMore", { moves: Math.round(three * 1.5) + 1 }), stars === 1],
          ].map(([l, v, on]) => (
            <div key={String(l)} className="row row--between" style={{ fontSize: 14, color: on ? "#F6C377" : "var(--text-2)" }}>
              <span>{l}</span><span>{v}</span>
            </div>
          ))}
        </section>
      )}
    </ResultScreen>
  );
}
