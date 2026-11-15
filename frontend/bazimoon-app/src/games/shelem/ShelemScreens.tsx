import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useSession } from "../../app/session";
import { shelemApi, type ShelemRoom, type ShelemSuit } from "../../api/shelem";
import { ApiError } from "../../api/client";
import { connectToShelemRoom } from "../../api/signalr";
import { Body, IconButton, Screen, Switch, TopBar } from "../../ui/components";
import { Icon } from "../../ui/Icon";
import { VoiceSession } from "../../lib/voiceSession";
import { appLink } from "../../lib/links";
import { shareLink } from "../../lib/platform";
import { haptic } from "../../lib/haptics";
import { CardBackFan, PlayingCard } from "../cards/PlayingCard";
import { useGameFeedback } from './GameFeedback';

import "./table.css";

const SUITS: { key: ShelemSuit; symbol: string; red: boolean }[] = [
  { key: "clubs", symbol: "♣", red: false }, { key: "diamonds", symbol: "♦", red: true },
  { key: "hearts", symbol: "♥", red: true }, { key: "spades", symbol: "♠", red: false },
];

export function ShelemIntro() {
  const { t } = useLanguage();
  const { back, push } = useNavigation();
  const session = useSession();
  const api = useMemo(() => shelemApi(session.api), [session.api]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(withBots: boolean) {
    setBusy(true); setError(null);
    try {
      const room = await api.create(withBots);
      push({ name: "game", game: "shelem", screen: "lobby", params: { code: room.code } });
    } catch (e) { setError(message(e, t("shelemCouldNotOpen"))); }
    finally { setBusy(false); }
  }

  async function join() {
    if (!code.trim()) return;
    setBusy(true); setError(null);
    try {
      const room = await api.join(code);
      push({ name: "game", game: "shelem", screen: "lobby", params: { code: room.code } });
    } catch (e) { setError(message(e, t("shelemRoomNotFound"))); }
    finally { setBusy(false); }
  }

  return <Screen theme="night" label={t("gameShelem")}>
    <TopBar onBack={back} backLabel={t("backToSolo")} title={t("gameShelem")} subtitle={t("shelemTagline")} />
    <Body style={{ gap: 18, paddingBottom: 24 }}>
      <section className="shelem-hero">
        <div className="shelem-hero__cards" aria-hidden="true">
          {["AS", "TH", "5D", "KC"].map((card, i) => <PlayingCard key={card} code={card} size="table" style={{ transform: `translateX(${(i - 1.5) * 28}px) rotate(${(i - 1.5) * 9}deg)`, zIndex: i }} />)}
        </div>
        <div><div className="display shelem-hero__title">{t("shelemHeroTitle")}</div><p className="small muted">{t("shelemHeroText")}</p></div>
      </section>

      <div className="stack" style={{ gap: 10 }}>
        <button className="shelem-way" disabled={busy} onClick={() => void create(true)}>
          <span className="shelem-way__icon"><Icon name="bolt" /></span><span className="grow"><b>{t("shelemBots")}</b><small>{t("shelemBotsDesc")}</small></span><Icon name="forward" />
        </button>
        <button className="shelem-way" disabled={busy} onClick={() => void create(false)}>
          <span className="shelem-way__icon"><Icon name="people" /></span><span className="grow"><b>{t("shelemCreateRoom")}</b><small>{t("shelemCreateRoomDesc")}</small></span><Icon name="forward" />
        </button>
      </div>

      <form className="shelem-join" onSubmit={(e) => { e.preventDefault(); void join(); }}>
        <label htmlFor="shelem-code">{t("shelemJoinRoom")}</label>
        <div className="row" style={{ gap: 8 }}><input id="shelem-code" className="text-field grow" dir="ltr" placeholder="SH-7K2M" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /><button className="btn btn--outline btn--auto" disabled={busy || !code.trim()}>{t("shelemJoin")}</button></div>
      </form>
      {error && <div className="banner banner--error" role="alert">{error}</div>}

      <section className="stack" style={{ gap: 12 }}><h2 className="h2">{t("howToPlay")}</h2>
        {[1, 2, 3, 4].map((i) => <div className="row" style={{ alignItems: "flex-start", gap: 12 }} key={i}><span className="shelem-step">{i}</span><div><b>{t(`shelemStep${i}` as "shelemStep1")}</b><p className="small muted" style={{ margin: "3px 0 0" }}>{t(`shelemStep${i}Text` as "shelemStep1Text")}</p></div></div>)}
      </section>
    </Body>
  </Screen>;
}

export function ShelemRoomScreen({ code }: { code: string }) {
  const { t, n } = useLanguage();
  const { back } = useNavigation();
  const session = useSession();
  const api = useMemo(() => shelemApi(session.api), [session.api]);
  const [room, setRoom] = useState<ShelemRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [playSelection, setPlaySelection] = useState<string | null>(null);
  const [pendingCard, setPendingCard] = useState<string | null>(null);
  useEffect(() => { setPlaySelection(null); }, [room?.turnSeat, room?.round, room?.phase]);
  const [voiceOn, setVoiceOn] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [localMutes, setLocalMutes] = useState<Set<number>>(() => new Set());
  const voice = useRef(new VoiceSession());
  const version = useRef(-1);
  const loadBlocked = useRef(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const hasRoom = room !== null;
  const polling = useRef(false);
  const queued = useRef(false);
  const [live, setLive] = useState(false);
  const submitting = useRef(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [moveRejected, setMoveRejected] = useState(false);
  const [dealtRound, setDealtRound] = useState(0);
  const round = room?.round ?? 0;
  const [settledHand, setSettledHand] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scoresOpen, setScoresOpen] = useState(false);
  const feedback = useGameFeedback(room);
  const handKey = room?.hand.join(',') ?? '';
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledHand(handKey ? handKey.split(',') : []), 300);
    return () => window.clearTimeout(timer);
  }, [handKey]);
  useEffect(() => {
    if (!round) return;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 3100;
    const timer = window.setTimeout(() => setDealtRound(round), duration);
    return () => window.clearTimeout(timer);
  }, [round]);

  const load = useCallback(async function refresh(): Promise<void> {
    if (loadBlocked.current) return;
    // A push that lands mid-request must not be lost: fetch once more when the current request ends.
    if (polling.current || submitting.current) { queued.current = true; return; }
    polling.current = true;
    try {
      const next = version.current < 0 ? await api.join(code) : await api.get(code);
      if (next.version > version.current) { version.current = next.version; setRoom(next); }
      setReconnecting(false);
    } catch (error) {
      if (error instanceof ApiError && (['room_not_found', 'room_full', 'already_started'].includes(error.code ?? '') || [400, 403, 404, 409].includes(error.status))) {
        loadBlocked.current = true;
        // Losing the seat after sitting down means the host removed this player.
        const removed = version.current >= 0 && error.status === 403;
        setEntryError(removed ? 'shelemRemovedFromTable' : error.code === 'room_full' ? 'shelemInviteFull' : error.code === 'already_started' ? 'shelemInviteStarted' : error.code === 'room_not_found' ? 'shelemRoomNotFound' : 'shelemCouldNotOpen');
        if (version.current >= 0) { setRoom(null); void voice.current.leave(); }
        setReconnecting(false);
      } else setReconnecting(true);
    }
    finally {
      polling.current = false;
      if (queued.current) { queued.current = false; void refresh(); }
    }
  }, [api, code]);

  useEffect(() => {
    if (!hasRoom) return;
    let cancelled = false;
    let hub: Awaited<ReturnType<typeof connectToShelemRoom>> | null = null;
    connectToShelemRoom(import.meta.env.VITE_API_BASE_URL, () => session.api.getToken() ?? "", code, () => void load(), (state) => { if (!cancelled) setLive(state === "connected"); })
      .then((connection) => { if (cancelled) void connection.stop(); else hub = connection; })
      .catch(() => { if (!cancelled) setLive(false); });
    return () => { cancelled = true; void hub?.stop(); };
  }, [code, load, session.api, hasRoom]);
  // Pushes drive the room; polling stays as a slow safety net, and takes over while the live link is down.
  useEffect(() => { void load(); const id = window.setInterval(() => void load(), live ? 5000 : 550); return () => window.clearInterval(id); }, [load, live]);
  useEffect(() => () => { void voice.current.leave(); }, []);
  useEffect(() => { setSelected([]); }, [room?.phase, room?.round]);

  async function act(fn: () => Promise<ShelemRoom>) {
    if (submitting.current) return;
    submitting.current = true;
    setMoveRejected(false);
    setBusy(true); setError(null);
    try { const next = await fn(); if (next.version >= version.current) { version.current = next.version; setRoom(next); } setReconnecting(false); haptic.tap(); }
    catch { setMoveRejected(true); haptic.error(); }
    finally { submitting.current = false; setBusy(false); void load(); }
  }

  /** Before the game starts, going back gives the seat up so the table is not left waiting for someone who has gone. */
  async function leaveTable() {
    loadBlocked.current = true;
    try { await api.leave(code); } catch { /* the seat is cleared with the table if this does not arrive */ }
    back();
  }

  async function joinVoice() {
    setError(null);
    try {
      const token = await api.voice(code);
      await voice.current.join(import.meta.env.VITE_AGORA_APP_ID, token.channel, token.token, token.uid, true);
      setVoiceOn(true); setMicMuted(false);
    } catch { setError(t("shelemVoiceFailed")); }
  }
  async function toggleMic() { const next = !micMuted; await voice.current.setMuted(next); setMicMuted(next); }
  function togglePlayer(uid: number) { const next = !localMutes.has(uid); voice.current.setRemoteMuted(uid, next); setLocalMutes((old) => { const copy = new Set(old); if (next) copy.add(uid); else copy.delete(uid); return copy; }); }

  if (!room) return <Screen theme="night"><TopBar onBack={back} title={t("gameShelem")} /><Body>{entryError ? <div role="alert"><p>{t(entryError as "shelemCouldNotOpen")}</p><button className="btn" onClick={back}>{t("back")}</button></div> : reconnecting ? <div role="status"><p>{t('shelemReconnecting')}</p><button className="btn" onClick={()=>void load()}>{t('shelemRetry')}</button></div> : <div className="skeleton" style={{ height: 420 }} />}</Body></Screen>;
  const me = room.players.find((p) => p.isYou);
  const dealing = room.phase === 'bidding' && dealtRound !== room.round;
  const myTurn = room.yourSeat === room.turnSeat;
  const minBid = Math.max(100, (room.highestBid ?? 95) + 5);
  const team = (room.yourSeat ?? 0) % 2;
  const phaseTitle = t(`shelemPhase_${room.phase}` as "shelemPhase_lobby");

  return <Screen theme="night" label={t("gameShelem")}>
    <header className={`shelem-topbar${room.phase !== "lobby" ? " shelem-game-toolbar" : ""}`}>
      <IconButton icon="back" label={room.phase === "lobby" ? t("shelemLeaveTable") : t("back")} onClick={room.phase === "lobby" ? () => void leaveTable() : back} />
      <div className="grow"><div className="kicker">{phaseTitle}</div><div className="display" style={{ fontSize: 20 }}>{room.phase === "lobby" ? t("shelemLobbyTitle") : t("shelemRoundN", { n: room.round })}</div></div>
      {room.phase !== "lobby" && <button type="button" className="shelem-score" aria-label={t("shelemScoreboard")} onClick={() => setScoresOpen(true)}><small>{t("shelemMatchScore")}</small><span>{t("shelemUs")} <b>{n(room.teamScores[team])}</b></span><span>{t("shelemThem")} <b>{n(room.teamScores[1 - team])}</b></span>{room.phase === 'playing' && <small>{t("shelemCapturedScore", { us: room.roundPoints[team], them: room.roundPoints[1-team] })}</small>}</button>}
      <IconButton icon="sliders" label={t("shelemSettings")} onClick={() => setSettingsOpen(true)} />
    </header>
    {room.phase !== 'lobby' && <div className="shelem-voice-entry"><button type="button" className="btn btn--outline" onClick={()=>voiceOn ? void toggleMic() : void joinVoice()}><Icon name={voiceOn && micMuted ? 'micOff' : 'mic'} size={18}/>{voiceOn ? t(micMuted ? 'shelemUnmuteMic' : 'shelemMuteMic') : t('shelemJoinVoice')}</button></div>}
    {(busy || reconnecting || moveRejected) && <div className="shelem-network" role="status">{busy ? t('shelemSending') : reconnecting ? t('shelemReconnecting') : t('shelemMoveRejected')}{!busy && <button type="button" onClick={()=>{setMoveRejected(false); void load();}}>{t('shelemRetry')}</button>}</div>}

    {room.phase === "lobby" ? <Lobby room={room} busy={busy} voiceOn={voiceOn} micMuted={micMuted} localMutes={localMutes} onVoice={() => void joinVoice()} onMic={() => void toggleMic()} onPlayerMute={togglePlayer}
      onMove={(from, to) => void act(() => api.movePlayer(code, from, to))} onAddBot={(seat) => void act(() => api.addBot(code, seat))} onRemove={(seat) => void act(() => api.removeSeat(code, seat))} onReady={() => void act(() => api.ready(code, !me?.ready))} onStart={() => void act(() => api.start(code, false))} /> :
      <GameTable room={room} />}

    {error && <div className="shelem-toast" role="alert">{error}</div>}
    {dealing && <DealSequence room={room} />}
    {scoresOpen && <Scoreboard room={room} onClose={() => setScoresOpen(false)} />}
    {settingsOpen && <SettingsSheet room={room} feedback={feedback} voiceOn={voiceOn} micMuted={micMuted} localMutes={localMutes} onVoice={() => void joinVoice()} onMic={() => void toggleMic()} onPlayerMute={togglePlayer} onClose={() => setSettingsOpen(false)} />}

    <div className={`shelem-actions shelem-actions--${room.phase}${myTurn ? " is-my-turn" : ""}`} hidden={dealing}>
      {room.phase === 'playing' && myTurn && <small role="status">{t(playSelection ? 'shelemTapAgain' : 'shelemTapSelect')}</small>}
      {room.declarerSeat != null && room.highestBid != null && room.phase === 'playing' && <div className="shelem-contract-progress"><small>{t('shelemProgress', {points:room.roundPoints[room.declarerSeat%2], target:room.highestBid})}</small><progress max={room.highestBid} value={room.roundPoints[room.declarerSeat%2]} aria-label={t('shelemContract')} /><small>{t('shelemZaminPending')}</small></div>}
      {(room.phase === 'roundresult' || room.phase === 'finished') && room.declarerSeat != null && <p className="small">{t(room.roundDelta[room.declarerSeat%2]>=0 ? 'shelemContractMade' : 'shelemContractMissed', {points:room.roundPoints[room.declarerSeat%2], target:room.highestBid ?? 0, delta:room.roundDelta[room.declarerSeat%2]})}</p>}
      {room.phase === 'discard' && myTurn && <div className="shelem-zamin" dir="ltr" aria-label={t('shelemChooseFour')}><small>{t('shelemDropFour')}</small>{Array.from({length:4},(_,i)=>selected[i] ? <PlayingCard key={selected[i]} code={selected[i]} size="table" dropTarget=".shelem-hand" onClick={busy ? undefined : ()=>setSelected(old=>old.filter(c=>c!==selected[i]))} /> : <span className="shelem-zamin-slot" key={i}>{n(i+1)}</span>)}</div>}
      {room.phase === "bidding" && (myTurn ? <div className="stack" style={{ gap: 10 }}>
          <div className="shelem-bid-heading"><b>{t("shelemYourBid")}</b><small>{t("shelemTapToBid")}</small></div>
          <div className="shelem-bid-values" dir="ltr" role="group" aria-label={t("shelemYourBid")}>{Array.from({length:14},(_,i)=>100+i*5).map(value=><button type="button" key={value} disabled={value<minBid || busy} aria-label={t("shelemBidN", { n: value })} onClick={() => void act(() => api.bid(code, value))}>{n(value)}</button>)}</div>
          <div className="row" style={{ gap: 8 }}><button className="btn btn--outline" disabled={busy} onClick={() => void act(() => api.bid(code, null))}>{t("shelemPass")}</button><button className="btn shelem-slam" disabled={busy} onClick={() => void act(() => api.bid(code, 165, true))}>{t("gameShelem")}</button></div>
        </div> : null)}
      {room.phase === "discard" && myTurn && <div className="row row--between"><span><b>{t("shelemChooseFour")}</b><small>{t("shelemChosen", { n: selected.length })}</small></span><button className="btn btn--auto" disabled={busy || selected.length !== 4} onClick={() => void act(() => api.discard(code, selected))}>{t("shelemDiscard")}</button></div>}
      {room.phase === "trump" && myTurn && <div className="stack stack--sm"><b>{t("shelemChooseTrump")}</b><div className="shelem-suits">{SUITS.map((s) => <button key={s.key} className={s.red ? "is-red" : ""} onClick={() => void act(() => api.trump(code, s.key))}>{s.symbol}</button>)}</div></div>}
      {room.phase === "roundresult" && <RoundResult room={room} onNext={() => void act(() => api.next(code))} />}
      {room.phase === "finished" && <FinalResult room={room} />}
    </div>

    {room.phase !== "lobby" && room.phase !== "roundresult" && room.phase !== "finished" && <div className="shelem-hand" dir="ltr" aria-busy={dealing}>
      {orderHand(settledHand.length ? settledHand : room.hand, room.trump).filter(card => room.phase !== 'discard' || !selected.includes(card)).map((card, i, cards) => {
        const selectable = room.phase === "discard" && myTurn;
        const playable = room.phase !== "playing" || !myTurn || room.legalCards.includes(card);
        const canPlay = !busy && !dealing && room.hand.includes(card) && room.phase === 'playing' && myTurn && playable;
        const play = () => { setPlaySelection(null); setPendingCard(card); void act(() => api.play(code, card)).finally(()=>setPendingCard(null)); };
        return <PlayingCard key={`${room.round}-${card}`} code={card} selected={playSelection===card} faceDown={dealing} dropTarget={selectable ? '.shelem-zamin' : '.shelem-table'} playable={playable} onDrop={canPlay ? play : undefined} onClick={busy || dealing || !room.hand.includes(card) ? undefined : selectable ? () => setSelected((old) => old.length < 4 && !old.includes(card) ? [...old, card] : old) : canPlay ? () => playSelection===card ? play() : setPlaySelection(card) : undefined} style={{ zIndex: playSelection===card ? 30 : i, opacity: room.hand.includes(card) && pendingCard!==card ? 1 : 0, '--hand-n': cards.length, '--fan-angle': `${(i-(cards.length-1)/2)*3.2}deg`, '--fan-y': `${Math.pow(i-(cards.length-1)/2,2)*.65}px` } as CSSProperties} />;
      })}
    </div>}
  </Screen>;
}

