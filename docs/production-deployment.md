# Bazimoon production deployment

## Public endpoints

| Component | Public URL | Internal port |
| --- | --- | --- |
| Frontend / Telegram Mini App | `https://bazimoon.com` | `frontend:80` |
| API and SignalR hub | `https://api.bazimoon.com` | `api:8080` |
| Telegram bot | `@BazimoonGamesBot` | No public port |

## Cloudflare DNS

The proxied `A` records for `@` and `api` point to the Coolify server. The proxied `www` CNAME follows the primary hostname. Keep SSL/TLS mode at **Full (strict)** after Coolify has issued valid certificates.

## Coolify resource

The application deploys from the `main` branch of `saeedsoltanabadi1378/bazimoon` using the root `docker-compose.yml`. Coolify routes `https://bazimoon.com` to `frontend:80` and `https://api.bazimoon.com` to `api:8080`.

Production environment values:

```dotenv
PUBLIC_API_BASE_URL=https://api.bazimoon.com
PUBLIC_FRONTEND_ORIGIN=https://bazimoon.com
MINI_APP_BASE_URL=https://bazimoon.com
TELEGRAM_MINI_APP_URL=https://t.me/BazimoonGamesBot
ASPNETCORE_ENVIRONMENT=Production
SOLO_TEST_ENABLED=false
```

Keep `TELEGRAM_BOT_TOKEN`, `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`, `POSTGRES_PASSWORD`, `JWT_SIGNING_KEY`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` only in Coolify.

## Automatic deployment

Coolify's **Deploy on push (webhooks)** option is enabled. The GitHub repository has an active, signed `push` webhook targeting the application's manual GitHub webhook endpoint. Every push to `main` therefore starts a deployment without storing a Coolify API token in GitHub.

## Telegram

In BotFather, set `bazimoon.com` as the bot domain for `@BazimoonGamesBot` and set the Mini App URL to `https://bazimoon.com`.
