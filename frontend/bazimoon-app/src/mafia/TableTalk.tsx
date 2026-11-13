import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { GameView, LogEntry } from "../api/types";
import { useLanguage } from "../i18n/LanguageContext";
import { Icon } from "../ui/Icon";
import { useGame } from "./GameProvider";
import { findPlayer } from "./roles";
import { seatPortrait } from "./TableScene";

const MAX_LENGTH = 300;

/** True while the stage is drawn sideways on a phone held upright (see stage.css). */
function stageIsTurned() {
  return window.matchMedia("(orientation: portrait) and (pointer: coarse)").matches;
}

/** Header button for the game log and the table chat, with a badge for unread messages. */
export function TableTalkButton() {
  const { view, tableChatUnread } = useGame();
  const { t, n } = useLanguage();
  const button = useRef<HTMLButtonElement>(null);
  const [host, setHost] = useState<Element | null>(null);
  if (!view || view.phase === "Lobby" || view.phase === "Ended") return null;
  return (
    <>
      <button
        ref={button}
        type="button"
        className="icon-btn icon-btn--round table-talk__button"
        aria-label={tableChatUnread ? `${t("tableTalk")} · ${t("unreadCount", { count: n(tableChatUnread) })}` : t("tableTalk")}
        onClick={() => {
          // Typing with the phone's keyboard needs the screen the right way up, so on a turned stage
          // the sheet opens upright over the whole screen instead of inside the room.
          setHost(stageIsTurned() ? document.body : button.current?.closest(".screen") ?? document.body);
        }}
      >
        <Icon name="send" size={20} />
        {tableChatUnread > 0 && <span className="table-talk__badge" aria-hidden="true">{n(tableChatUnread)}</span>}
      </button>
      {host && createPortal(<TableTalkSheet upright={host === document.body} onClose={() => setHost(null)} />, host)}
    </>
  );
}

function TableTalkSheet({ upright, onClose }: { upright: boolean; onClose(): void }) {
  const { view, tableChat, tableChatUnread, markTableChatRead } = useGame();
  const { t, n } = useLanguage();
  const [tab, setTab] = useState<"log" | "chat">(tableChatUnread > 0 ? "chat" : "log");
  if (!view) return null;
  return (
    <div className={`table-talk${upright ? " table-talk--upright" : ""}`} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t("tableTalk")} className="table-talk__sheet" onClick={(e) => e.stopPropagation()}>
        <div className="table-talk__tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "log"} className={tab === "log" ? "on" : undefined} onClick={() => setTab("log")}>{t("gameLog")}</button>
          <button type="button" role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "on" : undefined} onClick={() => setTab("chat")}>
            {t("chat")}
            {tab !== "chat" && tableChatUnread > 0 && <span className="table-talk__badge table-talk__badge--inline">{n(tableChatUnread)}</span>}
          </button>
          <button type="button" className="table-talk__close" onClick={onClose} aria-label={t("close")} autoFocus><Icon name="close" size={18} /></button>
        </div>
        {tab === "log" ? <GameLog view={view} /> : <TableChat view={view} count={tableChat.length} onSeen={markTableChatRead} />}
      </div>
    </div>
  );
}