function DealSequence({ room }: { room: ShelemRoom }) {
  const { t } = useLanguage();
  const destinations = [{x:0,y:150}, {x:-125,y:0}, {x:0,y:-150}, {x:125,y:0}];
  return <div className="shelem-dealing" role="status" aria-label={t('shelemDealing')}>
    <b>{t('shelemDealing')}</b>
    <div className="shelem-dealing-stage" aria-hidden="true">
      <PlayingCard faceDown size="table" />
      {Array.from({length:52}, (_,i) => {
        const seat = (room.dealerSeat + 1 + i) % 4;
        const target = i < 48 ? destinations[(seat - (room.yourSeat ?? 0) + 4) % 4] : {x:(i-49.5)*23,y:65};
        return <div className="shelem-dealt-card" key={i} style={{'--deal-x':`${target.x}px`, '--deal-y':`${target.y}px`, animationDelay:`${i*48}ms`, zIndex:i} as CSSProperties}><PlayingCard faceDown size="mini" /></div>;
      })}
    </div>
    <small>{t('shelemDealDescription')}</small>
  </div>;
}

// Where each seat sits around the table, seen from your own chair: partner across, opponents at the sides.
const LOBBY_SPOTS = ["bottom", "left", "top", "right"] as const;

function Lobby({ room, busy, voiceOn, micMuted, localMutes, onVoice, onMic, onPlayerMute, onReady, onStart, onMove, onAddBot, onRemove }: {
  room: ShelemRoom; busy: boolean; voiceOn: boolean; micMuted: boolean; localMutes: Set<number>; onVoice(): void; onMic(): void; onPlayerMute(uid: number): void;
  onReady(): void; onStart(): void; onMove(from: number, to: number): void; onAddBot(seat: number | null): void; onRemove(seat: number): void;
}) {
  const { t } = useLanguage();
  const [picked, setPicked] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const own = room.yourSeat ?? 0;
  const host = room.youAreHost;
  const me = room.players.find((p) => p.isYou);
  const at = (seat: number) => room.players.find((p) => p.seat === seat);
  const pickedPlayer = picked == null ? undefined : at(picked);
  const seated = room.players.length;
  const notReady = room.players.find((p) => !p.ready);
  const canStart = seated === 4 && !notReady;
  const status = seated < 4 ? t("shelemWaitingPlayers", { n: seated })
    : notReady ? (notReady.isYou ? t("shelemTapReady") : t("shelemWaitingReady", { name: notReady.name }))
    : host ? t("shelemStartGame") : t("shelemGuestWaitingHost");

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const invite = async () => void await shareLink(appLink(`sh_${room.code.replace("SH-", "")}`), t("shelemInviteText", { code: room.code }));
  const copyCode = async () => { try { await navigator.clipboard.writeText(room.code); setCopied(true); } catch { void invite(); } };

  function tapSeat(seat: number) {
    if (picked == null) setPicked(seat);
    else if (picked === seat) setPicked(null);
    else if (pickedPlayer) { onMove(picked, seat); setPicked(null); }
    else setPicked(seat);
  }

  return <>
    <Body style={{ gap: 14, paddingBottom: 20 }}>
      <section className="shelem-room-code">
        <span><small>{t("shelemRoomCode")}</small><b dir="ltr">{room.code}</b></span>
        <span className="row" style={{ gap: 8 }}>
          <IconButton icon={copied ? "check" : "link"} label={t("shelemCopyCode")} onClick={() => void copyCode()} />
          <button className="btn btn--outline btn--auto btn--sm" onClick={() => void invite()}><Icon name="share" size={17} /> {t("shelemInvite")}</button>
        </span>
        <small className="shelem-room-code__note" role="status">{copied ? t("shelemCodeCopied") : ""}</small>
      </section>

      <div className="shelem-lobby-table" dir="ltr">
        <div className="shelem-lobby-felt" aria-hidden="true"><span>✦</span></div>
        {[0, 1, 2, 3].map((delta) => {
          const seat = (own + delta) % 4;
          const p = at(seat);
          const role = delta === 0 ? t("you") : delta === 2 ? t("shelemPartner") : t("shelemOpponent");
          const state = !p ? t("shelemOpenSeat") : p.isBot ? t("shelemBot") : p.ready ? t("shelemSeatReady") : t("shelemSeatNotReady");
          const cls = `shelem-lobby-seat shelem-lobby-seat--${LOBBY_SPOTS[delta]} ${delta % 2 === 0 ? "is-ours" : "is-theirs"}${p ? "" : " is-open"}${p?.ready ? " is-ready" : ""}${picked === seat ? " is-picked" : ""}`;
          const content = <>
            <span className="shelem-seat-avatar">{!p ? <Icon name="plus" size={18} /> : p.isBot ? "✦" : p.name[0]?.toUpperCase()}{p?.isHost && <i className="shelem-seat-host" title={t("shelemHost")}><Icon name="crown" size={12} /></i>}</span>
            <small className="shelem-lobby-seat__role">{role}</small>
            <b dir="auto">{p ? p.name : t("shelemOpenSeat")}</b>
            {p && <small className="shelem-lobby-seat__state">{p.ready && !p.isBot && <Icon name="check" size={12} />}{p.isHost ? `${t("shelemHost")} · ${state}` : state}</small>}
          </>;
          const label = `${role} · ${p ? `${p.name} · ${p.isHost ? `${t("shelemHost")} · ` : ""}${state}` : t("shelemOpenSeat")}`;
          return host
            ? <button type="button" key={seat} className={cls} aria-pressed={picked === seat} aria-label={label} disabled={busy} onClick={() => tapSeat(seat)}>{content}</button>
            : <div key={seat} className={cls} role="group" aria-label={label}>{content}</div>;
        })}
      </div>

      <div className="shelem-seat-actions" role="status">
        {!host ? <p className="small muted">{t("shelemSeatHintGuest")}</p>
          : picked == null ? <p className="small muted">{t("shelemSeatHintHost")}</p>
          : !pickedPlayer ? <>
              <p className="small"><b>{t("shelemSeatOpenPicked")}</b></p>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => { onAddBot(picked); setPicked(null); }}><Icon name="bolt" size={17} /> {t("shelemAddBot")}</button>
                <button className="btn btn--outline btn--sm" onClick={() => { void invite(); setPicked(null); }}><Icon name="share" size={17} /> {t("shelemInviteFriend")}</button>
              </div>
            </>
          : <>
              <p className="small">{pickedPlayer.isYou ? t("shelemMoveSelfHint") : t("shelemMoveHint", { name: pickedPlayer.name })}</p>
              {!pickedPlayer.isYou && <button className="btn btn--outline btn--sm shelem-seat-remove" disabled={busy} onClick={() => { onRemove(picked); setPicked(null); }}><Icon name="close" size={17} /> {t("shelemRemovePlayer", { name: pickedPlayer.name })}</button>}
            </>}
      </div>

      <VoicePanel room={room} voiceOn={voiceOn} micMuted={micMuted} localMutes={localMutes} onVoice={onVoice} onMic={onMic} onPlayerMute={onPlayerMute} />
      <div className="card small muted"><Icon name="shield" size={18} /> {t("shelemFairBots")}</div>
    </Body>
    <div className="screen__bar">
      {host ? <>
        {seated < 4 && <button className="btn btn--outline btn--sm" disabled={busy} onClick={() => { onAddBot(null); setPicked(null); }}>{t("shelemFillSeats")}</button>}
        <button className="btn btn--primary" disabled={busy || !canStart} onClick={onStart} aria-live="polite">{status}</button>
      </> : <>
        <p className="small muted shelem-lobby-status" role="status">{status}</p>
        <button className={`btn ${me?.ready ? "btn--outline" : "btn--primary"}`} disabled={busy} onClick={onReady}>{me?.ready ? t("shelemNotReady") : t("shelemReady")}</button>
      </>}
    </div>
  </>;
}

