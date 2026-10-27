import { useEffect, useState, type ReactNode } from "react";
import type { Route } from "../app/router";
import { useNavigation } from "../app/router";
import { useLanguage } from "../i18n/LanguageContext";
import { useHub, useLoad } from "../hub/HubData";
import { useCoupleApi } from "./useCoupleApi";
import { type CoupleDay, type CoupleState } from "../api/couple";
import { ApiError } from "../api/client";
import { Body, IconButton, Screen, Toast } from "../ui/components";
import { LoadingScreen, StateScreen } from "../app/StateScreen";
import { appLink } from "../lib/links";
import { shareLink } from "../lib/platform";
import { formatShortDate } from "../lib/format";
import { readLocal, removeLocal, writeLocal } from "../lib/storage";
import { haptic } from "../lib/haptics";
import { useCountdown } from "../games/zip/ZipScreens";
import { fillName, questionSet } from "./questions";

const PINK = "#F2A7C3";
const PINK_INK = "#2A0F1C";
const ROSE_BG = "#24121C";
const BLUE = "#8FA8FF";

const initial = (name: string | null | undefined) => (name ? Array.from(name)[0]!.toUpperCase() : "?");
function Pair({ me, partner, size = 64, partnerStyle }: { me: string; partner: ReactNode; size?: number; partnerStyle?: React.CSSProperties }) {
  const font = { fontFamily: "var(--font-display)", fontSize: size * 0.4, fontWeight: 800 } as const;
  return (
    <div className="row" style={{ gap: 0 }} aria-hidden="true">
      <span style={{ width: size, height: size, borderRadius: 999, background: "#EDEBF5", color: "#0B0D1A", border: `3px solid ${ROSE_BG}`, display: "flex", alignItems: "center", justifyContent: "center", ...font }}>{me}</span>
      <span style={{ width: size, height: size, marginInlineStart: -size * 0.22, borderRadius: 999, background: PINK, color: "#0B0D1A", border: `3px solid ${ROSE_BG}`, display: "flex", alignItems: "center", justifyContent: "center", ...font, ...partnerStyle }}>{partner}</span>
    </div>
  );
}

