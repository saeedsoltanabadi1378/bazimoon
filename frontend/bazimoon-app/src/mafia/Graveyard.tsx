import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { haptic } from "../lib/haptics";
import { Icon } from "../ui/Icon";
import { useNavigation } from "../app/router";
import { useGame } from "./GameProvider";
import { useVoice } from "./VoiceProvider";
import { ActionError } from "./parts";

const MAX_LENGTH = 300;

/** Top-of-screen strip for people watching without a seat. */
export function SpectatorBanner() {
  const { view, busy, stopWatching } = useGame();
  const { t, n } = useLanguage();
  const { back } = useNavigation();
  if (!view?.youAreSpectator || view.phase === "Ended") return null;
  return (
    <div className="row" style={{ gap: 10, padding: "10px 12px", borderRadius: 14, background: "#1C2230", border: "1px solid #2E3A52" }}>
      <Icon name="eye" size={20} color="#8FA8FF" />
      <span className="grow stack" style={{ gap: 0, fontSize: 13, lineHeight: 1.4 }}>
        <b style={{ fontSize: 14 }}>{t("watchingTitle")}</b>
        <span style={{ color: "#B9C2D8" }}>{t("watchingText")}</span>
      </span>
      <span className="stack" style={{ gap: 4, alignItems: "flex-end" }}>
        <span className="tiny" style={{ color: "#B9C2D8", whiteSpace: "nowrap" }}>{t("watchingCount", { count: n(view.spectatorCount) })}</span>
        <button
          type="button"
          className="btn btn--ghost btn--auto"
          style={{ minHeight: 28, padding: "0 6px", fontSize: 12, color: "#8FA8FF" }}
          disabled={busy}
          onClick={async () => {
            if (await stopWatching()) back();
          }}
        >
          {t("stopWatching")}
        </button>
      </span>
    </div>
  );
}

