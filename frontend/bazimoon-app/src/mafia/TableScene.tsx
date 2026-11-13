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
export function TableScene({ pick, tags, counts, nowId, doneIds, dimIds }: {
  pick?: SeatPick | null;
  tags?: ReadonlyMap<string, SeatTag>;
  /** Votes against each player, shown on their seat. */
  counts?: ReadonlyMap<string, number>;
  /** Who holds the floor: their seat glows and shows a live mic. */
  nowId?: string | null;
  doneIds?: ReadonlySet<string>;
  /** Seats that take no part right now (a re-vote is only between the tied players). */
  dimIds?: ReadonlySet<string>;
}) {
  const { view } = useGame();
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

  return (
    <section ref={ref} className="table-scene" dir="ltr" aria-label={t("players")}>
      <img className="table-scene__table" src={tableArt.table} alt="" draggable={false} style={{ width: tableWidth, height: tableHeight }} />
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
        // You hear your own mic state; for everyone else the floor decides who can be heard.
        const live = now && (you ? voice.publishing && !voice.muted : true);
        const state = !p.isAlive ? t("outTag") : tag ? tag.text : now ? t("now") : silenced ? t("silencedTag") : mayor ? t("roleMayor") : done ? t("done") : p.isBot ? t("botTag") : t("aliveTag");
        const classes = ["table-seat"];
        if (pickable || notable) classes.push("table-seat--tap");
        if (!p.isAlive) classes.push("table-seat--out");
        if (you) classes.push("table-seat--you");
        if (now) classes.push("table-seat--now");
        if (done) classes.push("table-seat--done");
        if (selected) classes.push("table-seat--selected");
        if (p.isAlive && !pickable && (dimIds?.has(id) || (pick && !you))) classes.push("table-seat--dim");
        return (
          <button
            key={id}
            type="button"
            className={classes.join(" ")}
            style={{ left: w / 2 + x, top: h / 2 + y, "--face": `${face}px` } as CSSProperties}
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
                <span className={`table-seat__mic${live ? " table-seat__mic--live" : ""}`}>
                  <Icon name={live ? "mic" : "micOff"} size={Math.max(10, Math.round(face * 0.2))} strokeWidth={2.2} />
                </span>
              )}
              {votes > 0 && <span className="table-seat__votes">{n(votes)}</span>}
            </span>
            <span className="table-seat__plate">
              <span className="table-seat__name" dir="auto">{you ? t("you") : p.displayName}</span>
              {(!compact || tag) && <span className="table-seat__state" style={tag?.color && p.isAlive ? { color: tag.color } : undefined}>{state}</span>}
            </span>
          </button>
        );
      })}
      {noting && createPortal(<NoteSheet gameId={view.gameId} player={noting.player} onClose={() => setNoting(null)} />, noting.host)}
    </section>
  );
}
