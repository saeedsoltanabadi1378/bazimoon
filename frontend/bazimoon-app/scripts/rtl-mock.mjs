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
    lastVotingElimination: phase === "Results" ? { eliminatedPlayerId: players[2].playerId, wasSaved: false, wasTie: false, tiedPlayers: null, godfatherPromoted: false, ballots: [{ voterPlayerId: players[0].playerId, targetPlayerId: players[2].playerId }, { voterPlayerId: players[1].playerId, targetPlayerId: players[2].playerId }, { voterPlayerId: players[3].playerId, targetPlayerId: players[2].playerId }, { voterPlayerId: players[2].playerId, targetPlayerId: players[1].playerId }], round: 1, previousBallots: null, shotPlayerId: null } : null,
    winCondition: phase === "Ended" ? "VillagersWin" : "None", youAreController: true, requiredNightActionsComplete: false,
    votes: phase === "Voting" ? [{ voterPlayerId: players[1].playerId, targetPlayerId: players[2].playerId }, { voterPlayerId: players[3].playerId, targetPlayerId: players[2].playerId }, { voterPlayerId: players[2].playerId, targetPlayerId: null }] : [],
    discussion: phase === "Day" ? { segmentType: "Speaker", activePlayerId: players[1].playerId, originalSpeakerId: players[1].playerId, deadline: deadline(), pendingChallengerIds: [], yourChallengeIsPending: false, youCanRequestChallenge: true, youCanFinish: false, speakerOrder: players.filter(p => p.isAlive).map(p => p.playerId), completedSpeakerIds: [] } : null,
    mafiaTeam: null, mafiaSuggestions: null, yourNightActionTargetId: null, yourInvestigations: [], youCannotHealSelf: false,
    nightProgress: phase === "Night" ? { submitted: 1, required: 3 } : null, rematchGameId: null, phaseDeadline: ["Night", "Voting"].includes(phase) ? deadline() : null,
    votingRound: 1, runoffCandidateIds: phase === "Defence" ? [players[1].playerId, players[2].playerId] : null, lastWords: null, rules,
    readyPlayerIds: phase === "Lobby" ? [players[1].playerId, players[2].playerId] : [], autoStartAt: null, controllerPlayerId: players[0].playerId,
    yourStrikes: 0, removedForInactivity: [], mvps: phase === "Ended" ? [{ playerId: players[0].playerId, points: 42, breakdown: [{ kind: "teamWon", count: 1, points: 3 }] }] : null,
    silencedPlayerId: null, yourAbilityUsed: false, yourInquiryUsed: false, youSurvivedTheNight: false, yourShot: null, mafiaSilenceTargetId: null, jokerWinnerId: null,
    setup: { preset: "Classic", roles: ["Godfather", "Mafia", "Detective", "Doctor", "Villager"], minimumPlayers: 3, problem: null },
    log: phase === "Lobby" ? [] : [
      { kind: "VoteNone", round: 1, playerId: null, voteRound: 1, tied: null },
      { kind: "NightKill", round: 1, playerId: players[4].playerId, voteRound: 1, tied: null },
      { kind: "VoteTied", round: 1, playerId: null, voteRound: 1, tied: [players[1].playerId, players[2].playerId] },
      { kind: "NightQuiet", round: 2, playerId: null, voteRound: 1, tied: null },
    ],
    youAreSpectator: false, spectatorCount: 0, spectators: [], youCanUseGraveyard: false, youAreMutedInGraveyard: false,
  };
  return base;
}

// A small stand-in for the SignalR game hub over long polling, so reactions and the table chat can
// be tried against the mock: what you send is echoed to the table, and another player answers.
const RS = "";
const hub = { queue: [], waiting: null };
const push = (message) => {
  hub.queue.push(JSON.stringify(message) + RS);
  if (hub.waiting) flush();
};
function flush() {
  const res = hub.waiting;
  hub.waiting = null;
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(hub.queue.splice(0).join(""));
}
let nextId = 0;
const reaction = (gameId, sender, kind, targetId = null) => push({ type: 1, target: "MafiaReaction", arguments: [{ gameId, reaction: { id: `r${++nextId}`, senderId: sender.playerId, senderName: sender.displayName, kind, phase: view(gameId).phase, round: 2, targetId } }] });
const chat = (gameId, sender, text) => {
  const message = { id: `m${++nextId}`, senderId: sender.playerId, senderName: sender.displayName, text, sentAt: new Date().toISOString() };
  push({ type: 1, target: "TableChatMessage", arguments: [{ gameId, message }] });
  return message;
};
function hubMessage(message) {
  if (message.type !== 1) return;
  const [gameId, kind, targetId] = message.arguments;
  if (message.target === "SendReaction" || message.target === "SendAimedReaction") {
    reaction(gameId, players[0], kind, targetId ?? null);
    setTimeout(() => reaction(gameId, players[2], "suspect", players[0].playerId), 900);
    setTimeout(() => reaction(gameId, players[3], "think"), 1500);
  }
  if (message.invocationId) push({ type: 3, invocationId: message.invocationId, result: null });
}

const server = http.createServer((req, res) => {
  // The hub client sends credentials, which rules out the "*" origin.
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With, X-SignalR-User-Agent");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const send = (status, body) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(body)); };
  if (req.url?.startsWith("/hubs/game/negotiate")) {
    // The mock holds one connection: a page that connects again starts it afresh.
    if (hub.waiting) flush();
    hub.queue.length = 0;
    hub.opened = false;
  }
  if (req.url?.startsWith("/hubs/game/negotiate")) return send(200, { negotiateVersion: 1, connectionId: "mock", connectionToken: "mock", availableTransports: [{ transport: "LongPolling", transferFormats: ["Text"] }] });
  if (req.url?.startsWith("/hubs/game")) {
    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        for (const part of body.split(RS).filter(Boolean)) {
          const message = JSON.parse(part);
          if (message.protocol) push({});
          else hubMessage(message);
        }
        res.writeHead(200);
        res.end();
      });
      return;
    }
    if (req.method === "DELETE") { res.writeHead(202); return res.end(); }
    // The first poll only opens the connection; later ones wait for something to send.
    if (!hub.opened) { hub.opened = true; res.writeHead(200); return res.end(); }
    if (hub.waiting) flush();
    hub.waiting = res;
    if (hub.queue.length) flush();
    else setTimeout(() => { if (hub.waiting === res) push({ type: 6 }); }, 10_000);
    return;
  }
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
  const chatPost = req.method === "POST" && req.url?.match(/^\/api\/games\/([^/?]+)\/chat\/messages/);
  if (chatPost) {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const gameId = decodeURIComponent(chatPost[1]);
      send(200, chat(gameId, players[0], JSON.parse(body || "{}").text ?? ""));
      setTimeout(() => chat(gameId, players[1], "من هم همین فکر را می‌کنم."), 1200);
    });
    return;
  }
  if (req.url?.includes("/chat/messages")) return send(200, [
    { id: "c1", senderId: players[1].playerId, senderName: players[1].displayName, text: "به نظرم کیان مشکوک است.", sentAt: new Date().toISOString() },
    { id: "c2", senderId: players[2].playerId, senderName: players[2].displayName, text: "من فقط منطقی حرف زدم.", sentAt: new Date().toISOString() },
  ]);
  send(200, {});
});

server.listen(5199, "127.0.0.1", () => process.stdout.write("rtl mock ready\n"));
