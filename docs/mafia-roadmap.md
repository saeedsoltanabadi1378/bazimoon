# Mafia roadmap

A plan for the next twelve Mafia features. For each one it says how it plays, what changes
in the code, which artboards it needs, and what to test.

Per `AGENTS.md`, each milestone starts with its artboards in the
[Bazimoon Games Hub design](https://claude.ai/artifact/BPUhpaNYmSw9yky56fCdbW) and the
owner's approval. Every string ships in English and Persian. Nothing here is built yet.
The owner's answers to the open questions are recorded under **Decisions** at the end and
are reflected in each section.

> Written when Bazimoon ran as a Telegram Mini App. The Telegram bot and group chats have since
> been removed; notes about the bot or `CommandDispatcher` below no longer apply.

## Progress

| Milestone | Status |
|-----------|--------|
| M0 | Table rules in `GameConfig` and the single deadline service (`PhaseDeadlineService`) are built. The game event log is **not built yet**; it moves to the start of M3, the first milestone that needs it. Rules are not stored on `MafiaTableRecord`: the live game keeps them in its snapshot, and a rematch copies them from the finished game. |
| M1 | Built: tie-break defence and re-vote, last words (with the night-kill option), adjustable timers, the lobby rules line, and night and vote countdowns. |
| M2 | Built: ready check and auto-start, strikes and removal for missed timed turns, the Godfather fallback to the Mafia's suggestion, leaving mid-game as a loss, and the creator hand-off. Day speaking turns never give strikes. |
| M3 | Built: game event log (moved here from M0), game recap, stats per role, MVP and achievements. Changes from the plan: the MVP is worked out by the game from a points system instead of a vote (team won +3, each Mafia found +3, each kill blocked +3, each Mafia kill +2, each vote on a Mafia who went out +2, each night survived +1; most points on the winning team, ties share it, +50 XP); achievements are computed from per-game stats columns instead of a separate table, and join the Profile badges. Recap is `GET /api/hub/games/{id}/recap`. |
| M4 | Built: Sniper, Die Hard, Silencer, Joker and Mayor; Classic, Iranian and Custom role setups; Godfather-looks-innocent, Joker-ends-game and hide-roles-on-death options; Clutch shot and Jester achievements. Changes from the plan: the Silencer's action is optional (like the Sniper's) and can't target the same player two nights running; a plain Mafia member is promoted to Godfather before the Silencer; at hidden-role tables a player who is out sees no roles, their own included. |
| M5 | Built. Spectators (up to 30, "Allow spectators" on Create a table, on for public tables by default), a Watch button on the tables list, a spectator banner, a graveyard voice channel and text chat for players who are out and spectators. Differences from the plan: spectators can also talk in the graveyard voice (Room/Graveyard switch for them too); the creator can mute spectators from a message or, while still alive, from the "N watching" list; spectating a lobby is refused (join instead). |

## Where Mafia stands today

- **Roles:** Villager, Detective, Doctor, Mafia and Godfather (`Domain/Role.cs`). One Mafia
  per three players, hard-coded in `GameState.DetermineMafiaCount`. With 3 players it's one
  Godfather against two Villagers. Mafia players have a succession order: if the Godfather
  dies, the next in line is promoted.
- **Flow:** `Lobby → RoleAssignment → NightZero → Night → Day → Voting → Results → Night …
  → Ended` (`GamePhase.cs`). The creator ends each night, starts voting and closes the vote.
- **Day:** each speaker gets 60 s and a challenge gets 40 s. Both numbers are hard-coded in
  `GameState.StartNextSpeaker` and `AcceptChallenge`. `DiscussionDeadlineService` checks the
  deadlines every second.
- **Voting:** a tie means nobody goes out (`GameState.ResolveVoting`).
- **Roles on death:** a dead player's role is shown to everyone (`GameView`).
- **Voice:** Agora. Who may speak is decided per phase in
  `GameEndpoints` (`GetVoiceToken`): there's a `main` channel and a `mafia` channel.
- **History:** `GameRecord` / `GamePlayerRecord` hold role, survival, rating and win.
  Nothing records what each player *did* during the game.
