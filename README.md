# IP Messenger

A modern real-time messenger inspired by the classic LAN tool IP Messenger, built with **Next.js 16**, **React 19** and **Supabase** (Postgres, Auth, Realtime, Storage).

- Email sign-up and sign-in, profiles with display name, status and avatar
- Contact directory, direct and group conversations
- Live messages, online presence with "last seen", unread counts
- Light, dark or device theme, saved per user
- Responsive: sidebar on desktop, tab bar on phones
- Installable as an app (PWA) on phones and desktops, with an offline page
- Desktop app with installers for Windows and Linux ([docs/desktop.md](docs/desktop.md))

How to use the app: **[docs/user-guide.md](docs/user-guide.md)**.

---

## Contents

1. [Requirements](#requirements)
2. [Quick start](#quick-start)
3. [Environment variables](#environment-variables)
4. [Supabase project setup](#supabase-project-setup)
5. [Database and migrations](#database-and-migrations)
6. [Running the app](#running-the-app)
7. [Testing](#testing)
8. [Project structure](#project-structure)
9. [Deployment, logging and other docs](#deployment-logging-and-other-docs)
10. [Contributing](#contributing)
11. [Troubleshooting](#troubleshooting)

## Requirements

- **Node.js 24** and npm 11
- A **Supabase** project (the free tier is enough)
- Optional: **Docker**, for the dev container, the production image or a local Supabase stack

## Quick start

```bash
git clone https://github.com/Kiko0321/IP_Msg.git && cd IP_Msg
npm install
cp .env.example .env.local          # then fill in the two values, see below
npx supabase login                  # once
npx supabase link --project-ref <project-ref>
npm run db:push                     # create the schema in your Supabase project
npm run dev                         # http://localhost:3000
```

Then check the connection at <http://localhost:3000/api/health/supabase>. It should show `{"ok":true,…}`.

## Environment variables

`.env.local` (git-ignored; copy from [.env.example](.env.example)):

| Variable | Required | Where to find it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Dashboard → Project Settings → Data API → **Project URL**, e.g. `https://abcd.supabase.co` (no `/rest/v1`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Dashboard → Project Settings → API Keys → **Publishable key** (`sb_publishable_…`) |
| `LOG_LEVEL` | no | `debug`, `info` (default), `warn`, `error` |

Both `NEXT_PUBLIC_*` values are public by design: data access is enforced by Row Level Security. Never put the **secret** key or the database password in the app's environment.

For end-to-end tests there is a separate `.env.e2e.local`; see [Testing](#testing).

## Supabase project setup

Most setup is in migrations. Run `npm run db:push` and you get:
- **Tables** with RLS: `profiles`, `conversations`, `conversation_members`, `messages`, `user_settings`
- **Functions:** the sign-up trigger, starting a direct chat, unread counts, last seen
- **Storage:** the `avatars` bucket and its policies
- **Realtime:** turned on for `messages`

A few settings live in the Dashboard:

1. **Authentication → Sign In / Providers → Email:** enabled. Decide whether **Confirm email** is on; the app handles both.
2. **Authentication → URL Configuration:**
   - **Site URL:** `http://localhost:3000` (your production URL later)
   - **Redirect URLs:** `http://localhost:3000/auth/confirm**` (plus `https://<prod-domain>/auth/confirm**`, and `http://127.0.0.1:47321/auth/confirm**` for the [desktop app](docs/desktop.md)). The `**` lets the password reset link carry `?next=/reset-password`.
3. **Realtime:** public channels must be allowed (the default), for online presence.

## Database and migrations

Schema changes are timestamped SQL files in [supabase/migrations/](supabase/migrations/), applied in order by the Supabase CLI (a dev dependency). **Every migration is safe to re-run.**

```bash
npm run db:new -- add_something   # new supabase/migrations/<timestamp>_add_something.sql
npm run db:status                 # local vs. applied migrations
npx supabase db push --dry-run    # preview
npm run db:push                   # apply pending migrations (never loads seed data)
npm run db:check                  # RLS check against the linked project; prints PASS
```

[supabase/checks/rls_membership_check.sql](supabase/checks/rls_membership_check.sql) proves that non-members can't read, join or post in a conversation. It runs inside a transaction that is rolled back, so it leaves no data.

### Local database with seed data (Docker)

```bash
npm run db:start   # local Supabase stack; prints its API URL and keys
npm run db:reset   # rebuild the schema from migrations and load supabase/seed.sql
npm run db:stop
```

Put the printed API URL and publishable key in `.env.local` to use it.

[supabase/seed.sql](supabase/seed.sql) creates `alice@example.test`, `bob@example.test` and `carol@example.test`, all with password `password123`. They have a direct chat (Alice and Bob) and a group, "Team". **The seed is for local databases only;** never load it into a hosted project.

## Running the app

### Dev server

```bash
npm run dev            # http://localhost:3000, hot reload
```

### Dev server in Docker

```bash
docker compose up --build
```

This reads `.env.local` and hot-reloads on source changes. Run `docker compose down -v` to also drop the cached `node_modules` and `.next` volumes, for example after changing dependencies.

### Production build

```bash
npm run build && npm run start
```

Or build the production image: see [docs/deployment.md](docs/deployment.md).

## Testing

| Command | What |
| --- | --- |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Unit and component tests (Vitest and Testing Library): validation, settings, messaging components, logger, network |
| `npm run test:watch` | Same, in watch mode |
| `npm run test:e2e` | End-to-end tests (Playwright): two users chat on desktop and mobile, against a production build |

End-to-end setup (once): run `npx playwright install chromium`, then create `.env.e2e.local` with two confirmed test users. Details: [e2e/README.md](e2e/README.md).

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint, build, typecheck and unit tests on every PR. It also builds and smoke-tests the dev and production Docker images. Each release publishes the production image to GHCR ([publish.yml](.github/workflows/publish.yml)). The end-to-end job runs when its secrets are configured.

## Project structure

```
app/
  (auth)/            sign-in, sign-up, forgot-password (server actions)
  (app)/             signed-in pages sharing the sidebar / tab-bar layout
    chats/  chat/[id]/  contacts/  profile/  settings/  network/
  auth/confirm/      email confirmation and password reset callback
  reset-password/    choose a new password after the reset link
  api/health/        Supabase connectivity check
components/
  chat/              chat view, message list/input, conversation list
  presence/          online status (Realtime Presence)
  shell/             navigation
lib/
  supabase/          browser and server clients, env validation
  validation/        Zod schemas (mirror the DB checks)
  logger.ts  network.ts  settings.ts  theme.ts
supabase/
  migrations/  seed.sql  checks/  config.toml
e2e/                 Playwright tests
public/              PWA files: icons, service worker (sw.js), offline page
desktop/             Electron desktop app and installer config
docs/                user guide, deployment, observability, network information
proxy.ts             refreshes the auth session on every request
instrumentation.ts   server error logging
```

## Deployment, logging and other docs

| Doc | Contents |
| --- | --- |
| [docs/user-guide.md](docs/user-guide.md) | Using the app |
| [docs/deployment.md](docs/deployment.md) | Production Docker image or Vercel, env vars, Supabase Auth URLs, release flow |
| [docs/desktop.md](docs/desktop.md) | Desktop app: installers for Windows and Linux, building them, how it works |
| [docs/observability.md](docs/observability.md) | Structured logs, tracing an "Error ID", what is never logged |
| [docs/network-information.md](docs/network-information.md) | What "IP" means in this app, who sees it, limitations |
| [e2e/README.md](e2e/README.md) | End-to-end test setup |

## Contributing

Work is tracked as tickets (`MSG-NN`) on the GitHub project board, grouped into phases.

1. **One branch per ticket, always from the latest `dev`:**
   ```bash
   git fetch origin && git checkout -b feat/msg-NN-<slug> origin/dev
   ```
   Allowed prefixes are `feat`, `fix`, `chore`, `docs`, `ci`, `refactor` and `test`.
2. **Open a PR into `dev`.** CI and the branch-flow checks must pass.
   - Tickets that depend on each other go in rounds: merge one round before branching the next.
   - Independent tickets can be worked on in parallel.
3. **On merge,** the ticket moves to Done on the board, the issue closes and the branch is deleted ([.github/workflows/ticket-board.yml](.github/workflows/ticket-board.yml)).
4. **Releases:** run `npm run db:push` if there are new migrations. Then fast-forward `main` to `dev`, which keeps `main` an ancestor of `dev`:
   ```bash
   git checkout main && git merge --ff-only origin/dev && git push origin main
   ```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Every page shows "Missing NEXT_PUBLIC_SUPABASE_URL…" | Create `.env.local` from `.env.example` and restart the dev server |
| "NEXT_PUBLIC_SUPABASE_URL must be the project URL without a path" | Remove `/rest/v1/` (or any path) from the URL |
| `npm install` or `npx` fails with `ETIMEDOUT` while `curl` works | Node gives up on slow IPv4 connections when there's no IPv6. Run `export NODE_OPTIONS="--no-network-family-autoselection --dns-result-order=ipv4first"` and retry |
| Supabase SQL Editor says "Backend error! Retry your query" | Use the CLI instead: `npx supabase db query --linked -f <file.sql>` |
| Confirmation or reset email link goes to the wrong site | Set Site URL and Redirect URLs in Supabase (see [setup](#supabase-project-setup)) |
| Messages don't appear live | Check that `npm run db:status` shows all migrations applied; the Realtime migration is `…_enable_messages_realtime` |
| Everyone shows as offline | Supabase → Realtime settings: allow public channels |
