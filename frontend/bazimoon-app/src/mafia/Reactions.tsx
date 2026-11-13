import { useState, type ReactNode } from "react";
import { useGame } from "./GameProvider";
import { useLanguage } from "../i18n/LanguageContext";
import { reactionKinds, type ReactionKind } from "./reactionTypes";
import "./reactions.css";

export const reactionColors: Record<ReactionKind, string> = { suspect: "#e2b86b", trust: "#78d7b5", bluff: "#ef8d93", think: "#b6a0ec", shock: "#8cc9ee", applause: "#f1ca75" };

/** One shape per reaction, so they are told apart at a glance and not by colour alone. */
const glyphs: Record<ReactionKind, ReactNode> = {
  // An eye.
  suspect: <><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="2.8" fill="currentColor" stroke="none" /></>,
  // A thumbs-up.
  trust: <><path d="M7 10.5v10.5" /><path d="M14.6 6 13.8 10.5h5.6a2 2 0 0 1 1.9 2.6l-2.2 6.5a2 2 0 0 1-1.9 1.4H4.5a1.5 1.5 0 0 1-1.5-1.5V12a1.5 1.5 0 0 1 1.5-1.5h2.3a2 2 0 0 0 1.8-1.1L11.6 3a2.8 2.8 0 0 1 3 3Z" /></>,
  // A masquerade mask.
  bluff: <><path d="M2.5 8.5c3-1.8 6.5-1.6 9.5.6 3-2.2 6.5-2.4 9.5-.6 0 5-2.6 8.5-5.8 8.5-1.7 0-2.6-1.8-3.7-1.8s-2 1.8-3.7 1.8c-3.2 0-5.8-3.5-5.8-8.5Z" /><path d="M6.3 11.5h3M14.7 11.5h3" /></>,
  // A thought bubble.
  think: <><path d="M20.5 11a8 7 0 0 1-8.5 7 9.5 9.5 0 0 1-3.3-.6L4 19.5l1.3-3.7A6.6 6.6 0 0 1 3.5 11a8 7 0 0 1 8.5-7 8 7 0 0 1 8.5 7Z" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth="2.6" /></>,
  // An exclamation mark.
  shock: <><path d="M12 3.5v10.5" strokeWidth="3.2" /><path d="M12 19.5h.01" strokeWidth="3.4" /><path d="M4.5 6.5l2.2 1.8M19.5 6.5l-2.2 1.8" /></>,
  // A star.
  applause: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9l-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8Z" />,
};

/** The reaction's own line icon in its colour, crisp at every size. */
export function ReactionArt({ kind, size = 24 }: { kind: ReactionKind; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="mafia-reaction-art" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ color: reactionColors[kind] }}>
      {glyphs[kind]}
    </svg>
  );
}

/** Whether you may react right now: alive, not silenced, and the town is awake. */
export function useCanReact() {
  const { view } = useGame();
  if (!view) return false;
  const awake = view.phase === "Day" || view.phase === "Defence" || view.phase === "Voting" || view.phase === "LastWords";
  return awake && view.youAreAlive && !view.youAreSpectator && view.silencedPlayerId !== view.yourPlayerId;
}

/**
 * The reactions, one tap each, in the dock. What is sent shows at your seat on the table, so there
 * is no feed here and nothing that moves while you aim for a button.
 */
export function ReactionRow() {
  const { link, sendReaction, reactionCooling } = useGame();
  const { t } = useLanguage();
  const canReact = useCanReact();
  const [failed, setFailed] = useState(false);
  if (!canReact) return null;
  const offline = link !== "connected";
  return (
    <div className="reaction-row-wrap">
      <div className={`reaction-row${reactionCooling ? " reaction-row--cooling" : ""}`} role="group" aria-label={t("reactionsTitle")}>
        {reactionKinds.map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={offline || reactionCooling}
            aria-label={t(`reaction_${kind}`)}
            title={t(`reaction_${kind}`)}
            onClick={async () => {
              setFailed(false);
              setFailed(!(await sendReaction(kind)));
            }}
          >
            <ReactionArt kind={kind} size={22} />
          </button>
        ))}
      </div>
      {offline ? <p className="reaction-row__note">{t("reactionsOffline")}</p>
        : failed && <p className="reaction-row__note reaction-row__note--error" role="alert">{t("reactionsFailed")}</p>}
    </div>
  );
}