function GameTable({ room }: { room: ShelemRoom }) {
  const { t, n } = useLanguage();
  const own = room.yourSeat ?? 0;
  const collecting = room.trick.length === 4 && room.lastTrickWinner != null;
  const winner = room.players.find(p => p.seat === room.lastTrickWinner);
  const points = 5 + room.trick.reduce((sum, p) => sum + (['A','T'].includes(p.card[0]) ? 10 : p.card[0] === '5' ? 5 : 0), 0);
  const direction = ['south', 'west', 'north', 'east'][((room.lastTrickWinner ?? own) - own + 4) % 4];
  const biddingWinner = room.phase !== 'bidding' && room.phase !== 'lobby'
    ? room.players.find(player => player.seat === room.declarerSeat) : undefined;
  const at = (delta: number) => room.players.find((p) => p.seat === (own + delta) % 4);
  const spots = [{ delta: 2, pos: "top" }, { delta: 1, pos: "left" }, { delta: 3, pos: "right" }];
  return <div className="shelem-table">
    <div className="shelem-felt-glow" /><div className="shelem-table-brand" aria-hidden="true">{t("gameShelem")}</div>
    {room.phase === "bidding" && <div className="shelem-kitty" dir="ltr">{Array.from({length:room.zaminCount}, (_,i)=><PlayingCard key={i} faceDown size="table" />)}</div>}
    {spots.map(({ delta, pos }) => { const p = at(delta); if (!p) return null; return <div className={`shelem-player shelem-player--${pos} ${delta === 2 ? "team-blue" : "team-red"}${p.seat === room.turnSeat ? " is-turn" : ""}`} key={p.seat}><span>{p.isBot ? "✦" : p.name[0]}<TurnRing room={room} seat={p.seat} /></span><b dir="auto">{p.name}</b>{room.declarerSeat === p.seat && <i className="shelem-crown" aria-label={t("shelemBiddingWinner")}>♛</i>}<small>{n(p.cards)}</small><PlayerStatus room={room} seat={p.seat} /></div>; })}
    {spots.map(({ delta, pos }) => { const p = at(delta); return p && <div key={p.seat} className={`shelem-opponent-hand shelem-opponent-hand--${pos}`} aria-hidden="true"><CardBackFan count={p.cards} vertical={pos !== 'top'} /></div>; })}
    <div className="shelem-contract"><span>{room.highestBid ? n(room.highestBid) : "—"}</span>{room.trump && <b className={room.trump === "hearts" || room.trump === "diamonds" ? "is-red" : ""}>{SUITS.find((s) => s.key === room.trump)?.symbol}</b>}<small>{t("shelemContract")}</small></div>
    {biddingWinner && <div className="shelem-bidding-winner" role="status"><small>{t('shelemBiddingWinner')}</small><strong dir="auto">{biddingWinner.isYou ? t('you') : biddingWinner.name}</strong></div>}
    {collecting && <div className="shelem-trick-winner" role="status">{t('shelemTrickWon', {name: winner?.isYou ? t('you') : winner?.name ?? '', points})}</div>}
    <div className={`shelem-trick${collecting ? ` is-collecting collect-${direction}` : ''}`} dir="ltr">{room.trick.map((play) => <PlayingCard key={`${play.seat}-${play.card}`} code={play.card} size="table" selected={collecting && play.seat === room.lastTrickWinner} style={trickStyle((play.seat - own + 4) % 4)} />)}{room.trick.length === 0 && <span className="shelem-table-mark">✦</span>}</div>
    <div className={`shelem-player shelem-player--bottom team-blue${room.turnSeat === own ? " is-turn" : ""}`}><span>{at(0)?.name[0]}<TurnRing room={room} seat={own} /></span><b>{t("you")}</b><PlayerStatus room={room} seat={own} /></div>
  </div>;
}

