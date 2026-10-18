# Bazimoon production deployment

Bazimoon is an installable web app (PWA). Players start as guests and can sign in with Google to keep their progress on every device.

## Public endpoints

| Component | Public URL | Internal port |
| --- | --- | --- |
| Web app (PWA) and admin console (`/admin`) | `https://bazimoon.com` | `frontend:80` |
| API and SignalR hub | `https://api.bazimoon.com` | `api:8080` |

## Cloudflare DNS

The proxied `A` records for `@` and `api` point to the Coolify server. The proxied `www` CNAME follows the primary hostname. Keep SSL/TLS mode at **Full (strict)** after Coolify has issued valid certificates.

## Coolify resource

The application deploys from the `main` branch of `saeedsoltanabadi1378/bazimoon` using the root `docker-compose.yml`. Coolify routes `https://bazimoon.com` to `frontend:80` and `https://api.bazimoon.com` to `api:8080`. The API sits behind Coolify's proxy, which it trusts for `X-Forwarded-For` (used to rate-limit new guests per IP).

Production environment values:

```dotenv
PUBLIC_API_BASE_URL=https://api.bazimoon.com
PUBLIC_FRONTEND_ORIGIN=https://bazimoon.com
ASPNETCORE_ENVIRONMENT=Production
PUSH_SUBJECT=https://bazimoon.com
```

Keep `GOOGLE_CLIENT_ID`, `PUSH_PUBLIC_KEY`, `PUSH_PRIVATE_KEY`, `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`, `POSTGRES_PASSWORD`, `JWT_SIGNING_KEY`, `ADMIN_USERNAME` and `ADMIN_PASSWORD` only in Coolify. `GOOGLE_CLIENT_ID` is used by both the API (to check Google sign-ins) and the web app build.

## Google sign-in

In Google Cloud Console › APIs & Services › Credentials, create an **OAuth client ID** of type **Web application**:

- **Authorized JavaScript origins:** `https://bazimoon.com`, plus `http://localhost` and `http://localhost:5173` for local development.
- **Authorized redirect URIs:** `https://bazimoon.com/auth/google`, plus `http://localhost:5173/auth/google` for local development. The app sends players to Google's sign-in page and Google brings them back to this address (no popup), which also works inside the installed app.

Put the client ID in `GOOGLE_CLIENT_ID`. Fill in the OAuth consent screen (app name, support email, privacy policy URL) and publish it, or only test users can sign in.

## Web Push notifications

Generate a VAPID key pair once and store it in Coolify:

```bash
npx web-push generate-vapid-keys
```

`PUSH_PUBLIC_KEY` and `PUSH_PRIVATE_KEY` take the two keys. With them empty the app never asks for notifications and nothing is sent. Changing the keys later invalidates every saved subscription, so players are asked again. On iPhone, notifications only work once the app is added to the Home Screen (iOS 16.4 or later).

## Caching and updates

nginx serves `sw.js`, `push-sw.js`, the Workbox files, the manifest and `index.html` with `no-cache`, and hashed files under `/assets/` as immutable. After a deploy, open apps show "A new version is ready" within an hour (or on next launch).

## Database

Migrations run on startup. The schema starts from a single `InitialCreate` migration (the move from Telegram to guest and Google accounts started fresh), so a database created by the old Telegram version must be dropped and recreated before the first deploy of this version.

## Automatic deployment

Coolify's **Deploy on push (webhooks)** option is enabled. The GitHub repository has an active, signed `push` webhook targeting the application's manual GitHub webhook endpoint. Every push to `main` therefore starts a deployment without storing a Coolify API token in GitHub.

## Checks after deploying

- Lighthouse (Chrome DevTools) on `https://bazimoon.com`: the PWA install check passes.
- Android: open the site in Chrome, install it, play as a guest, sign in with Google, join a table and allow notifications.
- iPhone: add to Home Screen from Safari, open it from the icon, sign in with Google and allow notifications.
