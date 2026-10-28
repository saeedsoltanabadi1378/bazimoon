import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { LoadingScreen } from "../app/StateScreen";
import { Avatar, Body, IconButton, Screen, Toast, TopBar } from "../ui/components";
import { Icon } from "../ui/Icon";
import { useHub, useLoad } from "./HubData";
import { appLink } from "../lib/links";
import { shareLink } from "../lib/platform";
import { haptic } from "../lib/haptics";
import { friendLinkStart, type Friend } from "../api/friends";
import { seenText } from "./friendText";

const AMBER = "#F0A83A";
const colors = ["#5FD0BE", "#B79CF2", "#F0A83A", "#8FA8FF", "#E9D8A6", "#F08A7A", "#9ED98C", "#F2B8D0"];
const colorFor = (id: string) => colors[parseInt(id.replace(/-/g, "").slice(-4), 16) % colors.length];

export function FriendAvatar({ friend, size = 40 }: { friend: Friend; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", flex: "none" }}>
      <Avatar name={friend.name} color={colorFor(friend.userId)} size={size} style={{ color: "#101218", fontWeight: 700 }} />
      {friend.online && (
        <span aria-hidden="true" style={{ position: "absolute", insetInlineEnd: -1, bottom: -1, width: 12, height: 12, borderRadius: 999, background: "#5FD0BE", border: "2px solid #1A1D26" }} />
      )}
    </span>
  );
}

