import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { GameView, PlayerView, Role } from "../api/types";
import { useLanguage } from "../i18n/LanguageContext";
import { Icon, type IconName } from "../ui/Icon";
import { IconButton } from "../ui/components";
import { useGame } from "./GameProvider";
import { useVoice } from "./VoiceProvider";
import { OPTIONAL_ROLES, findPlayer, nightLabelNumber, playerColor } from "./roles";
import { LeaveGameButton, useRoleName } from "./parts";
import { usePlayerNotes, type PlayerNote } from "./notes";
import { PlayerSafetyButton } from "./PlayerSafety";
import { SpectatorList } from "./Graveyard";
import "./table.css";

/** A player's avatar: seat colour, a pattern and (optionally) the seat number, so colour is never the only cue. */
export function PlayerAvatar({ view, playerId, size = 40, seat = true, className = "", style }: {
  view: GameView;
  playerId: string;
  size?: number;
  seat?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const { n } = useLanguage();
  const { notes } = usePlayerNotes(view.gameId);
  const index = view.players.findIndex((p) => p.playerId === playerId);
  const player = view.players[index];
  // Your own private mark on this player, wherever their avatar shows.
  const mark = view.phase === "Ended" ? undefined : notes[playerId]?.mark;
  return (
    <span
      className={`avatar seat-avatar seat-avatar--p${Math.max(0, index) % 4} ${className}`}
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), backgroundColor: playerColor(view, playerId), ...style }}
    >
      {Array.from(player?.displayName ?? "?")[0]?.toUpperCase()}
      {seat && index >= 0 && <span className="seat-avatar__no">{n(index + 1)}</span>}
      {mark && <span className={`seat-avatar__mark seat-avatar__mark--${mark}`} />}
    </span>
  );
}

/** Swells behind the speaker's avatar with the live voice level, so a quiet floor reads as quiet, not broken. */
export function VoiceHalo({ inset, color }: { inset: number; color?: string }) {
  const voice = useVoice();
  const ref = useRef<HTMLSpanElement>(null);
  const getLevel = voice.getLevel;
  useEffect(() => {
    let smooth = 0;
    const id = window.setInterval(() => {
      // Voice levels are small numbers; lift them so normal speech fills most of the range.
      const level = Math.min(1, getLevel() * 2.4);
      smooth = level > smooth ? level : smooth * 0.7;
      ref.current?.style.setProperty("--voice", smooth.toFixed(2));
    }, 110);
    return () => window.clearInterval(id);
  }, [getLevel]);
  return <span ref={ref} className="voice-halo" aria-hidden="true" style={{ inset, "--halo": color } as CSSProperties} />;
}

/**
 * Everyone at the table in one strip, the same on every phase: who is alive, out, silenced or a
 * revealed Mayor. During a discussion the speakers come first, in speaking order.
 */
