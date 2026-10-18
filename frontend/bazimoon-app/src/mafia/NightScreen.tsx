import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import type { NightActionType, Role } from "../api/types";
import { useGame } from "./GameProvider";
import { useLanguage, type TranslationKey } from "../i18n/LanguageContext";
import { Banner, Bar, Body, IconDisc, PhaseHeader, ProgressBar, Screen } from "../ui/components";
import { findPlayer, isMafiaRole, nightLabelNumber, playerColor, roleMeta } from "./roles";
import { ActionError, LeaveGameButton, CreatorBox, PhaseTimer, ReconnectingBanner, RolePeek, VoiceStatusLine, TableNotices } from "./parts";
import { haptic } from "../lib/haptics";

const actions: Partial<Record<Role, { type: NightActionType; verb: TranslationKey; prompt: TranslationKey; includeSelf: boolean }>> = {
  Detective: { type: "Investigate", verb: "investigate", prompt: "promptInvestigate", includeSelf: false },
  Doctor: { type: "Heal", verb: "heal", prompt: "promptHeal", includeSelf: true },
  Godfather: { type: "Kill", verb: "kill", prompt: "promptKill", includeSelf: false },
  Mafia: { type: "Kill", verb: "suggestKill", prompt: "promptSuggest", includeSelf: false },
  Sniper: { type: "Shoot", verb: "shoot", prompt: "sniperTitle", includeSelf: false },
  Silencer: { type: "Silence", verb: "silence", prompt: "silenceTitle", includeSelf: false },
};

