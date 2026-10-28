import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { Icon } from "../ui/Icon";
import { useHub, useLoad } from "./HubData";
import { FriendAvatar } from "./FriendsScreen";
import { seenText } from "./friendText";
import { haptic } from "../lib/haptics";
import type { InviteKind, SentInvite } from "../api/friends";

/** "Invite friends" in a Mafia or online Esm-Famil lobby: opens the friend picker. */
export function InviteFriendsButton({ kind, target, accent, ink }: { kind: InviteKind; target: string; accent: string; ink: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn--md" style={{ background: accent, color: ink }} onClick={() => setOpen(true)}>
        <Icon name="people" size={18} />
        {t("inviteFriendsButton")}
      </button>
      {open && <InviteFriendsSheet kind={kind} target={target} accent={accent} ink={ink} onClose={() => setOpen(false)} />}
    </>
  );
}

function InviteFriendsSheet({ kind, target, accent, ink, onClose }: { kind: InviteKind; target: string; accent: string; ink: string; onClose(): void }) {
  const { t } = useLanguage();
  const { friends: fapi } = useHub();
  const { push } = useNavigation();
  const list = useLoad(() => fapi.list(), [fapi]);
  const sent = useLoad(() => fapi.sent(kind, target), [fapi, kind, target]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const statusOf = (userId: string): SentInvite["status"] | null => sent.data?.find((s) => s.userId === userId)?.status ?? null;

  async function invite(userId: string) {
    setBusy(userId);
    setFailed(false);
    try {
      await fapi.invite(kind, target, [userId]);
      haptic.success();
      sent.setData([...(sent.data ?? []).filter((s) => s.userId !== userId), { userId, status: "pending" }]);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  const friends = list.data?.friends ?? [];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(5,6,14,0.72)", display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-friends-title"
        className="stack"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxHeight: "80vh", boxSizing: "border-box", gap: 14, padding: "22px 16px calc(20px + var(--safe-bottom))", borderRadius: "28px 28px 0 0", background: "var(--surface)", color: "var(--text)" }}
      >
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="invite-friends-title" className="display" style={{ fontSize: 22 }}>{t("inviteFriendsTitle")}</h2>
          <span className="small muted">{t("inviteFriendsSub")}</span>
        </div>

        <div className="stack" style={{ gap: 0, overflowY: "auto", minHeight: 0, borderRadius: 16, background: "var(--bg)" }}>
          {list.loading && !list.data && <div className="skeleton" style={{ height: 180 }} />}
          {list.data && friends.length === 0 && (
            <div className="stack center" style={{ gap: 12, padding: "24px 16px", textAlign: "center" }}>
              <p className="small muted">{t("inviteNoFriends")}</p>
              <button type="button" className="btn btn--md btn--outline" onClick={() => { onClose(); push({ name: "friends" }); }}>{t("inviteAddFriends")}</button>
            </div>
          )}
          {friends.map((f, i) => {
            const status = statusOf(f.userId);
            const waiting = status === "pending" || status === "accepted";
            return (
              <div key={f.userId} className="row" style={{ gap: 12, minHeight: 60, padding: "8px 12px", borderTop: i ? "1px solid rgba(255,255,255,0.06)" : 0 }}>
                <FriendAvatar friend={f} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                  <div className="tiny" style={{ color: f.online ? "#5FD0BE" : "var(--muted)" }}>{seenText(f, t) ?? t("friendsLevel", { level: f.level })}</div>
                </div>
                {waiting ? (
                  <span className="row tiny" style={{ gap: 4, color: status === "accepted" ? "#5FD0BE" : "var(--text-2)", fontWeight: 600 }}>
                    <Icon name="check" size={14} />
                    {t(`inviteStatus_${status}`)}
                  </span>
                ) : (
                  <div className="row" style={{ gap: 8 }}>
                    {status === "declined" && <span className="tiny muted">{t("inviteStatus_declined")}</span>}
                    <button type="button" className="btn btn--sm" disabled={busy !== null} style={{ background: accent, color: ink }} onClick={() => void invite(f.userId)}>
                      {t("inviteSend")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {failed && <div className="small" role="alert" style={{ color: "#F08A7A" }}>{t("inviteGone")}</div>}
        <button type="button" className="btn btn--ghost" style={{ fontSize: 15, fontWeight: 600, color: "var(--text-2)" }} onClick={onClose}>{t("close")}</button>
      </div>
    </div>
  );
}