const ACTIVE_PHASES = ['bidding', 'discard', 'trump', 'playing'];

/** Drains over the move's time limit. Remounted for every new room version, so it restarts from the server's clock. */
function TurnRing({ room, seat }: { room: ShelemRoom; seat: number }) {
  if (seat !== room.turnSeat || room.turnRemainingMs == null || !ACTIVE_PHASES.includes(room.phase)) return null;
  const style = { '--turn-limit': `${room.turnLimitMs}ms`, '--turn-delay': `${room.turnRemainingMs - room.turnLimitMs}ms` } as CSSProperties;
  return <svg key={room.version} className="shelem-turn-ring" viewBox="0 0 36 36" aria-hidden="true" style={style}>
    <circle className="shelem-turn-ring__track" cx="18" cy="18" r="16" />
    <circle className="shelem-turn-ring__left" cx="18" cy="18" r="16" pathLength={100} />
  </svg>;
}

// Each card flies in from the seat that played it: you, then clockwise left, across and right.
const TRICK_SEATS = [
  { area: 'south', x: '0%', y: '140%', turn: '-8deg' }, { area: 'west', x: '-110%', y: '0%', turn: '-14deg' },
  { area: 'north', x: '0%', y: '-150%', turn: '10deg' }, { area: 'east', x: '110%', y: '0%', turn: '14deg' },
];
function trickStyle(relativeSeat: number) {
  const seat = TRICK_SEATS[relativeSeat];
  return { gridArea: seat.area, '--from-x': seat.x, '--from-y': seat.y, '--from-turn': seat.turn } as CSSProperties;
}

