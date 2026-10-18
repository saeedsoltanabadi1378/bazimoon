// Mirrors Bazimoon.Api's JSON contracts. Property names are camelCase (ASP.NET Core minimal API
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

export type Role = "Villager" | "Detective" | "Doctor" | "Mafia" | "Godfather" | "Sniper" | "DieHard" | "Silencer" | "Joker" | "Mayor";

export type RolePreset = "Classic" | "Iranian" | "Custom";
export type SniperOutcome = "Hit" | "Saved" | "Backfired";

export type NightActionType = "Investigate" | "Heal" | "Kill" | "Shoot" | "Silence";

export type WinCondition = "None" | "VillagersWin" | "MafiaWin" | "JokerWins";
export type DiscussionSegmentType = "Speaker" | "Challenge";

export type EliminationCause = "Night" | "Vote" | "Left";

export interface PlayerView {
  playerId: string;
  displayName: string;
  isAlive: boolean;
  revealedRole: Role | null;
  eliminatedBy: EliminationCause | null;
  eliminatedRound: number | null;
  /** Only true for viewers allowed to know (Mafia, or everyone once the game has ended). */
  wasPromoted: boolean;
  /** A Mayor who revealed: everyone knows, and their vote counts twice. */
  revealed: boolean;
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
  /** Night only: who died to the Sniper's shot (the target, or the Sniper when it backfired). */
  shotPlayerId: string | null;
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
  preset: RolePreset;
  godfatherAppearsInnocent: boolean;
  jokerWinEndsGame: boolean;
  revealRolesOnDeath: boolean;
  allowSpectators: boolean;
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
  /** Lobby players who tapped Ready. */
  readyPlayerIds: string[] | null;
  /** When a full lobby where everyone is ready starts by itself. */
  autoStartAt: string | null;
  /** Who runs the game; passes to the next seat when the creator leaves. */
  controllerPlayerId: string | null;
  /** Timed turns you have missed in a row (two remove you). */
  yourStrikes: number;
  /** Players removed for inactivity when the last timed night or vote closed. */
  removedForInactivity: string[] | null;
  /** Once the game has ended: the MVPs the game worked out (several on a tie). */
  mvps: MvpView[] | null;
  /** Who the Silencer silenced for today: their turn is skipped and they can only listen. */
  silencedPlayerId: string | null;
  /** Sniper: shot spent. Die Hard: extra life spent. */
  yourAbilityUsed: boolean;
  yourInquiryUsed: boolean;
  /** Die Hard: the Mafia came for you last night and you survived (only you are told). */
  youSurvivedTheNight: boolean;
  yourShot: { targetPlayerId: string; outcome: SniperOutcome } | null;
  /** Mafia only, at night: who the Silencer is silencing. */
  mafiaSilenceTargetId: string | null;
  /** The Joker who was voted out, and so won. */
  jokerWinnerId: string | null;
  /** The roles the table's setup deals for the players now seated, or why it can't start. */
  setup: { preset: RolePreset; roles: Role[] | null; minimumPlayers: number; problem: "TooFewPlayers" | "TooManyMafia" | null } | null;
  /** You're watching without a seat: only the public board. */
  youAreSpectator: boolean;
  spectatorCount: number;
  /** Only the table creator gets the list, to mute people in the graveyard chat. */
  spectators: SpectatorView[] | null;
  /** You're out (or watching), so you can use the graveyard voice and chat. */
  youCanUseGraveyard: boolean;
  youAreMutedInGraveyard: boolean;
}

export interface SpectatorView {
  id: string;
  username: string;
  muted: boolean;
}

export interface GraveyardMessage {
  id: string;
  senderId: string;
  senderName: string;
  fromSpectator: boolean;
  text: string;
  sentAt: string;
}

export type MvpPointsKind = "teamWon" | "mafiaFound" | "killBlocked" | "killMade" | "voteOnMafiaOut" | "nightSurvived";

export interface MvpView {
  playerId: string;
  points: number;
  breakdown: { kind: MvpPointsKind; count: number; points: number }[];
}

/** Your rating outcome for a finished game (from the history service). */
export interface MyGameResult {
  won: boolean;
  rating: number;
  ratingDelta: number;
  isMvp: boolean;
  /** Achievement keys this game earned you for the first time. */
  newAchievements: string[] | null;
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

export interface AuthUser {
  id: string;
  displayName: string;
  isGuest: boolean;
  language: "en" | "fa";
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
