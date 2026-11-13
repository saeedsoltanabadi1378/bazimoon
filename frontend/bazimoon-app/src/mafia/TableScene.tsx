import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { PlayerView } from "../api/types";
import { useLanguage } from "../i18n/LanguageContext";
import { haptic } from "../lib/haptics";
import { Icon } from "../ui/Icon";
import { useGame } from "./GameProvider";
import { useVoice } from "./VoiceProvider";
import { usePlayerNotes } from "./notes";
import { NoteSheet, VoiceHalo } from "./table";
import { ReactionArt, reactionColors, useCanReact } from "./Reactions";
import type { ReactionKind } from "./reactionTypes";
import { useClock, useSecondsLeft } from "./timers";

const PORTRAIT_COUNT = 16;

export const tableArt = { room: "/images/mafia-table/room.webp", table: "/images/mafia-table/table.webp" };

/** The stock portrait for a seat. Seats keep the same face for the whole game. */
export function seatPortrait(index: number) {
  return `/images/mafia-table/p${String((Math.max(0, index) % PORTRAIT_COUNT) + 1).padStart(2, "0")}.webp`;
}

/** Choosing a player by tapping their seat (a night action, a guess or a vote). */
export interface SeatPick {
  selected: string | null;
  canPick(playerId: string): boolean;
  onPick(playerId: string): void;
}

/** A short private or public label under a seat, such as a Detective's result. */
export interface SeatTag {
  text: string;
  color?: string;
}

/** A standing line from one seat to another: a vote, shown for as long as the vote stands. */
export interface SeatLink {
  fromId: string;
  toId: string;
}

/** The countdown everyone is watching, drawn on the felt in the middle of the table. */
export interface TableClock {
  /** What is being timed: a speaker's turn, a challenge, the vote. */
  label: string;
  /** Who holds the floor, when the clock is theirs. */
  name?: string;
  sub?: string;
  deadline: string | null | undefined;
  accent?: string;
}

function CentreClock({ clock, width, compact }: { clock: TableClock; width: number; compact: boolean }) {
  const { t } = useLanguage();
  const seconds = useSecondsLeft(clock.deadline);
  const format = useClock();
  if (seconds === null && !clock.name) return null;
  return (
    <div className={`table-clock${compact ? " table-clock--compact" : ""}${seconds !== null && seconds <= 5 ? " table-clock--urgent" : ""}`} style={{ maxWidth: width, "--clock": clock.accent } as CSSProperties}>
      <span className="table-clock__label" dir="auto">{clock.label}</span>
      <span className="table-clock__who" aria-live="polite">
        {clock.name && <span className="table-clock__name" dir="auto">{clock.name}</span>}
        {clock.sub && <span className="table-clock__sub" dir="auto">{clock.sub}</span>}
      </span>
      {seconds !== null && <span className="table-clock__time display num" role="timer" aria-label={t("secondsLeft", { seconds })}>{format(seconds)}</span>}
    </div>
  );
}

/** What a seat is showing for a moment: a reaction, or the chat line its player just sent. */
interface SeatBubble {
  key: string;
  at: number;
  kind?: ReactionKind;
  targetId?: string | null;
  text?: string;
}

/** The painted table is 834 wide for every 356 of height. */
const TABLE_RATIO = 2.34;

/**
 * Points at equal distances along a rounded curve around the table, the first at the top centre and
 * the rest clockwise. Equal spacing puts more seats on the long sides and never stacks the ends.
 */
function seatPoints(count: number, rx: number, ry: number): [number, number][] {
  const steps = 720;
  const power = 2 / 2.6;
  const points: [number, number][] = [];
  const lengths = [0];
  for (let k = 0; k <= steps; k++) {
    const angle = -Math.PI / 2 + (k / steps) * 2 * Math.PI;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    points.push([rx * Math.sign(c) * Math.abs(c) ** power, ry * Math.sign(s) * Math.abs(s) ** power]);
    if (k > 0) lengths.push(lengths[k - 1] + Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]));
  }
  const total = lengths[steps];
  const seats: [number, number][] = [];
  let k = 0;
  for (let i = 0; i < count; i++) {
    const target = (total / count) * i;
    while (lengths[k] < target) k++;
    seats.push(points[k]);
  }
  return seats;
}

