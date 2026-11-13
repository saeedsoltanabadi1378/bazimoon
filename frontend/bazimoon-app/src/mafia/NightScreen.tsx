import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import type { NightActionType, Role } from "../api/types";
import { useGame } from "./GameProvider";
import { useLanguage, type TranslationKey } from "../i18n/LanguageContext";
import { Banner, Bar, Body, IconDisc, PhaseHeader, Screen } from "../ui/components";
import { findPlayer, isMafiaRole, nightLabelNumber, roleMeta } from "./roles";
import { ActionError, PhaseTimer, ReconnectingBanner, RolePeek, VoiceStatusLine, TableNotices } from "./parts";
import { GraveyardBar, SpectatorBanner } from "./Graveyard";
import { HeaderTools } from "./table";
import { TableScene, type SeatTag } from "./TableScene";
import { haptic } from "../lib/haptics";

interface NightAction {
  type: NightActionType;
  verb: TranslationKey;
  prompt: TranslationKey;
  includeSelf: boolean;
  /** What the "do nothing tonight" button says, for the roles that may. */
  pass?: TranslationKey;
}

const actions: Partial<Record<Role, NightAction>> = {
  Detective: { type: "Investigate", verb: "investigate", prompt: "promptInvestigate", includeSelf: false },
  Doctor: { type: "Heal", verb: "heal", prompt: "promptHeal", includeSelf: true },
  Godfather: { type: "Kill", verb: "kill", prompt: "promptKill", includeSelf: false },
  Mafia: { type: "Kill", verb: "suggestKill", prompt: "promptSuggest", includeSelf: false },
  Sniper: { type: "Shoot", verb: "shoot", prompt: "sniperTitle", includeSelf: false, pass: "holdFire" },
  Silencer: { type: "Silence", verb: "silence", prompt: "silenceTitle", includeSelf: false },
  Negotiator: { type: "Negotiate", verb: "negotiate", prompt: "negotiateTitle", includeSelf: false, pass: "notTonight" },
  Bodyguard: { type: "Guard", verb: "guard", prompt: "guardTitle", includeSelf: false },
};