function LockNote() {
  const { t } = useLanguage();
  return (
    <div className="row" style={{ gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 14, background: "var(--surface)", fontSize: 13, lineHeight: 1.45, color: "var(--text-2)" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PINK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", marginTop: 1 }}>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <span>{t("couplePrivate")}</span>
    </div>
  );
}

export function CoupleRoute({ route }: { route: Extract<Route, { name: "couple" }> }) {
  switch (route.screen) {
    case "quiz":
      return <CoupleQuiz />;
    case "reveal":
      return <CoupleReveal number={route.number} />;
    case "invite":
      return route.token ? <CoupleJoin token={route.token} /> : <CoupleGate />;
    default:
      return <CoupleGate />;
  }
}

/** Couple home when you're paired up, otherwise the invite screen. */
function CoupleGate() {
  const { t } = useLanguage();
  const capi = useCoupleApi();
  const [reload, setReload] = useState(0);
  const { data, error, loading } = useLoad(() => capi.state(), [capi, reload]);
  if (loading && !data) return <LoadingScreen />;
  if (error || !data) return <StateScreen state={error instanceof ApiError && error.status === 0 ? "offline" : "error"} onPrimary={() => setReload((r) => r + 1)} primaryLabel={t("tryAgain")} />;
  if (data.status === "active") return <CoupleHome state={data} onChange={() => setReload((r) => r + 1)} />;
  return <CoupleInvite state={data} onChange={() => setReload((r) => r + 1)} />;
}

// ---------------------------------------------------------------- invite

function CoupleInvite({ state, onChange }: { state: CoupleState; onChange: () => void }) {
  const { t, n } = useLanguage();
  const { back } = useNavigation();
  const { profile } = useHub();
  const capi = useCoupleApi();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const pending = state.status === "pending" && state.invite;
  const link = pending ? appLink(`couple_${state.invite!.token}`) : "";
  const hoursLeft = pending ? Math.max(1, Math.round((new Date(state.invite!.expiresAt).getTime() - Date.now()) / 3_600_000)) : 0;

  async function invite() {
    setBusy(true);
    try {
      const next = await capi.invite();
      if (next.invite) void shareLink(appLink(`couple_${next.invite.token}`), t("coupleShareText"));
      onChange();
    } catch {
      setToast(t("coupleSomethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await capi.cancelInvite();
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      haptic.success();
      setToast(t("coupleLinkCopied"));
    } catch {
      setToast(link);
    }
  }

  const steps = [
    [t("coupleStep1"), t("coupleStep1Text")],
    [t("coupleStep2"), t("coupleStep2Text")],
    [t("coupleStep3"), t("coupleStep3Text")],
  ];

  return (
    <Screen theme="night">
      <header className="topbar">
        <IconButton icon="back" label={t("backToHome")} onClick={back} />
        <div className="topbar__text">
          <h1 className="display" style={{ fontSize: 24, fontWeight: 800 }}>{t("coupleQuiz")}</h1>
          <div className="tiny muted">{t("coupleTagline")}</div>
        </div>
      </header>
      <Body style={{ gap: 18 }}>
        <section className="stack center" style={{ gap: 14, padding: "24px 16px", borderRadius: 24, background: ROSE_BG, textAlign: "center" }}>
          <Pair
            me={initial(profile?.name)}
            partner={pending ? "?" : "+"}
            partnerStyle={pending ? { background: "#3A2030", color: PINK } : { background: "transparent", color: PINK, borderStyle: "dashed", borderColor: PINK }}
          />
          <h2 className="display" style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15 }}>{pending ? t("coupleInviteSent") : t("couplePlayTogether")}</h2>
          <p style={{ maxWidth: 300, fontSize: 15, lineHeight: 1.5, color: "#D9C9D1" }}>{pending ? t("coupleInviteSentBody") : t("couplePlayTogetherBody")}</p>
        </section>

        {!pending && (
          <section className="stack" style={{ gap: 12 }}>
            <h2 className="h2">{t("coupleHowItWorks")}</h2>
            {steps.map(([title, text], i) => (
              <div key={title} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                <span style={{ width: 28, height: 28, flex: "none", borderRadius: 999, background: "var(--surface)", color: PINK, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{n(i + 1)}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
                  <div className="small" style={{ color: "var(--text-2)" }}>{text}</div>
                </div>
              </div>
            ))}
          </section>
        )}

        {pending && (
          <section className="stack" style={{ gap: 10, padding: 16, borderRadius: 18, background: "var(--surface)" }}>
            <div className="row row--between" style={{ fontSize: 14 }}>
              <span style={{ fontWeight: 600 }}>{t("coupleInviteLink")}</span>
              <span style={{ color: "#F0A83A" }}>{t("coupleExpiresIn", { count: n(hoursLeft) })}</span>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: "var(--bg)", fontSize: 13, color: "var(--text-2)", overflowWrap: "anywhere" }} dir="ltr">{link}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              <button type="button" className="btn btn--outline" style={{ minHeight: 44, fontSize: 14 }} onClick={copy}>{t("coupleCopyLink")}</button>
              <button type="button" className="btn btn--outline" style={{ minHeight: 44, fontSize: 14, color: "#F08A7A" }} disabled={busy} onClick={cancel}>{t("coupleCancelInvite")}</button>
            </div>
          </section>
        )}

        <LockNote />
      </Body>
      <div className="screen__bar">
        {pending ? (
          <button type="button" className="btn btn--outline" style={{ minHeight: 54, borderStyle: "dashed", borderColor: "#5A3448" }} onClick={() => void shareLink(link, t("coupleShareText"))}>
            {t("coupleShareAgain")}
          </button>
        ) : (
          <button type="button" className="btn" style={{ minHeight: 54, background: PINK, color: PINK_INK, fontSize: 16 }} disabled={busy} onClick={invite}>
            {t("coupleInviteCta")}
          </button>
        )}
      </div>
      <Toast message={toast} />
    </Screen>
  );
}

/** Opened from a partner's couple_<token> link: show who invited you and let you join. */
function CoupleJoin({ token }: { token: string }) {
  const { t, language } = useLanguage();
  const { reset, replace } = useNavigation();
  const { profile } = useHub();
  const capi = useCoupleApi();
  const preview = useLoad(() => capi.preview(token), [capi, token]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = preview.data?.status;

  useEffect(() => {
    if (status === "joined" || status === "own") replace({ name: "couple", screen: "home" });
  }, [status, replace]);

  if (preview.loading && !preview.data) return <LoadingScreen />;
  const name = preview.data?.inviterName ?? "?";

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await capi.accept(token);
      haptic.success();
      replace({ name: "couple", screen: "home" });
    } catch (err) {
      setError(err instanceof ApiError && language === "en" ? err.message : t("coupleSomethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  const open = status === "open";
  const title = open ? t("coupleJoinTitle", { name }) : status === "expired" ? t("coupleJoinExpired") : status === "used" ? t("coupleJoinUsed") : t("coupleJoinInvalid");
  const body = open ? t("coupleJoinBody", { name }) : t("coupleJoinAskAgain", { name });

  return (
    <Screen theme="night">
      <header className="topbar">
        <IconButton icon="back" label={t("backToHome")} onClick={() => reset({ name: "home" })} />
        <div className="topbar__text">
          <h1 className="display" style={{ fontSize: 24, fontWeight: 800 }}>{t("coupleQuiz")}</h1>
          <div className="tiny muted">{t("coupleTagline")}</div>
        </div>
      </header>
      <Body style={{ gap: 18 }}>
        <section className="stack center" style={{ gap: 14, padding: "24px 16px", borderRadius: 24, background: ROSE_BG, textAlign: "center" }}>
          <Pair me={initial(name)} partner={initial(profile?.name)} partnerStyle={{ background: "#EDEBF5" }} />
          <h2 className="display" style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15 }}>{title}</h2>
          <p style={{ maxWidth: 300, fontSize: 15, lineHeight: 1.5, color: "#D9C9D1" }}>{body}</p>
        </section>
        {error && <div className="small" role="alert" style={{ color: "#F08A7A", textAlign: "center" }}>{error}</div>}
        <LockNote />
      </Body>
      <div className="screen__bar">
        {open ? (
          <button type="button" className="btn" style={{ minHeight: 54, background: PINK, color: PINK_INK, fontSize: 16 }} disabled={busy} onClick={accept}>
            {t("coupleJoinCta", { name })}
          </button>
        ) : (
          <button type="button" className="btn btn--outline" style={{ minHeight: 54 }} onClick={() => replace({ name: "couple", screen: "home" })}>
            {t("coupleStartOwn")}
          </button>
        )}
      </div>
    </Screen>
  );
}

// ---------------------------------------------------------------- home

function CoupleHome({ state, onChange }: { state: CoupleState; onChange: () => void }) {
  const { t, n, language } = useLanguage();
  const { back, push, reset } = useNavigation();
  const { profile } = useHub();
  const capi = useCoupleApi();
  const countdown = useCountdown();
  const couple = state.couple!;
  const today = couple.today;
  const set = questionSet(today.setId, couple.language);
  const [menu, setMenu] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const partner = couple.partnerName;
  const myName = profile?.name ?? "";

  const cta = today.youDone && today.partnerDone
    ? { label: t("coupleSeeReveal"), primary: true, go: () => push({ name: "couple", screen: "reveal", number: today.number }) }
    : today.youDone
      ? { label: t("coupleWaitingFor", { name: partner }), primary: false, go: () => push({ name: "couple", screen: "reveal", number: today.number }) }
      : today.partnerDone
        ? { label: t("couplePartnerWaiting", { name: partner }), primary: true, go: () => push({ name: "couple", screen: "quiz" }) }
        : { label: t("couplePlayToday"), primary: true, go: () => push({ name: "couple", screen: "quiz" }) };

  const doneIcon = "m5 12 5 5 9-10";
  const waitIcon = "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z";
  const status = [
    { i: initial(myName), name: t("you"), bg: "#EDEBF5", done: today.youDone },
    { i: initial(partner), name: partner, bg: PINK, done: today.partnerDone },
  ];

  async function save(settings: { reminderTime?: string; language?: "en" | "fa" }) {
    try {
      await capi.settings(settings);
      onChange();
    } catch {
      setToast(t("coupleSomethingWrong"));
    }
  }

  async function leave() {
    await capi.leave();
    removeLocal(quizKey(today.number));
    reset({ name: "home" });
  }

  return (
    <Screen theme="night">
      <header className="topbar">
        <IconButton icon="back" label={t("backToHome")} onClick={back} />
        <div className="topbar__text">
          <h1 className="display" style={{ fontSize: 24, fontWeight: 800 }}>{t("coupleNames", { me: myName, partner })}</h1>
          <div className="tiny muted">{t("coupleTogether", { count: n(couple.togetherDays) })}</div>
        </div>
        <button
          type="button"
          aria-label={t("coupleSettings")}
          aria-expanded={menu}
          onClick={() => { setMenu((m) => !m); setConfirmLeave(false); }}
          style={{ width: 44, height: 44, borderRadius: 14, border: 0, background: "var(--surface)", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
        </button>
      </header>
      <Body style={{ gap: 16, position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {[
            [n(couple.streak), t("coupleDayStreak"), true],
            [`${n(couple.matchRate)}%`, t("coupleMatchRate"), false],
            [t("coupleLevelShort", { level: n(couple.level) }), t("coupleLevel"), false],
          ].map(([v, l, rose]) => (
            <div key={String(l)} style={{ padding: "12px 8px", borderRadius: 16, background: rose ? ROSE_BG : "var(--surface)", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: rose ? PINK : undefined }}>{v}</div>
              <div style={{ fontSize: 11, color: rose ? "#D9C9D1" : "var(--muted)" }}>{l}</div>
            </div>
          ))}
        </div>

        <section className="stack" style={{ gap: 14, padding: 18, borderRadius: 22, background: ROSE_BG, border: "1px solid #4A2638" }}>
          <div className="row row--between" style={{ alignItems: "baseline" }}>
            <span className="kicker" style={{ color: PINK }}>{t("coupleTodayN", { number: n(today.number) })}</span>
            <span style={{ fontSize: 12, color: "#D9C9D1" }}>{t("coupleNewIn", { time: countdown })}</span>
          </div>
          <div className="display" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{set.theme}</div>
          <div className="stack" style={{ gap: 8 }}>
            {status.map((p) => (
              <div key={p.name} className="row" style={{ gap: 10 }}>
                <span style={{ width: 32, height: 32, borderRadius: 999, background: p.bg, color: "#0B0D1A", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.i}</span>
                <span className="grow" style={{ fontSize: 15 }}>{p.name}</span>
                <span className="row" style={{ gap: 6, fontSize: 13, fontWeight: 600, color: p.done ? "#9ED98C" : "var(--muted)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={p.done ? doneIcon : waitIcon} /></svg>
                  {p.done ? t("coupleDone") : t("coupleNotYet")}
                </span>
              </div>
            ))}
          </div>
          <button type="button" className="btn" style={{ minHeight: 52, background: cta.primary ? PINK : "#1E2138", color: cta.primary ? PINK_INK : "var(--text)", fontSize: 16 }} onClick={cta.go}>
            {cta.label}
          </button>
        </section>

        <section className="stack" style={{ gap: 10 }}>
          <div className="row row--between" style={{ alignItems: "baseline" }}>
            <h2 className="h2">{t("couplePastDays")}</h2>
            {couple.history.length > 0 && <span className="tiny muted">{t("coupleTapToSee")}</span>}
          </div>
          <div className="stack" style={{ gap: 0, borderRadius: 18, background: "var(--surface)", overflow: "hidden" }}>
            {couple.history.length === 0 && <div className="small muted" style={{ padding: 14 }}>{t("couplePastEmpty")}</div>}
            {couple.history.map((h, i) => {
              const score = h.matches.filter(Boolean).length;
              return (
                <button
                  key={h.number}
                  type="button"
                  onClick={() => push({ name: "couple", screen: "reveal", number: h.number })}
                  className="row"
                  style={{ gap: 12, minHeight: 56, padding: "0 14px", border: 0, borderTop: i ? "1px solid #1E2138" : 0, background: "transparent", color: "var(--text)", textAlign: "start", cursor: "pointer", font: "inherit" }}
                >
                  <span style={{ width: 70, fontSize: 13, color: "var(--muted)" }}>{formatShortDate(h.date, language)}</span>
                  <span className="grow" style={{ fontSize: 14 }}>{questionSet(h.setId, couple.language).theme}</span>
                  <span className="row" style={{ gap: 3 }} role="img" aria-label={t("coupleMatchedOf", { count: n(score) })}>
                    {h.matches.map((m, k) => <span key={k} style={{ width: 8, height: 8, borderRadius: 999, background: m ? PINK : "#3A3F5E" }} />)}
                  </span>
                  <span className="num" style={{ width: 30, textAlign: "end", fontSize: 14, fontWeight: 700 }}>{n(score)}/{n(6)}</span>
                </button>
              );
            })}
          </div>
        </section>

        {menu && (
          <div role="menu" className="stack" style={{ position: "absolute", top: 0, insetInlineEnd: 16, width: 250, padding: 6, gap: 0, borderRadius: 16, background: "#1E2138", border: "1px solid #2E3252", boxShadow: "0 12px 30px rgba(0,0,0,0.4)", zIndex: 5 }}>
            <label className="row row--between" style={{ minHeight: 44, padding: "0 12px", fontSize: 14 }}>
              <span>{t("coupleReminderTime")}</span>
              <input
                type="time"
                value={couple.reminderTime}
                onChange={(e) => e.target.value && void save({ reminderTime: e.target.value })}
                style={{ minHeight: 36, borderRadius: 8, border: "1px solid #3A3F52", background: "#101218", color: "var(--text)", padding: "0 6px", font: "inherit" }}
              />
            </label>
            <button type="button" role="menuitem" onClick={() => void save({ language: couple.language === "en" ? "fa" : "en" })} style={menuItem}>
              {t("coupleQuestionLanguage", { language: couple.language === "fa" ? "فارسی" : "English" })}
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenu(false); setConfirmLeave(true); }} style={{ ...menuItem, color: "#F08A7A" }}>
              {t("coupleLeave")}
            </button>
          </div>
        )}
        {confirmLeave && (
          <div role="alertdialog" aria-labelledby="leave-title" className="stack" style={{ position: "absolute", insetInline: 16, top: 120, padding: 18, gap: 12, borderRadius: 20, background: "#1E2138", border: "1px solid #2E3252", boxShadow: "0 16px 40px rgba(0,0,0,0.5)", zIndex: 6 }}>
            <div id="leave-title" style={{ fontSize: 18, fontWeight: 700 }}>{t("coupleLeaveTitle")}</div>
            <div style={{ fontSize: 14, lineHeight: 1.45, color: "var(--text-2)" }}>{t("coupleLeaveBody", { count: n(couple.streak), name: partner })}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              <button type="button" className="btn btn--outline" style={{ minHeight: 48 }} onClick={() => setConfirmLeave(false)}>{t("coupleStay")}</button>
              <button type="button" className="btn" style={{ minHeight: 48, background: "#E5604D", color: "#1C0905" }} onClick={() => void leave()}>{t("coupleLeaveConfirm")}</button>
            </div>
          </div>
        )}
      </Body>
      <Toast message={toast} />
    </Screen>
  );
}

const menuItem = { minHeight: 44, padding: "0 12px", borderRadius: 10, border: 0, background: "transparent", color: "var(--text)", font: "500 14px var(--font-body)", textAlign: "start", cursor: "pointer" } as const;

// ---------------------------------------------------------------- quiz

const quizKey = (number: number) => `bazimoon-couple-quiz-${number}`;

interface QuizDraft {
  step: number;
  answers: (number | null)[];
  review: boolean;
}

function CoupleQuiz() {
  const { t, n } = useLanguage();
  const { back, replace } = useNavigation();
  const { profile } = useHub();
  const capi = useCoupleApi();
  const { data: state } = useLoad(() => capi.state(), [capi]);
  const couple = state?.couple;

  if (state && state.status !== "active") return <CoupleGate />;
  if (!couple) return <LoadingScreen />;
  if (couple.today.youDone) {
    return <CoupleRevealView number={couple.today.number} />;
  }
  return <QuizBoard key={couple.today.number} number={couple.today.number} setId={couple.today.setId} language={couple.language} partner={couple.partnerName} me={profile?.name ?? ""} onBack={back} onDone={(n) => replace({ name: "couple", screen: "reveal", number: n })} submit={capi.answer} t={t} fmt={n} />;
}

function QuizBoard({ number, setId, language, partner, me, onBack, onDone, submit, t, fmt }: {
  number: number;
  setId: number;
  language: "en" | "fa";
  partner: string;
  me: string;
  onBack: () => void;
  onDone: (number: number) => void;
  submit: (number: number, answers: number[]) => Promise<CoupleDay>;
  t: ReturnType<typeof useLanguage>["t"];
  fmt: ReturnType<typeof useLanguage>["n"];
}) {
  const { language: uiLanguage } = useLanguage();
  const set = questionSet(setId, language);
  const [draft, setDraftState] = useState<QuizDraft>(() => readLocal<QuizDraft>(quizKey(number), { step: 0, answers: [null, null, null, null, null, null], review: false }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setDraft = (next: QuizDraft) => {
    setDraftState(next);
    writeLocal(quizKey(number), next);
  };
  const { step, answers, review } = draft;
  const guess = step >= 3;
  const q = set.questions[step % 3];
  const text = (i: number) => (i < 3 ? set.questions[i].you : fillName(set.questions[i % 3].them, partner));
  const cur = answers[step];
  const picked = cur !== null && cur !== -1;
  const qDir = language === "fa" ? "rtl" : "ltr";

  function advance(next: (number | null)[]) {
    if (step === 5) setDraft({ step, answers: next, review: true });
    else setDraft({ step: step + 1, answers: next, review: false });
  }

  async function lockIn() {
    setBusy(true);
    setError(null);
    try {
      await submit(number, answers.map((a) => a ?? -1));
      haptic.success();
      onDone(number);
    } catch (err) {
      setError(err instanceof ApiError && uiLanguage === "en" ? err.message : t("coupleSomethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  const progress = answers.map((a, i) => (i < step || review ? (a === -1 || a === null ? "#3A3F5E" : PINK) : i === step ? "#F8C9DA" : "#262A44"));
  const atStart = step === 0 && !review;

  return (
    <Screen theme="night">
      <div className="row" style={{ gap: 10, padding: "14px 16px 6px" }}>
        <IconButton
          icon="back"
          label={atStart ? t("coupleBackToSpace") : t("couplePrevQuestion")}
          onClick={() => (atStart ? onBack() : review ? setDraft({ ...draft, review: false }) : setDraft({ ...draft, step: step - 1 }))}
        />
        <div className="grow row" style={{ gap: 4 }} role="img" aria-label={t("coupleQuestionOf", { n: fmt(step + 1) })}>
          {progress.map((c, i) => <span key={i} style={{ flex: 1, height: 6, borderRadius: 999, background: c }} />)}
        </div>
        <span className="num" style={{ minWidth: 36, textAlign: "end", fontSize: 13, color: "var(--muted)" }}>{review ? t("coupleDone") : `${fmt(step + 1)}/${fmt(6)}`}</span>
      </div>

      {!review ? (
        <>
          <Body style={{ gap: 18, paddingTop: 16 }}>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ width: 40, height: 40, borderRadius: 999, background: guess ? PINK : "#EDEBF5", color: "#0B0D1A", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {initial(guess ? partner : me)}
              </span>
              <div>
                <div className="kicker" style={{ color: guess ? PINK : BLUE }}>{guess ? t("coupleGuessFor", { name: partner }) : t("coupleAboutYou")}</div>
                <div className="small muted">{guess ? t("coupleGuessHint") : t("coupleAboutHint", { name: partner })}</div>
              </div>
            </div>
            <h1 className="display" style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2 }} dir={qDir}>{text(step)}</h1>
            <div role="radiogroup" aria-label={text(step)} className="stack" style={{ gap: 10 }}>
              {q.options.map((label, i) => {
                const on = cur === i;
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => { haptic.select(); const a = [...answers]; a[step] = i; setDraft({ ...draft, answers: a }); }}
                    className="row"
                    dir={qDir}
                    style={{ gap: 12, minHeight: 60, padding: "0 16px", borderRadius: 16, border: `2px solid ${on ? PINK : "#262A44"}`, background: on ? ROSE_BG : "var(--surface)", color: "var(--text)", font: "500 16px var(--font-body)", textAlign: "start", cursor: "pointer" }}
                  >
                    <span style={{ width: 22, height: 22, flex: "none", boxSizing: "border-box", borderRadius: 999, border: `2px solid ${on ? PINK : "#4A4E70"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: on ? PINK : "transparent" }} />
                    </span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </Body>
          <div className="screen__bar screen__bar--row" style={{ gap: 8 }}>
            <button type="button" className="btn btn--outline" style={{ flex: "none", width: "auto", padding: "0 18px", color: "var(--text-2)" }} onClick={() => { const a = [...answers]; a[step] = -1; advance(a); }}>
              {t("coupleSkip")}
            </button>
            <button type="button" className="btn" disabled={!picked} style={{ flex: 1, background: picked ? PINK : "#1E2138", color: picked ? PINK_INK : "#7D80A0", fontSize: 16 }} onClick={() => picked && advance(answers)}>
              {step === 2 ? t("coupleNextGuess", { name: partner }) : step === 5 ? t("coupleReview") : t("coupleNext")}
            </button>
          </div>
        </>
      ) : (
        <>
          <Body style={{ gap: 14, paddingTop: 16 }}>
            <h1 className="display" style={{ fontSize: 26, fontWeight: 800 }}>{t("coupleCheckAnswers")}</h1>
            <p className="small" style={{ color: "var(--text-2)" }}>{t("coupleCheckHint")}</p>
            {answers.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setDraft({ ...draft, review: false, step: i })}
                className="stack"
                style={{ gap: 4, alignItems: "flex-start", padding: "12px 14px", borderRadius: 14, border: 0, background: "var(--surface)", color: "var(--text)", font: "inherit", textAlign: "start", cursor: "pointer" }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: i < 3 ? BLUE : PINK }}>{i < 3 ? t("coupleAboutYou") : t("coupleYourGuessFor", { name: partner })}</span>
                <span style={{ fontSize: 14, color: "var(--text-2)" }} dir={qDir}>{text(i)}</span>
                <span style={{ fontSize: 15, fontWeight: 600 }} dir={qDir}>{a === null || a === -1 ? t("coupleSkipped") : set.questions[i % 3].options[a]}</span>
              </button>
            ))}
            {error && <div className="small" role="alert" style={{ color: "#F08A7A" }}>{error}</div>}
          </Body>
          <div className="screen__bar">
            <button type="button" className="btn" style={{ minHeight: 54, background: PINK, color: PINK_INK, fontSize: 16 }} disabled={busy} onClick={() => void lockIn()}>
              {t("coupleLockIn")}
            </button>
          </div>
        </>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------- reveal

function CoupleReveal({ number }: { number?: number }) {
  const capi = useCoupleApi();
  const { data } = useLoad(() => (number ? Promise.resolve(null) : capi.state()), [capi, number]);
  const resolved = number ?? data?.couple?.today.number;
  if (!resolved) return <LoadingScreen />;
  return <CoupleRevealView number={resolved} />;
}

function CoupleRevealView({ number }: { number: number }) {
  const { t, n, language: uiLanguage } = useLanguage();
  const { back } = useNavigation();
  const { profile } = useHub();
  const capi = useCoupleApi();
  const countdown = useCountdown();
  const [reload, setReload] = useState(0);
  const { data: day, error } = useLoad(() => capi.day(number), [capi, number, reload]);
  const { data: state } = useLoad(() => capi.state(), [capi]);
  const [nudged, setNudged] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const language = state?.couple?.language ?? "en";

  // While waiting for the partner, check back every half minute so the reveal opens on its own.
  useEffect(() => {
    if (!day || day.revealed) return;
    const id = window.setInterval(() => setReload((r) => r + 1), 30_000);
    return () => window.clearInterval(id);
  }, [day]);

  if (error) return <StateScreen state={error instanceof ApiError && error.status === 0 ? "offline" : "error"} onPrimary={() => setReload((r) => r + 1)} primaryLabel={t("tryAgain")} />;
  if (!day) return <LoadingScreen />;

  const set = questionSet(day.setId, language);
  const partner = day.partnerName;
  const me = profile?.name ?? "";
  const qDir = language === "fa" ? "rtl" : "ltr";

  async function nudge() {
    try {
      await capi.nudge();
      haptic.success();
      setNudged(true);
    } catch (err) {
      setToast(err instanceof ApiError && uiLanguage === "en" ? err.message : t("coupleSomethingWrong"));
    }
  }

  const header = (
    <div className="row" style={{ gap: 10, padding: "14px 16px 6px" }}>
      <IconButton icon="back" label={t("coupleBackToSpace")} onClick={back} />
      <div className="grow">
        <div className="display" style={{ fontSize: 21, fontWeight: 800 }}>{t("coupleDayN", { number: n(day.number) })}</div>
        <div className="tiny muted">{set.theme}</div>
      </div>
    </div>
  );

  if (!day.revealed) {
    const sent = nudged || day.youNudged;
    return (
      <Screen theme="night">
        {header}
        <div className="stack center" style={{ flex: 1, justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <Pair me={initial(me)} partner={initial(partner)} partnerStyle={{ background: "#3A2030", color: PINK, opacity: 0.7, borderColor: "var(--bg)" }} />
          <h1 className="display" style={{ fontSize: 26, fontWeight: 800 }}>{day.youDone ? t("coupleLockedIn") : t("coupleNotPlayedYet")}</h1>
          <p style={{ maxWidth: 300, fontSize: 15, lineHeight: 1.5, color: "var(--text-2)" }}>
            {day.youDone ? t("coupleWaitingBody", { name: partner }) : t("couplePastMissed")}
          </p>
          <div className="row" style={{ gap: 8 }} aria-hidden="true">
            {[0, 1, 2].map((k) => (
              <span key={k} style={{ width: 44, height: 44, borderRadius: 12, background: "var(--surface)", color: PINK, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              </span>
            ))}
          </div>
        </div>
        {day.youDone && !day.partnerDone && (
          <div className="screen__bar stack" style={{ gap: 8 }}>
            <button type="button" className="btn" disabled={sent} style={{ minHeight: 54, background: sent ? "#1E2138" : PINK, color: sent ? "var(--muted)" : PINK_INK, fontSize: 16 }} onClick={() => void nudge()}>
              {sent ? t("coupleNudgeSent", { name: partner }) : t("coupleNudge", { name: partner })}
            </button>
            <span className="small muted" style={{ textAlign: "center" }}>{t("coupleNudgeNote")}</span>
          </div>
        )}
        <Toast message={toast} />
      </Screen>
    );
  }

  const mine = day.yourAnswers!;
  const theirs = day.partnerAnswers!;
  const matches = day.matches!;
  const myScore = matches.slice(0, 3).filter(Boolean).length;
  const theirScore = matches.slice(3).filter(Boolean).length;
  const score = myScore + theirScore;
  const verdict = score >= 5 ? t("coupleVerdictHigh") : score >= 3 ? t("coupleVerdictMid") : t("coupleVerdictLow");
  const ok = "m5 12 5 5 9-10";
  const no = "M6 6l12 12M18 6 6 18";
  const option = (q: number, a: number) => (a < 0 ? t("coupleSkipped") : set.questions[q].options[a]);
  const isToday = state?.couple?.today.number === day.number;

  const chip = (hit: boolean, text: string) => (
    <span className="row" style={{ gap: 4, padding: "4px 10px", borderRadius: 999, background: hit ? "#13302C" : "#2A1418", color: hit ? "#5FD0BE" : "#F08A7A", fontSize: 12, fontWeight: 700, maxWidth: 150, flexShrink: 0 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={hit ? ok : no} /></svg>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
    </span>
  );

  return (
    <Screen theme="night">
      {header}
      <Body style={{ gap: 14, paddingTop: 10 }}>
        <section className="stack center" style={{ gap: 6, padding: 18, borderRadius: 22, background: ROSE_BG, textAlign: "center" }}>
          <div className="kicker" style={{ color: PINK }}>{t("coupleTodaysMatch")}</div>
          <div className="display num" style={{ fontSize: 52, fontWeight: 800, lineHeight: 1 }}>
            {n(score)}<span style={{ fontSize: 26, color: "#D9C9D1" }}> / {n(6)}</span>
          </div>
          <div style={{ fontSize: 15, color: "#D9C9D1" }}>{verdict}</div>
          <div className="row" style={{ gap: 16, marginTop: 6, fontSize: 13, color: "#D9C9D1" }}>
            <span>{t("coupleYouGuessed")} <b style={{ color: "var(--text)" }}>{n(myScore)}/{n(3)}</b></span>
            <span>{t("couplePartnerGuessed", { name: partner })} <b style={{ color: "var(--text)" }}>{n(theirScore)}/{n(3)}</b></span>
          </div>
        </section>

        {set.questions.map((q, i) => (
          <section key={i} className="stack" style={{ gap: 10, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
            <div style={{ fontSize: 15, fontWeight: 600 }} dir={qDir}>{q.short}</div>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ width: 28, height: 28, flex: "none", borderRadius: 999, background: PINK, color: "#0B0D1A", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{initial(partner)}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="tiny muted">{t("couplePartnerSaid", { name: partner })}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }} dir={qDir}>{option(i, theirs[i])}</div>
              </div>
              {chip(matches[i], matches[i] ? t("coupleYouKnew") : t("coupleYouGuessedX", { answer: option(i, mine[3 + i]) }))}
            </div>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ width: 28, height: 28, flex: "none", borderRadius: 999, background: "#EDEBF5", color: "#0B0D1A", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{initial(me)}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="tiny muted">{t("coupleYouSaid")}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }} dir={qDir}>{option(i, mine[i])}</div>
              </div>
              {chip(matches[3 + i], matches[3 + i] ? t("couplePartnerKnew", { name: partner }) : t("couplePartnerGuessedX", { answer: option(i, theirs[3 + i]) }))}
            </div>
          </section>
        ))}

        <section className="row row--between" style={{ padding: 14, borderRadius: 18, background: "var(--surface)" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t("coupleStreakDays", { count: n(day.streak) })}</div>
            <div className="tiny muted">{t("coupleXpEach", { xp: n(day.xpEach), level: n(day.level) })}</div>
          </div>
          {isToday && <span style={{ fontSize: 13, color: PINK, fontWeight: 600 }}>{t("coupleNextIn", { time: countdown })}</span>}
        </section>
      </Body>
      <div className="screen__bar screen__bar--row" style={{ gap: 8 }}>
        <button type="button" className="btn btn--outline" style={{ flex: 1 }} onClick={back}>{t("coupleDone")}</button>
        <button
          type="button"
          className="btn"
          style={{ flex: 1.4, background: PINK, color: PINK_INK }}
          onClick={() => void shareLink(appLink("couple"), t("coupleShareResult", { score, day: day.number }))}
        >
          {t("coupleShareResultCta")}
        </button>
      </div>
    </Screen>
  );
}