function PlayerStatus({ room, seat }: { room: ShelemRoom; seat: number }) {
  const { t } = useLanguage();
  const player = room.players.find(p => p.seat === seat);
  if (!player || !ACTIVE_PHASES.includes(room.phase)) return null;
  if (room.phase === 'bidding' && (player.passed || player.lastBid != null)) return <em className={`shelem-player-status${player.passed ? ' is-passed' : ''}`}>{player.lastBid != null && t('shelemBidN', {n:player.lastBid})}{player.passed && ` · ${t('shelemPassed')}`}</em>;
  if (seat !== room.turnSeat) return null;
  if (player.isYou) {
    const mustFollow = room.phase === 'playing' && room.trick.length > 0 && room.legalCards.length < room.hand.length;
    const suit = mustFollow ? SUITS.find(s => s.key[0].toUpperCase() === room.trick[0].card.at(-1))?.symbol ?? '' : '';
    return <em className="shelem-player-status is-you" role="status">{mustFollow ? t('shelemYourTurnFollow', { suit }) : t('shelemYourTurnShort')}</em>;
  }
  const label = player.isBot && room.botThinking ? t('shelemThinking') : t(`shelemTurnStatus_${room.phase}` as 'shelemTurnStatus_bidding');
  return <em className="shelem-player-status" role="status"><i /><i /><i />{label}</em>;
}

