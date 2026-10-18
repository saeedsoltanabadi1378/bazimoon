import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useSession } from "../../app/session";
import { esmApi, type EsmRoom } from "../../api/esmfamil";
import { Body, IconButton, Screen, TopBar } from "../../ui/components";
import { Icon } from "../../ui/Icon";
import { formatClock } from "../../lib/format";
import { haptic } from "../../lib/haptics";
import { shareToTelegram } from "../../lib/telegram";
import { botLink } from "../../lib/links";
import { categoryLabel, startsWithLetter } from "./logic";
import { EsmLetterChip } from "./parts";

const ACCENT = "#F6C377";
const INK = "#2A1A06";
const COLORS = ["#F6C377", "#5FD0BE", "#B79CF2", "#8FA8FF", "#F2A7C3", "#9ED98C", "#F08A7A", "#7FC8E8"];

const initial = (name: string) => Array.from(name)[0]?.toUpperCase() ?? "?";

/** Polls a room every `ms`, keeping the latest view and when it arrived (for local countdowns). */
function useRoom(code: string, ms: number, onFirst?: (api: ReturnType<typeof esmApi>) => Promise<EsmRoom>) {
  const session = useSession();
  const api = useMemo(() => esmApi(session.api), [session.api]);
  const [room, setRoomState] = useState<EsmRoom | null>(null);
  const [error, setError] = useState(false);
  const receivedAt = useRef(Date.now());
  const version = useRef(-1);
  const setRoom = useCallback((r: EsmRoom) => {
    receivedAt.current = Date.now();
    version.current = r.version;
    setRoomState(r);
    setError(false);
  }, []);

  useEffect(() => {
    let alive = true;
    let timer = 0;
    const load = async (first: boolean) => {
      try {
        const r = first && onFirst ? await onFirst(api) : await api.get(code);
        if (alive) setRoom(r);
      } catch {
        if (alive) setError(true);
      }
      if (alive) timer = window.setTimeout(() => void load(false), ms);
    };
    void load(true);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // onFirst only matters for the first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, code, ms, setRoom]);

  /** Runs an action and shows its result straight away. */
  const act = useCallback(async (fn: (a: ReturnType<typeof esmApi>) => Promise<EsmRoom>) => {
    try {
      setRoom(await fn(api));
      return true;
    } catch {
      setError(true);
      haptic.error();
      return false;
    }
  }, [api, setRoom]);

  return { room, error, act, receivedAt };
}

/** Milliseconds left on the room's clock, counting down locally between polls. */
function useClock(room: EsmRoom | null, receivedAt: React.MutableRefObject<number>) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  return room ? Math.max(0, room.msLeft - (now - receivedAt.current)) : 0;
}

function settingsChips(room: EsmRoom, t: ReturnType<typeof useLanguage>["t"], n: ReturnType<typeof useLanguage>["n"]) {
  return [
    t("esmCategoriesN", { count: n(room.settings.categories.length) }),
    t("esmRoundsN", { count: n(room.settings.rounds) }),
    t("secondsShort", { count: n(room.settings.seconds) }),
    room.settings.letters === "fa" ? t("esmLettersFa") : t("esmLettersEn"),
    t("esmStopGrace"),
  ];
}

export function EsmFamilLobby({ code }: { code: string }) {
  const { t, n } = useLanguage();
  const { back, push, replace } = useNavigation();
  const { room, error, act } = useRoom(code, 1500, (api) => api.join(code));
  const [copied, setCopied] = useState(false);
  const link = botLink(`ef_${code.replace("EF-", "")}`);

  useEffect(() => {
    if (room && room.phase !== "lobby") replace({ name: "game", game: "esmfamil", screen: "online", params: { code: room.code } });
  }, [room, replace]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      haptic.success();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function leave() {
    await act((a) => a.leave(code));
    back();
  }

  const me = room?.players.find((p) => p.isYou);
  const readyCount = room?.players.filter((p) => p.ready).length ?? 0;

  return (
    <Screen theme="night">
      <TopBar onBack={() => void leave()} backLabel={t("backToGame", { game: t("gameEsmFamil") })} title={t("esmRoomTitle")} subtitle={t("esmRoomSub")} titleSize={24} />
      <Body style={{ gap: 16, paddingBottom: 20 }}>
        {error && !room && <div className="card small" style={{ color: "#F08A7A" }} role="alert">{t("esmRoomMissing")}</div>}
        {room && (
          <>
            <section className="stack" style={{ gap: 10, padding: 16, borderRadius: 20, background: "#241A0E" }}>
              <div className="row row--between">
                <span className="small" style={{ color: "var(--text-2)" }}>{t("esmRoomCode")}</span>
                <span className="display" dir="ltr" style={{ fontSize: 26, fontWeight: 800, letterSpacing: 3, color: ACCENT }}>{room.code}</span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn btn--md" style={{ flex: 1.4, background: ACCENT, color: INK }} onClick={() => shareToTelegram(link, t("esmInviteText", { code: room.code }))}>
                  {t("esmInvite")}
                </button>
                <button type="button" className="btn btn--md btn--outline" style={{ flex: 1, borderColor: "#4A3A22" }} onClick={() => void copy()}>
                  <span aria-live="polite">{copied ? t("linkCopied") : t("copyLink")}</span>
                </button>
              </div>
            </section>

            <section className="stack" style={{ gap: 8 }}>
              <div className="row row--between row--baseline">
                <h2 className="h2">{t("partyPlayers")}</h2>
                <span className="tiny muted">{t("esmReadyCount", { n: n(readyCount), total: n(room.players.length) })}</span>
              </div>
              {room.players.map((p, i) => (
                <div key={p.seat} className="row" style={{ gap: 12, minHeight: 56, padding: "8px 12px", borderRadius: 14, background: "var(--surface)" }}>
                  <span className="avatar" aria-hidden="true" style={{ width: 34, height: 34, fontSize: 14, background: COLORS[i % COLORS.length], color: "#0B0D1A" }}>{initial(p.name)}</span>
                  <span className="grow stack" style={{ gap: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{p.isYou ? t("youName", { name: p.name }) : p.name}</span>
                    {p.isHost && <span className="tiny muted">{t("esmHost")}</span>}
                  </span>
                  <span className="tag" style={{ background: p.ready ? "#13302C" : "#1E2138", color: p.ready ? "#5FD0BE" : "var(--muted)", fontSize: 12 }}>
                    {p.ready ? t("esmReady") : t("esmWaiting")}
                  </span>
                </div>
              ))}
              <div className="small muted" style={{ textAlign: "center", padding: 14, borderRadius: 14, border: "1.5px dashed #2E3252" }}>{t("esmWaitingForMore")}</div>
            </section>

            <section className="stack" style={{ gap: 8, padding: 14, borderRadius: 16, background: "var(--surface)" }}>
              <div className="row row--between">
                <span style={{ fontSize: 15, fontWeight: 600 }}>{t("esmGameSettings")}</span>
                {room.youAreHost && (
                  <button type="button" onClick={() => push({ name: "game", game: "esmfamil", screen: "setup", params: { way: "online", room: room.code } })} style={{ border: 0, background: "transparent", color: ACCENT, fontSize: 14, fontWeight: 600, minHeight: 40, cursor: "pointer" }}>
                    {t("esmEdit")}
                  </button>
                )}
              </div>
              <div className="row row--wrap" style={{ gap: 6 }}>
                {settingsChips(room, t, n).map((c) => <span key={c} className="tag" style={{ background: "#1E2138", color: "var(--text-2)", fontSize: 12, padding: "5px 10px" }}>{c}</span>)}
              </div>
              <div className="tiny muted">{room.youAreHost ? t("esmHostNote") : t("esmGuestNote")}</div>
            </section>
          </>
        )}
      </Body>
      {room && (
        <div className="screen__bar">
          {room.youAreHost ? (
            <>
              <button type="button" className="btn" disabled={readyCount < 2} style={{ background: readyCount < 2 ? "var(--surface-2)" : ACCENT, color: readyCount < 2 ? "var(--faint)" : INK }} onClick={() => void act((a) => a.start(code))}>
                {t("esmStart")}
              </button>
              <div className="tiny muted" style={{ textAlign: "center", paddingTop: 4 }}>{t("esmStartHint")}</div>
            </>
          ) : (
            <>
              <button type="button" className="btn" style={{ background: me?.ready ? "#13302C" : ACCENT, color: me?.ready ? "#5FD0BE" : INK }} onClick={() => void act((a) => a.ready(code, !me?.ready))}>
                {me?.ready ? t("esmImReadyOn") : t("esmImReady")}
              </button>
              <div className="tiny muted" style={{ textAlign: "center", paddingTop: 4 }}>{t("esmGuestHint")}</div>
            </>
          )}
        </div>
      )}
    </Screen>
  );
}

export function EsmFamilOnline({ code }: { code: string }) {
  const { t, n, language } = useLanguage();
  const { back, replace } = useNavigation();
  const { room, act, receivedAt } = useRoom(code, 1000);
  const left = useClock(room, receivedAt);
  const [answers, setAnswers] = useState<string[] | null>(null);
  const [cat, setCat] = useState(0);
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const roundKey = room ? `${room.round}-${room.letter}` : "";
  const lastRound = useRef("");
  const saveTimer = useRef(0);

  // A new round starts with empty answers and no votes.
  useEffect(() => {
    if (!room || room.phase === "lobby") return;
    if (lastRound.current !== roundKey) {
      lastRound.current = roundKey;
      setAnswers(room.yourAnswers ?? room.settings.categories.map(() => ""));
      setCat(0);
      setVotes({});
    }
  }, [room, roundKey]);

  useEffect(() => {
    if (room?.phase === "finished") {
      const ranked = [...room.players].sort((a, b) => b.total - a.total);
      replace({
        name: "game", game: "esmfamil", screen: "result",
        params: { kind: "online", rounds: room.settings.rounds, standings: JSON.stringify(ranked.map((p) => [p.name, p.total, p.isYou])) },
      });
    }
  }, [room, replace]);

  if (!room || !answers) {
    return (
      <Screen theme="night">
        <TopBar onBack={back} backLabel={t("backToGame", { game: t("gameEsmFamil") })} title={t("gameEsmFamil")} />
        <Body><div className="small muted">{t("esmConnecting")}</div></Body>
      </Screen>
    );
  }

  const cats = room.settings.categories;
  const letter = room.letter ?? "";
  const me = room.players.find((p) => p.isYou);
  const header = (
    <div className="row row--between" style={{ padding: "14px 16px 8px" }}>
      <IconButton icon="back" label={t("esmBackToRoom")} onClick={() => void act((a) => a.leave(code)).then(back)} />
      <div style={{ textAlign: "center" }}>
        <div className="display" style={{ fontSize: 22, fontWeight: 700 }}>{t("gameEsmFamil")}</div>
        <div className="tiny muted">{t("esmRoundOnline", { round: n(room.round + 1), rounds: n(room.settings.rounds) })}</div>
      </div>
      <EsmLetterChip letter={letter} />
    </div>
  );

  function edit(c: number, value: string) {
    const next = answers!.map((a, i) => (i === c ? value : a));
    setAnswers(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void act((a) => a.answers(code, next)), 600);
  }

  if (room.phase === "writing") {
    const filled = answers.filter((a) => a.trim() !== "").length;
    const full = filled === cats.length;
    const low = left <= 10_000;
    const stoppedByOther = room.stoppedBy && room.stoppedBy !== me?.name;
    return (
      <Screen theme="night">
        {header}
        <div className="row" style={{ gap: 6, padding: "0 16px 8px", overflowX: "auto" }}>
          {room.players.filter((p) => !p.isYou && !p.left).map((p) => (
            <span key={p.seat} className="row" style={{ flex: "none", gap: 6, paddingBlock: 4, paddingInlineStart: 4, paddingInlineEnd: 10, borderRadius: 999, background: "var(--surface)" }}>
              <span className="avatar" aria-hidden="true" style={{ width: 24, height: 24, fontSize: 11, background: COLORS[room.players.indexOf(p) % COLORS.length], color: "#0B0D1A" }}>{initial(p.name)}</span>
              <span className="tiny" style={{ fontWeight: 600, color: p.filled === cats.length ? "#5FD0BE" : "var(--text-2)" }}>{`${n(p.filled)}/${n(cats.length)}`}</span>
            </span>
          ))}
        </div>
        <div className="row row--between" style={{ padding: "0 16px 8px" }}>
          <span className="small" style={{ color: "var(--text-2)" }}>{t("esmFilledOf", { n: n(filled), total: n(cats.length) })}</span>
          <span className="num" aria-live={low ? "polite" : "off"} style={{ padding: "6px 12px", borderRadius: 999, background: low ? "#2A1418" : "var(--surface)", color: low ? "#F08A7A" : "var(--text)", fontWeight: 700 }}>
            {formatClock(left, language)}
          </span>
        </div>
        <div className="stack" style={{ flex: 1, gap: 8, padding: "4px 16px 16px", overflowY: "auto" }}>
          {cats.map((c, i) => (
            <label key={c} className="row" style={{ gap: 10, padding: 6, paddingInlineStart: 14, borderRadius: 14, background: "var(--surface)" }}>
              <span style={{ width: 92, flex: "none", fontSize: 14, fontWeight: 600, color: "var(--text-2)" }}>{categoryLabel(c, t)}</span>
              <input
                type="text" value={answers[i]} dir="auto" autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={40}
                placeholder={`${letter}…`} className="text-field" style={{ flex: 1 }} onChange={(e) => edit(i, e.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="screen__bar">
          <button
            type="button" className="btn" disabled={!full || !!room.stoppedBy}
            style={{ background: full && !room.stoppedBy ? "#F08A7A" : "var(--surface-2)", color: full && !room.stoppedBy ? "#2A0F0B" : "var(--faint)", fontSize: 17, fontWeight: 700 }}
            onClick={() => { haptic.success(); void act((a) => a.stop(code, answers)); }}
          >
            {full ? t("esmStop") : t("esmStopLocked")}
          </button>
          <div className="tiny muted" style={{ textAlign: "center", paddingTop: 6 }}>{t("esmStopHint")}</div>
        </div>
        {stoppedByOther && (
          <div role="alert" className="row" style={{ position: "fixed", insetInline: 16, top: 120, zIndex: 5, gap: 14, padding: 16, borderRadius: 20, background: "#F08A7A", color: "#2A0F0B", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
            <span className="display num" style={{ width: 56, height: 56, flex: "none", borderRadius: 999, background: "#2A0F0B", color: "#F08A7A", fontSize: 28, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {n(Math.ceil(left / 1000))}
            </span>
            <span className="stack" style={{ gap: 2 }}>
              <span className="display" style={{ fontSize: 20, fontWeight: 800 }}>{t("esmStoppedBy", { name: room.stoppedBy! })}</span>
              <span className="small">{t("esmStoppedSub")}</span>
            </span>
          </div>
        )}
      </Screen>
    );
  }

  if (room.phase === "judging" && !me?.votesDone) {
    const last = cat === cats.length - 1;
    const voteKey = (seat: number, c: number) => `${seat}-${c}`;
    function cast(seat: number, reject: boolean) {
      setVotes((v) => ({ ...v, [voteKey(seat, cat)]: reject }));
      haptic.tap();
      void act((a) => a.vote(code, [{ seat, category: cat, reject }], false));
    }
    return (
      <Screen theme="night">
        {header}
        <div className="stack" style={{ flex: 1, gap: 12, padding: "4px 16px 16px", overflowY: "auto" }}>
          <div>
            <div className="kicker" style={{ color: ACCENT }}>{t("esmJudgingOf", { n: n(cat + 1), total: n(cats.length) })}</div>
            <h1 className="display" style={{ fontSize: 28 }}>{categoryLabel(cats[cat], t)}</h1>
            <p className="small" style={{ color: "var(--text-2)" }}>{t("esmVoteHint")}</p>
          </div>
          {room.players.map((p, i) => {
            const text = p.answers?.[cat] ?? "";
            const auto = !startsWithLetter(text, letter);
            const tally = room.votes?.find((v) => v.seat === p.seat && v.category === cat);
            const mine = votes[voteKey(p.seat, cat)] ?? tally?.myReject ?? null;
            const voters = room.players.filter((o) => !o.left && o.seat !== p.seat).length;
            const out = auto || (tally?.rejects ?? 0) * 2 > voters;
            return (
              <div key={p.seat} className="row" style={{ gap: 10, minHeight: 60, paddingBlock: 8, paddingInlineStart: 12, paddingInlineEnd: 8, borderRadius: 14, background: "var(--surface)" }}>
                <span className="avatar" aria-hidden="true" style={{ width: 30, height: 30, fontSize: 12, background: COLORS[i % COLORS.length], color: "#0B0D1A" }}>{initial(p.name)}</span>
                <span className="grow stack" style={{ gap: 0, minWidth: 0 }}>
                  <span dir="auto" style={{ fontSize: 16, fontWeight: 600, textDecoration: out && text ? "line-through" : "none", color: out ? "var(--muted)" : "var(--text)" }}>{text || t("esmNoAnswer")}</span>
                  <span className="tiny muted">
                    {p.isYou ? t("esmYourAnswer") : auto ? `${p.name} · ${text ? t("esmWrongLetter") : t("esmEmpty")}` : `${p.name} · ${t("esmVoteTally", { y: n(tally?.accepts ?? 0), n: n(tally?.rejects ?? 0) })}`}
                  </span>
                </span>
                {!p.isYou && !auto && (
                  <span className="row" role="group" aria-label={t("esmJudge", { name: p.name })} style={{ gap: 6 }}>
                    <button type="button" aria-pressed={mine === false} aria-label={t("esmAccept", { name: p.name })} onClick={() => cast(p.seat, false)} className="icon-btn" style={{ background: mine === false ? "#13302C" : "#1E2138", color: mine === false ? "#5FD0BE" : "var(--muted)" }}>
                      <Icon name="check" size={20} />
                    </button>
                    <button type="button" aria-pressed={mine === true} aria-label={t("esmReject", { name: p.name })} onClick={() => cast(p.seat, true)} className="icon-btn" style={{ background: mine === true ? "#2A1418" : "#1E2138", color: mine === true ? "#F08A7A" : "var(--muted)" }}>
                      <Icon name="close" size={20} />
                    </button>
                  </span>
                )}
                {p.isYou && <span className="tag" style={{ background: "#1E2138", color: "var(--muted)" }}>{t("esmYourAnswer")}</span>}
              </div>
            );
          })}
        </div>
        <div className="screen__bar screen__bar--row" style={{ gap: 8 }}>
          <button type="button" className="btn btn--outline" disabled={cat === 0} style={{ flex: 1 }} onClick={() => setCat(cat - 1)}>{t("esmPrevious")}</button>
          <button type="button" className="btn" style={{ flex: 1.4, background: ACCENT, color: INK }} onClick={() => (last ? void act((a) => a.vote(code, [], true)) : setCat(cat + 1))}>
            {last ? t("esmSendVotes") : t("esmNextCategory")}
          </button>
        </div>
      </Screen>
    );
  }

  if (room.phase === "judging") {
    const waitingFor = room.players.filter((p) => !p.left && !p.votesDone);
    return (
      <Screen theme="night">
        {header}
        <div className="stack center" style={{ flex: 1, justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
          <div className="row" style={{ gap: 8 }}>
            {room.players.filter((p) => !p.left).map((p, i) => (
              <span key={p.seat} className="avatar" aria-hidden="true" style={{ width: 44, height: 44, fontSize: 16, background: COLORS[i % COLORS.length], color: "#0B0D1A", opacity: p.votesDone ? 1 : 0.35 }}>{initial(p.name)}</span>
            ))}
          </div>
          <h1 className="display" style={{ fontSize: 26 }}>{t("esmWaitingVotes")}</h1>
          <p className="small" style={{ color: "var(--text-2)" }}>{t("esmStillJudging", { names: waitingFor.map((p) => p.name).join(language === "fa" ? "، " : ", ") })}</p>
          <p className="tiny muted">{t("esmJudgingEndsIn", { time: formatClock(left, language) })}</p>
        </div>
      </Screen>
    );
  }

  // Scores between rounds.
  const ranked = [...room.players].sort((a, b) => b.total - a.total);
  const lastRoundNow = room.round + 1 >= room.settings.rounds;
  return (
    <Screen theme="night">
      {header}
      <div className="stack" style={{ flex: 1, gap: 10, padding: "4px 16px 16px", overflowY: "auto" }}>
        <h1 className="display" style={{ fontSize: 28 }}>{t("esmScoresAfter", { round: n(room.round + 1) })}</h1>
        {ranked.map((p, i) => (
          <div key={p.seat} className="row" style={{ gap: 12, minHeight: 56, padding: "8px 14px", borderRadius: 14, background: p.isYou ? "#1E2138" : i === 0 ? "#2A2113" : "var(--surface)" }}>
            <span className="num" style={{ width: 22, color: i === 0 ? ACCENT : "var(--muted)", fontWeight: 700 }}>{n(i + 1)}</span>
            <span className="grow" style={{ fontSize: 15, fontWeight: 600 }}>{p.isYou ? t("youName", { name: p.name }) : p.name}</span>
            <span className="tiny" style={{ color: "#5FD0BE" }}>+{n(p.roundPoints)}</span>
            <span className="num" style={{ minWidth: 40, textAlign: "end", fontSize: 18, fontWeight: 700 }}>{n(p.total)}</span>
          </div>
        ))}
        <div className="tiny muted">{lastRoundNow ? t("esmFinalIn", { time: formatClock(left, language) }) : t("esmNextIn", { time: formatClock(left, language) })}</div>
      </div>
      {room.youAreHost && (
        <div className="screen__bar">
          <button type="button" className="btn" style={{ background: ACCENT, color: INK }} onClick={() => void act((a) => a.next(code))}>
            {lastRoundNow ? t("esmFinalResults") : t("esmNextRound")}
          </button>
        </div>
      )}
    </Screen>
  );
}
