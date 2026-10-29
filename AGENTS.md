# Rules for agents working on Bazimoon

These rules apply to every change in this repository, by any agent or contributor.

## The design

The source of truth for the web app's look and behaviour is the **Bazimoon Games Hub design**:

https://claude.ai/artifact/BPUhpaNYmSw9yky56fCdbW

It has one artboard per screen: the player web app (hub, Mafia flow, every solo game's intro, play and result screens, Couple Quiz, sign-in, install and notification prompts, app states) and the admin web console (sign in, overview, games, players, puzzles and leagues, app settings, system and events).

## 1. Code and design stay in sync

### Owner-approved exception: Shelem

- The Shelem game and its reusable playing-card framework may be designed and implemented in code without adding or changing design artboards. This exception also covers Shelem rooms, bots, voice controls, game states, results, admin integration and bilingual player-facing UI.
- The exception applies only to Shelem and shared card primitives introduced for Shelem. All other player and admin UI remains subject to the design-sync rules below.

- Design first: a new screen or game needs its artboards in the design, approved by the project owner, before any code is written for it. Draw the artboards, stop and ask for approval, then build to them.
- Before changing a player app or admin screen, open the matching artboard in the design and build to it.
- Any change to the player app's or admin console's UI or user-facing behaviour must also update the design in the same piece of work: new screens get a new artboard; changed layouts, copy, states, modes or rules get the artboard updated.
- If you cannot update the design yourself, stop and tell the person exactly which artboards need which changes. Do not leave the two out of sync silently.
- If the code and the design disagree and you were not asked to change that screen, flag it rather than picking one.
- Backend-only changes with no visible effect do not need a design change.

## 2. English and Persian, always

Every feature ships in both English and Persian (fa, right-to-left).

- Never hard-code user-facing text. Add every string to both `frontend/bazimoon-app/src/i18n/en/*.ts` and `frontend/bazimoon-app/src/i18n/fa/*.ts`; the fa files are typed against en, so `npx tsc -b` fails if a key is missing.
- Write real Persian, not transliteration or machine-literal phrasing.
- Use `t()` for text and `n()` for numbers so Persian gets Persian digits.
- Check layouts in RTL: use logical CSS (`margin-inline-*`, `inset-inline-*`, `text-align: start`), flip directional icons, and force `dir="ltr"` only where content is inherently left-to-right (game boards, English words, links).
- Server text that reaches players (push notifications, reminders) also needs both languages, chosen from the player's language setting.
- In the design, check the screen in both languages too.

## Checks before committing

- Frontend: `cd frontend/bazimoon-app && npx tsc -b && npm run lint`
- Backend: `dotnet test src/Bazimoon.Tests`