- **Persistence:** live games live in Redis as a `GameStateSnapshot`. Any new state must go
  into the snapshot, and its new fields need defaults so games already running during a
  deploy still load.

## Milestones

| # | Milestone | Features | Needs new artboards |
|---|-----------|----------|---------------------|
| M0 | Foundation | Table rules in `GameConfig`, one deadline service for every phase, game event log | No (backend only) |
| M1 | Day flow | 1 Tie-break re-vote · 2 Last words · 6 Adjustable timers | Yes |
| M2 | Smooth tables | 7 Ready check and auto-start · 8 AFK handling | Yes |
| M3 | After the game | 10 Game recap · 11 Stats per role · 12 MVP vote and achievements | Yes |
| M4 | Roles | 3 New roles · 5 Custom role setups · 4 Hide roles on death | Yes |
| M5 | Watching | 9 Spectators and a graveyard channel | Yes |

M0 comes first because almost every later feature relies on it. After M0, M1 and M2 can go
in either order. M3 needs the event log from M0. M4 is the largest milestone and is easier
once timers (M1) and AFK handling (M2) exist.

---

## M0 — Foundation (backend only)

### Table rules
- Grow `GameConfig` into the per-table rule set. It holds the timers (M1), the role setup
  (M4), `RevealRolesOnDeath` (M4) and `AllowSpectators` (M5). Every default matches today's
  behaviour, so existing tables and the bot keep working unchanged.
- Store the rules on `MafiaTableRecord` as a JSON column (needs an EF migration) and pass them
  to `new GameState(config)` in `GameService.CreateGameAsync`. A rematch copies them.
- `GameConfig` is already part of `GameStateSnapshot`, so it's persisted for free. Give every
  new property an `init` default.

### One deadline service for every phase
- Turn `DiscussionDeadlineService` into a `PhaseDeadlineService`, and give `GameState` a
  single `PhaseDeadline` field (in the snapshot) that each phase sets when it starts.
  Today's discussion deadline is the first user of it.
- Add `GameState.AdvanceExpiredPhase(now)`. On each tick the service calls it, then saves
  and notifies on change, the same way it handles discussions today.
- When a phase has no deadline (`PhaseDeadline == null`), the creator still advances it by
  hand, as today.

### Game event log
- Add a `GameEvent` hierarchy to Domain, using only BCL types: `NightResolved` (every action
  and its outcome), `VoteResolved` (round number and ballots), `PlayerEliminated` (cause and
  round), `GodfatherPromoted`, and later the M4 role events.
- `GameState` appends to `_events` inside the existing resolve methods, and the list goes
  into the snapshot.
- When the game ends, `GameHistoryRepository` saves the log as a JSON column on `GameRecord`.

**Tests:**
- Snapshot round-trip including the new fields.
- An old snapshot without the new fields still loads.
- The event log matches a scripted game in `GameFlowIntegrationTests`.

---

## M1 — Day flow

### 1. Tie-break re-vote
**Rules:**
1. A tied vote opens **Defence**. Each tied player speaks once, in seat order, for
   `DefenceSeconds` (default 30), and nobody can challenge.
2. **Voting round 2** follows. Only the tied players can be voted for.
3. If round 2 ties again, nobody goes out, as today (decided).

**Domain:**
- Add `GamePhase.Defence`, appended at the end of the enum (it's string-serialised, so the
  position is safe).
- Add `VotingRound` (1 or 2) to `GameState` and the snapshot, and `Round` to `VotingResult`.
- `ResolveVoting` round 1, on a tie: build a speaker-only discussion with
  `SpeakerOrder = TiedPlayers`, then enter `Defence`. When Defence ends, enter `Voting` with
  round 2.
- `SubmitVote` round 2 rejects any target that isn't one of the tied players.

**Voice:** in `GetVoiceToken`, during `Defence` only `Discussion.ActivePlayerId` gets
Publisher.

**App:**
- `DayScreen` gains a defence mode: the header reads "Defence", the order is just the tied
  players, and there's no challenge UI.
- `VotingScreen` shows "Round 2" and lists only the tied players.
- `ResultsScreen` copy covers "tied twice, nobody out".

**Bot:** `CommandDispatcher` and `GameViewDto` learn the `Defence` phase. Its messages are
written in both languages.

