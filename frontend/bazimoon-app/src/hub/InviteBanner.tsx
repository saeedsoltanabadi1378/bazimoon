import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation, type Route } from "../app/router";
import { Icon } from "../ui/Icon";
import { useHub } from "./HubData";
import { haptic } from "../lib/haptics";
import type { GameInvite } from "../api/friends";

const POLL_MS = 20_000;

/** Screens where a game is in progress: an invite waits until the player is out of it. */
function busyIn(route: Route) {
  return (route.name === "mafia" && !!route.gameId) || (route.name === "game" && (route.screen === "play" || route.screen === "online"));
}

/** A friend's invite into a Mafia table or Esm-Famil room, floating over the app. The app checks
 * for invites while it is open; the server also counts that as the player being online. */
export function InviteBanner() {
  const { t } = useLanguage();
  const { friends } = useHub();
  const { route, push } = useNavigation();
  const [invites, setInvites] = useState<GameInvite[]>([]);
  const [hidden, setHidden] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);

  const load = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    friends.invites().then(setInvites).catch(() => undefined);
  }, [friends]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
  }, [load]);

  const invite = invites.find((i) => !hidden.includes(i.id));

  if (!invite || busyIn(route)) return null;

  const dismiss = () => {
    setHidden((h) => [...h, invite.id]);
    setGone(false);
  };

  async function join() {
    setBusy(true);
    try {
      const joined = await friends.acceptInvite(invite!.id);
      haptic.success();
      dismiss();
      if (joined.kind === "mafia" && joined.gameId) push({ name: "mafia", gameId: joined.gameId });
      else if (joined.code) push({ name: "game", game: "esmfamil", screen: "lobby", params: { code: joined.code } });
    } catch {
      setGone(true);
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    dismiss();
    await friends.declineInvite(invite!.id).catch(() => undefined);
  }

  const mafia = invite.kind === "mafia";
  return (
    <div
      data-theme="night"
      role="alertdialog"
      aria-labelledby="invite-banner-title"
      style={{
        position: "fixed", zIndex: 25, top: "calc(10px + var(--safe-top, 0px))", insetInline: 12, margin: "0 auto", maxWidth: 420,
        display: "flex", flexDirection: "column", gap: 12, padding: 14, borderRadius: 20,
        background: mafia ? "#1A1836" : "#241A0E", border: `1.5px solid ${mafia ? "#9C8CFF" : "#F6C377"}`,
        boxShadow: "0 12px 32px rgba(0,0,0,0.45)", color: "var(--text)", fontFamily: "var(--font-body)",
      }}
    >
      <div className="row" style={{ gap: 12 }}>
        <span style={{ width: 40, height: 40, flex: "none", borderRadius: 999, background: mafia ? "#2A2650" : "#3A2A16", color: mafia ? "#9C8CFF" : "#F6C377", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={mafia ? "mafia" : "esmFamil"} size={22} />
        </span>
        <div className="grow stack" style={{ gap: 2, minWidth: 0 }}>
          <span id="invite-banner-title" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>
            {mafia ? t("inviteFromMafia", { name: invite.fromName }) : t("inviteFromEsm", { name: invite.fromName })}
          </span>
          {gone && <span className="tiny" role="alert" style={{ color: "#F08A7A" }}>{t("inviteGone")}</span>}
        </div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        {gone ? (
          <button type="button" className="btn btn--md btn--outline" style={{ flex: 1 }} onClick={dismiss}>{t("close")}</button>
        ) : (
          <>
            <button type="button" className="btn btn--md btn--outline" style={{ flex: 1 }} disabled={busy} onClick={() => void decline()}>{t("inviteNotNow")}</button>
            <button type="button" className="btn btn--md" style={{ flex: 1.4, background: mafia ? "#9C8CFF" : "#F6C377", color: mafia ? "#120D2E" : "#2A1A06" }} disabled={busy} onClick={() => void join()}>
              {t("inviteJoin")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