/** Voice switch (room or graveyard) and the graveyard chat button, for players who are out and spectators. */
export function GraveyardBar() {
  const { view, graveyardUnread } = useGame();
  const voice = useVoice();
  const { t, n } = useLanguage();
  const [open, setOpen] = useState(false);
  if (!view?.youCanUseGraveyard) return null;
  const options = [
    { on: !voice.graveyardChosen, label: t("voiceRoom"), sub: t("voiceRoomSub"), pick: () => voice.chooseGraveyard(false) },
    { on: voice.graveyardChosen, label: t("graveyard"), sub: t("voiceGraveyardSub"), pick: () => voice.chooseGraveyard(true) },
  ];
  return (
    <>
      <div className="row" style={{ gap: 10, width: "100%" }}>
        <div role="radiogroup" aria-label={t("voiceChannel")} className="grow" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4, borderRadius: 14, background: "var(--surface-2)" }}>
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={o.on}
              onClick={() => {
                haptic.select();
                o.pick();
              }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 48, borderRadius: 11, border: 0,
                background: o.on ? "var(--accent)" : "transparent", color: o.on ? "var(--accent-ink, #14110D)" : "var(--text-2)",
                fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              {o.label}
              <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>{o.sub}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={graveyardUnread ? `${t("graveyardChat")} · ${t("unreadCount", { count: n(graveyardUnread) })}` : t("graveyardChat")}
          style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "0 14px", borderRadius: 14, border: 0, background: "#2A2340", color: "#D8CCFF", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", flex: "none" }}
        >
          <Icon name="grave" size={18} />
          {t("chat")}
          {graveyardUnread > 0 && (
            <span aria-hidden="true" style={{ position: "absolute", top: -6, insetInlineEnd: -6, minWidth: 20, height: 20, padding: "0 5px", boxSizing: "border-box", borderRadius: 999, background: "#E5604D", color: "#1C0905", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {n(graveyardUnread)}
            </span>
          )}
        </button>
      </div>
      {open && <GraveyardSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function GraveyardSheet({ onClose }: { onClose(): void }) {
  const { view, graveyard, markGraveyardRead, sendGraveyard, setSpectatorMuted, busy } = useGame();
  const { t, n } = useLanguage();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Everything on screen counts as read; keep the newest message in view.
  useEffect(() => {
    markGraveyardRead();
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graveyard.length]);

  if (!view) return null;
  const out = view.players.filter((p) => !p.isAlive).length;
  const mutedIds = new Set((view.spectators ?? []).filter((s) => s.muted).map((s) => s.id));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    if (await sendGraveyard(body)) setText("");
    setSending(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="graveyard-h"
        onClick={(e) => e.stopPropagation()}
        style={{ height: "78%", display: "flex", flexDirection: "column", borderRadius: "24px 24px 0 0", background: "var(--surface)", borderTop: "1px solid var(--edge-soft)" }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 999, background: "var(--edge-soft)", margin: "10px auto 0" }} />
        <div className="row" style={{ gap: 10, padding: "10px 16px" }}>
          <h2 id="graveyard-h" className="grow display" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t("graveyard")}</h2>
          <span className="tiny muted">{t("graveyardWho", { out: n(out), watching: n(view.spectatorCount) })}</span>
          <button type="button" className="btn btn--ghost btn--auto" style={{ minHeight: 32, padding: "0 8px" }} onClick={onClose} aria-label={t("close")}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div ref={listRef} className="grow stack" style={{ gap: 10, overflowY: "auto", padding: "4px 16px 12px" }} aria-live="polite">
          {graveyard.length === 0 && <p className="small muted" style={{ textAlign: "center", padding: "24px 0" }}>{t("graveyardEmpty")}</p>}
          {graveyard.map((m) => {
            const mine = m.senderId === view.yourPlayerId;
            const canMute = view.youAreController && m.fromSpectator && !mine;
            const isMuted = mutedIds.has(m.senderId);
            return (
              <div key={m.id} className="row" style={{ gap: 8, alignItems: "flex-start", flexDirection: mine ? "row-reverse" : "row" }}>
                {!mine && (
                  <span className="avatar" aria-hidden="true" style={{ width: 30, height: 30, fontSize: 12, flex: "none", background: m.fromSpectator ? "#8FA8FF" : "#5FD0BE" }}>
                    {Array.from(m.senderName)[0]?.toUpperCase()}
                  </span>
                )}
                <div style={{ maxWidth: "75%", padding: "8px 12px", borderRadius: 14, background: mine ? "#3A2C14" : "var(--surface-2)", fontSize: 14, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                  {!mine && (
                    <div className="row" style={{ gap: 6, fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 2 }}>
                      <span dir="auto">{m.senderName}</span>
                      <span style={{ padding: "1px 7px", borderRadius: 999, background: m.fromSpectator ? "#1C2230" : "var(--surface-3)", color: m.fromSpectator ? "#8FA8FF" : "var(--muted)", fontSize: 11 }}>
                        {m.fromSpectator ? t("tagWatching") : t("tagOut")}
                      </span>
                      {canMute && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void setSpectatorMuted(m.senderId, !isMuted)}
                          style={{ marginInlineStart: "auto", padding: "2px 8px", borderRadius: 999, border: "1px solid var(--edge-soft)", background: "transparent", color: "#F08A7A", fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                        >
                          {isMuted ? t("unmuteSpectator") : t("muteSpectator")}
                        </button>
                      )}
                    </div>
                  )}
                  <span dir="auto">{m.text}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "10px 16px 22px", borderTop: "1px solid var(--edge-soft)" }}>
          <ActionError />
          {view.youAreMutedInGraveyard ? (
            <div style={{ padding: "12px 14px", borderRadius: 14, background: "#2A1612", border: "1px solid #4A2620", fontSize: 13, lineHeight: 1.45, color: "#F0C2B8" }}>
              {t("graveyardMuted")}
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="row" style={{ gap: 8 }}>
                <input
                  type="text"
                  dir="auto"
                  value={text}
                  maxLength={MAX_LENGTH}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t("graveyardPlaceholder")}
                  aria-label={t("graveyardPlaceholder")}
                  style={{ flex: 1, minWidth: 0, minHeight: 44, boxSizing: "border-box", padding: "0 12px", borderRadius: 12, border: "1px solid var(--edge-soft)", background: "var(--bg, #14110D)", color: "var(--text)", fontFamily: "inherit", fontSize: 14 }}
                />
                <button type="submit" aria-label={t("send")} disabled={!text.trim() || sending} style={{ width: 44, height: 44, flex: "none", borderRadius: 12, border: 0, background: "var(--accent)", color: "#14110D", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <span className="flip-rtl" style={{ display: "flex" }}><Icon name="arrowSend" size={20} /></span>
                </button>
              </div>
              <div className="row row--between tiny" style={{ marginTop: 6, color: "var(--faint)" }}>
                <span>{t("graveyardHint")}</span>
                <span>{n(text.length)} / {n(MAX_LENGTH)}</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/** For the table creator while still in the game: who is watching, with a mute switch for the graveyard chat. */
export function SpectatorList() {
  const { view, busy, setSpectatorMuted } = useGame();
  const { t, n } = useLanguage();
  const [open, setOpen] = useState(false);
  const list = view?.spectators ?? [];
  if (!view?.youAreController || list.length === 0 || view.phase === "Ended") return null;
  return (
    <>
      <button type="button" className="btn btn--outline btn--sm" onClick={() => setOpen(true)}>
        <Icon name="eye" size={16} /> {t("watchingCount", { count: n(list.length) })}
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end" }} onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="spectators-h" className="stack" onClick={(e) => e.stopPropagation()} style={{ width: "100%", gap: 8, padding: "20px 16px 26px", borderRadius: "24px 24px 0 0", background: "var(--surface)", maxHeight: "70%", overflowY: "auto" }}>
            <h2 id="spectators-h" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t("spectatorsTitle")}</h2>
            <p className="small muted" style={{ margin: 0, lineHeight: 1.45 }}>{t("spectatorsNote")}</p>
            {list.map((s) => (
              <div key={s.id} className="row" style={{ gap: 10, minHeight: 48 }}>
                <span className="grow" dir="auto">{s.username}</span>
                <button type="button" className="btn btn--outline btn--auto btn--sm" disabled={busy} onClick={() => void setSpectatorMuted(s.id, !s.muted)} style={{ color: s.muted ? "var(--text)" : "#F08A7A" }}>
                  {s.muted ? t("unmuteSpectator") : t("muteSpectator")}
                </button>
              </div>
            ))}
            <button type="button" className="btn btn--outline" onClick={() => setOpen(false)}>{t("close")}</button>
          </div>
        </div>
      )}
    </>
  );
}