**Artboards:** Defence (EN/FA), Voting round 2, Results after a re-vote.

**Tests:**
- A round-1 tie leads to Defence and then round 2.
- Round 2 rejects votes for anyone else.
- A second tie means nobody is eliminated.
- A round-2 elimination that ends the game.

### 2. Last words
**Rules:**
- A player voted out gets `LastWordsSeconds` (default 20) to speak before Results.
- Night victims don't get last words by default (the usual table convention). The creator
  can turn them on with the table option `LastWordsForNightKills` (default off). When it's
  on, a night victim speaks at the start of the Day, before the first speaker.

**Domain:**
- Add `GamePhase.LastWords`. `ResolveVoting` enters it whenever someone is eliminated, even
  when that vote wins the game: the speech comes first, then `Results` or `Ended`.
  `PhaseDeadlineService` moves the game on, and the speaker can also tap "Finish early".
- Hold the win check until after LastWords, and store which phase comes next.

**Voice:** during `LastWords` only the eliminated player is a Publisher. This is the one time
a dead player may speak.

**App:** a LastWords screen (the eliminated player's card, a countdown, the speaking
indicator) plus a speaker view with "Finish early".

**App (Create a table):** a "Last words for night kills" switch, off by default.

**Artboards:** Last words — listener view and speaker view (EN/FA), the night-victim
variant at the start of the Day, and the switch on Create a table.

**Tests:**
- Phase order after a vote elimination.
- A game-ending vote still runs LastWords before Ended.
- The voice role is Publisher only for the eliminated player.

### 6. Adjustable timers
**Rules:** the creator picks the following on Create a table. "Off" means the creator moves
the game on by hand, as today.

| Timer | Choices | Default |
|-------|---------|---------|
| Speaking turn | 30 / 45 / 60 / 90 s | 60 s |
| Challenge | 20 / 30 / 40 s | 40 s |
| Defence | 20 / 30 / 45 s | 30 s |
| Last words | 10 / 20 / 30 s | 20 s |
| Night | off / 45 / 60 / 90 s | off |
| Voting | off / 30 / 45 / 60 s | off |

**Domain:** replace the hard-coded `AddSeconds(60)` and `AddSeconds(40)` with values from
`Config`. The night and voting deadlines use the M0 `PhaseDeadline`.

**API:** extend `TableOptions` and the create-table endpoint. Validate each value against the
allowed set.

**App:**
- `CreateTableScreen` gets a collapsible "Timers" section.
- `LobbyScreen` shows a summary of the table's rules.
- Night and voting screens show a countdown whenever a deadline is set.
- The "60 s each · challenges 40 s" line (`turnLengths`) becomes parameterised.

**Artboards:** Create a table with the timers open, the lobby rules summary, the night and
voting countdowns.

---

## M2 — Smooth tables

### 7. Ready check and auto-start
**Rules:**
- Players in the lobby tap "Ready".
- When every seat is full and everyone is ready, the game starts after a 5 s countdown.
- The creator can still start early at any time once the minimum is reached.

**Creator hand-off:** if the creator leaves the lobby or drops out mid-game, the creator role
passes to the longest-seated player still alive. Without this, a table whose creator
disappears is stuck.

**Domain:**
- Add `_readyPlayers` to `GameState` and the snapshot, with `SetReady(playerId, bool)`.
- Joining or leaving clears that player's ready flag.
- Add `CreatorPlayerId` to `GameState`. Today the creator lives only in the table record and
  service layer; check `GameService` before moving it.

**App:** a Ready button on `LobbyScreen`, ready ticks on the player list, and the auto-start
countdown.

**Artboards:** the lobby with ready states, the lobby during the auto-start countdown.

### 8. AFK handling
**Rules:**
- When the night timer runs out:
  - a night role that hasn't acted does nothing that night (no random actions, which would be
    unfair);
  - if the Godfather hasn't chosen, the kill goes to the target the other Mafia suggested
    most, and if there's no suggestion, nobody dies.
- When the voting timer runs out, missing votes count as abstentions.
- Each missed turn is a strike. After 2 strikes in a row the player is removed. They count as
  eliminated with the new `EliminationCause.Left`, and their role is revealed by the normal
  rules.