export function TableRoster({ heading, note, order, nowId, doneIds }: {
  heading?: ReactNode;
  note?: ReactNode;
  order?: string[];
  nowId?: string | null;
  doneIds?: ReadonlySet<string>;
}) {
  const { view } = useGame();
  const { t } = useLanguage();
  const roleName = useRoleName();
  const { notes } = usePlayerNotes(view?.gameId ?? "");
  const [noting, setNoting] = useState<{ player: PlayerView; host: Element } | null>(null);
  if (!view) return null;
  // Notes are a player's tool; someone watching has no use for them.
  const canNote = !view.youAreSpectator && view.phase !== "Ended";
  const first = (order ?? []).filter((id) => findPlayer(view, id));
  const ids = [...first, ...view.players.map((p) => p.playerId).filter((id) => !first.includes(id))];
  return (
    <section className="roster mafia-table" aria-label={t("players")}>
      <div className="row row--between" style={{ fontSize: 13 }}>
        <span className="strong">{heading ?? t("atTheTable", { count: view.players.filter((p) => p.isAlive).length })}</span>
        {note && <span className="muted">{note}</span>}
      </div>
      <ol className="roster__seats">
        {ids.map((id) => {
          const p = findPlayer(view, id)!;
          const you = id === view.yourPlayerId;
          const now = p.isAlive && id === nowId;
          const silenced = p.isAlive && view.silencedPlayerId === id;
          const mayor = p.isAlive && p.revealed;
          const done = p.isAlive && !now && (doneIds?.has(id) ?? false);
          const state = !p.isAlive ? "out" : now ? "now" : silenced ? "silenced" : mayor ? "mayor" : done ? "done" : "";
          const claim = canNote ? notes[id]?.claim : undefined;
          const tag = !p.isAlive ? t("outTag") : now ? t("now") : silenced ? t("silencedTag") : mayor ? t("roleMayor") : done ? t("done")
            : claim ? roleName(claim) : p.isBot ? t("botTag") : "";
          const seat = (
            <>
              <PlayerAvatar view={view} playerId={id} />
              <span className="roster__name" dir="auto">{you ? t("you") : p.displayName}</span>
              <span className="roster__tag">{tag}</span>
            </>
          );
          return (
            <li key={id} className={`roster__seat${state ? ` roster__seat--${state}` : ""}`}>
              {canNote && !you ? (
                <button type="button" className="roster__button" aria-label={t("noteOpen", { name: p.displayName })} onClick={(e) => setNoting({ player: p, host: e.currentTarget.closest(".screen") ?? document.body })}>
                  {seat}
                </button>
              ) : seat}
            </li>
          );
        })}
      </ol>
      {canNote && <span className="tiny muted">{t("notesHint")}</span>}
      {noting && createPortal(<NoteSheet gameId={view.gameId} player={noting.player} onClose={() => setNoting(null)} />, noting.host)}
    </section>
  );
}