function SettingsSheet({ room, feedback, onClose, ...voice }: { room: ShelemRoom; feedback: ReturnType<typeof useGameFeedback>; voiceOn: boolean; micMuted: boolean; localMutes: Set<number>; onVoice(): void; onMic(): void; onPlayerMute(uid: number): void; onClose(): void }) {
  const { t } = useLanguage();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="help-sheet" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="help-sheet__panel shelem-settings" role="dialog" aria-modal="true" aria-labelledby="shelem-settings-title">
      <div className="row row--between">
        <h2 id="shelem-settings-title" className="display" style={{ fontSize: 23 }}>{t('shelemSettings')}</h2>
        <IconButton icon="close" label={t('close')} onClick={onClose} />
      </div>
      <div className="shelem-settings__group">
        <button type="button" role="switch" aria-checked={feedback.sound} onClick={() => void feedback.toggleSound()}><span>{t('shelemGameSound')}</span><Switch on={feedback.sound} /></button>
        <button type="button" role="switch" aria-checked={feedback.vibration} onClick={feedback.toggleVibration}><span>{t('shelemGameVibration')}</span><Switch on={feedback.vibration} /></button>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <b>{t('shelemVoiceSettings')}</b>
        <VoicePanel room={room} {...voice} />
      </div>
    </section>
  </div>;
}