- A player who leaves on purpose mid-game gets the same treatment.
- A player removed for inactivity or who leaves mid-game always counts as a **loss** for
  rating and XP, even if their team goes on to win (decided).

**Domain:**
- Add `_strikes` to the snapshot.
- Add `EliminationCause.Left`.
- `ResolveNight` and `ResolveVoting` accept "deadline reached" and fill the gaps as above.

**App:**
- A "Removed for inactivity" banner on the Day and Results screens.
- A warning toast on the player's first strike.

**Artboards:** the AFK warning, the removal banner, and the Results variant for "left the
game".

**Tests:**
- Night resolves on its deadline with missing actions.
- The Godfather's kill falls back to the Mafia's suggestion.
- A player is removed after 2 strikes.
- A win check runs after an AFK removal.

---

## M3 — After the game

### 10. Game recap
**What players see:**
- After the game, "See recap" on `GameOverScreen` opens a timeline:
  - Night 1: the Mafia targeted X, the Doctor saved Y, the Detective checked Z (Mafia/Town).
  - Day 1: the votes, with who voted for whom, plus re-votes and last words.
  - … through to the end.
- Every role is revealed in the recap.
- It can also be opened later from the game history on Profile.

**API:** `GET /games/{id}/recap`. It is served only once the game is Ended, and it builds the
recap from the event log saved on `GameRecord`.

**App:** a `RecapScreen` reached from `GameOverScreen` and from Profile history.

**Artboards:** the recap timeline (EN/FA), and a recap entry point on Profile.

### 11. Stats per role
**Data:**
- When the game ends, compute per-player numbers from the event log:
  - checks made, and Mafia found;
  - saves made, and saves that actually blocked a kill;
  - votes against Mafia, and total votes;
  - nights survived.
- Store them as new nullable columns on `GamePlayerRecord` (needs a migration). Games played
  before this release have no numbers and are left out of the averages.

**App:** a "Mafia stats" section on `ProfileScreen`:
- games and win rate for each role;
- Detective accuracy;
- Doctor saves;
- vote accuracy.

**Admin:** add the same per-role figures to the player detail page in the admin console.

**Artboards:** the Profile Mafia stats section, and the admin player detail.

### 12. MVP vote and achievements
**MVP:**
- At `Ended`, every player has 45 s to pick one MVP, but not themselves.
- The MVP gets bonus XP: `Progression.MafiaXp` gains an `isMvp` argument.
- On a tie, every tied player is MVP.

**Achievements:**
- A `PlayerAchievementRecord(TelegramUserId, Key, EarnedAt, GameId)` table, with the
  definitions in code.
- They're checked against the event log when a game ends.
- First set:

| Achievement | Earned by |
|-------------|-----------|
| Sharp eye | Finding 2 or more Mafia as Detective in one game |
| Guardian angel | Saving a kill target as Doctor |
| Survivor | Living to the end, 10 times |
| Silver tongue | Surviving a re-vote |
| Kingslayer | Voting out the Godfather |
| Don | Winning as Godfather |
| Clutch shot | As Sniper, hitting the Godfather (M4) |
| Jester | Winning as Joker (M4) |

**App:**
- `GameOverScreen` gets the MVP vote and an "Achievement unlocked" sheet.
- `ProfileScreen` gets an achievements grid.

**Artboards:** Game over with the MVP vote, the MVP result, the achievement sheet, the
Profile achievements grid.

---

## M4 — Roles

### 3. New roles
Each new role is off by default and is turned on through the role setup (5). Every role
needs a reveal card, night or day controls, a description in EN/FA, and an entry in `roles.ts`
and `parts.tsx`.

