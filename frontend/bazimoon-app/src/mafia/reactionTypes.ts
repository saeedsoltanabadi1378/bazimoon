export const reactionKinds = ['suspect', 'trust', 'bluff', 'think', 'shock', 'applause'] as const;
export type ReactionKind = typeof reactionKinds[number];
export interface MafiaReaction {
  id: string;
  senderId: string;
  senderName: string;
  kind: ReactionKind;
  phase: string;
  round: number;
  receivedAt: number;
}