/** Your private read on one player: trust or suspect, and the role they claimed. Kept on this device only. */
function NoteSheet({ gameId, player, onClose }: { gameId: string; player: PlayerView; onClose: () => void }) {
  const { t } = useLanguage();
  const roleName = useRoleName();
  const { notes, setNote } = usePlayerNotes(gameId);
  const note: PlayerNote = notes[player.playerId] ?? {};
  const marks: { value: PlayerNote["mark"]; label: string; color: string }[] = [
    { value: "trust", label: t("noteTrust"), color: "#5FD0BE" },
    { value: "suspect", label: t("noteSuspect"), color: "#F08A7A" },
    { value: undefined, label: t("noteNone"), color: "var(--text-2)" },
  ];
  const claims: (Role | undefined)[] = [undefined, "Villager", ...OPTIONAL_ROLES.filter((r) => r !== "Silencer" && r !== "Negotiator" && r !== "Joker")];
  const chip = (on: boolean, color: string) => ({
    minHeight: 40, padding: "0 14px", borderRadius: 999, border: `1.5px solid ${on ? color : "var(--edge)"}`,
    background: on ? "var(--surface-2)" : "transparent", color: on ? color : "var(--text)", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
  }) as const;
  return (
    <div className="table-menu" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="note-h" className="table-menu__sheet stack" onClick={(e) => e.stopPropagation()}>
        <h2 id="note-h" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t("notesFor", { name: player.displayName })}</h2>
        <p className="small muted" style={{ margin: 0 }}>{t("notesPrivate")}</p>
        <div role="radiogroup" aria-label={t("noteMark")} className="row row--wrap" style={{ gap: 8 }}>
          {marks.map((m) => (
            <button key={m.label} type="button" role="radio" aria-checked={note.mark === m.value} style={chip(note.mark === m.value, m.color)} onClick={() => setNote(player.playerId, { ...note, mark: m.value })}>
              {m.label}
            </button>
          ))}
        </div>
        <strong style={{ fontSize: 14 }}>{t("noteClaim")}</strong>
        <div role="radiogroup" aria-label={t("noteClaim")} className="row row--wrap" style={{ gap: 8 }}>
          {claims.map((c) => (
            <button key={c ?? "none"} type="button" role="radio" aria-checked={note.claim === c} style={chip(note.claim === c, "#F0A83A")} onClick={() => setNote(player.playerId, { ...note, claim: c })}>
              {c ? roleName(c) : t("noteNoClaim")}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--outline" style={{ justifyContent: "center" }} autoFocus onClick={onClose}>{t("close")}</button>
      </div>
    </div>
  );
}

/** Right side of the phase header: whatever the screen shows there, plus the table menu. */
export function HeaderTools({ children }: { children?: ReactNode }) {
  return (
    <div className="row" style={{ gap: 6, flex: "none" }}>
      {children}
      <TableMenu />
    </div>
  );
}

/** Secondary table actions (player safety, spectators, leaving) live here instead of in the game flow. */
export function TableMenu() {
  const { view } = useGame();
  const { t } = useLanguage();
  const button = useRef<HTMLButtonElement>(null);
  const [host, setHost] = useState<Element | null>(null);
  if (!view) return null;
  return (
    <>
      <IconButton
        ref={button}
        icon="more"
        round
        label={t("tableMenu")}
        // The sheet is mounted on the screen itself, above the header, body and bar.
        onClick={() => setHost(button.current?.closest(".screen") ?? document.body)}
      />
      {host && createPortal(
        <div className="table-menu" onClick={() => setHost(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="table-menu-h" className="table-menu__sheet stack" onClick={(e) => e.stopPropagation()}>
            <h2 id="table-menu-h" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t("tableMenu")}</h2>
            <PlayerSafetyButton />
            <SpectatorList />
            <LeaveGameButton />
            <button type="button" className="btn btn--outline" style={{ justifyContent: "center" }} autoFocus onClick={() => setHost(null)}>{t("close")}</button>
          </div>
        </div>,
        host,
      )}
    </>
  );
}

/** Creator-only control, pinned in the bottom bar so it never scrolls out of reach. */
export function CreatorBar({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <div className={`creator-bar${label ? "" : " creator-bar--solo"}`}>
      {label && <span>{label}</span>}
      {children}
    </div>
  );
}

/** A short full-screen beat when night falls and when morning comes. Tap to skip. */
export function PhaseCurtain() {
  const { view } = useGame();
  const { t } = useLanguage();
  const [shown, setShown] = useState<"night" | "day" | null>(null);
  const phase = view?.phase;
  const last = useRef(phase);

  useEffect(() => {
    const from = last.current;
    last.current = phase;
    const wasNight = from === "Night" || from === "NightZero";
    const next = !from || !phase || from === phase ? null
      : phase === "Night" ? "night"
      : wasNight && (phase === "Day" || phase === "LastWords") ? "day"
      : null;
    setShown(next);
    if (!next) return;
    const id = window.setTimeout(() => setShown(null), 2400);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (!view || !shown) return null;

  let icon: IconName = "moon";
  let kicker = t("nightFalls");
  let title = t("nightN", { number: nightLabelNumber(view) });
  let line = "";
  if (shown === "day") {
    const night = view.lastNightElimination;
    const dead = findPlayer(view, night?.eliminatedPlayerId) ?? (view.lastWords?.cause === "Night" ? findPlayer(view, view.lastWords.playerId) : undefined);
    icon = dead ? "coffin" : night?.wasSaved ? "doctor" : "sun";
    kicker = t("morning");
    title = t("dayN", { number: view.nightNumber });
    line = dead
      ? t("foundDead", { name: dead.playerId === view.yourPlayerId ? t("youName", { name: dead.displayName }) : dead.displayName })
      : night?.wasSaved ? t("doctorSavedTitle") : t("quietNight");
  }

  return (
    <div className={`phase-curtain phase-curtain--${shown}`} role="status" onClick={() => setShown(null)}>
      <span className="phase-curtain__disc"><Icon name={icon} size={46} strokeWidth={1.8} /></span>
      <div className="kicker">{kicker}</div>
      <div className="display phase-curtain__title">{title}</div>
      {line && <div className="phase-curtain__line">{line}</div>}
    </div>
  );
}
