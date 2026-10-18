// Mirrors Nightfall.Api's JSON contracts. Property names are camelCase (ASP.NET Core minimal API
// default) and enums serialize as their exact PascalCase member name (via
// [JsonConverter(typeof(JsonStringEnumConverter))] on the Domain enums — verified server-side by
// DomainEnumJsonSerializationTests, not just assumed).

export type GamePhase =
  | "Lobby"
  | "RoleAssignment"
  | "NightZero"
  | "Night"
  | "Day"
  | "Voting"
  | "Results"
  | "Ended"
  | "Defence"
  | "LastWords";

export type Role = "Villager" | "Detective" | "Doctor" | "Mafia" | "Godfather";

export type NightActionType = "Investigate" | "Heal" | "Kill";

export type WinCondition = "None" | "VillagersWin" | "MafiaWin";
export type DiscussionSegmentType = "Speaker" | "Challenge";

export type EliminationCause = "Night" | "Vote";

export interface PlayerView {
  playerId: string;
  telegramUsername: string;
  isAlive: boolean;
  revealedRole: Role | null;
  eliminatedBy: EliminationCause | null;
  eliminatedRound: number | null;
  /** Only true for viewers allowed to know (Mafia, or everyone once the game has ended). */
  wasPromoted: boolean;
}

export interface DetectiveResultView {
  targetPlayerId: string;
  isMafiaAligned: boolean;
}

export interface EliminationView {
  eliminatedPlayerId: string | null;
  wasSaved: boolean;
  wasTie: boolean;
  tiedPlayers: string[] | null;
  godfatherPromoted: boolean;
  ballots: VoteView[] | null;
  /** 1 for the day's vote, 2 for the re-vote between the players tied in round 1. */
  round: number;
  /** Round 1's ballots, when this result is round 2. */
  previousBallots: VoteView[] | null;
}

/** The player saying their last words, why they are out, and when their time is up. */
export interface LastWordsView {
  playerId: string;
  cause: EliminationCause;
  deadline: string;
  youAreSpeaking: boolean;
}

/** The table's timers in seconds (null night or voting: the creator moves it on) and rule switches. */
export interface RulesView {
  speakerSeconds: number;
  challengeSeconds: number;
  defenceSeconds: number;
  lastWordsSeconds: number;
  nightSeconds: number | null;
  votingSeconds: number | null;
  lastWordsForNightKills: boolean;
}

export interface MafiaMemberView {
  playerId: string;
  role: Role;
  rank: number | null;
  isAlive: boolean;
}

export interface NightSuggestionView {
  actorPlayerId: string;
  targetPlayerId: string;
}

export interface NightProgressView {
  submitted: number;
  required: number;
}

export interface GameView {
  gameId: string;
  phase: GamePhase;
  nightNumber: number;
  minPlayers: number;
  players: PlayerView[];
  yourPlayerId: string;
  yourRole: Role | null;
  youAreAlive: boolean;
  yourLastInvestigationResult: DetectiveResultView | null;
  lastNightElimination: EliminationView | null;
  lastVotingElimination: EliminationView | null;
  winCondition: WinCondition;
  youAreController: boolean;
  requiredNightActionsComplete: boolean;
  votes: VoteView[];
  discussion: DiscussionView | null;
  maxPlayers: number;
  mafiaTeam: MafiaMemberView[] | null;
  mafiaSuggestions: NightSuggestionView[] | null;
  yourNightActionTargetId: string | null;
  yourInvestigations: DetectiveResultView[] | null;
  youCannotHealSelf: boolean;
  nightProgress: NightProgressView | null;
  rematchGameId: string | null;
  /** When a timed Night, Voting or LastWords phase moves on by itself. */
  phaseDeadline: string | null;
  votingRound: number;
  /** The tied players: they defend, and round 2 is between them only. */
  runoffCandidateIds: string[] | null;
  lastWords: LastWordsView | null;
  rules: RulesView;
}

/** Your rating outcome for a finished game (from the history service). */
export interface MyGameResult {
  won: boolean;
  rating: number;
  ratingDelta: number;
}

export interface DiscussionView {
  segmentType: DiscussionSegmentType;
  activePlayerId: string;
  originalSpeakerId: string;
  deadline: string;
  pendingChallengerIds: string[];
  yourChallengeIsPending: boolean;
  youCanRequestChallenge: boolean;
  youCanFinish: boolean;
  speakerOrder: string[] | null;
  completedSpeakerIds: string[] | null;
}

export interface VoteView {
  voterPlayerId: string;
  targetPlayerId: string | null;
}

export interface NightResult {
  nightNumber: number;
  eliminated: string | null;
  targetWasSaved: boolean;
  detectiveTarget: string | null;
  detectiveResultIsMafiaAligned: boolean | null;
  promotedGodfatherId: string | null;
}

export interface VotingResult {
  eliminated: string | null;
  wasTie: boolean;
  tiedPlayers: string[];
  promotedGodfatherId: string | null;
}

export interface CreateGameResponse {
  gameId: string;
}

export interface VoiceTokenResponse {
  token: string;
  channel: string;
  uid: number;
  role: string;
}

export interface TelegramAuthResponse {
  token: string;
  telegramUserId: number;
  username: string;
}