/** What the whole table has been told so far, oldest first, under its night or day. */
function GameLog({ view }: { view: GameView }) {
  const { t } = useLanguage();
  const listRef = useRef<HTMLDivElement>(null);
  const log = view.log ?? [];
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [log.length]);

  const name = (id: string | null | undefined) => findPlayer(view, id)?.displayName ?? t("unknown");
  const line = (entry: LogEntry): string => {
    switch (entry.kind) {
      case "NightKill": return t("foundDead", { name: name(entry.playerId) });
      case "NightSaved": return t("doctorSavedTitle");
      case "NightQuiet": return t("quietNight");
      case "Shot": return t("shotDead", { name: name(entry.playerId) });
      case "Silenced": return t("silencedOtherTitle", { name: name(entry.playerId) });
      case "VotedOut": return t(entry.voteRound === 2 ? "logRevotedOut" : "logVotedOut", { name: name(entry.playerId) });
      case "VoteTied": return t(entry.voteRound === 2 ? "logTiedAgain" : "logVoteTied", { names: (entry.tied ?? []).map(name).join(t("listAnd")) });
      case "VoteNone": return t("logVoteNone");
      case "Left": return t("logLeft", { name: name(entry.playerId) });
      case "Removed": return t("removedTitle", { name: name(entry.playerId) });
      case "MayorRevealed": return t("mayorRevealedTitle", { name: name(entry.playerId) });
      case "Inquiry": return t("logInquiry");
      default: return "";
    }
  };
  const isNight = (entry: LogEntry) => entry.kind === "NightKill" || entry.kind === "NightSaved" || entry.kind === "NightQuiet" || entry.kind === "Shot" || entry.kind === "Silenced";

  let lastHeading = "";
  return (
    <div ref={listRef} className="table-talk__list" aria-live="polite">
      {log.length === 0 && <p className="table-talk__empty">{t("logEmpty")}</p>}
      {log.map((entry, index) => {
        const text = line(entry);
        if (!text) return null;
        // What the night did is announced in the morning, so it reads under that night.
        const heading = isNight(entry) ? t("nightN", { number: entry.round }) : t("dayN", { number: entry.round });
        const showHeading = heading !== lastHeading;
        lastHeading = heading;
        return (
          <div key={index}>
            {showHeading && <h3 className="table-talk__heading">{heading}</h3>}
            <p className="table-talk__line" dir="auto">{text}</p>
          </div>
        );
      })}
    </div>
  );
}

function TableChat({ view, count, onSeen }: { view: GameView; count: number; onSeen(): void }) {
  const { tableChat, sendTableChat, blockedPlayers, actionError } = useGame();
  const { t, n } = useLanguage();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Everything on screen counts as read; keep the newest message in view.
  useEffect(() => {
    onSeen();
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const blocked = new Set(blockedPlayers.map((player) => player.playerId));
  const awake = view.phase === "Day" || view.phase === "Defence" || view.phase === "Voting" || view.phase === "LastWords" || view.phase === "Results";
  const closed = !view.youAreAlive ? t(view.youAreSpectator ? "tableChatWatching" : "tableChatOut")
    : !awake ? t("tableChatNight")
    : view.silencedPlayerId === view.yourPlayerId ? t("tableChatSilenced")
    : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    if (await sendTableChat(body)) setText("");
    setSending(false);
  }

  return (
    <>
      <div ref={listRef} className="table-talk__list" aria-live="polite">
        {tableChat.length === 0 && <p className="table-talk__empty">{t("tableChatEmpty")}</p>}
        {tableChat.filter((m) => !blocked.has(m.senderId)).map((m) => {
          const seat = view.players.findIndex((p) => p.playerId === m.senderId);
          const mine = m.senderId === view.yourPlayerId;
          return (
            <div key={m.id} className={`table-talk__message${mine ? " table-talk__message--mine" : ""}`}>
              <span className="table-talk__face" aria-hidden="true" style={{ backgroundImage: `url(${seatPortrait(seat)})` }} />
              <span className="table-talk__bubble">
                <b dir="auto">{seat >= 0 ? `${n(seat + 1)} ` : ""}{mine ? t("you") : m.senderName}</b>
                <span dir="auto">{m.text}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="table-talk__compose">
        {actionError && <p className="table-talk__error" role="alert">{actionError}</p>}
        {closed ? (
          <p className="table-talk__closed">{closed}</p>
        ) : (
          <form onSubmit={submit}>
            <input
              type="text"
              dir="auto"
              value={text}
              maxLength={MAX_LENGTH}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("tableChatPlaceholder")}
              aria-label={t("tableChatPlaceholder")}
            />
            <button type="submit" aria-label={t("send")} disabled={!text.trim() || sending}>
              <span className="flip-rtl" style={{ display: "flex" }}><Icon name="arrowSend" size={20} /></span>
            </button>
          </form>
        )}
      </div>
    </>
  );
}