/**
 * The table with everyone seated around it, the same on every phase: who is alive, out, speaking,
 * silenced or a revealed Mayor. Seats are tapped to pick a player, or to open your private note.
 */
export function TableScene({ pick, tags, counts, nowId, doneIds, dimIds, clock, links, spotId }: {
  pick?: SeatPick | null;
  tags?: ReadonlyMap<string, SeatTag>;
  /** Votes against each player, shown on their seat. */
  counts?: ReadonlyMap<string, number>;
  /** Who holds the floor: their seat glows and shows a live mic. */
  nowId?: string | null;
  doneIds?: ReadonlySet<string>;
  /** Seats that take no part right now (a re-vote is only between the tied players). */
  dimIds?: ReadonlySet<string>;
  clock?: TableClock | null;
  /** Who voted for whom, drawn across the table. */
  links?: readonly SeatLink[];
  /** The seat the verdict is about. */
  spotId?: string | null;
}) {
  const { view, reactions, seatLines, blockedPlayers, sendReaction, reactionCooling, link } = useGame();
  const canReact = useCanReact();
  const voice = useVoice();
  const { t, n } = useLanguage();
  const { notes } = usePlayerNotes(view?.gameId ?? "");
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [noting, setNoting] = useState<{ player: PlayerView; host: Element } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Layout size, not the on-screen box: the stage may be drawn sideways.
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!view) return null;

  const { w, h } = size;
  const compact = h < 340;
  const face = Math.round(Math.max(38, Math.min(92, h / (compact ? 6.2 : 6.6))));
  const seatHeight = face + (compact ? 20 : 38);
  // Seats ring the table from outside: the table is sized so each portrait only overlaps its rim.
  const ry = h / 2 - seatHeight / 2 - 3;
  const tableHeight = Math.max(80, 2 * ry - face * 0.75);
  const tableWidth = Math.max(160, Math.min(tableHeight * TABLE_RATIO, w - 2 * face - 56));
  const rx = tableWidth / 2 + face * 0.32;
  const points = w > 0 && h > 0 ? seatPoints(view.players.length, rx, ry) : [];

  const canNote = !view.youAreSpectator && view.phase !== "Ended";
  const speaking = Boolean(nowId);

  // Reactions and fresh chat lines show where they came from: at the sender's seat.
  const blocked = new Set(blockedPlayers.map((player) => player.playerId));
  const seatOf = new Map(view.players.map((player, index) => [player.playerId, index]));
  const bubbles = new Map<string, SeatBubble>();
  const shownReactions = reactions.filter((r) => r.phase === view.phase && r.round === view.nightNumber && !blocked.has(r.senderId));
  for (const r of shownReactions) bubbles.set(r.senderId, { key: r.id, at: r.receivedAt, kind: r.kind, targetId: r.targetId });
  for (const line of seatLines) {
    if (blocked.has(line.senderId)) continue;
    const shown = bubbles.get(line.senderId);
    if (!shown || line.at > shown.at) bubbles.set(line.senderId, { key: line.id, at: line.at, text: line.text });
  }
  // A line across the table from one seat to another, stopping short of both portraits.
  const segment = (fromId: string | null | undefined, toId: string | null | undefined) => {
    const from = points[seatOf.get(fromId ?? "") ?? -1];
    const to = points[seatOf.get(toId ?? "") ?? -1];
    if (!from || !to || from === to) return null;
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    const inset = Math.min(face * 0.62, length / 3);
    const [ux, uy] = [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
    return { x1: w / 2 + from[0] + ux * inset, y1: h / 2 + from[1] + uy * inset, x2: w / 2 + to[0] - ux * inset, y2: h / 2 + to[1] - uy * inset };
  };
  // An aimed reaction also draws a line across the table to the player it is about.
  const aims = shownReactions.flatMap((r) => {
    const line = bubbles.get(r.senderId)?.key === r.id ? segment(r.senderId, r.targetId) : null;
    return line ? [{ id: r.id, targetId: r.targetId!, color: reactionColors[r.kind], ...line }] : [];
  });
  const voteLines = (links ?? []).flatMap((link) => {
    const line = segment(link.fromId, link.toId);
    return line ? [{ id: `${link.fromId}-${link.toId}`, ...line }] : [];
  });
  const aimedAt = new Map(aims.map((aim) => [aim.targetId, aim.color]));
  const seatName = (id: string | null | undefined) => {
    const p = view.players[seatOf.get(id ?? "") ?? -1];
    return !p ? t("unknown") : p.playerId === view.yourPlayerId ? t("you") : p.displayName;
  };

  return (
    <section ref={ref} className="table-scene" dir="ltr" aria-label={t("players")}>
      <img className="table-scene__table" src={tableArt.table} alt="" draggable={false} style={{ width: tableWidth, height: tableHeight }} />
      {voteLines.length > 0 && (
        <svg className="table-links" width={w} height={h} aria-hidden="true">
          {voteLines.map((line) => (
            <g key={line.id}>
              <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
              <circle cx={line.x2} cy={line.y2} r={3.5} />
            </g>
          ))}
        </svg>
      )}
      {aims.length > 0 && (
        <svg className="table-aims" width={w} height={h} aria-hidden="true">
          {aims.map((aim) => (
            <g key={aim.id} stroke={aim.color} fill={aim.color}>
              <line x1={aim.x1} y1={aim.y1} x2={aim.x2} y2={aim.y2} pathLength={1} />
              <circle cx={aim.x2} cy={aim.y2} r={4} />
            </g>
          ))}
        </svg>
      )}
      {/* Drawn after the aim lines, so the clock stays readable when one crosses it. */}
      {clock && w > 0 && <CentreClock clock={clock} width={Math.round(tableWidth * 0.6)} compact={compact} />}
      <div className="table-scene__spoken" role="log" aria-live="polite">
        {[...bubbles].map(([senderId, bubble]) => (
          <p key={bubble.key}>
            {bubble.kind
              ? t(bubble.targetId ? "reactionSaysTo" : "reactionSays", { name: seatName(senderId), text: t(`reaction_${bubble.kind}`), target: seatName(bubble.targetId) })
              : t("reactionSays", { name: seatName(senderId), text: bubble.text ?? "" })}
          </p>
        ))}
      </div>
      {points.map(([x, y], index) => {
        const p = view.players[index];
        const id = p.playerId;
        const you = id === view.yourPlayerId;
        // Someone saying their last words is already out, yet holds the floor.
        const now = id === nowId;
        const silenced = p.isAlive && view.silencedPlayerId === id;
        const mayor = p.isAlive && p.revealed;
        const done = p.isAlive && !now && (doneIds?.has(id) ?? false);
        const tag = tags?.get(id);
        const pickable = Boolean(pick?.canPick(id));
        const selected = pick?.selected === id;
        const notable = canNote && !you;
        const mark = view.phase === "Ended" ? undefined : notes[id]?.mark;
        const votes = counts?.get(id) ?? 0;
        const bubble = bubbles.get(id);
        const aimColor = aimedAt.get(id);
        // You hear your own mic state; for everyone else the floor decides who can be heard.
        const micLive = now && (you ? voice.publishing && !voice.muted : true);
        const state = tag ? tag.text : !p.isAlive ? t("outTag") : now ? t("now") : silenced ? t("silencedTag") : mayor ? t("roleMayor") : done ? t("done") : p.isBot ? t("botTag") : t("aliveTag");
        const classes = ["table-seat"];
        if (pickable || notable) classes.push("table-seat--tap");
        if (!p.isAlive) classes.push("table-seat--out");
        if (you) classes.push("table-seat--you");
        if (now) classes.push("table-seat--now");
        if (done) classes.push("table-seat--done");
        if (selected) classes.push("table-seat--selected");
        if (p.isAlive && !pickable && (dimIds?.has(id) || (pick && !you))) classes.push("table-seat--dim");
        if (bubble) classes.push("table-seat--saying");
        if (aimColor) classes.push("table-seat--aimed");
        if (spotId === id) classes.push("table-seat--spot");
        return (
          <button
            key={id}
            type="button"
            className={classes.join(" ")}
            style={{ left: w / 2 + x, top: h / 2 + y, "--face": `${face}px`, "--aim": aimColor } as CSSProperties}
            aria-label={`${n(index + 1)} ${you ? t("youName", { name: p.displayName }) : p.displayName}, ${state}`}
            aria-pressed={pick ? selected : undefined}
            aria-disabled={!pickable && !notable}
            onClick={(e) => {
              if (pickable) {
                haptic.select();
                pick!.onPick(id);
              } else if (notable) {
                setNoting({ player: p, host: e.currentTarget.closest(".screen") ?? document.body });
              }
            }}
          >
            <span className="table-seat__face" style={{ backgroundImage: `url(${seatPortrait(index)})` }}>
              {now && <VoiceHalo inset={-7} color="#f1d79a" />}
              {view.controllerPlayerId === id && <span className="table-seat__crown"><Icon name="crown" size={Math.round(face * 0.34)} strokeWidth={2.2} /></span>}
              {mark && <span className={`table-seat__mark table-seat__mark--${mark}`} />}
              <span className="table-seat__no">{n(index + 1)}</span>
              {speaking && (p.isAlive || now) && (
                <span className={`table-seat__mic${micLive ? " table-seat__mic--live" : ""}`}>
                  <Icon name={micLive ? "mic" : "micOff"} size={Math.max(10, Math.round(face * 0.2))} strokeWidth={2.2} />
                </span>
              )}
              {votes > 0 && <span className="table-seat__votes">{n(votes)}</span>}
            </span>
            <span className="table-seat__plate">
              <span className="table-seat__name" dir="auto">{you ? t("you") : p.displayName}</span>
              {(!compact || tag) && <span className="table-seat__state" style={tag?.color ? { color: tag.color } : undefined}>{state}</span>}
            </span>
            {bubble && (
              // Bubbles open towards the middle of the table, so they never run off its edge.
              <span key={bubble.key} className={`seat-say seat-say--${y < 0 ? "below" : "above"}${x < -w / 5 ? " seat-say--start" : x > w / 5 ? " seat-say--end" : ""}`}>
                {bubble.kind ? (
                  <>
                    <ReactionArt kind={bubble.kind} size={20} />
                    <span className="seat-say__text">
                      <b dir="auto">{t(`reaction_${bubble.kind}`)}</b>
                      {bubble.targetId && <small dir="auto">{t("reactionTo", { name: seatName(bubble.targetId) })}</small>}
                    </span>
                  </>
                ) : (
                  <span className="seat-say__text seat-say__text--chat" dir="auto">{bubble.text}</span>
                )}
              </span>
            )}
          </button>
        );
      })}
      {noting && createPortal(<NoteSheet
          gameId={view.gameId}
          player={noting.player}
          onClose={() => setNoting(null)}
          aim={canReact && noting.player.isAlive ? {
            disabled: reactionCooling || link !== "connected",
            send: (kind) => {
              void sendReaction(kind, noting.player.playerId);
              setNoting(null);
            },
          } : undefined}
        />, noting.host)}
    </section>
  );
}
