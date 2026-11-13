import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { GameView, LogEntry } from "../api/types";
import { useLanguage } from "../i18n/LanguageContext";
import { Icon, type IconName } from "../ui/Icon";
import { useGame } from "./GameProvider";
import { useRoleName } from "./parts";
import { findPlayer } from "./roles";
import { seatPortrait } from "./TableScene";

const MAX_LENGTH = 300;

/** True while the stage is drawn sideways on a phone held upright (see stage.css). */
function stageIsTurned() {
  return window.matchMedia("(orientation: portrait) and (pointer: coarse)").matches;
}

/**
 * The panel beside the table. Events holds what this phase needs from you, then everything the table
 * has been told so far; Chat is the table chat. The table stays in view on both.
 */
export function PhasePanel({ children }: { children?: ReactNode }) {
  const { view, panelTab, setPanelTab, tableChatUnread } = useGame();
  const { t, n } = useLanguage();
  if (!view) return null;
  const chat = panelTab === "chat";
  return (
    <div className="screen__body phase-panel">
      <div className="phase-panel__tabs" role="tablist" aria-label={t("tableTalk")}>
        <button type="button" role="tab" aria-selected={!chat} className={chat ? undefined : "on"} onClick={() => setPanelTab("events")}>{t("panelEvents")}</button>
        <button
          type="button"
          role="tab"
          aria-selected={chat}
          aria-label={!chat && tableChatUnread > 0 ? `${t("chat")} · ${t("unreadCount", { count: n(tableChatUnread) })}` : undefined}
          className={chat ? "on" : undefined}
          onClick={() => setPanelTab("chat")}
        >
          {t("chat")}
          {!chat && tableChatUnread > 0 && <span className="panel-badge" aria-hidden="true">{n(tableChatUnread)}</span>}
        </button>
      </div>
      {chat ? <TableChat view={view} /> : (
        <div className="phase-panel__scroll" role="tabpanel" aria-label={t("panelEvents")}>
          {children}
          <GameLog view={view} />
        </div>
      )}
    </div>
  );
}

/** Something only you are told, pinned above the log in one quiet style. */
export function PanelNote({ icon, title, children }: { icon: IconName; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="panel-note" role="status">
      <span className="panel-note__icon"><Icon name={icon} size={18} /></span>
      <div>
        <b>{title}</b>
        {children && <span>{children}</span>}
      </div>
    </section>
  );
}

/** What the whole table has been told so far, newest first, under its night or day. */
function GameLog({ view }: { view: GameView }) {
  const { t } = useLanguage();
  const roleName = useRoleName();

  const name = (id: string | null | undefined) => findPlayer(view, id)?.displayName ?? t("unknown");
  // A role the table has been shown reads next to the event that showed it.
  const withRole = (text: string, entry: LogEntry) => {
    const role = findPlayer(view, entry.playerId)?.revealedRole;
    if (!role) return text;
    const guarding = entry.kind === "NightKill" && role === "Bodyguard" && view.bodyguardDiedId === entry.playerId;
    return `${text} ${t("theyWereThe", { role: roleName(role) })}${guarding ? ` ${t("bodyguardDiedText")}` : ""}`;
  };
  const line = (entry: LogEntry): string => {
    switch (entry.kind) {
      case "NightKill": return withRole(t("foundDead", { name: name(entry.playerId) }), entry);
      case "NightSaved": return t("doctorSavedTitle");
      case "NightQuiet": return t("quietNight");
      case "Shot": return withRole(t("shotDead", { name: name(entry.playerId) }), entry);
      case "Silenced": return t("silencedOtherTitle", { name: name(entry.playerId) });
      case "VotedOut": return withRole(t(entry.voteRound === 2 ? "logRevotedOut" : "logVotedOut", { name: name(entry.playerId) }), entry);
      case "VoteTied": return t(entry.voteRound === 2 ? "logTiedAgain" : "logVoteTied", { names: (entry.tied ?? []).map(name).join(t("listAnd")) });
      case "VoteNone": return t("logVoteNone");
      case "Left": return withRole(t("logLeft", { name: name(entry.playerId) }), entry);
      case "Removed": return withRole(t("removedTitle", { name: name(entry.playerId) }), entry);
      case "MayorRevealed": return t("mayorRevealedTitle", { name: name(entry.playerId) });
      case "Inquiry": return t("logInquiry");
      default: return "";
    }
  };
  const isNight = (entry: LogEntry) => entry.kind === "NightKill" || entry.kind === "NightSaved" || entry.kind === "NightQuiet" || entry.kind === "Shot" || entry.kind === "Silenced";

  // What the night did is announced in the morning, so it reads under that night.
  const groups: { heading: string; lines: string[] }[] = [];
  for (const entry of view.log ?? []) {
    const text = line(entry);
    if (!text) continue;
    const heading = isNight(entry) ? t("nightN", { number: entry.round }) : t("dayN", { number: entry.round });
    const last = groups[groups.length - 1];
    if (last?.heading === heading) last.lines.unshift(text);
    else groups.push({ heading, lines: [text] });
  }
  if (groups.length === 0) return null;
  groups.reverse();

  return (
    <section className="panel-log" aria-label={t("gameLog")}>
      {groups.map((group, index) => (
        <div key={groups.length - index}>
          <h3 className="panel-log__heading">{group.heading}</h3>
          {group.lines.map((text, i) => <p key={group.lines.length - i} className="panel-log__line" dir="auto">{text}</p>)}
        </div>
      ))}
    </section>
  );
}

