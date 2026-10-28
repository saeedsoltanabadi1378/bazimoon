import { useState, type FormEvent } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { Icon } from "../ui/Icon";
import { useGame } from "./GameProvider";
import { useVoice } from "./VoiceProvider";

const categories = ["harassment", "cheating", "voice", "name", "other"] as const;

/** Local mute is immediate and private. Block persists across future Mafia lobbies; reports are
 * stored for moderation with this game id as evidence context. */
export function PlayerSafetyButton() {
  const { view, safetyPlayers, blockedPlayers, blockPlayer, reportPlayer, busy, actionError, clearActionError } = useGame();
  const voice = useVoice();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [category, setCategory] = useState<(typeof categories)[number]>("harassment");
  const [note, setNote] = useState("");
  const [sentFor, setSentFor] = useState<string | null>(null);
  if (!view) return null;
  const players = view.players.filter((player) => player.playerId !== view.yourPlayerId);
  if (players.length === 0) return null;
  const target = players.find((player) => player.playerId === selected) ?? null;
  const safetyTarget = target ? safetyPlayers.find((player) => player.playerId === target.playerId) : null;
  const blocked = target ? blockedPlayers.some((player) => player.playerId === target.playerId) : false;
  const locallyMuted = target ? voice.isPlayerMuted(target.playerId) : false;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!target || busy) return;
    if (await reportPlayer(target.playerId, category, note.trim() || null)) setSentFor(target.playerId);
  }

  return (
    <>
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => { clearActionError(); setOpen(true); }} style={{ alignSelf: "flex-start", color: "var(--text-2)" }}>
        <Icon name="shield" size={16} /> {t("playerSafety")}
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.62)", display: "flex", alignItems: "flex-end" }} onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="safety-title" className="stack" onClick={(e) => e.stopPropagation()} style={{ width: "100%", boxSizing: "border-box", gap: 12, padding: "20px 16px 26px", borderRadius: "24px 24px 0 0", background: "var(--surface)", maxHeight: "82%", overflowY: "auto" }}>
            <div className="row row--between">
              <h2 id="safety-title" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{target ? t("safetyFor", { name: target.displayName }) : t("playerSafety")}</h2>
              <button type="button" className="btn btn--ghost btn--auto" style={{ minHeight: 32, padding: "0 8px" }} onClick={() => setOpen(false)} aria-label={t("close")}><Icon name="close" size={18} /></button>
            </div>
            {!target ? (
              <>
                <p className="small muted" style={{ margin: 0 }}>{t("playerSafetyText")}</p>
                <div className="list">
                  {players.map((player) => (
                    <button key={player.playerId} type="button" className="list__row" onClick={() => { clearActionError(); setSelected(player.playerId); }} style={{ width: "100%", border: 0, color: "var(--text)", font: "inherit", textAlign: "start", cursor: "pointer" }}>
                      <span className="grow" dir="auto">{player.displayName}</span>
                      {blockedPlayers.some((item) => item.playerId === player.playerId) && <span className="tiny" style={{ color: "#F08A7A" }}>{t("blocked")}</span>}
                      <Icon name="forward" size={16} className="flip-rtl" color="var(--muted)" />
                    </button>
                  ))}
                </div>
              </>
            ) : sentFor === target.playerId ? (
              <div className="stack center" style={{ padding: "18px 0", textAlign: "center" }}>
                <Icon name="check" size={32} color="#5FD0BE" />
                <strong>{t("reportSent")}</strong>
                <p className="small muted">{t("reportSentText")}</p>
                <button type="button" className="btn btn--primary" onClick={() => setOpen(false)}>{t("close")}</button>
              </div>
            ) : (
              <>
                {actionError && <div role="alert" className="small" style={{ padding: 10, borderRadius: 10, background: "#321A1A", color: "#F3A9A0" }}>{actionError}</div>}
                <button type="button" className="btn btn--outline" disabled={!safetyTarget} onClick={() => {
                  if (!safetyTarget) return;
                  voice.setPlayerMuted(target.playerId, safetyTarget.voiceUid, !locallyMuted);
                }}>
                  <Icon name={locallyMuted ? "mic" : "mute"} size={18} /> {locallyMuted ? t("localUnmutePlayer") : t("localMutePlayer")}
                </button>
                <button type="button" className="btn btn--outline" disabled={!safetyTarget || blocked || busy} onClick={async () => {
                  if (!safetyTarget || blocked) return;
                  if (await blockPlayer(target.playerId)) voice.setPlayerMuted(target.playerId, safetyTarget.voiceUid, true);
                }} style={{ color: blocked ? "var(--muted)" : "#F08A7A" }}>
                  <Icon name="eliminated" size={18} /> {blocked ? t("blocked") : t("blockPlayer")}
                </button>
                <p className="tiny muted" style={{ margin: 0 }}>{t("blockPlayerText")}</p>
                <form className="stack" onSubmit={submit} style={{ gap: 10, paddingTop: 8, borderTop: "1px solid var(--edge-soft)" }}>
                  <strong style={{ fontSize: 15 }}>{t("reportPlayer")}</strong>
                  <div role="radiogroup" aria-label={t("reportReason")} className="row row--wrap">
                    {categories.map((item) => (
                      <button key={item} type="button" role="radio" aria-checked={category === item} onClick={() => setCategory(item)} style={{ minHeight: 38, padding: "0 12px", borderRadius: 999, border: `1px solid ${category === item ? "#F08A7A" : "var(--edge-soft)"}`, background: category === item ? "#2A1612" : "transparent", color: "var(--text)", font: "inherit", fontSize: 13, cursor: "pointer" }}>
                        {t(`report_${item}`)}
                      </button>
                    ))}
                  </div>
                  <textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder={t("reportNotePlaceholder")} style={{ minHeight: 82, resize: "vertical", padding: 10, borderRadius: 12, border: "1px solid var(--edge-soft)", background: "var(--bg)", color: "var(--text)", font: "inherit" }} />
                  <button type="submit" className="btn" disabled={busy} style={{ background: "#E5604D", color: "#1C0905" }}>{t("sendReport")}</button>
                </form>
                <button type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>{t("back")}</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
