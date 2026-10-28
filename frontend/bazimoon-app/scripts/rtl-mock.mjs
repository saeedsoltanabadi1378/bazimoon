import http from "node:http";

const players = [
  ["11111111-1111-1111-1111-111111111111", "آرمان", true],
  ["22222222-2222-2222-2222-222222222222", "سارا", true],
  ["33333333-3333-3333-3333-333333333333", "کیان", true],
  ["44444444-4444-4444-4444-444444444444", "نگار", true],
  ["55555555-5555-5555-5555-555555555555", "نیما", false],
].map(([playerId, displayName, isAlive], index) => ({
  playerId, displayName, isAlive, revealedRole: isAlive ? null : "Villager",
  eliminatedBy: isAlive ? null : "Night", eliminatedRound: isAlive ? null : 1,
  wasPromoted: false, revealed: index === 3,
}));

const deadline = () => new Date(Date.now() + 45_000).toISOString();
const rules = { speakerSeconds: 60, challengeSeconds: 30, defenceSeconds: 30, lastWordsSeconds: 20, nightSeconds: 60, votingSeconds: 45, lastWordsForNightKills: false, preset: "Classic", godfatherAppearsInnocent: false, jokerWinEndsGame: true, revealRolesOnDeath: true, allowSpectators: true };

function view(id) {
  const phase = ({ lobby: "Lobby", night: "Night", day: "Day", voting: "Voting", defence: "Defence", results: "Results", ended: "Ended" })[id] ?? "Day";
  const base = {
    gameId: id, phase, nightNumber: phase === "Lobby" ? 0 : 2, minPlayers: 3, maxPlayers: 8, players,
    yourPlayerId: players[0].playerId, yourRole: phase === "Lobby" ? null : "Detective", youAreAlive: true,
    yourLastInvestigationResult: null, lastNightElimination: phase === "Day" ? { eliminatedPlayerId: players[4].playerId, wasSaved: false, wasTie: false, tiedPlayers: null, godfatherPromoted: false, ballots: null, round: 1, previousBallots: null, shotPlayerId: null } : null,
    lastVotingElimination: phase === "Results" ? { eliminatedPlayerId: players[2].playerId, wasSaved: false, wasTie: false, tiedPlayers: null, godfatherPromoted: false, ballots: [], round: 1, previousBallots: null, shotPlayerId: null } : null,
    winCondition: phase === "Ended" ? "VillagersWin" : "None", youAreController: true, requiredNightActionsComplete: false,
    votes: phase === "Voting" ? [{ voterPlayerId: players[1].playerId, targetPlayerId: players[2].playerId }] : [],
    discussion: phase === "Day" ? { segmentType: "Speaker", activePlayerId: players[1].playerId, originalSpeakerId: players[1].playerId, deadline: deadline(), pendingChallengerIds: [], yourChallengeIsPending: false, youCanRequestChallenge: true, youCanFinish: false, speakerOrder: players.filter(p => p.isAlive).map(p => p.playerId), completedSpeakerIds: [] } : null,
    mafiaTeam: null, mafiaSuggestions: null, yourNightActionTargetId: null, yourInvestigations: [], youCannotHealSelf: false,
    nightProgress: phase === "Night" ? { submitted: 1, required: 3 } : null, rematchGameId: null, phaseDeadline: ["Night", "Voting"].includes(phase) ? deadline() : null,
    votingRound: 1, runoffCandidateIds: phase === "Defence" ? [players[1].playerId, players[2].playerId] : null, lastWords: null, rules,
    readyPlayerIds: phase === "Lobby" ? [players[1].playerId, players[2].playerId] : [], autoStartAt: null, controllerPlayerId: players[0].playerId,
    yourStrikes: 0, removedForInactivity: [], mvps: phase === "Ended" ? [{ playerId: players[0].playerId, points: 42, breakdown: [{ kind: "teamWon", count: 1, points: 3 }] }] : null,
    silencedPlayerId: null, yourAbilityUsed: false, yourInquiryUsed: false, youSurvivedTheNight: false, yourShot: null, mafiaSilenceTargetId: null, jokerWinnerId: null,
    setup: { preset: "Classic", roles: ["Godfather", "Mafia", "Detective", "Doctor", "Villager"], minimumPlayers: 3, problem: null },
    youAreSpectator: false, spectatorCount: 0, spectators: [], youCanUseGraveyard: false, youAreMutedInGraveyard: false,
  };
  return base;
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const send = (status, body) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(body)); };
  if (req.url === "/api/auth/guest") return send(200, { accessToken: "rtl-token", refreshToken: "rtl-refresh", user: { id: "rtl-user", displayName: "آرمان", isGuest: true, language: "fa" } });
  if (req.url === "/api/hub/config") return send(200, { disabledGames: [] });
  if (req.url === "/api/invites") return send(200, []);
  if (req.url === "/api/events") { res.writeHead(204); return res.end(); }
  if (/^\/api\/tables\//.test(req.url ?? "")) return send(200, { gameId: "lobby", name: "میز شب جمعه", isOpen: true, isHost: true, inviteCode: "FA1234" });
  const safety = req.url?.match(/^\/api\/games\/([^/?]+)\/safety$/);
  if (safety) return send(200, { players: players.map((p, i) => ({ playerId: p.playerId, voiceUid: i + 1 })), blockedPlayerIds: [] });
  const game = req.url?.match(/^\/api\/games\/([^/?]+)$/);
  if (game && req.method === "GET") return send(200, view(decodeURIComponent(game[1])));
  if (req.url?.startsWith("/api/me/games/")) return send(200, { won: true, rating: 1516, ratingDelta: 16, isMvp: true, newAchievements: [] });
  if (req.url?.includes("/graveyard/messages")) return send(200, []);
  send(200, {});
});

server.listen(5199, "127.0.0.1", () => process.stdout.write("rtl mock ready\n"));
