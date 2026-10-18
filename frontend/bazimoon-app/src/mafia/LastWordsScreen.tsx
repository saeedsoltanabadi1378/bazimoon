import { useGame } from "./GameProvider";
import { useVoice } from "./VoiceProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { Bar, Body, Screen } from "../ui/components";
import { Icon } from "../ui/Icon";
import { findPlayer, playerColor } from "./roles";
import { ActionError, ReconnectingBanner } from "./parts";
import { useClock, useSecondsLeft } from "./timers";
import { MicState } from "./DefenceScreen";

const RING = 2 * Math.PI * 68;

/**
 * A player who is out speaks once before their role is shown: always after being voted out, and at
 * the start of the day after a night kill when the table turns that on.
 */
export function LastWordsScreen() {
  const { view, busy, finishLastWords } = useGame();
  const voice = useVoice();
  const { t } = useLanguage();
  const clock = useClock();
  const seconds = useSecondsLeft(view?.lastWords?.deadline) ?? 0;
  if (!view) return null;

  const name = (id: string | null | undefined) => {
    const p = findPlayer(view, id);
    if (!p) return t("unknown");
    return p.playerId === view.yourPlayerId ? t("youName", { name: p.displayName }) : p.displayName;
  };

  const lastWords = view.lastWords;
  const speaker = findPlayer(view, lastWords?.playerId);
  const night = lastWords?.cause === "Night";
  const speaking = lastWords?.youAreSpeaking ?? false;
  const accent = night ? "#F08A7A" : "#F0A83A";
  const total = view.rules.lastWordsSeconds;
  const frac = Math.min(1, seconds / total);
  const live = voice.publishing && !voice.muted;

  return (
    <Screen theme="day">
      <header style={{ padding: "16px 16px 8px" }}>
        <div className="kicker" style={{ color: accent }}>
          {night ? t("lastWordsNightKicker", { number: view.nightNumber }) : t("lastWordsVoteKicker", { number: view.nightNumber })}
        </div>
        <h1 className="h1" style={{ marginTop: 2 }}>{t("lastWordsTitle")}</h1>
      </header>

      <Body tight>
        <ReconnectingBanner />
        {speaker && (
          <section className="stack center" style={{ gap: 14, padding: "26px 16px", borderRadius: 24, background: "var(--surface)", textAlign: "center" }} aria-live="polite">
            <span style={{ padding: "4px 10px", borderRadius: 999, background: night ? "#3A1C1A" : "#3A2A16", color: accent, fontSize: 12, fontWeight: 700, letterSpacing: 0.8 }}>
              {night ? t("killedLastNight") : t("votedOutByTown")}
            </span>
            <div style={{ position: "relative", width: 150, height: 150 }}>
              <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
                <circle cx="75" cy="75" r="68" fill="none" stroke="#342C22" strokeWidth="7" />
                <circle
                  cx="75" cy="75" r="68" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={`${(RING * frac).toFixed(1)} ${RING.toFixed(1)}`} transform="rotate(-90 75 75)"
                  style={{ transition: "stroke-dasharray 250ms linear" }}
                />
              </svg>
              <span
                className="avatar display"
                aria-hidden="true"
                style={{ position: "absolute", left: 19, top: 19, width: 112, height: 112, fontSize: 44, fontWeight: 800, background: playerColor(view, speaker.playerId), filter: "grayscale(0.5)" }}
              >
                {Array.from(speaker.displayName)[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <div className="display" style={{ fontSize: 26, lineHeight: 1.1 }}>{name(speaker.playerId)}</div>
              <div style={{ marginTop: 4, fontSize: 14, color: "var(--muted)" }}>{speaking ? t("yourLastWords") : t("sayingLastWords")}</div>
            </div>
            <div className="display num" style={{ fontSize: 36 }} aria-label={t("secondsLeft", { seconds })}>{clock(seconds)}</div>
          </section>
        )}

        <div className="row" style={{ gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 14, background: "#1A1611", border: "1px solid #2B241B", fontSize: 13, lineHeight: 1.5, color: "var(--text-2)" }}>
          <span style={{ marginTop: 1 }}><Icon name="info" size={18} color={accent} /></span>
          <span>{night ? t("lastWordsNightNote") : t("lastWordsVoteNote")}</span>
        </div>

        <div className="row row--wrap" aria-label={t("players")}>
          {view.players.map((p) => (
            <span key={p.playerId} className="chip" style={{ background: "var(--surface)", borderColor: "#2B241B", color: p.isAlive ? "var(--text)" : "var(--faint)", textDecoration: p.isAlive ? "none" : "line-through" }}>
              {name(p.playerId)}
              {!p.isAlive && <span className="visually-hidden">, {t("eliminated")}</span>}
            </span>
          ))}
        </div>
        <ActionError />
      </Body>

      <Bar row>
        {speaking ? (
          <button type="button" className="btn btn--primary grow" style={{ fontSize: 15 }} disabled={busy} onClick={() => void finishLastWords()}>
            {t("finishEarly")}
          </button>
        ) : (
          <div className="grow" style={{ minHeight: 52, padding: "8px 14px", borderRadius: 16, border: "1.5px dashed var(--edge)", color: "var(--text-2)", fontSize: 14, display: "flex", alignItems: "center" }}>
            {t("lastWordsListening", { seconds: total })}
          </div>
        )}
        <MicState live={live} />
      </Bar>
    </Screen>
  );
}
