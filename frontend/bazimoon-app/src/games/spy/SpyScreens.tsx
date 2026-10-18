import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { IconButton, Screen } from "../../ui/components";
import { Icon } from "../../ui/Icon";
import { formatClock } from "../../lib/format";
import { randomSeed, seeded, shuffle } from "../../lib/rng";
import { readLocal, writeLocal } from "../../lib/storage";
import { haptic } from "../../lib/haptics";
import { IntroScreen } from "../shared/IntroScreen";
import { ResultScreen } from "../shared/ResultScreen";
import { PassPhone, Stepper } from "../shared/party";
import { bumpPartyStats, readPartyStats } from "../shared/partyStats";
import type { ResultParams } from "../shared/play";
import { packWords, spyWords, type SpyPack } from "./words";

const ACCENT = "#F08A7A";
const INK = "#2A0F0B";
const SETUP_KEY = "bazimoon-spy-setup";
const MINUTES = [3, 5, 8];

interface SpySetup {
  players: number;
  spies: number;
  minutes: number;
}

const maxSpies = (players: number) => (players >= 7 ? 2 : 1) + (players >= 10 ? 1 : 0);

function readSetup(): SpySetup {
  return readLocal<SpySetup>(SETUP_KEY, { players: 5, spies: 1, minutes: 5 });
}

