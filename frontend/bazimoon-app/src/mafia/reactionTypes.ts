export const reactionKinds = ['suspect', 'trust', 'bluff', 'think', 'shock', 'applause'] as const;
export type ReactionKind = typeof reactionKinds[number];
/** The reactions that can be aimed at a player from their seat. */
export const aimedReactionKinds = ['suspect', 'trust', 'bluff', 'applause'] as const satisfies readonly ReactionKind[];
export interface MafiaReaction {
  id: string;
  senderId: string;
  senderName: string;
  kind: ReactionKind;
  /** Set when the reaction is aimed at another player. */
  targetId?: string | null;
  phase: string;
  round: number;
  receivedAt: number;
}