| Role | Team | Ability | Notes |
|------|------|---------|-------|
| **Sniper** | Town | One night shot per game (new `NightActionType.Shoot`). If the target is Mafia, they die (the Doctor can still save them). If the target is Town, the Sniper dies instead. | Optional action: doesn't count towards `RequiredNightActionCount`. |
| **Die Hard** | Town | Survives the first night kill without being revealed. Once per game, during the day, can call an **Inquiry**: the roles of every eliminated player are announced. | The Inquiry only matters when roles are hidden (4). Hide the option otherwise. |
| **Silencer** | Mafia | Each night, silences one player (new `NightActionType.Silence`). The next day that player's turn is skipped and their voice is listen-only, but they can still vote. | Mafia-aligned for the Detective and for the win check. |
| **Joker** | Independent | Wins if voted out during the day. | Table option `JokerWinEndsGame` (default on): when on, the game ends there with the new `WinCondition.JokerWins` and everyone else loses. When off, the Joker is recorded as a winner, leaves the game, and play continues until Town or Mafia wins. Counts as non-Mafia for parity. Rated like everyone else. |
| **Mayor** | Town | Can reveal themselves during their speaking turn. Once revealed, their vote counts twice and everyone knows their role. | Add a `Revealed` flag on `Player`. `ResolveVoting` weights the ballots. |

**Domain:**
- Extend the `Role` enum (append at the end).
- Add a `Team` mapping (`Town`, `Mafia`, `Independent`) to replace `Player.IsMafiaAligned`
  checks wherever the meaning is "team".
- Add the new night action types and their resolution order: Silence → Heal → Kill and Shoot
  → Investigate.
- Add per-role "used" state to the snapshot (Sniper shot used, Die Hard life used, Inquiry
  used, Mayor revealed).
- Extend `NightResult` with `SniperTarget`, `SniperOutcome` and `SilencedPlayer`.
- `CheckWinCondition` becomes team-based.
- Add a separate per-player `Won` result next to the team result, so a Joker can win while
  the game goes on.

**Voice:**
- A silenced player gets Subscriber in `main` for that whole day.
- The Silencer joins the `mafia` channel.

