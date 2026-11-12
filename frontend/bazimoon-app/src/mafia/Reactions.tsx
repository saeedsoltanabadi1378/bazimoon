import { useEffect, useRef, useState } from "react";
import { useGame } from "./GameProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { reactionKinds, type ReactionKind } from "./reactionTypes";
import "./reactions.css";

const colors: Record<ReactionKind, string> = { suspect: '#e2b86b', trust: '#78d7b5', bluff: '#ef8d93', think: '#b6a0ec', shock: '#8cc9ee', applause: '#f1ca75' };
const eyes: Record<ReactionKind, string> = {
  suspect: 'M17 27l8 3m14-3-8 3', trust: 'M17 30l3 3 5-6m7 3 3 3 5-6',
  bluff: 'M17 27l8 6m0-6-8 6m15-6 8 6m0-6-8 6', think: 'M17 30h8m8 0h7',
  shock: 'M21 27v7m15-7v7', applause: 'M17 32l4-5 4 5m7 0 4-5 4 5',
};
/** Original vector stickers, kept crisp in both the picker and live feed. */
export function ReactionArt({ kind }: { kind: ReactionKind }) {
  return <svg viewBox="0 0 56 56" aria-hidden="true" className="mafia-reaction-art">
    <circle cx="28" cy="29" r="24" fill={colors[kind]} opacity=".12" />
    <path d="M12 23Q28 16 44 23L42 36Q28 52 14 36Z" fill={colors[kind]} />
    <path d="M9 22h38M16 20l3-12 9 4 9-4 3 12" fill="#24202f" stroke={colors[kind]} strokeWidth="2" strokeLinejoin="round" />
    <path d={eyes[kind]} stroke="#24202f" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    {kind === 'shock' ? <ellipse cx="28" cy="39" rx="3" ry="4" fill="#24202f" /> :
      <path d={kind === 'trust' || kind === 'applause' ? 'M23 38q5 6 10 0' : kind === 'bluff' ? 'M23 40l10-4' : 'M24 39h8'} fill="none" stroke="#24202f" strokeWidth="2" strokeLinecap="round" />}
    {kind === 'think' && <path d="M43 10q6-5 8 0t-5 5v2m0 4v1" fill="none" stroke={colors[kind]} strokeWidth="2" strokeLinecap="round" />}
    {kind === 'applause' && <path d="M5 29l-3-3m3 12-3 2m49-11 3-3m-3 12 3 2" stroke={colors[kind]} strokeWidth="2" strokeLinecap="round" />}
  </svg>;
}

export function Reactions() {
  const { view, link, reactions, sendReaction, blockedPlayers } = useGame();
  const { t, n } = useLanguage();
  const [open, setOpen] = useState(false);
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [failed, setFailed] = useState(false);
  const sending = useRef(false);
  useEffect(() => {
    if (!until) return;
    const timer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= until) setUntil(0);
    }, 250);
    return () => window.clearInterval(timer);
  }, [until]);
  if (!view) return null;
  const canSend = view.youAreAlive && !view.youAreSpectator && view.silencedPlayerId !== view.yourPlayerId;
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  const visible = reactions.filter(r => r.phase === view.phase && r.round === view.nightNumber && !blockedPlayers.some(p => p.playerId === r.senderId));
  async function send(kind: ReactionKind) {
    if (sending.current || Date.now() < until) return;
    sending.current = true;
    setFailed(false);
    setNow(Date.now());
    setUntil(Date.now() + 3000);
    const ok = await sendReaction(kind);
    setFailed(!ok);
    sending.current = false;
  }
  return <section className="mafia-reactions" aria-label={t('reactionsTitle')}>
    <div className="mafia-reactions__feed" role="status" aria-live="polite" aria-relevant="additions">
      {visible.map(r => <div className="mafia-reactions__bubble" key={r.id}>
        <ReactionArt kind={r.kind} /><span><b dir="auto">{r.senderName}</b><small>{t(`reaction_${r.kind}`)}</small></span>
      </div>)}
    </div>
    {canSend && <>
      <button type="button" className="mafia-reactions__toggle" aria-expanded={open} aria-controls="mafia-reaction-picker" onClick={() => setOpen(v => !v)}>
        <ReactionArt kind="suspect" /><span>{t('reactionsTitle')}</span><span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && <div id="mafia-reaction-picker" className="mafia-reactions__picker">
        <p>{link !== 'connected' ? t('reactionsOffline') : remaining ? t('reactionsCooldown', { seconds: n(remaining) }) : t('reactionsHint')}</p>
        <div className="mafia-reactions__grid">{reactionKinds.map(kind => <button type="button" key={kind} disabled={remaining > 0 || link !== 'connected'} onClick={() => void send(kind)} aria-label={t(`reaction_${kind}`)}>
          <ReactionArt kind={kind} /><span>{t(`reaction_${kind}`)}</span>
        </button>)}</div>
      </div>}
      {failed && <p className="mafia-reactions__error" role="alert">{t('reactionsFailed')}</p>}
    </>}
  </section>;
}
