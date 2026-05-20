# Discord Moderation Bot

A full-featured Discord moderation and staff-network bot with 35 slash commands, SQLite persistence, role-based permissions, a web dashboard with Discord OAuth2 login, and an application system for server staff recruitment.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the bot + web server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Discord: discord.js v14
- Database: SQLite via `node:sqlite` (Node built-in, no compilation)
- HTTP: Express 5 + express-session
- Auth: Discord OAuth2 (owner-only dashboard)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/bot/database.ts` — SQLite schema + all DB helper functions
- `artifacts/api-server/src/bot/commands.ts` — All 29 moderation/utility slash commands
- `artifacts/api-server/src/bot/setup.ts` — 6 setup slash commands
- `artifacts/api-server/src/bot/dashboard.ts` — Web dashboard + public apply page (Express routers)
- `artifacts/api-server/src/bot/utils.ts` — Shared helpers: embeds, permission checks, duration parsing
- `artifacts/api-server/src/bot/index.ts` — Bot entry point, event handlers
- `artifacts/api-server/src/bot/register.ts` — Global slash command registration
- `data/bot.db` — SQLite database (auto-created on first run)

## Architecture decisions

- Bot and web server run in the same process (Express + discord.js), sharing the SQLite DB directly
- `node:sqlite` (Node built-in) used instead of `better-sqlite3` to avoid native compilation issues
- Sessions stored in memory (suitable for single-owner dashboard); upgrade to persistent store for prod
- Dashboard is server-rendered HTML with Tailwind CDN — no frontend build step needed
- Slash commands registered globally on every bot start (can take up to 1 hour to propagate)

## Product

- **35 slash commands** covering warnings, bans, mutes, strikes, jail, promotions, breaks, and requests
- **Application system** — create custom forms via dashboard, collect submissions, accept/deny with automatic role assignment
- **Web dashboard** — owner-only admin panel at `/dashboard` secured by Discord OAuth2
- **Role-based permissions** — configure which roles can use each command via `/setup-roles-extra`
- **Message tracking** — counts messages per user, leaderboard, reset commands
- **Snipe cache** — captures last deleted message per channel

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Slash commands are registered globally — changes can take up to 1 hour to propagate in Discord
- The `node:sqlite` module emits an `ExperimentalWarning` on startup — this is expected and harmless
- OAuth2 redirect URI must be added in Discord Developer Portal: `https://<your-domain>/dashboard/auth/callback`
- `SESSION_SECRET` env var is already set; rotate it for production use
- Run `/setup` in your Discord server before using moderation commands

## Required Secrets

| Variable | Description |
|---|---|
| `TOKEN` | Discord bot token |
| `CLIENT_ID` | Discord application/client ID |
| `OWNER_ID` | Your Discord user ID (dashboard access) |
| `DISCORD_CLIENT_SECRET` | OAuth2 client secret |
| `SESSION_SECRET` | Session signing secret (already set) |