export function NightScreen() {
  const { view, busy, submitNightAction, submitSuspicion, passNight } = useGame();
  const { t } = useLanguage();
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmShot, setConfirmShot] = useState(false);
  const nightKey = `${view?.gameId}-${view?.nightNumber}`;

  // A new night starts with a clean pick.
  useEffect(() => {
    setPicked(null);
    setConfirmShot(false);
  }, [nightKey]);

  if (!view) return null;

  const role = view.yourRole;
  const alive = view.youAreAlive;
  // The Sniper has one shot and the Negotiator one try for the whole game.
  const shotUsed = role === "Sniper" && view.yourAbilityUsed;
  // A Negotiator who has had their try plans the kill with the rest of the Mafia.
  const action = !alive || !role || shotUsed ? undefined : role === "Negotiator" && view.yourAbilityUsed ? actions.Mafia : actions[role];
  const meta = role ? roleMeta[role] : roleMeta.Villager;
  const lockedTarget = view.yourNightActionTargetId;
  const submitted = Boolean(lockedTarget);
  const passed = view.youPassedTonight;
  const canAct = Boolean(action) && !submitted && !passed;
  // Everyone without a night action makes a private guess instead, so the whole table is busy at night.
  const suspecting = alive && !action;
  const suspected = view.yourSuspicionTargetId;
  const canSuspect = suspecting && !suspected && !passed;
  const picking = canAct || canSuspect;
  const accent = canSuspect ? "#C9A25A" : meta.fg;
  const mafiaSide = isMafiaRole(role);
  const teamIds = new Set((view.mafiaTeam ?? []).map((m) => m.playerId));
  const checked = new Map((view.yourInvestigations ?? []).map((r) => [r.targetPlayerId, r.isMafiaAligned]));
  const name = (id: string | null | undefined) => {
    const p = findPlayer(view, id);
    if (!p) return t("unknown");
    return p.playerId === view.yourPlayerId ? t("youName", { name: p.displayName }) : p.displayName;
  };

  // Info line above the targets, per role.
  let info: string | null = null;
  let infoBg = "var(--surface)";
  if (canSuspect) {
    info = t("suspectPrompt");
    infoBg = "#241A12";
  } else if (role === "Detective" && view.yourLastInvestigationResult) {
    info = t(view.yourLastInvestigationResult.isMafiaAligned ? "lastNightMafia" : "lastNightTown", { name: name(view.yourLastInvestigationResult.targetPlayerId) });
    infoBg = "#141F33";
  } else if (role === "Sniper" && view.yourShot?.outcome === "Saved") {
    info = t("shotSavedText", { name: name(view.yourShot.targetPlayerId) });
    infoBg = "#141F33";
  } else if (role === "Silencer") {
    info = t("silencePrompt");
    infoBg = "#2A1418";
  } else if (action?.type === "Negotiate") {
    info = t("negotiatePrompt");
    infoBg = "#2A1418";
  } else if (role === "Bodyguard") {
    info = t("guardPrompt");
    infoBg = "#141F33";
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

  const targets = view.players.filter((p) => (canAct && action?.includeSelf) || p.playerId !== view.yourPlayerId).map((p) => {
    const you = p.playerId === view.yourPlayerId;
    let note = "";
    let noteColor = "var(--muted)";
    let disabled = false;
    if (!p.isAlive) {
      note = t("eliminated");
      disabled = true;
    } else if (canSuspect) {
      // A guess can land on anyone.
    } else if (role === "Detective" && checked.has(p.playerId)) {
      note = checked.get(p.playerId) ? t("checkedMafia") : t("checkedTown");
      noteColor = checked.get(p.playerId) ? "#F08A7A" : "#5FD0BE";
      disabled = true;
    } else if (role === "Doctor" && you && view.youCannotHealSelf) {
      note = t("healedLastNight");
      disabled = true;
    } else if (role === "Bodyguard" && p.playerId === view.yourLastGuardedId) {
      note = t("guardedLastNight");
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

  // Picking happens on the table: each seat carries what the old target list said about that player.
  const seatTags = new Map<string, SeatTag>();
  const pickable = new Set<string>();
  for (const target of targets) {
    if (!target.disabled) pickable.add(target.p.playerId);
    if (target.note && target.p.isAlive && !(target.you && target.note === t("you"))) seatTags.set(target.p.playerId, { text: target.note, color: target.noteColor === "var(--muted)" ? undefined : target.noteColor });
  }

  const prompt = canSuspect ? t("suspectTitle") : action ? t(action.prompt) : "";
  const passLabel = canSuspect ? t("skipTonight") : canAct && action?.pass ? t(action.pass) : null;

  let waitTitle: string;
  let waitText: string;
  if (view.youAreSpectator) {
    waitTitle = t("watchingNightTitle");
    waitText = t("watchingNightText");
  } else if (!alive) {
    waitTitle = t("outOfGame");
    waitText = t("outOfGameText");
  } else if (suspected) {
    waitTitle = t("suspicionNoted");
    waitText = t("suspicionWaiting", { name: name(suspected) });
  } else if (passed) {
    waitTitle = role === "Sniper" && !shotUsed ? t("holdingFire") : t("passedTonight");
    waitText = t("noActionText");
  } else if (action) {
    waitTitle = action.verb === "suggestKill" ? t("suggestionSent") : t("lockedIn", { action: t(action.verb) });
    waitText = t("youChoseWaiting", { name: name(lockedTarget) });
  } else {
    waitTitle = t("noActionTonight");
    waitText = t("noActionText");
  }

  async function submit() {
    if (!picked) return;
    if (canSuspect) {
      if (await submitSuspicion(picked)) haptic.success();
      return;
    }
    if (!action) return;
    if (action.type === "Shoot" && !confirmShot) {
      setConfirmShot(true);
      return;
    }
    setConfirmShot(false);
    const ok = await submitNightAction(picked, action.type);
    if (ok) haptic.success();
  }

  const submitLabel = !picked ? t("pickAPlayer")
    : canSuspect ? t("suspectName", { name: name(picked) })
    : action?.type === "Shoot" ? t("shootName", { name: name(picked) })
    : action?.type === "Silence" ? t("silenceName", { name: name(picked) })
    : action?.type === "Negotiate" ? t("negotiateName", { name: name(picked) })
    : action?.type === "Guard" ? t("guardName", { name: name(picked) })
    : t("actOn", { action: action ? t(action.verb) : "", name: name(picked) });

  return (
    <Screen theme="night" className="screen--table">
      <PhaseHeader kicker={t("nightFalls")} title={t("nightN", { number: nightLabelNumber(view) })} right={<HeaderTools><RolePeek role={role} alive={alive} /></HeaderTools>} />
      <TableScene
        pick={picking ? { selected: picked, canPick: (id) => !busy && pickable.has(id), onPick: setPicked } : null}
        tags={picking ? seatTags : undefined}
      />

      <Body tight>
        <ReconnectingBanner />
        <SpectatorBanner />
        <TableNotices />
        <PhaseTimer
          deadline={view.phaseDeadline} total={view.rules.nightSeconds} label={(seconds) => t("nightSecondsLeft", { seconds })}
        />
        {info && picking && <Banner icon="info" iconColor={accent} background={infoBg}><span style={{ color: "var(--text-soft)" }}>{info}</span></Banner>}

        {picking ? (
          <section className="stack" style={{ gap: 6, padding: 14, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--edge-soft)" }} aria-live="polite">
            <h2 style={{ fontSize: 17, fontWeight: 600 }}>{prompt}</h2>
            <p className="small" style={{ color: picked ? accent : "var(--muted)" }}>{picked ? t("seatPicked", { name: name(picked) }) : t("tapASeat")}</p>
          </section>
        ) : (
          <section className="stack center" style={{ gap: 12, padding: "36px 18px", borderRadius: 22, background: "var(--surface-3)", textAlign: "center" }}>
            <IconDisc icon={view.youAreSpectator ? "moon" : !alive ? "eliminated" : action || suspected ? "check" : "moon"} size={80} iconSize={36} bg="#2A1E14" fg="#C9A25A" />
            <h2 className="display" style={{ fontSize: 21, fontWeight: 700 }}>{waitTitle}</h2>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-2)", maxWidth: 280 }}>{waitText}</p>
          </section>
        )}

        <ActionError />
      </Body>

      <Bar>
        <GraveyardBar />
        {picking && (
          <button
            type="button"
            className="btn"
            disabled={!picked || busy}
            onClick={() => void submit()}
            style={{ background: picked ? accent : "var(--surface-2)", color: picked ? "#120C06" : "var(--faint)" }}
          >
            {submitLabel}
          </button>
        )}
        {passLabel && (
          <button type="button" className="btn btn--outline" disabled={busy} onClick={() => void passNight()}>{passLabel}</button>
        )}
        <VoiceStatusLine />
      </Bar>
      {confirmShot && picked && (
        <div style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(5,3,2,0.76)", display: "flex", alignItems: "flex-end" }}>
          <div role="dialog" aria-modal="true" aria-labelledby="shot-title" className="stack" style={{ width: "100%", boxSizing: "border-box", gap: 12, padding: "22px 16px 26px", borderRadius: "24px 24px 0 0", background: "var(--surface)" }}>
            <h2 id="shot-title" className="row" style={{ gap: 8, fontSize: 20, fontWeight: 700 }}><Icon name="target" color="#E5604D" />{t("shootConfirmTitle", { name: name(picked) })}</h2>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-2)" }}>{t("shootConfirmText", { name: name(picked) })}</p>
            <button type="button" className="btn" style={{ background: "#E5604D", color: "#1C0905" }} disabled={busy} onClick={() => void submit()}>{t("shootConfirmYes")}</button>
            <button type="button" className="btn btn--outline" autoFocus onClick={() => setConfirmShot(false)}>{t("shootConfirmNo")}</button>
          </div>
        </div>
      )}
    </Screen>
  );
}