export function NightScreen() {
  const { view, busy, submitNightAction, resolveNight } = useGame();
  const { t } = useLanguage();
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmShot, setConfirmShot] = useState(false);
  const [holding, setHolding] = useState(false);
  const nightKey = `${view?.gameId}-${view?.nightNumber}`;

  // A new night starts with a clean pick.
  useEffect(() => {
    setPicked(null);
    setHolding(false);
    setConfirmShot(false);
  }, [nightKey]);

  if (!view) return null;

  const role = view.yourRole;
  const alive = view.youAreAlive;
  // The Sniper has one shot for the whole game.
  const shotUsed = role === "Sniper" && view.yourAbilityUsed;
  const action = alive && role && !shotUsed ? actions[role] : undefined;
  const meta = role ? roleMeta[role] : roleMeta.Villager;
  const lockedTarget = view.yourNightActionTargetId;
  const submitted = Boolean(lockedTarget);
  const canAct = Boolean(action) && !submitted && !holding;
  const mafiaSide = isMafiaRole(role);
  const teamIds = new Set((view.mafiaTeam ?? []).map((m) => m.playerId));
  const checked = new Map((view.yourInvestigations ?? []).map((r) => [r.targetPlayerId, r.isMafiaAligned]));
  const name = (id: string | null | undefined) => {
    const p = findPlayer(view, id);
    if (!p) return t("unknown");
    return p.playerId === view.yourPlayerId ? t("youName", { name: p.telegramUsername }) : p.telegramUsername;
  };

  // Info line above the targets, per role.
  let info: string | null = null;
  let infoBg = "var(--surface)";
  if (role === "Detective" && view.yourLastInvestigationResult) {
    info = t(view.yourLastInvestigationResult.isMafiaAligned ? "lastNightMafia" : "lastNightTown", { name: name(view.yourLastInvestigationResult.targetPlayerId) });
    infoBg = "#141F33";
  } else if (role === "Sniper" && view.yourShot?.outcome === "Saved") {
    info = t("shotSavedText", { name: name(view.yourShot.targetPlayerId) });
    infoBg = "#141F33";
  } else if (role === "Silencer") {
    info = t("silencePrompt");
    infoBg = "#2A1418";
  } else if (role === "Sniper") {
    info = t("sniperPrompt");
    infoBg = "#141F33";
  } else if (role === "Doctor" && view.youCannotHealSelf) {
    info = t("doctorSelfBlocked");
    infoBg = "#10251F";
  } else if (mafiaSide) {
    const godfather = view.mafiaTeam?.find((m) => m.role === "Godfather" && m.isAlive);
    const suggestions = (view.mafiaSuggestions ?? []).filter((s) => s.actorPlayerId !== view.yourPlayerId);
    if (role === "Godfather") {
      info = suggestions.length
        ? suggestions.map((s) => t("suggests", { name: name(s.actorPlayerId), target: name(s.targetPlayerId) })).join(" ") + " " + t("yourCallFinal")
        : t("youMakeTheCall");
      if (view.mafiaSilenceTargetId) info += " " + t("mafiaSilencing", { name: name(view.mafiaSilenceTargetId) }) + ".";
    } else if (godfather) {
      info = t("godfatherDecides", { name: name(godfather.playerId) });
    }
    infoBg = "#2A1418";
  }

  const suggestedBy = new Map<string, string[]>();
  for (const s of view.mafiaSuggestions ?? []) {
    if (s.actorPlayerId === view.yourPlayerId) continue;
    suggestedBy.set(s.targetPlayerId, [...(suggestedBy.get(s.targetPlayerId) ?? []), name(s.actorPlayerId)]);
  }

  const targets = view.players.filter((p) => action?.includeSelf || p.playerId !== view.yourPlayerId).map((p) => {
    const you = p.playerId === view.yourPlayerId;
    let note = "";
    let noteColor = "var(--muted)";
    let disabled = false;
    if (!p.isAlive) {
      note = t("eliminated");
      disabled = true;
    } else if (role === "Detective" && checked.has(p.playerId)) {
      note = checked.get(p.playerId) ? t("checkedMafia") : t("checkedTown");
      noteColor = checked.get(p.playerId) ? "#F08A7A" : "#5FD0BE";
      disabled = true;
    } else if (role === "Doctor" && you && view.youCannotHealSelf) {
      note = t("healedLastNight");
      disabled = true;
    } else if (mafiaSide && teamIds.has(p.playerId)) {
      note = t("yourTeam");
      noteColor = "#F08A7A";
      disabled = true;
    } else if (role === "Godfather" && suggestedBy.has(p.playerId)) {
      note = t("suggestedBy", { names: suggestedBy.get(p.playerId)!.join(", ") });
      noteColor = "#F08A7A";
    } else if (you) {
      note = t("you");
    }
    return { p, you, note, noteColor, disabled };
  });

  const progress = view.nightProgress;
  const allIn = view.requiredNightActionsComplete;

  let waitTitle: string;
  let waitText: string;
  if (!alive) {
    waitTitle = t("outOfGame");
    waitText = t("outOfGameText");
  } else if (shotUsed) {
    waitTitle = t("shotUsedTitle");
    waitText = t("shotUsedText");
  } else if (holding && !submitted) {
    waitTitle = t("holdingFire");
    waitText = t("noActionText");
  } else if (action) {
    waitTitle = role === "Mafia" ? t("suggestionSent") : t("lockedIn", { action: t(action.verb) });
    waitText = t("youChoseWaiting", { name: name(lockedTarget) });
  } else {
    waitTitle = t("noActionTonight");
    waitText = t("noActionText");
  }

  async function submit() {
    if (!action || !picked) return;
    if (action.type === "Shoot" && !confirmShot) {
      setConfirmShot(true);
      return;
    }
    setConfirmShot(false);
    const ok = await submitNightAction(picked, action.type);
    if (ok) haptic.success();
  }

  return (
    <Screen theme="night">
      <PhaseHeader kicker={t("nightFalls")} title={t("nightN", { number: nightLabelNumber(view) })} right={<RolePeek role={role} alive={alive} />} />

      <Body tight>
        <ReconnectingBanner />
        <TableNotices />
        <PhaseTimer
          deadline={view.phaseDeadline} total={view.rules.nightSeconds} label={(seconds) => t("nightSecondsLeft", { seconds })}
          accent="#9C8CFF" track="#262A44" bg="#151829" edge="#262A44"
        />
        {info && canAct && <Banner icon="info" iconColor={meta.fg} background={infoBg}><span style={{ color: "var(--text-soft)" }}>{info}</span></Banner>}

        {canAct && action ? (
          <section className="stack">
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>{t(action.prompt)}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }} role="radiogroup" aria-label={t(action.prompt)}>
              {targets.map(({ p, you, note, noteColor, disabled }) => {
                const on = picked === p.playerId;
                return (
                  <button
                    key={p.playerId}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={disabled || busy}
                    onClick={() => {
                      haptic.select();
                      setPicked(p.playerId);
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, minHeight: 60, padding: "10px 12px", borderRadius: 16,
                      border: `2px solid ${on ? meta.fg : "var(--edge-soft)"}`, background: on ? "#1A1D36" : "var(--surface)",
                      color: "var(--text)", textAlign: "start", opacity: disabled ? 0.4 : 1, cursor: disabled ? "default" : "pointer",
                    }}
                  >
                    <span className="avatar" aria-hidden="true" style={{ width: 36, height: 36, fontSize: 15, background: playerColor(view, p.playerId) }}>
                      {Array.from(p.telegramUsername)[0]?.toUpperCase()}
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{you ? t("youName", { name: p.telegramUsername }) : p.telegramUsername}</span>
                      {note && <span className="tiny" style={{ color: noteColor }}>{note}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="stack center" style={{ gap: 12, padding: "36px 18px", borderRadius: 22, background: "var(--surface-3)", textAlign: "center" }}>
            <IconDisc icon={!alive ? "eliminated" : action ? "check" : "moon"} size={80} iconSize={36} bg="#1E2138" fg="#9C8CFF" />
            <h2 className="display" style={{ fontSize: 21, fontWeight: 700 }}>{waitTitle}</h2>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-2)", maxWidth: 280 }}>{waitText}</p>
          </section>
        )}

        {view.youAreController && (
          <CreatorBox>
            <div className="row row--between" style={{ fontSize: 13 }}>
              <span className="muted">{t("gameCreator")}</span>
              {progress && <span className="strong">{t("nightActionsIn", { done: progress.submitted, total: progress.required })}</span>}
            </div>
            {progress && <ProgressBar value={progress.required ? (progress.submitted / progress.required) * 100 : 100} label={t("nightActionsIn", { done: progress.submitted, total: progress.required })} />}
            <button
              type="button"
              className={`btn btn--sm${allIn ? " btn--primary" : " btn--locked"}`}
              disabled={busy || !allIn}
              onClick={() => void resolveNight()}
            >
              {allIn ? t("endNight") : t("waitingNightRoles")}
            </button>
          </CreatorBox>
        )}
        <ActionError />
        <LeaveGameButton />
      </Body>

      <Bar>
        {canAct && action && (
          <button
            type="button"
            className="btn"
            disabled={!picked || busy}
            onClick={() => void submit()}
            style={{ background: picked ? meta.fg : "var(--surface-2)", color: picked ? "#0B0D1A" : "var(--faint)" }}
          >
            {!picked ? t("pickAPlayer")
              : action.type === "Shoot" ? t("shootName", { name: name(picked) })
              : action.type === "Silence" ? t("silenceName", { name: name(picked) })
              : t("actOn", { action: t(action.verb), name: name(picked) })}
          </button>
        )}
        {canAct && action?.type === "Shoot" && (
          <button type="button" className="btn btn--outline" onClick={() => setHolding(true)}>{t("holdFire")}</button>
        )}
        <VoiceStatusLine />
      </Bar>
      {confirmShot && picked && (
        <div style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(5,6,14,0.72)", display: "flex", alignItems: "flex-end" }}>
          <div role="dialog" aria-modal="true" aria-labelledby="shot-title" className="stack" style={{ width: "100%", boxSizing: "border-box", gap: 12, padding: "22px 16px 26px", borderRadius: "24px 24px 0 0", background: "var(--surface)" }}>
            <h2 id="shot-title" className="row" style={{ gap: 8, fontSize: 20, fontWeight: 700 }}><Icon name="target" color="#8FA8FF" />{t("shootConfirmTitle", { name: name(picked) })}</h2>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-2)" }}>{t("shootConfirmText", { name: name(picked) })}</p>
            <button type="button" className="btn" style={{ background: "#E5604D", color: "#1C0905" }} disabled={busy} onClick={() => void submit()}>{t("shootConfirmYes")}</button>
            <button type="button" className="btn btn--outline" autoFocus onClick={() => setConfirmShot(false)}>{t("shootConfirmNo")}</button>
          </div>
        </div>
      )}
    </Screen>
  );
}