### 5. Custom role setups
**Rules:**
- On Create a table, the creator picks a preset: **Classic** (today's rules), **Iranian**
  (Godfather, Silencer, Sniper, Doctor, Detective, Die Hard) or **Custom**.
- Custom sets how many Mafia there are and turns each optional role on or off. Villagers fill
  the remaining seats.
- Validation:
  - at least one Godfather;
  - Mafia must be fewer than half the players;
  - the setup must fit the minimum player count.
- A setup that doesn't fit the players present blocks Start, with a clear reason.
- **Godfather appears innocent:** a table option `GodfatherAppearsInnocent`, off by default
  (today's rule). When on, the Detective's check on the Godfather comes back "not Mafia".
  The Iranian preset turns it on; the creator can change it.

**Domain:**
- Add a `RoleSetup` record to `GameConfig`.
- `AssignRolesCore` deals from the setup instead of the fixed sequence.
- `DetermineMafiaCount` becomes the Classic preset.

**Rating:** every game counts for league rating and XP, whatever the setup (decided).
`RatingDelta` keeps comparing each player's team with the other side. A Joker is rated
against the average of all other players.

**App:**
- A role picker on `CreateTableScreen`.
- The roles list in `LobbyScreen` (`rolesForPlayers`) reflects the chosen setup.

### 4. Hide roles on death
**Rules:** a table option `RevealRolesOnDeath`, on by default (today's behaviour). When it's
off:
- the dead player's card says "Out" without a role;
- the Die Hard's Inquiry and the end of the game reveal the roles.

**API:** `GameView` withholds the roles of dead players from everyone while the game is
running. That includes the dead themselves, so they can't leak them.

**App:** the `foundDead` and `theyWereThe` copy gets a variant with no role, and the player
lists show "Out".

**M4 artboards:**
- a reveal card for each new role;
- Sniper, Silencer and Mafia night controls;
- the Die Hard Inquiry button and its result;
- the Mayor reveal and the double-vote indicator;
- a "Silenced today" banner;
- the Joker win screen;
- the role picker on Create a table;
- the lobby roles list for custom setups;
- the hidden-role death variants.

All of them in EN and FA.

**Tests:**
- every role's rules;
- resolution order (for example, the Silencer is killed the same night they silence
  someone);
- team win checks;
- Joker win;
- setup validation;
- `GameView` hiding roles.

---

## M5 — Watching

### 9. Spectators and a graveyard channel
**Rules:**
- On tables with `AllowSpectators`, anyone with the link can watch: the public board, the
  voting tallies and the room voice (listen only).
- Spectators never see living players' roles or hear the Mafia channel.
- Dead players and spectators share a **graveyard** voice channel, where they can talk freely
  without the living hearing.
- Dead players can switch between the room (listen) and the graveyard (talk).
- The graveyard also has a **text chat** (decided), for the same people: dead players and
  spectators. The living never see it.
  - Messages are plain text, at most 300 characters, rate-limited to one every 2 s.
  - They go out over the existing SignalR game connection, and the last 200 are kept with
    the live game in Redis so a reconnect shows history. They are deleted when the game
    ends and are not part of the recap.
  - The table creator can mute a spectator in the chat.

**Domain and API:**
- Add a `Spectators` list to `GameState` and the snapshot.
- Add a `POST /games/{id}/spectate` endpoint.
- Add `POST /games/{id}/graveyard/messages` (send) and a `GraveyardMessage` SignalR event,
  sent only to dead players and spectators. Graveyard messages stay out of `GameState`:
  store them next to the session in `IGameSessionStore`.
- `GameView` gets a spectator projection. Today a non-player is refused, so this is a new
  path.
- `GetVoiceToken` accepts `channel=graveyard` for dead players and spectators, and rejects it
  for the living.
- Cap spectators at 30 per table.

**App:**
- A "Watch" button on `MafiaTablesScreen` for games in progress.
- A spectator banner.
- A room/graveyard switch in the voice bar for dead players.
- A graveyard chat panel (bottom sheet) with unread badge, RTL-aware.

**Artboards:**
- the Open tables list with a "Watch" entry;
- the spectator view of the Night, Day and Voting screens;
- the graveyard voice switch;
- the graveyard chat panel (EN/FA), including the muted-spectator state.

**Tests:**
- A spectator's view never contains living players' roles.
- Voice tokens are given out by channel and status.
- Spectators can't vote or act.
- Living players can't send or receive graveyard messages; the rate limit and length cap
  hold.

---

## Cross-cutting

- **Persian:** every new string goes into `i18n/en/mafia.ts` and `i18n/fa/mafia.ts`, with
  numbers through `n()`. Bot messages go in both languages, chosen from the player's setting.
  Persian role names, confirmed by the owner: پدرخوانده (Godfather), تک‌تیرانداز (Sniper),
  جان‌سخت (Die Hard), ناتو/سایلنسر (Silencer), جوکر (Joker), شهردار (Mayor).
- **RTL:** the recap timeline and the vote lists use logical CSS, and the countdowns use
  Persian digits.
- **Bot:** each new phase needs handling in `CommandDispatcher` and `GameViewDto`, or bot-run
  games stall.
- **Admin console:** the Games page shows the table rules and a link to the recap. The
  Players page shows Mafia stats and achievements.
- **Deploys:** enum values are only ever appended, and snapshot fields always have defaults,
  so games in progress survive each release.
- **Checks:** `npx tsc -b && npm run lint` and `dotnet test src/Bazimoon.Tests` must pass on
  every milestone.

## Decisions

Answered by the owner on 2026-10-16.

| # | Question | Decision |
|---|----------|----------|
| 1 | Re-vote ties again | Nobody goes out. |
| 2 | Last words for night victims | Creator's table option `LastWordsForNightKills`, default off. |
| 3 | Godfather shows "not Mafia" to the Detective | Creator's table option `GodfatherAppearsInnocent`, default off. |
| 4 | AFK removal and leaving | Removed after 2 missed turns in a row; leaving or removal counts as a loss. |
| 5 | Joker voted out ends the game | Creator's table option `JokerWinEndsGame`. |
| 6 | Which setups are rated | All games are rated, whatever the setup. |
| 7 | Graveyard | Voice and text chat. |
| 8 | Persian role names | Confirmed as listed under Cross-cutting. |

### New table options from these decisions
All of these sit in `GameConfig` (M0) and appear on Create a table:

| Option | Default | Milestone |
|--------|---------|-----------|
| `LastWordsForNightKills` | off | M1 |
| `GodfatherAppearsInnocent` | off (on in the Iranian preset) | M4 |
| `JokerWinEndsGame` | on | M4 |
| `RevealRolesOnDeath` | on | M4 |
| `AllowSpectators` | on for public tables, off for private | M5 |
