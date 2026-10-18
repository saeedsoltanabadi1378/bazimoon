# Plan: PWA with guest and Google login (removing Telegram)

Goal: turn Bazimoon from a Telegram Mini App into a standalone PWA. Players start as guests straight away and can sign in with Google later to keep their progress. Telegram (Mini App auth, bot, group games, notifier) is removed completely.

Decisions:
- No real users yet: start fresh, no data migration.
- Telegram group games are replaced by the in-app Mafia tables that already exist (`MafiaTableRecord`, `CreateTableScreen`, invite codes).
- Keep the existing .NET + Postgres + Redis + SignalR stack; no Supabase (it would duplicate auth, database and realtime we already have).
- Login methods: guest + Google. Email is an optional later phase.

---

## Phase 0: Design first (required by `AGENTS.md`)
Draw artboards in the Bazimoon design and get them approved before writing UI code. Each screen in English and Persian (RTL):
- First launch: play as a guest straight away, with an optional "Sign in with Google"
- "Save your progress" prompt (after a win or level-up) and the Google linking result, including the "this Google account already has an account" case
- Profile: guest badge, linked account, log out
- Install prompt (Android/desktop) and the "Add to Home Screen" guide for iOS
- "Update available" banner and the offline screen
- Notification permission prompt
- Update existing artboards that mention Telegram (invites, the `no-telegram` state screen, admin bot settings and chats)

## Phase 1: Backend identity (no UI changes)
- Start fresh: delete all existing EF migrations and create one new `InitialCreate`.
- New tables: `users (Id Guid, IsGuest, DisplayName, Language, CreatedAt, LastSeenAt)` and `user_identities (UserId, Provider, ProviderUserId, Email, UNIQUE(Provider, ProviderUserId))`.
- `refresh_tokens (UserId, TokenHash, ExpiresAt, RevokedAt)`, so the installed app stays logged in.
- Every `long TelegramUserId` becomes `Guid UserId`: player stats, profiles, hub/league records, couples, `GamePlayerRecord`, `GameRosterEntry`, and `MafiaTableRecord.CreatorTelegramUserId`.
- Remove `TelegramChatId` and chat-related things: `GameRecord`, `MafiaTableRecord`, `chat_profiles`, `ChatGameIndex`, the `/games/by-chat/...` endpoint.
- `PlayerIdentity.DeriveId(Guid gameId, Guid userId)`.
- JWT: claims `user_id` and `is_guest`. Rename helpers to `GetUserId()` / `GetDisplayName()`.
- Update the Redis session stores and domain snapshot to use the new user IDs.

## Phase 2: Auth endpoints
- `POST /api/auth/guest`: creates a guest, returns `{ accessToken, refreshToken, user }`.
- `POST /api/auth/google`: takes a Google ID token, validates it with `Google.Apis.Auth`, finds or creates the user.
- `POST /api/auth/link/google`: turns the current guest into a Google user and keeps their progress. If the Google account already belongs to a user, return 409; the frontend offers "switch to that account" (the guest's progress is dropped).
- `POST /api/auth/refresh` and `POST /api/auth/logout`.
- Rate-limit guest creation per IP (ASP.NET built-in rate limiter).
- Background job: delete guests with no activity for 30 days.
- Config: `Google__ClientId` replaces `Telegram__BotToken`.
- Tests: guest flow, Google validation (fake validator), linking, the 409 conflict, refresh.

## Phase 3: Remove Telegram from the backend
- Delete the `src/Bazimoon.Bot` project (solution, Dockerfile, docker-compose).
- Delete `TelegramInitDataValidator`, `TelegramAuthOptions`, `TelegramIdentity`, `TelegramNotifier`, and the Telegram test fakes and fixtures.
- `ReminderService` and `CoupleService` send through a new `IPushNotifier` (phase 6) instead of Telegram.
- Admin: remove bot settings and the chats page; player IDs become `Guid`. `BotSettingsService` becomes general app settings (game on/off switches stay).
- Invite parsing in `TableService` accepts `/t/CODE` URLs instead of `startapp=`.

## Phase 4: Frontend session and removing Telegram
- Rewrite `src/app/session.tsx`: load saved tokens, else call `/auth/guest`; refresh automatically on 401. Remove the `no-telegram` status. Expose `userId`, `isGuest`, `displayName`, `signInWithGoogle()`, `logout()`.
- Google login with Google Identity Services (Sign in with Google button / One Tap), using redirect mode in the installed app.
- Replace `src/lib/telegram.ts`:
  - Haptics → `navigator.vibrate` (no-op on iOS)
  - Back button → a back button in the app header
  - Theme → `prefers-color-scheme` + `theme-color` meta tag
  - `openTelegramLink` → Web Share API, falling back to copying the link
- `links.ts`: invites become `https://bazimoon.com/t/CODE`, plus a router entry.
- Go through the ~39 files that mention Telegram; rename `telegramUserId` to `userId` in `api/types.ts` and screens.
- Add every new string to both `i18n/en` and `i18n/fa`.

## Phase 5: PWA
- `vite-plugin-pwa` with Workbox: cache static files and word lists. Never cache `/api`, `/hubs` (SignalR) or Agora traffic.
- Manifest: name, `display: standalone`, `dir`/`lang` for Persian, theme colours, PNG icons 192, 512, 512-maskable, plus `apple-touch-icon` (from the SVG logo).
- `nginx.conf`: serve `sw.js` and the manifest with `no-cache`; route `/t/*` to the SPA.
- Install prompt (`beforeinstallprompt`), iOS guide, update banner, offline screen.
- Verify with Lighthouse, a real Android phone and a real iPhone.

## Phase 6: Web Push notifications
- Generate VAPID keys (`Push__PublicKey`, `Push__PrivateKey`); add the `WebPush` NuGet package.
- `push_subscriptions (UserId, Endpoint, Keys, CreatedAt)` with subscribe/unsubscribe endpoints.
- Service worker: `push` handler and `notificationclick` that opens the right game or table.
- Messages in English and Persian, from the user's language setting.
- Ask for permission at a sensible moment (e.g. after joining a table), not on first load.
- Note: on iOS, push only works once the app is installed (iOS 16.4+).

## Phase 7: Deployment and cleanup
- `docker-compose.yml` / `.env.example`: remove `TELEGRAM_BOT_TOKEN`, Telegram use of `MINI_APP_BASE_URL`, and the bot service; add the Google client ID and VAPID keys.
- Google Cloud Console: create the OAuth client; add `https://bazimoon.com` and localhost as allowed origins.
- Update `docs/production-deployment.md`, the README and `AGENTS.md` ("Mini App" wording).
- Final checks: `cd frontend/bazimoon-app && npx tsc -b && npm run lint` and `dotnet test src/Bazimoon.Tests`.

## Optional Phase 8: Email backup login
Email magic-link login (`email` provider in `user_identities`) as a backup in case Google is unreliable for some players. Needs an email-sending service (possible small cost).

---

## Order and size
| Phase | Size | Depends on |
|---|---|---|
| 0 Design | Medium | — |
| 1 Identity model | Large | — |
| 2 Auth endpoints | Medium | 1 |
| 3 Remove Telegram (backend) | Medium | 2 |
| 4 Frontend session | Large | 0, 2 |
| 5 PWA | Small–medium | 4 |
| 6 Web Push | Medium | 3, 5 |
| 7 Deploy/cleanup | Small | all |

One PR per phase. Phases 1–3 can start while the phase 0 designs are being approved.