function orderHand(cards: string[], trump: ShelemSuit | null) {
  const suits = [...SUITS].sort((a, b) => Number(b.key === trump) - Number(a.key === trump)).map(s => s.key[0].toUpperCase());
  return suits.flatMap(suit => cards.filter(card => card.at(-1) === suit));
}

function VoicePanel({ room, voiceOn, micMuted, localMutes, onVoice, onMic, onPlayerMute }: { room: ShelemRoom; voiceOn: boolean; micMuted: boolean; localMutes: Set<number>; onVoice(): void; onMic(): void; onPlayerMute(uid: number): void }) {
  const { t } = useLanguage();
  if (!voiceOn) return <button className="btn btn--outline" onClick={onVoice}><Icon name="mic" size={18} /> {t("shelemJoinVoice")}</button>;
  const people = room.players.filter((p) => !p.isYou && !p.isBot);
  return <div className="shelem-voice">
    <button className={micMuted ? "is-muted" : ""} onClick={onMic}><Icon name={micMuted ? "micOff" : "mic"} size={18} />{micMuted ? t("shelemUnmuteMic") : t("shelemMuteMic")}</button>
    <div className="shelem-voice-peers">{people.map((p) => <button key={p.seat} onClick={() => onPlayerMute(p.voiceUid)} className={localMutes.has(p.voiceUid) ? "is-muted" : ""}><Icon name={localMutes.has(p.voiceUid) ? "mute" : "mic"} size={16} />{localMutes.has(p.voiceUid) ? t("shelemUnmutePlayer", { name: p.name }) : t("shelemMutePlayer", { name: p.name })}</button>)}</div>
  </div>;
}

