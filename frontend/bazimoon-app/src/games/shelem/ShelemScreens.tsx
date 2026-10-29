import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useSession } from "../../app/session";
import { shelemApi, type ShelemRoom, type ShelemSuit } from "../../api/shelem";
import { ApiError } from "../../api/client";
import { Body, IconButton, Screen, TopBar } from "../../ui/components";
import { Icon } from "../../ui/Icon";
import { VoiceSession } from "../../lib/voiceSession";
import { appLink } from "../../lib/links";
import { shareLink } from "../../lib/platform";
import { haptic } from "../../lib/haptics";
import { CardBackFan, PlayingCard } from "../cards/PlayingCard";

const ACCENT = "#E2B86B";
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
        <div className="row" style={{ gap: 8 }}><input id="shelem-code" className="text-field grow" dir="ltr" placeholder="SH-7K2M" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /><button className="btn btn--outline btn--auto" disabled={busy}>{t("shelemJoin")}</button></div>
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
  const [bid, setBid] = useState(100);
  const [voiceOn, setVoiceOn] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [localMutes, setLocalMutes] = useState<Set<number>>(() => new Set());
  const voice = useRef(new VoiceSession());
  const version = useRef(-1);
  const [dealtRound, setDealtRound] = useState(0);
  const round = room?.round ?? 0;
  useEffect(() => {
    if (!round) return;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 3100;
    const timer = window.setTimeout(() => setDealtRound(round), duration);
    return () => window.clearTimeout(timer);
  }, [round]);

  const load = useCallback(async () => {
    try {
      const next = await api.get(code);
      if (next.version > version.current) { version.current = next.version; setRoom(next); }
    } catch (e) { setError(message(e, t("shelemConnectionLost"))); }
  }, [api, code, t]);

  useEffect(() => { void load(); const id = window.setInterval(() => void load(), 550); return () => window.clearInterval(id); }, [load]);
  useEffect(() => () => { void voice.current.leave(); }, []);
  useEffect(() => { setSelected([]); }, [room?.phase, room?.round]);
  useEffect(() => { if (room?.highestBid != null) setBid(Math.min(165, room.highestBid + 5)); }, [room?.highestBid]);

  async function act(fn: () => Promise<ShelemRoom>) {
    if (busy) return;
    setBusy(true); setError(null);
    try { const next = await fn(); version.current = next.version; setRoom(next); haptic.tap(); }
    catch (e) { setError(message(e, t("shelemActionFailed"))); haptic.error(); }
    finally { setBusy(false); }
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

  if (!room) return <Screen theme="night"><TopBar onBack={back} title={t("gameShelem")} /><Body><div className="skeleton" style={{ height: 420 }} /></Body></Screen>;
  const me = room.players.find((p) => p.isYou);
  const dealing = room.phase === 'bidding' && dealtRound !== room.round;
  const myTurn = room.yourSeat === room.turnSeat;
  const currentPlayer = room.players.find((p) => p.seat === room.turnSeat);
  const minBid = Math.max(100, (room.highestBid ?? 95) + 5);
  const team = (room.yourSeat ?? 0) % 2;
  const phaseTitle = t(`shelemPhase_${room.phase}` as "shelemPhase_lobby");

  return <Screen theme="night" label={t("gameShelem")}>
    <header className="shelem-topbar">
      <IconButton icon="back" label={t("back")} onClick={back} />
      <div className="grow"><div className="kicker">{phaseTitle}</div><div className="display" style={{ fontSize: 20 }}>{room.phase === "lobby" ? room.code : t("shelemRoundN", { n: room.round })}</div></div>
      <div className="shelem-score"><small>{t("shelemMatchScore")}</small><span>{t("shelemUs")} <b>{n(room.teamScores[team])}</b></span><span>{t("shelemThem")} <b>{n(room.teamScores[1 - team])}</b></span>{room.phase === 'playing' && <small>{t("shelemCapturedScore", { us: room.roundPoints[team], them: room.roundPoints[1-team] })}</small>}</div>
    </header>

    {room.phase === "lobby" ? <Lobby room={room} busy={busy} voiceOn={voiceOn} micMuted={micMuted} localMutes={localMutes} onVoice={() => void joinVoice()} onMic={() => void toggleMic()} onPlayerMute={togglePlayer}
      onReady={() => void act(() => api.ready(code, !me?.ready))} onStart={(fill) => void act(() => api.start(code, fill))} /> :
      <GameTable room={room} voiceOn={voiceOn} micMuted={micMuted} localMutes={localMutes} onVoice={() => void joinVoice()} onMic={() => void toggleMic()} onPlayerMute={togglePlayer} />}

    {error && <div className="shelem-toast" role="alert">{error}</div>}
    {dealing && <DealSequence room={room} />}

    <div className="shelem-actions" hidden={dealing}>
      {room.phase === 'discard' && myTurn && <div className="shelem-zamin" dir="ltr" aria-label={t('shelemChooseFour')}><small>{t('shelemDropFour')}</small>{Array.from({length:4},(_,i)=>selected[i] ? <PlayingCard key={selected[i]} code={selected[i]} size="table" dropTarget=".shelem-hand" onClick={busy ? undefined : ()=>setSelected(old=>old.filter(c=>c!==selected[i]))} /> : <span className="shelem-zamin-slot" key={i}>{n(i+1)}</span>)}</div>}
      {room.phase === "bidding" && (myTurn ? <div className="stack" style={{ gap: 10 }}>
          <div className="row row--between"><b>{t("shelemYourBid")}</b><output className="display" style={{ fontSize: 24, color: ACCENT }}>{n(bid)}</output></div>
          <div className="shelem-bid-values" role="group" aria-label={t("shelemYourBid")}>{Array.from({length:14},(_,i)=>100+i*5).map(value=><button type="button" key={value} disabled={value<minBid || busy} aria-pressed={value===Math.max(minBid,bid)} onClick={()=>setBid(value)}>{n(value)}</button>)}</div>
          <div className="row" style={{ gap: 8 }}><button className="btn btn--outline" disabled={busy} onClick={() => void act(() => api.bid(code, null))}>{t("shelemPass")}</button><button className="btn" disabled={busy || minBid > 165} onClick={() => void act(() => api.bid(code, Math.max(minBid, bid)))}>{t("shelemBidN", { n: Math.max(minBid, bid) })}</button><button className="btn shelem-slam" disabled={busy} onClick={() => void act(() => api.bid(code, 165, true))}>{t("gameShelem")}</button></div>
        </div> : <div className="shelem-thinking"><span /><span /><span /> {t("shelemWaitingBid", { name: currentPlayer?.name ?? "" })}</div>)}
      {room.phase === "discard" && myTurn && <div className="row row--between"><span><b>{t("shelemChooseFour")}</b><small>{t("shelemChosen", { n: selected.length })}</small></span><button className="btn btn--auto" disabled={busy || selected.length !== 4} onClick={() => void act(() => api.discard(code, selected))}>{t("shelemDiscard")}</button></div>}
      {room.phase === "trump" && myTurn && <div className="stack stack--sm"><b>{t("shelemChooseTrump")}</b><div className="shelem-suits">{SUITS.map((s) => <button key={s.key} className={s.red ? "is-red" : ""} onClick={() => void act(() => api.trump(code, s.key))}>{s.symbol}</button>)}</div></div>}
      {room.phase === "playing" && myTurn && <div className="tiny" style={{ textAlign: "center", color: ACCENT }}>{t("shelemYourTurn")}</div>}
      {room.phase === "roundresult" && <RoundResult room={room} onNext={() => void act(() => api.next(code))} />}
      {room.phase === "finished" && <FinalResult room={room} />}
    </div>

    {room.phase !== "lobby" && room.phase !== "roundresult" && room.phase !== "finished" && <div className="shelem-hand" dir="ltr" aria-busy={dealing}>
      {room.hand.filter(card=>room.phase !== 'discard' || !selected.includes(card)).map((card, i) => {
        const selectable = room.phase === "discard" && myTurn;
        const playable = room.phase !== "playing" || room.legalCards.includes(card);
        return <PlayingCard key={`${room.round}-${card}`} code={card} faceDown={dealing} dropTarget={selectable ? '.shelem-zamin' : '.shelem-table'} playable={playable} onClick={busy || dealing ? undefined : selectable ? () => setSelected((old) => old.length < 4 && !old.includes(card) ? [...old, card] : old) : room.phase === "playing" && myTurn && playable ? () => void act(() => api.play(code, card)) : undefined} style={{ zIndex: i, animationDelay: `${i*35}ms` }} />;
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

function Lobby({ room, busy, voiceOn, micMuted, localMutes, onVoice, onMic, onPlayerMute, onReady, onStart }: {
  room: ShelemRoom; busy: boolean; voiceOn: boolean; micMuted: boolean; localMutes: Set<number>; onVoice(): void; onMic(): void; onPlayerMute(uid: number): void; onReady(): void; onStart(fill: boolean): void;
}) {
  const { t } = useLanguage();
  const me = room.players.find((p) => p.isYou);
  const invite = async () => void await shareLink(appLink(`sh_${room.code.replace("SH-", "")}`), t("shelemInviteText", { code: room.code }));
  return <Body style={{ gap: 16, paddingBottom: 180 }}>
    <section className="shelem-room-code"><span><small>{t("shelemRoomCode")}</small><b dir="ltr">{room.code}</b></span><button className="btn btn--outline btn--auto" onClick={() => void invite()}><Icon name="share" size={17} /> {t("share")}</button></section>
    <div className="shelem-lobby-seats">{[0, 1, 2, 3].map((seat) => {
      const p = room.players.find((x) => x.seat === seat);
      return <div className={`shelem-lobby-seat${p?.ready ? " is-ready" : ""}`} key={seat}><span className="shelem-seat-avatar">{p?.isBot ? "✦" : p?.name?.[0]?.toUpperCase() ?? "+"}</span><b>{p?.name ?? t("shelemOpenSeat")}</b><small>{seat % 2 === 0 ? t("shelemTeamA") : t("shelemTeamB")}{p?.isBot ? ` · ${t("shelemBot")}` : ""}</small>{p?.ready && <Icon name="check" size={16} />}</div>;
    })}</div>
    <VoicePanel room={room} voiceOn={voiceOn} micMuted={micMuted} localMutes={localMutes} onVoice={onVoice} onMic={onMic} onPlayerMute={onPlayerMute} />
    <div className="card small muted"><Icon name="shield" size={18} /> {t("shelemFairBots")}</div>
    <div className="screen__bar screen__bar--row">
      {!room.youAreHost && <button className={`btn${me?.ready ? " btn--outline" : ""}`} disabled={busy} onClick={onReady}>{me?.ready ? t("shelemNotReady") : t("shelemReady")}</button>}
      {room.youAreHost && <><button className="btn btn--outline" disabled={busy} onClick={() => onStart(false)}>{t("shelemStartFour")}</button><button className="btn" disabled={busy} onClick={() => onStart(true)}>{t("shelemFillBots")}</button></>}
    </div>
  </Body>;
}

function GameTable({ room, voiceOn, micMuted, localMutes, onVoice, onMic, onPlayerMute }: { room: ShelemRoom; voiceOn: boolean; micMuted: boolean; localMutes: Set<number>; onVoice(): void; onMic(): void; onPlayerMute(uid: number): void }) {
  const { t, n } = useLanguage();
  const own = room.yourSeat ?? 0;
  const biddingWinner = room.phase !== 'bidding' && room.phase !== 'lobby'
    ? room.players.find(player => player.seat === room.declarerSeat) : undefined;
  const at = (delta: number) => room.players.find((p) => p.seat === (own + delta) % 4);
  const spots = [{ delta: 2, pos: "top" }, { delta: 1, pos: "left" }, { delta: 3, pos: "right" }];
  return <div className="shelem-table">
    <div className="shelem-felt-glow" />
    {spots.map(({ delta, pos }) => { const p = at(delta); if (!p) return null; return <div className={`shelem-player shelem-player--${pos}${p.seat === room.turnSeat ? " is-turn" : ""}`} key={p.seat}><span>{p.isBot ? "✦" : p.name[0]}</span><b>{p.name}</b><small>{n(p.cards)}</small><CardBackFan count={p.cards} vertical={pos !== "top"} /></div>; })}
    <div className="shelem-contract"><span>{room.highestBid ? n(room.highestBid) : "—"}</span>{room.trump && <b className={room.trump === "hearts" || room.trump === "diamonds" ? "is-red" : ""}>{SUITS.find((s) => s.key === room.trump)?.symbol}</b>}<small>{t("shelemContract")}</small></div>
    {biddingWinner && <div className="shelem-bidding-winner" role="status"><small>{t('shelemBiddingWinner')}</small><strong dir="auto">{biddingWinner.isYou ? t('you') : biddingWinner.name}</strong></div>}
    <div className="shelem-trick" dir="ltr">{room.trick.map((play) => <PlayingCard key={`${play.seat}-${play.card}`} code={play.card} size="table" style={{ gridArea: play.seat === own ? "south" : play.seat === (own + 1) % 4 ? "west" : play.seat === (own + 2) % 4 ? "north" : "east" }} />)}{room.trick.length === 0 && <span className="shelem-table-mark">✦</span>}</div>
    <div className={`shelem-player shelem-player--bottom${room.turnSeat === own ? " is-turn" : ""}`}><span>{at(0)?.name[0]}</span><b>{t("you")}</b></div>
    <div className="shelem-voice-float"><VoicePanel compact room={room} voiceOn={voiceOn} micMuted={micMuted} localMutes={localMutes} onVoice={onVoice} onMic={onMic} onPlayerMute={onPlayerMute} /></div>
  </div>;
}

function VoicePanel({ room, voiceOn, micMuted, localMutes, onVoice, onMic, onPlayerMute, compact = false }: { room: ShelemRoom; voiceOn: boolean; micMuted: boolean; localMutes: Set<number>; onVoice(): void; onMic(): void; onPlayerMute(uid: number): void; compact?: boolean }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  if (!voiceOn) return <button className={compact ? "shelem-voice-button" : "btn btn--outline"} onClick={onVoice}><Icon name="mic" size={18} /> {t("shelemJoinVoice")}</button>;
  const people = room.players.filter((p) => !p.isYou && !p.isBot);
  return <div className={`shelem-voice${compact ? " is-compact" : ""}`}>
    <button className={micMuted ? "is-muted" : ""} onClick={onMic}><Icon name={micMuted ? "micOff" : "mic"} size={18} />{!compact && (micMuted ? t("shelemUnmuteMic") : t("shelemMuteMic"))}</button>
    {compact && people.length > 0 && <button aria-label={t("shelemPlayerAudio")} onClick={() => setOpen((value) => !value)}><Icon name="people" size={18} /></button>}
    {(!compact || open) && <div className={compact ? "shelem-voice-menu" : "shelem-voice-peers"}>{people.map((p) => <button key={p.seat} onClick={() => onPlayerMute(p.voiceUid)} className={localMutes.has(p.voiceUid) ? "is-muted" : ""}><Icon name={localMutes.has(p.voiceUid) ? "mute" : "mic"} size={16} />{localMutes.has(p.voiceUid) ? t("shelemUnmutePlayer", { name: p.name }) : t("shelemMutePlayer", { name: p.name })}</button>)}</div>}
  </div>;
}

function RoundResult({ room, onNext }: { room: ShelemRoom; onNext(): void }) { const { t, n } = useLanguage(); return <div className="shelem-result"><div><small>{t("shelemTeamA")}</small><b>{n(room.roundPoints[0])}</b><span className={room.roundDelta[0] >= 0 ? "is-positive" : "is-negative"}>{room.roundDelta[0] >= 0 ? "+" : ""}{n(room.roundDelta[0])}</span></div><div><small>{t("shelemTeamB")}</small><b>{n(room.roundPoints[1])}</b><span className={room.roundDelta[1] >= 0 ? "is-positive" : "is-negative"}>{room.roundDelta[1] >= 0 ? "+" : ""}{n(room.roundDelta[1])}</span></div>{room.youAreHost && <button className="btn" onClick={onNext}>{t("shelemNextRound")}</button>} {!room.youAreHost && <small>{t("shelemWaitingHost")}</small>}</div>; }
function FinalResult({ room }: { room: ShelemRoom }) { const { t, n } = useLanguage(); const won = room.yourSeat != null && room.winnerTeam === room.yourSeat % 2; return <div className="shelem-final"><span>{won ? "♛" : "♜"}</span><b>{won ? t("shelemYouWon") : t("shelemYouLost")}</b><small>{n(room.teamScores[0])} — {n(room.teamScores[1])}</small></div>; }
function message(error: unknown, fallback: string) { return error instanceof ApiError ? error.message : fallback; }
