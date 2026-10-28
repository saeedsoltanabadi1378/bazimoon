import type { ApiError } from "../api/client";
import type { TranslationKey } from "../i18n/LanguageContext";

const errorKeys: Record<string, TranslationKey> = {
  game_not_found: "errorGameNotFound",
  lobby_full: "errorLobbyFull",
  not_enough_players: "errorNotEnoughPlayers",
  role_setup_invalid: "errorRoleSetupInvalid",
  already_joined: "errorAlreadyJoined",
  game_already_started: "errorGameStarted",
  not_in_lobby: "errorNotInLobby",
  ready_unavailable: "errorReadyUnavailable",
  night_actions_pending: "errorNightActionsPending",
  already_investigated: "errorAlreadyInvestigated",
  doctor_repeat_self_heal: "errorDoctorRepeatSelfHeal",
  mafia_team_target: "errorMafiaTeamTarget",
  sniper_shot_used: "errorSniperShotUsed",
  cannot_target_self: "errorCannotTargetSelf",
  silencer_repeat_target: "errorSilencerRepeatTarget",
  voting_closed: "errorVotingClosed",
  revote_target_invalid: "errorRevoteTarget",
  challenge_already_requested: "errorChallengeAlreadyRequested",
  challenge_not_pending: "errorChallengeGone",
  speaker_only: "errorSpeakerOnly",
  creator_only: "errorCreatorOnly",
  not_in_game: "errorNotInGame",
  spectators_disabled: "errorSpectatorsDisabled",
  spectating_unavailable: "errorSpectatingUnavailable",
  spectators_full: "errorSpectatorsFull",
  graveyard_muted: "errorGraveyardMuted",
  message_empty: "errorMessageEmpty",
  message_too_long: "errorMessageTooLong",
  message_rate_limited: "errorMessageRateLimited",
  rematch_unavailable: "errorRematchUnavailable",
  timer_invalid: "errorTimerInvalid",
  action_forbidden: "errorActionForbidden",
  game_action_invalid: "errorGameActionInvalid",
  report_category_invalid: "errorReportCategory",
  report_note_too_long: "errorReportNoteLong",
  report_already_sent: "errorReportAlreadySent",
  safety_target_self: "errorSafetySelf",
  safety_target_missing: "errorSafetyMissing",
  blocked_player_at_table: "errorBlockedAtTable",
};

export function localizedGameError(error: ApiError, t: (key: TranslationKey) => string): string {
  if (error.status === 0) return t("offlineAction");
  return t(error.code ? errorKeys[error.code] ?? "errorGameActionInvalid" : "errorGameActionInvalid");
}