function Scoreboard({ room, onClose }: { room: ShelemRoom; onClose(): void }) {
  const { t, n } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  const team = (room.yourSeat ?? 0) % 2;
  return <dialog ref={dialog} className="shelem-scoreboard" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header><h2>{t('shelemScoreboard')}</h2><IconButton icon="close" label={t('close')} onClick={onClose} /></header>
    <p>{t('shelemScoreTarget', { n: room.winningScore })}</p>
    <div className="shelem-score-teams">{[team, 1-team].map(side => <div className={side === team ? 'team-blue' : 'team-red'} key={side}>{room.players.filter(p => p.seat%2 === side).map(p => <b key={p.seat} dir="auto">{p.isYou ? t('you') : p.name}</b>)}</div>)}</div>
    <div className="shelem-score-scroll"><table><thead><tr>{['shelemRoundLabel','shelemContract','shelemUs','shelemThem','shelemTotalUs','shelemTotalThem'].map(key => <th key={key}>{t(key as 'shelemContract')}</th>)}</tr></thead><tbody>
      {room.scoreHistory.map(row => <tr key={row.round}><td>{n(row.round)}</td><td>{n(row.bid)}</td><td>{n(row.delta[team])}</td><td>{n(row.delta[1-team])}</td><td>{n(row.totals[team])}</td><td>{n(row.totals[1-team])}</td></tr>)}
      {!room.scoreHistory.length && <tr><td colSpan={6}>{t('shelemNoRounds')}</td></tr>}
    </tbody></table></div>
    <footer><div><b className="team-blue">{n(room.teamScores[team])}</b><b className="team-red">{n(room.teamScores[1-team])}</b></div><strong>{t('shelemScoreDifference', { n: Math.abs(room.teamScores[0]-room.teamScores[1]) })}</strong></footer>
  </dialog>;
}

function RoundResult({ room, onNext }: { room: ShelemRoom; onNext(): void }) { const { t, n } = useLanguage(); return <div className="shelem-result"><div><small>{t("shelemTeamA")}</small><b>{n(room.roundPoints[0])}</b><span className={room.roundDelta[0] >= 0 ? "is-positive" : "is-negative"}>{room.roundDelta[0] >= 0 ? "+" : ""}{n(room.roundDelta[0])}</span></div><div><small>{t("shelemTeamB")}</small><b>{n(room.roundPoints[1])}</b><span className={room.roundDelta[1] >= 0 ? "is-positive" : "is-negative"}>{room.roundDelta[1] >= 0 ? "+" : ""}{n(room.roundDelta[1])}</span></div>{room.youAreHost && <button className="btn" onClick={onNext}>{t("shelemNextRound")}</button>} {!room.youAreHost && <small>{t("shelemWaitingHost")}</small>}</div>; }
function FinalResult({ room }: { room: ShelemRoom }) { const { t, n } = useLanguage(); const won = room.yourSeat != null && room.winnerTeam === room.yourSeat % 2; return <div className="shelem-final"><span>{won ? "♛" : "♜"}</span><b>{won ? t("shelemYouWon") : t("shelemYouLost")}</b><small>{n(room.teamScores[0])} — {n(room.teamScores[1])}</small></div>; }
function message(error: unknown, fallback: string) { return error instanceof ApiError ? error.message : fallback; }