/** Ready-made lines, so most messages need no keyboard. "Suspect" and "Trust" ask which seat. */
function QuickPhrases({ view, disabled, onSend }: { view: GameView; disabled: boolean; onSend(text: string): void }) {
  const { t, n } = useLanguage();
  const [asking, setAsking] = useState<"quickSuspectLine" | "quickTrustLine" | null>(null);

  if (asking) {
    const others = view.players.map((player, index) => ({ player, seat: index + 1 })).filter(({ player }) => player.isAlive && player.playerId !== view.yourPlayerId);
    return (
      <div className="quick-phrases" role="group" aria-label={t("quickPickSeat")}>
        <button type="button" className="quick-phrases__back" aria-label={t("close")} onClick={() => setAsking(null)}><Icon name="close" size={14} /></button>
        {others.map(({ player, seat }) => (
          <button
            key={player.playerId}
            type="button"
            disabled={disabled}
            onClick={() => {
              onSend(t(asking, { seat: n(seat), name: player.displayName }));
              setAsking(null);
            }}
          >
            <b>{n(seat)}</b><span dir="auto">{player.displayName}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="quick-phrases" role="group" aria-label={t("quickPhrases")}>
      <button type="button" disabled={disabled} onClick={() => setAsking("quickSuspectLine")}>{t("quickSuspect")}</button>
      <button type="button" disabled={disabled} onClick={() => setAsking("quickTrustLine")}>{t("quickTrust")}</button>
      {(["quickAgree", "quickDisagree", "quickVote"] as const).map((key) => (
        <button key={key} type="button" disabled={disabled} onClick={() => onSend(t(key))}>{t(key)}</button>
      ))}
    </div>
  );
}

/**
 * The table chat. Inside the panel it is used with the quick phrases; `upright` is the full-screen
 * copy opened for typing on a turned stage, where the phone's keyboard would otherwise sit sideways.
 */
function TableChat({ view, upright = false }: { view: GameView; upright?: boolean }) {
  const { tableChat, sendTableChat, markTableChatRead, blockedPlayers, actionError } = useGame();
  const { t, n } = useLanguage();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  // The panel shows the quick phrases until you choose to type; the upright copy shows both.
  const [typing, setTyping] = useState(upright);
  const [typingUpright, setTypingUpright] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const count = tableChat.length;

  // Everything on screen counts as read; keep the newest message in view.
  useEffect(() => {
    markTableChatRead();
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const blocked = new Set(blockedPlayers.map((player) => player.playerId));
  const awake = view.phase === "Day" || view.phase === "Defence" || view.phase === "Voting" || view.phase === "LastWords" || view.phase === "Results";
  const closed = !view.youAreAlive ? t(view.youAreSpectator ? "tableChatWatching" : "tableChatOut")
    : !awake ? t("tableChatNight")
    : view.silencedPlayerId === view.yourPlayerId ? t("tableChatSilenced")
    : null;

  async function send(body: string) {
    if (!body || sending) return false;
    setSending(true);
    const ok = await sendTableChat(body);
    setSending(false);
    return ok;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await send(text.trim())) setText("");
  }

  const shown = tableChat.filter((m) => !blocked.has(m.senderId));

  return (
    <>
      <div ref={listRef} className="panel-chat__list" role="tabpanel" aria-label={t("chat")} aria-live="polite">
        {shown.length === 0 && <p className="panel-chat__empty">{t("tableChatEmpty")}</p>}
        {shown.map((m) => {
          const seat = view.players.findIndex((p) => p.playerId === m.senderId);
          const mine = m.senderId === view.yourPlayerId;
          return (
            <div key={m.id} className={`panel-chat__message${mine ? " panel-chat__message--mine" : ""}`}>
              <span className="panel-chat__face" aria-hidden="true" style={{ backgroundImage: `url(${seatPortrait(seat)})` }} />
              <span className="panel-chat__bubble">
                <b dir="auto">{seat >= 0 ? `${n(seat + 1)} ` : ""}{mine ? t("you") : m.senderName}</b>
                <span dir="auto">{m.text}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="panel-chat__compose">
        {actionError && <p className="panel-chat__error" role="alert">{actionError}</p>}
        {closed ? (
          <p className="panel-chat__closed">{closed}</p>
        ) : (
          <>
            {(upright || !typing) && (
              <div className="panel-chat__quick">
                {!upright && (
                  // Typing with the phone's keyboard needs the screen the right way up, so on a turned
                  // stage the chat opens upright over the whole screen instead.
                  <button type="button" className="panel-chat__write" onClick={() => (stageIsTurned() ? setTypingUpright(true) : setTyping(true))}>{t("chatWrite")}</button>
                )}
                <QuickPhrases view={view} disabled={sending} onSend={(body) => void send(body)} />
              </div>
            )}
            {typing && (
              <form onSubmit={submit}>
                {!upright && <button type="button" className="panel-chat__back" aria-label={t("quickPhrases")} onClick={() => setTyping(false)}><Icon name="close" size={16} /></button>}
                <input
                  type="text"
                  dir="auto"
                  value={text}
                  maxLength={MAX_LENGTH}
                  autoFocus
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t("tableChatPlaceholder")}
                  aria-label={t("tableChatPlaceholder")}
                />
                <button type="submit" aria-label={t("send")} disabled={!text.trim() || sending}>
                  <span className="flip-rtl" style={{ display: "flex" }}><Icon name="arrowSend" size={20} /></span>
                </button>
              </form>
            )}
          </>
        )}
      </div>
      {typingUpright && createPortal(
        <div className="chat-upright" role="dialog" aria-modal="true" aria-label={t("chat")}>
          <header className="chat-upright__head">
            <h2>{t("chat")}</h2>
            <button type="button" aria-label={t("close")} onClick={() => setTypingUpright(false)}><Icon name="close" size={18} /></button>
          </header>
          <TableChat view={view} upright />
        </div>,
        document.body,
      )}
    </>
  );
}