export function SpyIntro() {
  const { t, n } = useLanguage();
  const { push } = useNavigation();
  const [setup, setSetup] = useState<SpySetup>(readSetup);
  const stats = readPartyStats("spy");
  const update = (patch: Partial<SpySetup>) => {
    const next = { ...setup, ...patch };
    next.spies = Math.min(next.spies, maxSpies(next.players));
    setSetup(next);
    writeLocal(SETUP_KEY, next);
  };
  const play = (pack: SpyPack) => push({ name: "game", game: "spy", screen: "play", params: { pack, players: setup.players, spies: setup.spies, minutes: setup.minutes } });

  return (
    <IntroScreen
      title={t("gameSpy")}
      tagline={t("spyTagline")}
      accent={ACCENT}
      accentInk={INK}
      heroBg="#241216"
      preview={
        <div className="stack center" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 34, height: 48, borderRadius: 8, background: i === 1 ? ACCENT : "#3A1C1A", color: i === 1 ? INK : ACCENT, display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${(i - 1) * 8}deg)` }}>
                <Icon name={i === 1 ? "spy" : "villager"} size={18} />
              </span>
            ))}
          </div>
        </div>
      }
      heroTitle={t("spyHeroTitle")}
      heroSub={t("spyHeroSub")}
      modeTitle={t("spyWordPack")}
      modes={(["places", "food", "jobs", "mixed"] as SpyPack[]).map((pack) => ({
        key: pack,
        label: t(`spyPack_${pack}`),
        desc: t(`spyPackDesc_${pack}`),
        play: t("spyDeal"),
        onPlay: () => play(pack),
      }))}
      extra={() => (
        <section className="stack" style={{ gap: 8 }}>
          <h2 className="h2">{t("partySetup")}</h2>
          <Stepper label={t("partyPlayers")} value={setup.players} min={3} max={12} onChange={(v) => update({ players: v })} />
          <Stepper label={t("spySpies")} value={setup.spies} min={1} max={maxSpies(setup.players)} onChange={(v) => update({ spies: v })} />
          <Stepper
            label={t("spyTimer")}
            value={MINUTES.indexOf(setup.minutes) < 0 ? 1 : MINUTES.indexOf(setup.minutes)}
            min={0}
            max={MINUTES.length - 1}
            onChange={(i) => update({ minutes: MINUTES[i] })}
            format={(i) => t("minutesShort", { count: n(MINUTES[i]) })}
          />
        </section>
      )}
      stats={[
        { value: n(stats.played ?? 0), label: t("statGames") },
        { value: n(stats.town ?? 0), label: t("spyTownWins") },
        { value: n(stats.spy ?? 0), label: t("spySpyWins") },
        { value: n(stats.guessed ?? 0), label: t("spyGuessed") },
      ]}
      steps={[
        { title: t("spyStep1"), text: t("spyStep1Text") },
        { title: t("spyStep2"), text: t("spyStep2Text") },
        { title: t("spyStep3"), text: t("spyStep3Text") },
        { title: t("spyStep4"), text: t("spyStep4Text") },
      ]}
    />
  );
}

type Phase =
  | { name: "pass"; seat: number }
  | { name: "card"; seat: number }
  | { name: "talk" }
  | { name: "vote" }
  | { name: "caught"; accused: number }
  | { name: "guess"; accused: number };

export function SpyPlay({ pack, players, spies, minutes }: { pack: SpyPack; players: number; spies: number; minutes: number }) {
  const { t, n, language } = useLanguage();
  const { back, replace } = useNavigation();
  const game = useMemo(() => {
    const rng = seeded(`spy-${randomSeed()}`);
    const words = packWords(pack);
    const word = words[Math.floor(rng() * words.length)];
    // The spy guesses from words of the same kind, so "mixed" narrows to the word's own pack.
    const home = (Object.values(spyWords).find((list) => list.includes(word)) ?? words);
    const options = shuffle(rng, [word, ...shuffle(rng, home.filter((w) => w !== word)).slice(0, 11)]);
    const seats = shuffle(rng, Array.from({ length: players }, (_, i) => i));
    return { word, options, spySeats: seats.slice(0, spies).sort((a, b) => a - b), first: Math.floor(rng() * players) };
  }, [pack, players, spies]);
  const [phase, setPhase] = useState<Phase>({ name: "pass", seat: 0 });
  const [leftMs, setLeftMs] = useState(minutes * 60_000);
  const [accused, setAccused] = useState<number | null>(null);
  const word = (w: [string, string]) => (language === "fa" ? w[1] : w[0]);
  const seatName = (seat: number) => t("partyPlayerN", { n: n(seat + 1) });

  function end(winner: "town" | "spy", reason: string) {
    bumpPartyStats("spy", ["played", winner, ...(reason === "guessed" ? ["guessed"] : [])]);
    if (winner === "town") haptic.success();
    else haptic.error();
    const params: ResultParams = { winner, reason, wordEn: game.word[0], wordFa: game.word[1], spies: game.spySeats.join(","), pack, players, spyCount: spies, minutes };
    replace({ name: "game", game: "spy", screen: "result", params });
  }

  // The discussion clock; time running out hands the round to the spies.
  useEffect(() => {
    if (phase.name !== "talk") return;
    const id = window.setInterval(() => setLeftMs((ms) => Math.max(0, ms - 1000)), 1000);
    return () => window.clearInterval(id);
  }, [phase.name]);

  useEffect(() => {
    if (phase.name === "talk" && leftMs === 0) {
      haptic.warn();
      setPhase({ name: "vote" });
    }
  }, [leftMs, phase.name]);

  const header = (
    <div className="row row--between" style={{ padding: "14px 16px 8px" }}>
      <IconButton icon="back" label={t("backToGame", { game: t("gameSpy") })} onClick={back} />
      <div style={{ textAlign: "center" }}>
        <div className="display" style={{ fontSize: 22, fontWeight: 700 }}>{t("gameSpy")}</div>
        <div className="tiny muted">{t("spyPlaySub", { players: n(players), spies: n(spies) })}</div>
      </div>
      <span style={{ width: 44 }} />
    </div>
  );

  if (phase.name === "pass") {
    return (
      <Screen theme="night">
        {header}
        <PassPhone
          accent={ACCENT}
          ink={INK}
          kicker={t("partyCardOf", { n: n(phase.seat + 1), total: n(players) })}
          name={t("partyPassTo", { name: seatName(phase.seat) })}
          hint={t("spyPassHint")}
          action={t("spyShowCard")}
          onReady={() => {
            haptic.tap();
            setPhase({ name: "card", seat: phase.seat });
          }}
        />
      </Screen>
    );
  }

  if (phase.name === "card") {
    const isSpy = game.spySeats.includes(phase.seat);
    const last = phase.seat === players - 1;
    return (
      <Screen theme="night">
        {header}
        <div className="stack center" style={{ flex: 1, justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <div className="kicker" style={{ color: "var(--muted)" }}>{seatName(phase.seat)}</div>
          <div className="spy-card" style={{ width: "min(100%, 300px)", padding: "34px 20px", borderRadius: 26, background: isSpy ? ACCENT : "#1E2138", color: isSpy ? INK : "var(--text)" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Icon name={isSpy ? "spy" : "info"} size={40} /></div>
            {isSpy ? (
              <>
                <div className="display" style={{ fontSize: 32, fontWeight: 800 }}>{t("spyYouAreSpy")}</div>
                <p className="small" style={{ marginTop: 8 }}>{spies > 1 ? t("spySpyHintMany") : t("spySpyHint")}</p>
              </>
            ) : (
              <>
                <div className="tiny" style={{ color: "var(--muted)", marginBottom: 6 }}>{t("spySecretWord")}</div>
                <div className="display" style={{ fontSize: 32, fontWeight: 800 }}>{word(game.word)}</div>
                <p className="small" style={{ marginTop: 8, color: "var(--text-2)" }}>{t("spyTownHint")}</p>
              </>
            )}
          </div>
          <button
            type="button"
            className="btn"
            style={{ maxWidth: 320, background: "var(--surface-2)" }}
            onClick={() => setPhase(last ? { name: "talk" } : { name: "pass", seat: phase.seat + 1 })}
          >
            {last ? t("spyEveryoneSeen") : t("spyHideAndPass")}
          </button>
        </div>
      </Screen>
    );
  }

  if (phase.name === "talk") {
    const low = leftMs <= 30_000;
    return (
      <Screen theme="night">
        {header}
        <div className="stack center" style={{ flex: 1, justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
          <div className="kicker" style={{ color: ACCENT }}>{t("spyAskAway")}</div>
          <div className="display num" style={{ fontSize: 72, fontWeight: 800, lineHeight: 1, color: low ? ACCENT : "var(--text)" }} aria-live={low ? "polite" : "off"}>
            {formatClock(leftMs, language)}
          </div>
          <p className="small" style={{ color: "var(--text-2)", maxWidth: 320 }}>{t("spyFirstAsks", { name: seatName(game.first) })}</p>
          <div className="card small" style={{ maxWidth: 340, textAlign: "start", color: "var(--text-2)" }}>{t("spyTalkTip")}</div>
        </div>
        <div className="screen__bar">
          <button type="button" className="btn" style={{ background: ACCENT, color: INK }} onClick={() => setPhase({ name: "vote" })}>{t("spyVoteNow")}</button>
        </div>
      </Screen>
    );
  }

  if (phase.name === "vote") {
    return (
      <Screen theme="night">
        {header}
        <div className="stack" style={{ flex: 1, gap: 14, padding: "8px 16px 20px", overflowY: "auto" }}>
          <div>
            <h1 className="display" style={{ fontSize: 26 }}>{leftMs === 0 ? t("spyTimeUp") : t("spyWhoIsSpy")}</h1>
            <p className="small" style={{ color: "var(--text-2)" }}>{t("spyVoteHint")}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }} role="radiogroup" aria-label={t("spyWhoIsSpy")}>
            {Array.from({ length: players }, (_, seat) => {
              const on = accused === seat;
              return (
                <button
                  key={seat}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setAccused(seat)}
                  className="stack center"
                  style={{ gap: 6, padding: "12px 6px", minHeight: 84, borderRadius: 16, border: `2px solid ${on ? ACCENT : "transparent"}`, background: on ? "#2A1418" : "var(--surface)", color: "var(--text)", cursor: "pointer" }}
                >
                  <span className="avatar" aria-hidden="true" style={{ width: 34, height: 34, fontSize: 14, background: on ? ACCENT : "#2B3042", color: on ? INK : "var(--text)" }}>{n(seat + 1)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{seatName(seat)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="screen__bar">
          <button
            type="button"
            className="btn"
            disabled={accused === null}
            style={{ background: accused === null ? "var(--surface-2)" : ACCENT, color: accused === null ? "var(--faint)" : INK }}
            onClick={() => accused !== null && (game.spySeats.includes(accused) ? setPhase({ name: "caught", accused }) : end("spy", "wrong"))}
          >
            {accused === null ? t("spyPickSomeone") : t("spyAccuse", { name: seatName(accused) })}
          </button>
        </div>
      </Screen>
    );
  }

  if (phase.name === "caught") {
    return (
      <Screen theme="night">
        {header}
        <PassPhone
          accent={ACCENT}
          ink={INK}
          kicker={t("spyCaughtKicker")}
          name={t("spyCaught", { name: seatName(phase.accused) })}
          hint={t("spyLastChance")}
          action={t("spyMakeGuess")}
          onReady={() => setPhase({ name: "guess", accused: phase.accused })}
        />
      </Screen>
    );
  }

  return (
    <Screen theme="night">
      {header}
      <div className="stack" style={{ flex: 1, gap: 14, padding: "8px 16px 20px", overflowY: "auto" }}>
        <div>
          <h1 className="display" style={{ fontSize: 26 }}>{t("spyGuessTitle")}</h1>
          <p className="small" style={{ color: "var(--text-2)" }}>{t("spyGuessHint", { name: seatName(phase.accused) })}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {game.options.map((w) => (
            <button
              key={w[0]}
              type="button"
              className="btn btn--md"
              style={{ background: "var(--surface)", fontSize: 14 }}
              onClick={() => end(w === game.word ? "spy" : "town", w === game.word ? "guessed" : "caught")}
            >
              {word(w)}
            </button>
          ))}
        </div>
      </div>
    </Screen>
  );
}

export function SpyResult({ params }: { params?: ResultParams }) {
  const { t, n, language } = useLanguage();
  const { replace } = useNavigation();
  const town = params?.winner === "town";
  const reason = String(params?.reason ?? "wrong");
  const spySeats = String(params?.spies ?? "").split(",").filter(Boolean).map(Number);
  const word = String(language === "fa" ? params?.wordFa : params?.wordEn);
  const names = spySeats.map((s) => t("partyPlayerN", { n: n(s + 1) })).join(language === "fa" ? "، " : ", ");
  const again = () => replace({ name: "game", game: "spy", screen: "play", params: { pack: String(params?.pack ?? "places"), players: Number(params?.players ?? 5), spies: Number(params?.spyCount ?? 1), minutes: Number(params?.minutes ?? 5), at: Date.now() } });

  return (
    <ResultScreen
      win={town}
      heroIcon={town ? "villager" : "spy"}
      heroColors={["#13302C", "#5FD0BE"]}
      kicker={town ? t("spyTownWinKicker") : t("spySpyWinKicker")}
      title={town ? t("spyTownWins") : t("spySpyWins")}
      sub={t(`spyReason_${reason}` as "spyReason_wrong", { name: names })}
      metrics={[
        { value: word, label: t("spySecretWord"), color: "#F6C377" },
        { value: names, label: spySeats.length > 1 ? t("spySpies") : t("spyTheSpy"), color: ACCENT },
      ]}
      xp={null}
      hideXp
      accent={ACCENT}
      accentInk={INK}
      onClose={() => replace({ name: "game", game: "spy", screen: "intro" })}
      primary={{ label: t("spyNewRound"), onClick: again }}
      secondary={{ label: t("spyChangeSetup"), onClick: () => replace({ name: "game", game: "spy", screen: "intro" }) }}
    />
  );
}
