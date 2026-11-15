import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { useSession } from "../app/session";
import { LoadingScreen } from "../app/StateScreen";
import { Avatar, Body, IconButton, Screen, Segmented, Switch, Toast, TopBar } from "../ui/components";
import { Icon } from "../ui/Icon";
import { useHub, useLoad } from "../hub/HubData";
import { appLink } from "../lib/links";
import { shareLink } from "../lib/platform";
import { haptic } from "../lib/haptics";
import {
  clanLinkStart, type ClanDetail, type ClanEvent, type ClanMember, type ClanMessage, type ClanSummary, type RsvpAnswer,
} from "../api/clans";
import { ClanEmblemTile, RoleChip } from "./shared";
import { clanError, formatWhen, useToast } from "./clanText";

const faceColors = ["#5FD0BE", "#B79CF2", "#F0A83A", "#8FA8FF", "#E9D8A6", "#F08A7A", "#9ED98C", "#F2B8D0"];
const colorFor = (id: string) => faceColors[Array.from(id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % faceColors.length];
/** Joins short facts on one line. In Persian a middle dot reads like the digit zero, so a comma is used. */
const joinFacts = (parts: (string | null | false)[], language: string) => parts.filter(Boolean).join(language === "fa" ? "، " : " · ");
const ACCENT = "#9C8CFF";
const DANGER_BG = "#3A1C1A";
const DANGER = "#F08A7A";

const smallBtn: CSSProperties = { width: "auto", minHeight: 38, padding: "0 14px", fontSize: 14, flex: "none" };

/** /clan: your clan, or (if you're not in one) the place to find or start one. */
export function ClanScreen() {
  const { clans } = useHub();
  const me = useLoad(() => clans.me(), [clans]);
  if (me.loading && !me.data) return <LoadingScreen />;
  if (me.data?.clan) return <ClanHome clanId={me.data.clan.id} onLeft={me.reload} />;
  return <FindClans requested={me.data?.requestedClanIds ?? []} onJoined={me.reload} />;
}

// ---------------------------------------------------------------------------------- find a clan

function FindClans({ requested, onJoined }: { requested: string[]; onJoined(): void }) {
  const { t, n } = useLanguage();
  const { back, push } = useNavigation();
  const { clans } = useHub();
  const session = useSession();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const list = useLoad(() => clans.search(query), [clans, query]);
  const [asked, setAsked] = useState<string[]>(requested);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useToast();
  const [code, setCode] = useState("");

  // Search as the player types, without a request per key.
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  async function toggle(clan: ClanSummary) {
    setBusy(true);
    try {
      if (asked.includes(clan.id)) {
        await clans.cancelRequest(clan.id);
        setAsked((a) => a.filter((id) => id !== clan.id));
      } else {
        await clans.askToJoin(clan.id);
        haptic.success();
        setAsked((a) => [...a, clan.id]);
        setToast(t("clanRequestSent"));
      }
    } catch (err) {
      setToast(clanError(err, t));
    } finally {
      setBusy(false);
    }
  }

  function openInvite(e: FormEvent) {
    e.preventDefault();
    const value = code.trim();
    if (!value) return;
    // A pasted link works as well as a bare code.
    const match = value.match(/\/c\/([A-Za-z0-9]+)/);
    push({ name: "clanLink", code: (match ? match[1] : value).toUpperCase() });
  }

  return (
    <Screen theme="night">
      <TopBar onBack={back} title={t("clanFindTitle")} subtitle={t("clanFindSub")} titleSize={24} />
      <Body style={{ gap: 14 }}>
        <label className="row" style={{ gap: 8, padding: "0 12px", minHeight: 46, borderRadius: 14, background: "var(--surface)", border: "1px solid #2E3252" }}>
          <Icon name="detective" size={18} color="var(--muted)" />
          <span className="visually-hidden">{t("clanSearch")}</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("clanSearch")}
            autoComplete="off"
            style={{ flex: 1, minWidth: 0, minHeight: 44, border: 0, background: "transparent", color: "var(--text)", font: "inherit" }}
          />
        </label>

        {list.loading && !list.data && <div className="skeleton" style={{ height: 140, borderRadius: 18 }} />}
        {list.error && !list.data && (
          <div className="card stack center">
            <p className="soft small">{t("genericError")}</p>
            <button type="button" className="btn btn--outline btn--pill" onClick={list.reload}>{t("tryAgain")}</button>
          </div>
        )}
        {list.data && list.data.length === 0 && (
          <p className="small muted" style={{ padding: "18px 16px", borderRadius: 18, background: "var(--surface-3)", textAlign: "center", lineHeight: 1.5 }}>
            {query ? t("clanSearchEmpty") : t("clanListEmpty")}
          </p>
        )}
        <div className="stack" style={{ gap: 10 }}>
          {list.data?.map((clan) => {
            const isAsked = asked.includes(clan.id);
            const full = clan.members >= clan.maxMembers;
            return (
              <article key={clan.id} className="row" style={{ gap: 12, padding: 14, borderRadius: 18, background: "var(--surface)", alignItems: "flex-start" }}>
                <ClanEmblemTile emblem={clan.emblem} color={clan.color} />
                <div className="grow stack" style={{ gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{clan.name}</span>
                  <span className="tiny muted">{t("clanMembersOf", { count: n(clan.members), max: n(clan.maxMembers) })}</span>
                  {clan.bio && <span className="small" style={{ color: "var(--text-2)", lineHeight: 1.45 }}>{clan.bio}</span>}
                </div>
                <button
                  type="button"
                  className={isAsked || full ? "btn btn--outline" : "btn"}
                  disabled={busy || (full && !isAsked)}
                  onClick={() => void toggle(clan)}
                  style={{ ...smallBtn, ...(isAsked || full ? {} : { background: ACCENT, color: "#120D2E" }) }}
                >
                  {isAsked ? t("clanCancelRequest") : full ? t("clanFull") : t("clanAskToJoin")}
                </button>
              </article>
            );
          })}
        </div>

        <form onSubmit={openInvite} className="stack" style={{ gap: 8, padding: 14, borderRadius: 18, border: "1.5px dashed #2E3252" }}>
          <label htmlFor="clan-code" style={{ fontSize: 14, fontWeight: 600 }}>{t("clanGotInvite")}</label>
          <div className="row" style={{ gap: 8 }}>
            <input
              id="clan-code"
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("clanInvitePlaceholder")}
              autoCapitalize="characters"
              autoComplete="off"
              style={{ flex: 1, minWidth: 0, minHeight: 44, padding: "0 12px", borderRadius: 12, border: "1px solid #3A3F5E", background: "#0B0D1A", color: "var(--text)", font: "inherit" }}
            />
            <button type="submit" className="btn btn--outline" disabled={!code.trim()} style={{ ...smallBtn, minHeight: 44 }}>{t("clanOpenInvite")}</button>
          </div>
        </form>
      </Body>
      <div className="screen__bar">
        {session.isGuest ? (
          <>
            <p className="small muted" style={{ textAlign: "center", lineHeight: 1.45 }}>{t("clanCreateGuest")}</p>
            <button type="button" className="btn btn--outline" onClick={session.startGoogle}>{t("clanSignIn")}</button>
          </>
        ) : (
          <button type="button" className="btn" style={{ background: "#E5604D", color: "#1C0905" }} onClick={() => push({ name: "clanForm" })}>
            <Icon name="plus" size={18} />
            {t("clanCreate")}
          </button>
        )}
      </div>
      <Toast message={toast} />
      {/* Joined from elsewhere (an invite link in another tab): the clan page takes over. */}
      <VisibleReload onVisible={onJoined} />
    </Screen>
  );
}

/** Calls back when the app returns to the foreground. */
function VisibleReload({ onVisible }: { onVisible(): void }) {
  useEffect(() => {
    const handler = () => { if (document.visibilityState === "visible") onVisible(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [onVisible]);
  return null;
}

// ---------------------------------------------------------------------------------- your clan

type Tab = "home" | "chat" | "ranking" | "members";
const TAB_KEY = "bazimoon-clan-tab";

function ClanHome({ clanId, onLeft }: { clanId: string; onLeft(): void }) {
  const { t, n } = useLanguage();
  const { back, push } = useNavigation();
  const { clans } = useHub();
  const detail = useLoad(() => clans.get(clanId), [clans, clanId]);
  const [tab, setTabState] = useState<Tab>(() => {
    try {
      const saved = sessionStorage.getItem(TAB_KEY);
      return saved === "chat" || saved === "ranking" || saved === "members" ? saved : "home";
    } catch {
      return "home";
    }
  });
  const [toast, setToast] = useToast();
  const setTab = (next: Tab) => {
    setTabState(next);
    try { sessionStorage.setItem(TAB_KEY, next); } catch { /* private mode */ }
    if (next === "home" || next === "members") detail.reload();
  };

  const reload = detail.reload;
  useEffect(() => {
    const handler = () => { if (document.visibilityState === "visible") reload(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [reload]);

  const clan = detail.data;
  if (detail.loading && !clan) return <LoadingScreen />;
  if (!clan) {
    return (
      <Screen theme="night">
        <TopBar onBack={back} title={t("clansTitle")} />
        <Body>
          <div className="card stack center">
            <p className="soft small">{detail.error ? clanError(detail.error, t) : t("genericError")}</p>
            <button type="button" className="btn btn--outline btn--pill" onClick={onLeft}>{t("tryAgain")}</button>
          </div>
        </Body>
      </Screen>
    );
  }

  const manager = clan.yourRole !== "member";
  const link = appLink(clanLinkStart(clan.inviteCode));
  const chatUnread = tab === "chat" ? 0 : clan.unread;

  return (
    <Screen theme="night">
      <TopBar
        onBack={back}
        title={clan.name}
        subtitle={t("clanCardMembers", { count: n(clan.members.length) })}
        titleSize={22}
        right={manager ? <IconButton icon="sliders" label={t("clanSettings")} onClick={() => push({ name: "clanForm", clanId: clan.id })} /> : undefined}
      />
      <div style={{ padding: "0 16px 8px" }}>
        <Segmented<Tab>
          role="tablist"
          label={t("clanSections")}
          value={tab}
          onChange={setTab}
          options={[
            { value: "home", label: t("clanTabHome") },
            { value: "chat", label: <span className="row" style={{ gap: 5, justifyContent: "center" }}>{t("clanTabChat")}{chatUnread > 0 && <span className="num" style={{ minWidth: 18, padding: "0 5px", borderRadius: 999, background: "#E5604D", color: "#1C0905", fontSize: 11, fontWeight: 800 }}>{n(Math.min(chatUnread, 99))}</span>}</span> },
            { value: "ranking", label: t("clanTabRanking") },
            { value: "members", label: <span className="row" style={{ gap: 5, justifyContent: "center" }}>{t("clanTabMembers")}{manager && clan.requests.length > 0 && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: "#E5604D" }} />}</span> },
          ]}
        />
      </div>
      {tab === "home" && <OverviewTab clan={clan} link={link} reload={reload} setToast={setToast} />}
      {tab === "chat" && <ChatTab clan={clan} setToast={setToast} />}
      {tab === "ranking" && <RankingTab clanId={clan.id} />}
      {tab === "members" && <MembersTab clan={clan} reload={reload} onLeft={onLeft} setToast={setToast} />}
      <Toast message={toast} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------------- overview

function OverviewTab({ clan, link, reload, setToast }: { clan: ClanDetail; link: string; reload(): void; setToast(m: string): void }) {
  const { t, n, language } = useLanguage();
  const { push } = useNavigation();
  const { clans } = useHub();
  const [busy, setBusy] = useState(false);
  const manager = clan.yourRole !== "member";

  async function openTable() {
    setBusy(true);
    try {
      const { gameId } = await clans.openTable(clan.id);
      haptic.success();
      push({ name: "mafia", gameId });
    } catch (err) {
      setToast(clanError(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Body style={{ gap: 18, paddingBottom: 24 }}>
      <section className="row" style={{ gap: 14, padding: 16, borderRadius: 20, background: `linear-gradient(135deg, ${clan.color}26, var(--surface) 75%)`, border: `1px solid ${clan.color}40` }}>
        <ClanEmblemTile emblem={clan.emblem} color={clan.color} size={56} />
        <div className="grow stack" style={{ gap: 4, minWidth: 0 }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <RoleChip role={clan.yourRole} />
            <span className="tiny muted row" style={{ gap: 4 }}>
              <Icon name={clan.isListed ? "globe" : "lock"} size={12} />
              {clan.isListed ? t("clanListed") : t("clanUnlisted")}
            </span>
          </div>
          {clan.bio && <p className="small" style={{ color: "var(--text-2)", lineHeight: 1.45 }}>{clan.bio}</p>}
        </div>
        <button type="button" className="btn" onClick={() => void shareLink(link, t("clanShareText", { name: clan.name }))} style={{ ...smallBtn, background: clan.color, color: "#101218", gap: 6 }}>
          <Icon name="share" size={16} />
          {t("clanInvite")}
        </button>
      </section>

      {clan.announcement && (
        <section className="stack" style={{ gap: 6, padding: 14, borderRadius: 18, background: "#2A2113", border: "1px solid #5A4120" }}>
          <div className="row tiny" style={{ gap: 6, color: "#F0A83A", fontWeight: 700 }}>
            <Icon name="bell" size={14} />
            {t("clanAnnouncement")}
            <span className="muted" style={{ fontWeight: 400 }}>{joinFacts([clan.announcement.name, formatWhen(clan.announcement.createdAt, language)], language)}</span>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.5, color: "#E3D3B8", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{clan.announcement.text}</p>
        </section>
      )}

      <section className="stack" style={{ gap: 10 }}>
        <div className="row row--between">
          <h2 className="h2">{t("clanNights")}</h2>
          {manager && (
            <button type="button" className="btn btn--outline" style={{ ...smallBtn, gap: 6 }} onClick={() => push({ name: "clanEvent", clanId: clan.id })}>
              <Icon name="plus" size={16} />
              {t("clanPlanNight")}
            </button>
          )}
        </div>
        {clan.events.length === 0 && (
          <p className="small muted" style={{ padding: "16px", borderRadius: 16, background: "var(--surface-3)", textAlign: "center", lineHeight: 1.5 }}>
            {manager ? t("clanNoNights") : t("clanNoNightsMember")}
          </p>
        )}
        {clan.events.map((ev) => <EventCard key={ev.id} clan={clan} ev={ev} reload={reload} setToast={setToast} />)}
      </section>

      <section className="stack" style={{ gap: 10 }}>
        <h2 className="h2">{t("clanTables")}</h2>
        {clan.tables.map((table) => {
          const action = table.youAreSeated ? t("clanReturn") : t("clanJoinTable");
          const canOpen = table.youAreSeated || (table.inLobby && table.seated < table.maxPlayers);
          return (
            <article key={table.gameId} className="row" style={{ gap: 12, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
              <span style={{ width: 38, height: 38, flex: "none", borderRadius: 12, background: "#2E2340", color: "#B79CF2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="moon" size={18} />
              </span>
              <div className="grow stack" style={{ gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{table.name ?? clan.name}</span>
                <span className="tiny muted">
                  {joinFacts([t("clanTableBy", { name: table.host }), table.inLobby ? t("clanTableSeated", { seated: n(table.seated), max: n(table.maxPlayers) }) : t("clanTablePlaying", { count: n(table.seated) })], language)}
                </span>
              </div>
              <button type="button" className="btn" disabled={!canOpen} onClick={() => push({ name: "mafia", gameId: table.gameId })} style={{ ...smallBtn, background: canOpen ? ACCENT : "transparent", color: canOpen ? "#120D2E" : "var(--text-2)" }}>
                {action}
              </button>
            </article>
          );
        })}
        <button type="button" className="btn" disabled={busy} onClick={() => void openTable()} style={{ background: "#E5604D", color: "#1C0905", gap: 8 }}>
          <Icon name="plus" size={18} />
          {t("clanOpenTable")}
        </button>
        <p className="tiny muted" style={{ textAlign: "center", marginTop: -2 }}>{t("clanOpenTableSub")}</p>
      </section>
    </Body>
  );
}

function EventCard({ clan, ev, reload, setToast }: { clan: ClanDetail; ev: ClanEvent; reload(): void; setToast(m: string): void }) {
  const { t, n, language } = useLanguage();
  const { push } = useNavigation();
  const { clans } = useHub();
  const [answer, setAnswer] = useState(ev.yourAnswer);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const manager = clan.yourRole !== "member";
  const going = ev.going.length;
  const seatsLeft = Math.max(0, ev.seats - going);
  const waiting = Math.max(0, going - ev.seats);

  useEffect(() => setAnswer(ev.yourAnswer), [ev.yourAnswer]);

  async function rsvp(next: RsvpAnswer) {
    const previous = answer;
    setAnswer(next);
    haptic.select();
    try {
      await clans.rsvp(clan.id, ev.id, next);
      reload();
    } catch (err) {
      setAnswer(previous);
      setToast(clanError(err, t));
    }
  }

  async function takeSeat() {
    setBusy(true);
    try {
      const { gameId } = await clans.takeSeat(clan.id, ev.id);
      haptic.success();
      push({ name: "mafia", gameId });
    } catch (err) {
      setToast(clanError(err, t));
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await clans.cancelEvent(clan.id, ev.id);
      reload();
    } catch (err) {
      setToast(clanError(err, t));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <article className="stack" style={{ gap: 12, padding: 14, borderRadius: 18, background: "var(--surface)", border: ev.tableOpen ? "1px solid #E5604D80" : "1px solid transparent" }}>
      <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
        <span style={{ width: 44, height: 44, flex: "none", borderRadius: 13, background: `${clan.color}26`, color: clan.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="calendar" size={20} />
        </span>
        <div className="grow stack" style={{ gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{ev.title}</span>
          <span className="small" style={{ color: clan.color, fontWeight: 600 }}>{formatWhen(ev.startsAt, language)}</span>
          <span className="tiny muted row" style={{ gap: 6, flexWrap: "wrap" }}>
            {ev.repeatWeekly && <span className="row" style={{ gap: 3 }}><Icon name="refresh" size={11} />{t("clanWeekly")}</span>}
            {ev.createdBy && <span>{t("clanPlannedBy", { name: ev.createdBy })}</span>}
          </span>
        </div>
      </div>
      {ev.note && <p className="small" style={{ color: "var(--text-2)", lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{ev.note}</p>}

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <span className="row" aria-hidden="true">
          {ev.going.slice(0, 5).map((p, i) => (
            <Avatar key={p.userId} name={p.name} color={colorFor(p.userId)} size={26} style={{ marginInlineEnd: -6, border: "2px solid var(--surface)", color: "#101218", fontWeight: 800, zIndex: 5 - i }} />
          ))}
        </span>
        <span className="small grow" style={{ color: "var(--text-2)", paddingInlineStart: going > 0 ? 8 : 0 }}>
          {joinFacts([
            t("clanGoing", { count: n(going) }),
            waiting > 0 ? t("clanWaitlist", { count: n(waiting) }) : t("clanSeatsLeft", { count: n(seatsLeft) }),
            ev.maybe.length > 0 && t("clanMaybeCount", { count: n(ev.maybe.length) }),
          ], language)}
        </span>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <span className="tiny muted">{t("clanRsvp")}</span>
        <Segmented<RsvpAnswer | "none">
          label={t("clanRsvp")}
          value={answer ?? "none"}
          onChange={(v) => { if (v !== "none") void rsvp(v); }}
          options={[
            { value: "yes", label: t("clanRsvpYes") },
            { value: "maybe", label: t("clanRsvpMaybe") },
            { value: "no", label: t("clanRsvpNo") },
          ]}
        />
      </div>

      {ev.tableOpen ? (
        <button type="button" className="btn" disabled={busy} onClick={() => void takeSeat()} style={{ background: "#E5604D", color: "#1C0905", gap: 8 }}>
          <Icon name="moon" size={18} />
          {t("clanTakeSeat")}
        </button>
      ) : (
        <p className="tiny muted row" style={{ gap: 6 }}><Icon name="clock" size={13} />{t("clanOpensBefore")}</p>
      )}

      {manager && (confirming ? (
        <div className="stack" style={{ gap: 8, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <p className="small" role="status">{t("clanCancelNightConfirm", { title: ev.title })}</p>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn" disabled={busy} onClick={() => void cancel()} style={{ ...smallBtn, background: DANGER_BG, color: DANGER }}>{t("clanCancelNightYes")}</button>
            <button type="button" className="btn btn--outline" onClick={() => setConfirming(false)} style={smallBtn}>{t("clanCancel")}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} style={{ alignSelf: "flex-start", padding: "4px 0", border: 0, background: "none", color: "var(--muted)", font: "inherit", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
          {t("clanCancelNight")}
        </button>
      ))}
    </article>
  );
}

// ---------------------------------------------------------------------------------- chat

const CHAT_POLL_MS = 4000;

function ChatTab({ clan, setToast }: { clan: ClanDetail; setToast(m: string): void }) {
  const { t, language } = useLanguage();
  const { clans } = useHub();
  const [messages, setMessages] = useState<ClanMessage[] | null>(null);
  const [text, setText] = useState("");
  const [announce, setAnnounce] = useState(false);
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const lastId = useRef<number | undefined>(undefined);
  const manager = clan.yourRole !== "member";

  const merge = useCallback((incoming: ClanMessage[]) => {
    if (incoming.length === 0) return;
    lastId.current = Math.max(lastId.current ?? 0, ...incoming.map((m) => m.id));
    setMessages((current) => {
      const known = new Set((current ?? []).map((m) => m.id));
      return [...(current ?? []), ...incoming.filter((m) => !known.has(m.id))];
    });
  }, []);

  // First the latest page, then only newer messages while the chat is open.
  useEffect(() => {
    let stopped = false;
    clans.messages(clan.id).then((first) => {
      if (stopped) return;
      lastId.current = first.length ? first[first.length - 1].id : 0;
      setMessages(first);
    }).catch(() => { if (!stopped) setMessages([]); });
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible" || lastId.current === undefined) return;
      clans.messages(clan.id, lastId.current).then((newer) => { if (!stopped) merge(newer); }).catch(() => undefined);
    }, CHAT_POLL_MS);
    return () => { stopped = true; window.clearInterval(id); };
  }, [clans, clan.id, merge]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const sent = await clans.post(clan.id, body, announce);
      merge([sent]);
      setText("");
      setAnnounce(false);
      haptic.select();
    } catch (err) {
      setToast(clanError(err, t));
    } finally {
      setSending(false);
    }
  }

  async function remove(message: ClanMessage) {
    try {
      await clans.deleteMessage(clan.id, message.id);
      setMessages((current) => (current ?? []).filter((m) => m.id !== message.id));
    } catch (err) {
      setToast(clanError(err, t));
    }
    setSelected(null);
  }

  return (
    <>
      <Body style={{ gap: 8, paddingBottom: 12 }}>
        {messages === null && <div className="skeleton" style={{ height: 160, borderRadius: 18 }} />}
        {messages?.length === 0 && <p className="small muted" style={{ textAlign: "center", padding: "32px 16px" }}>{t("clanChatEmpty")}</p>}
        <div role="log" aria-live="polite" className="stack" style={{ gap: 8 }}>
          {messages?.map((m, i) => {
            const showName = !m.mine && (i === 0 || messages[i - 1].userId !== m.userId || m.isAnnouncement);
            const canDelete = m.mine || manager;
            const open = selected === m.id;
            return (
              <div key={m.id} className="stack" style={{ alignItems: m.mine ? "flex-end" : "flex-start", gap: 3 }}>
                {showName && <span className="tiny" style={{ color: colorFor(m.userId), fontWeight: 700, paddingInline: 6 }}>{m.name}</span>}
                <button
                  type="button"
                  disabled={!canDelete}
                  onClick={() => setSelected(open ? null : m.id)}
                  style={{
                    maxWidth: "82%", padding: "8px 12px", borderRadius: 16, border: m.isAnnouncement ? "1px solid #5A4120" : 0,
                    borderEndEndRadius: m.mine ? 4 : 16, borderEndStartRadius: m.mine ? 16 : 4,
                    background: m.isAnnouncement ? "#2A2113" : m.mine ? "#2E2650" : "var(--surface)",
                    color: m.isAnnouncement ? "#E3D3B8" : "var(--text)", font: "inherit", fontSize: 15, lineHeight: 1.45,
                    textAlign: "start", whiteSpace: "pre-wrap", overflowWrap: "anywhere", cursor: canDelete ? "pointer" : "default",
                  }}
                >
                  {m.isAnnouncement && (
                    <span className="row tiny" style={{ gap: 4, color: "#F0A83A", fontWeight: 700, marginBottom: 2 }}>
                      <Icon name="bell" size={12} />
                      {t("clanAnnouncement")}
                    </span>
                  )}
                  {m.text}
                  <span className="tiny muted" style={{ display: "block", marginTop: 2, textAlign: "end" }}>{formatWhen(m.createdAt, language)}</span>
                </button>
                {open && (
                  <button type="button" onClick={() => void remove(m)} aria-label={t("clanChatDeleteLabel")} style={{ padding: "4px 10px", borderRadius: 999, border: 0, background: DANGER_BG, color: DANGER, font: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {t("clanChatDelete")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div ref={end} />
      </Body>
      <form className="screen__bar" onSubmit={(e) => void send(e)} style={{ gap: 8 }}>
        {manager && (
          <button type="button" role="switch" aria-checked={announce} onClick={() => setAnnounce((a) => !a)} className="row" style={{ gap: 10, padding: 0, border: 0, background: "none", color: "var(--text)", font: "inherit", textAlign: "start", cursor: "pointer" }}>
            <Switch on={announce} />
            <span className="stack" style={{ gap: 1 }}>
              <span className="small" style={{ fontWeight: 600 }}>{t("clanChatAnnounce")}</span>
              {announce && <span className="tiny muted">{t("clanChatAnnounceHint")}</span>}
            </span>
          </button>
        )}
        <div className="row" style={{ gap: 8 }}>
          <label style={{ display: "flex", flex: 1, minWidth: 0 }}>
            <span className="visually-hidden">{t("clanChatPlaceholder")}</span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={400}
              placeholder={t("clanChatPlaceholder")}
              autoComplete="off"
              style={{ width: "100%", minHeight: 46, padding: "0 14px", borderRadius: 14, border: `1px solid ${announce ? "#5A4120" : "#3A3F5E"}`, background: "#0B0D1A", color: "var(--text)", font: "inherit" }}
            />
          </label>
          <button type="submit" className="icon-btn icon-btn--round" aria-label={t("clanChatSend")} disabled={sending || !text.trim()} style={{ width: 46, height: 46, background: announce ? "#F0A83A" : ACCENT, color: "#120D2E" }}>
            <span className="flip-rtl" style={{ display: "flex" }}><Icon name="arrowSend" size={20} /></span>
          </button>
        </div>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------------- ranking

function RankingTab({ clanId }: { clanId: string }) {
  const { t, n } = useLanguage();
  const { clans } = useHub();
  const [period, setPeriod] = useState<"all" | "month">("all");
  const ranking = useLoad(() => clans.ranking(clanId, period), [clans, clanId, period]);
  const data = ranking.data;
  const medal = ["#F0A83A", "#C9CEDB", "#D08A5A"];
  const cell: CSSProperties = { width: 34, flex: "none", textAlign: "center" };

  return (
    <Body style={{ gap: 14, paddingBottom: 24 }}>
      <Segmented<"all" | "month">
        soft
        role="tablist"
        label={t("clanRankPeriod")}
        value={period}
        onChange={setPeriod}
        options={[{ value: "all", label: t("clanRankAll") }, { value: "month", label: t("clanRankMonth") }]}
      />
      <p className="tiny muted" style={{ lineHeight: 1.5 }}>{t("clanRankRules")}</p>

      {ranking.loading && !data && <div className="skeleton" style={{ height: 200, borderRadius: 18 }} />}
      {ranking.error && !data && (
        <div className="card stack center">
          <p className="soft small">{t("genericError")}</p>
          <button type="button" className="btn btn--outline btn--pill" onClick={ranking.reload}>{t("tryAgain")}</button>
        </div>
      )}
      {data && data.rows.length === 0 && (
        <p className="small muted" style={{ padding: "20px 16px", borderRadius: 18, background: "var(--surface-3)", textAlign: "center", lineHeight: 1.5 }}>{t("clanRankEmpty")}</p>
      )}
      {data && data.rows.length > 0 && (
        <>
          <div className="row row--between tiny muted">
            <span>{t("clanRankClanGames", { count: n(data.clanGames) })}</span>
          </div>
          <div className="list" role="table" aria-label={t("clanTabRanking")}>
            <div className="list__row tiny muted" role="row" style={{ gap: 6, minHeight: 36 }}>
              <span role="columnheader" style={{ width: 22, flex: "none" }}>#</span>
              <span role="columnheader" className="grow">{t("clanRankPlayer")}</span>
              <span role="columnheader" style={cell}>{t("clanRankGames")}</span>
              <span role="columnheader" style={cell}>{t("clanRankWins")}</span>
              <span role="columnheader" style={cell}>{t("clanRankMvp")}</span>
              <span role="columnheader" style={{ ...cell, fontWeight: 700 }}>{t("clanRankPoints")}</span>
            </div>
            {data.rows.map((row) => (
              <div key={row.userId} className="list__row" role="row" style={{ gap: 6, minHeight: 54, background: row.isYou ? "#2E265066" : undefined }}>
                <span role="cell" className="num" style={{ width: 22, flex: "none", fontWeight: 800, color: medal[row.rank - 1] ?? "var(--text-2)" }}>{n(row.rank)}</span>
                <span role="cell" className="grow row" style={{ gap: 8, minWidth: 0 }}>
                  <Avatar name={row.name} color={colorFor(row.userId)} size={26} style={{ color: "#101218", fontWeight: 800 }} />
                  <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: row.isYou ? "#B79CF2" : undefined }}>
                    {row.name}
                    {row.isYou && <span className="visually-hidden"> ({t("clanRankYou")})</span>}
                  </span>
                </span>
                <span role="cell" className="num small" style={cell}>{n(row.games)}</span>
                <span role="cell" className="num small" style={cell}>{n(row.wins)}</span>
                <span role="cell" className="num small" style={cell}>{n(row.mvps)}</span>
                <span role="cell" className="num" style={{ ...cell, fontWeight: 800 }}>{n(row.points)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {data && data.unranked > 0 && data.rows.length > 0 && <p className="tiny muted" style={{ textAlign: "center" }}>{t("clanRankUnranked", { count: n(data.unranked) })}</p>}
    </Body>
  );
}

// ---------------------------------------------------------------------------------- members

type Pending = { kind: "owner" | "remove" | "leave"; userId: string } | null;

function MembersTab({ clan, reload, onLeft, setToast }: { clan: ClanDetail; reload(): void; onLeft(): void; setToast(m: string): void }) {
  const { t, n, language } = useLanguage();
  const { clans } = useHub();
  const session = useSession();
  const [open, setOpen] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const manager = clan.yourRole !== "member";
  const owner = clan.yourRole === "owner";
  const alone = clan.members.length === 1;

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    try {
      await action();
      haptic.success();
      setPending(null);
      setOpen(null);
      if (after) after(); else reload();
    } catch (err) {
      setToast(clanError(err, t));
    } finally {
      setBusy(false);
    }
  }

  const canAct = (m: ClanMember) => m.userId !== session.userId && (owner ? m.role !== "owner" : manager && m.role === "member");

  return (
    <Body style={{ gap: 18, paddingBottom: 24 }}>
      {manager && clan.requests.length > 0 && (
        <Section title={t("clanRequests")} count={clan.requests.length}>
          {clan.requests.map((r) => (
            <div key={r.userId} className="list__row" style={{ gap: 12, minHeight: 60 }}>
              <Avatar name={r.name} color={colorFor(r.userId)} size={40} style={{ color: "#101218", fontWeight: 700 }} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                <div className="tiny muted">{t("friendsLevel", { level: r.level })}</div>
              </div>
              <button type="button" className="btn" disabled={busy} onClick={() => void run(() => clans.acceptRequest(clan.id, r.userId))} style={{ ...smallBtn, background: ACCENT, color: "#120D2E" }}>{t("clanAccept")}</button>
              <button type="button" className="btn btn--outline" disabled={busy} onClick={() => void run(() => clans.declineRequest(clan.id, r.userId))} style={smallBtn}>{t("clanDecline")}</button>
            </div>
          ))}
        </Section>
      )}

      <Section title={t("clanMembers")} count={clan.members.length} max={clan.maxMembers}>
        {clan.members.map((m) => (
          <div key={m.userId} className="list__row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10, minHeight: 60 }}>
            <div className="row" style={{ gap: 12 }}>
              <span style={{ position: "relative", display: "inline-flex", flex: "none" }}>
                <Avatar name={m.name} color={colorFor(m.userId)} size={40} style={{ color: "#101218", fontWeight: 700 }} />
                {m.online && <span aria-hidden="true" style={{ position: "absolute", insetInlineEnd: -1, bottom: -1, width: 12, height: 12, borderRadius: 999, background: "#5FD0BE", border: "2px solid var(--surface)" }} />}
              </span>
              <div className="grow stack" style={{ gap: 2, minWidth: 0 }}>
                <div className="row" style={{ gap: 6, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                  <RoleChip role={m.role} />
                </div>
                <span className="tiny" style={{ color: m.online ? "#5FD0BE" : "var(--muted)" }}>
                  {joinFacts([m.online && t("clanOnline"), t("friendsLevel", { level: m.level }), m.isGuest && t("clanGuestTag")], language)}
                </span>
              </div>
              {canAct(m) && <IconButton icon="more" label={t("clanMemberActions", { name: m.name })} onClick={() => { setOpen(open === m.userId ? null : m.userId); setPending(null); }} />}
            </div>
            {open === m.userId && (
              pending?.userId === m.userId ? (
                <div className="stack" style={{ gap: 8 }}>
                  <p className="small" role="status">{pending.kind === "owner" ? t("clanMakeOwnerConfirm", { name: m.name }) : t("clanRemoveConfirm", { name: m.name })}</p>
                  <div className="row" style={{ gap: 8 }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void run(() => pending.kind === "owner" ? clans.makeOwner(clan.id, m.userId) : clans.kick(clan.id, m.userId))}
                      style={{ ...smallBtn, background: pending.kind === "remove" ? DANGER_BG : ACCENT, color: pending.kind === "remove" ? DANGER : "#120D2E" }}
                    >
                      {t("clanConfirm")}
                    </button>
                    <button type="button" className="btn btn--outline" onClick={() => setPending(null)} style={smallBtn}>{t("clanCancel")}</button>
                  </div>
                </div>
              ) : (
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {owner && !m.isGuest && (
                    <button type="button" className="btn btn--outline" disabled={busy} style={smallBtn}
                      onClick={() => void run(() => clans.setRole(clan.id, m.userId, m.role === "admin" ? "member" : "admin"))}>
                      {m.role === "admin" ? t("clanMakeMember") : t("clanMakeAdmin")}
                    </button>
                  )}
                  {owner && !m.isGuest && (
                    <button type="button" className="btn btn--outline" style={smallBtn} onClick={() => setPending({ kind: "owner", userId: m.userId })}>
                      {t("clanMakeOwner")}
                    </button>
                  )}
                  <button type="button" className="btn" style={{ ...smallBtn, background: DANGER_BG, color: DANGER }} onClick={() => setPending({ kind: "remove", userId: m.userId })}>
                    {t("clanRemove")}
                  </button>
                </div>
              )
            )}
          </div>
        ))}
      </Section>

      <section className="stack" style={{ gap: 8 }}>
        {owner && !alone ? (
          <p className="small muted" style={{ lineHeight: 1.5 }}>{t("clanLeaveOwner")}</p>
        ) : pending?.kind === "leave" ? (
          <div className="stack" style={{ gap: 8 }}>
            <p className="small" role="status">{alone ? t("clanLeaveLast") : t("clanLeaveConfirm", { name: clan.name })}</p>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn" disabled={busy} onClick={() => void run(() => clans.leave(clan.id), onLeft)} style={{ ...smallBtn, background: DANGER_BG, color: DANGER }}>{t("clanLeave")}</button>
              <button type="button" className="btn btn--outline" onClick={() => setPending(null)} style={smallBtn}>{t("clanCancel")}</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn--outline" style={{ borderColor: "#5A2A26", color: DANGER, gap: 8 }} onClick={() => setPending({ kind: "leave", userId: session.userId ?? "" })}>
            <Icon name="logout" size={18} />
            {t("clanLeave")}
          </button>
        )}
      </section>
      <span className="visually-hidden" aria-live="polite">{t("clanCardMembers", { count: n(clan.members.length) })}</span>
    </Body>
  );
}

function Section({ title, count, max, children }: { title: string; count?: number; max?: number; children: ReactNode }) {
  const { n } = useLanguage();
  return (
    <section className="stack" style={{ gap: 8 }}>
      <div className="row row--between row--baseline">
        <h2 className="h2">{title}</h2>
        {count !== undefined && <span className="small muted num">{max ? `${n(count)}/${n(max)}` : n(count)}</span>}
      </div>
      <div className="list">{children}</div>
    </section>
  );
}