export function FriendsScreen() {
  const { t, n } = useLanguage();
  const { back } = useNavigation();
  const { friends: fapi } = useHub();
  const list = useLoad(() => fapi.list(), [fapi]);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [requested, setRequested] = useState<string[]>([]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const data = list.data;
  const link = data ? appLink(friendLinkStart(data.code)) : "";

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      list.reload();
    } catch {
      setToast(t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function addCode(e: FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setBusy(true);
    setCodeError(false);
    try {
      const added = await fapi.addByCode(clean);
      haptic.success();
      setCode("");
      setToast(t("friendsAdded", { name: added.name }));
      list.reload();
    } catch {
      setCodeError(true);
    } finally {
      setBusy(false);
    }
  }

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

  if (list.loading && !data) return <LoadingScreen />;

  return (
    <Screen theme="hub">
      <TopBar onBack={back} title={t("friendsTitle")} subtitle={t("friendsSub")} titleSize={24} />
      <Body style={{ gap: 18, paddingBottom: 24 }}>
        {list.error && !data && (
          <div className="card stack center">
            <p className="soft small">{t("genericError")}</p>
            <button type="button" className="btn btn--outline btn--pill" onClick={list.reload}>{t("tryAgain")}</button>
          </div>
        )}

        {data && (
          <>
            <section className="stack" style={{ gap: 12, padding: 16, borderRadius: 18, background: "#2A2113", border: "1px solid #5A4120" }}>
              <div className="row row--between">
                <span className="small" style={{ color: "#E3D3B8" }}>{t("friendsYourCode")}</span>
                <span className="display" dir="ltr" style={{ fontSize: 24, fontWeight: 800, letterSpacing: 3, color: AMBER }}>{data.code}</span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn btn--md" style={{ flex: 1.4, background: AMBER, color: "#2A1A06", fontSize: 14, whiteSpace: "nowrap" }} onClick={() => void shareLink(link, t("friendsShareText"))}>
                  <Icon name="share" size={18} />
                  {t("friendsShareLink")}
                </button>
                <button type="button" className="btn btn--md btn--outline" style={{ flex: 1, borderColor: "#5A4120", fontSize: 14, whiteSpace: "nowrap" }} onClick={() => void copy()}>
                  <span aria-live="polite">{copied ? t("linkCopied") : t("copyLink")}</span>
                </button>
              </div>
              <form className="row" style={{ gap: 8, paddingTop: 12, borderTop: "1px solid #3A2A16" }} onSubmit={(e) => void addCode(e)}>
                <label style={{ display: "flex", flex: 1, minWidth: 0 }}>
                  <span className="visually-hidden">{t("friendsCodeLabel")}</span>
                  <input
                    dir="ltr"
                    value={code}
                    onChange={(e) => { setCode(e.target.value); setCodeError(false); }}
                    placeholder={t("friendsCodeLabel")}
                    autoCapitalize="characters"
                    autoComplete="off"
                    maxLength={8}
                    aria-invalid={codeError}
                    style={{ width: "100%", minHeight: 44, borderRadius: 12, border: `1px solid ${codeError ? "#F08A7A" : "#5A4120"}`, background: "#101218", color: "var(--text)", padding: "0 12px", font: "inherit", letterSpacing: 2, textTransform: "uppercase" }}
                  />
                </label>
                <button type="submit" className="btn btn--md btn--outline" disabled={busy || !code.trim()} style={{ flex: "none", width: "auto", minWidth: 88, borderColor: "#5A4120" }}>{t("friendsAdd")}</button>
              </form>
              {codeError && <div className="small" role="alert" style={{ color: "#F08A7A" }}>{t("friendsCodeError")}</div>}
            </section>

            {data.incoming.length > 0 && (
              <Section title={t("friendsRequests")} count={data.incoming.length}>
                {data.incoming.map((r) => (
                  <PersonRow key={r.id} friend={r.player}>
                    <button type="button" className="btn btn--sm" disabled={busy} style={{ background: AMBER, color: "#2A1A06" }} onClick={() => void run(async () => { await fapi.accept(r.id); haptic.success(); })}>
                      {t("friendsAccept")}
                    </button>
                    <button type="button" className="btn btn--sm btn--outline" disabled={busy} onClick={() => void run(() => fapi.remove(r.player.userId))}>
                      {t("friendsDecline")}
                    </button>
                  </PersonRow>
                ))}
              </Section>
            )}

            <Section title={t("friendsList")} count={data.friends.length}>
              {data.friends.length === 0 && <p className="small muted" style={{ padding: "12px 16px" }}>{t("friendsEmpty")}</p>}
              {data.friends.map((f) => (
                <PersonRow key={f.userId} friend={f}>
                  {confirming === f.userId ? (
                    <>
                      <button type="button" className="btn btn--sm" disabled={busy} style={{ background: "#3A1C1A", color: "#F08A7A" }} onClick={() => void run(async () => { await fapi.remove(f.userId); setConfirming(null); })}>
                        {t("friendsRemove")}
                      </button>
                      <button type="button" className="btn btn--sm btn--outline" onClick={() => setConfirming(null)}>{t("friendsCancel")}</button>
                    </>
                  ) : (
                    <IconButton icon="close" label={t("friendsRemoveLabel", { name: f.name })} onClick={() => setConfirming(f.userId)} />
                  )}
                </PersonRow>
              ))}
              {confirming && <p className="tiny muted" role="status" style={{ padding: "0 16px 12px" }}>{t("friendsRemoveConfirm", { name: data.friends.find((f) => f.userId === confirming)?.name ?? "" })}</p>}
            </Section>

            {data.suggestions.length > 0 && (
              <Section title={t("friendsPlayedWith")} sub={t("friendsPlayedWithSub")}>
                {data.suggestions.map((s) => {
                  const sent = requested.includes(s.userId);
                  return (
                    <PersonRow key={s.userId} friend={s} hideSeen>
                      <button
                        type="button"
                        className="btn btn--sm btn--outline"
                        disabled={busy || sent}
                        onClick={() => void run(async () => {
                          await fapi.request(s.userId);
                          haptic.success();
                          setRequested((r) => [...r, s.userId]);
                        })}
                      >
                        {sent ? t("friendsRequestSent") : t("friendsSendRequest")}
                      </button>
                    </PersonRow>
                  );
                })}
              </Section>
            )}

            {data.outgoing.length > 0 && (
              <Section title={t("friendsSentTitle")} count={data.outgoing.length}>
                {data.outgoing.map((r) => (
                  <PersonRow key={r.id} friend={r.player} sub={t("friendsWaiting")}>
                    <button type="button" className="btn btn--sm btn--outline" disabled={busy} onClick={() => void run(() => fapi.remove(r.player.userId))}>
                      {t("friendsCancel")}
                    </button>
                  </PersonRow>
                ))}
              </Section>
            )}
            <span className="visually-hidden" aria-live="polite">{t("profileFriendsCount", { count: n(data.friends.length) })}</span>
          </>
        )}
      </Body>
      <Toast message={toast} />
    </Screen>
  );
}

function Section({ title, sub, count, children }: { title: string; sub?: string; count?: number; children: ReactNode }) {
  const { n } = useLanguage();
  return (
    <section className="stack" style={{ gap: 8 }}>
      <div className="row row--between row--baseline">
        <h2 className="h2">{title}</h2>
        {count !== undefined && <span className="small muted num">{n(count)}</span>}
      </div>
      {sub && <div className="tiny muted" style={{ marginTop: -4 }}>{sub}</div>}
      <div className="list">{children}</div>
    </section>
  );
}

function PersonRow({ friend, sub, hideSeen, children }: { friend: Friend; sub?: string; hideSeen?: boolean; children?: ReactNode }) {
  const { t } = useLanguage();
  const seen = hideSeen ? null : seenText(friend, t);
  const line = sub ?? [seen, t("friendsLevel", { level: friend.level })].filter(Boolean).join(" · ");
  return (
    <div className="list__row" style={{ gap: 12, minHeight: 60, borderTopColor: "#232734" }}>
      <FriendAvatar friend={friend} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{friend.name}</div>
        <div className="tiny" style={{ color: friend.online && !sub && !hideSeen ? "#5FD0BE" : "var(--muted)" }}>{line}</div>
      </div>
      <div className="row" style={{ gap: 6, flex: "none" }}>{children}</div>
    </div>
  );
}

/** Opened from someone's /f/CODE friend link: who it is, and one tap to add them. */
export function FriendLinkScreen({ code }: { code: string }) {
  const { t } = useLanguage();
  const { reset, replace } = useNavigation();
  const { friends: fapi } = useHub();
  const preview = useLoad(() => fapi.previewCode(code), [fapi, code]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (preview.loading && !preview.data) return <LoadingScreen />;
  const p = preview.data;
  const name = p?.name ?? "?";

  async function add() {
    setBusy(true);
    setError(false);
    try {
      await fapi.addByCode(code);
      haptic.success();
      replace({ name: "friends" });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const canAdd = p && !p.isYou && !p.alreadyFriends;
  const text = !p ? t("friendLinkMissing") : p.isYou ? t("friendLinkYou") : p.alreadyFriends ? t("friendLinkAlready", { name }) : t("friendLinkText", { name });

  return (
    <Screen theme="hub">
      <TopBar onBack={() => reset({ name: "home" })} backLabel={t("backToHome")} title={t("friendLinkTitle")} titleSize={24} />
      <Body style={{ gap: 18 }}>
        <section className="stack center" style={{ gap: 14, padding: "28px 16px", borderRadius: 24, background: "#2A2113", textAlign: "center" }}>
          <Avatar name={name} color={AMBER} size={72} style={{ color: "#101218", fontWeight: 800 }} />
          {p && <div className="display" style={{ fontSize: 24, fontWeight: 800 }}>{name}</div>}
          {p && <div className="small muted">{t("friendsLevel", { level: p.level })}</div>}
          <p style={{ maxWidth: 300, fontSize: 15, lineHeight: 1.5, color: "#E3D3B8" }}>{text}</p>
        </section>
        {error && <div className="small" role="alert" style={{ color: "#F08A7A", textAlign: "center" }}>{t("genericError")}</div>}
      </Body>
      <div className="screen__bar">
        {canAdd ? (
          <button type="button" className="btn" style={{ minHeight: 54, background: AMBER, color: "#2A1A06", fontSize: 16 }} disabled={busy} onClick={() => void add()}>
            {t("friendLinkAdd", { name })}
          </button>
        ) : (
          <button type="button" className="btn btn--outline" style={{ minHeight: 54 }} onClick={() => replace({ name: "friends" })}>
            {t("friendsOpen")}
          </button>
        )}
      </div>
    </Screen>
  );
}
