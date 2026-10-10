# IP Messenger

A modern real-time messenger inspired by IP Messenger, built with Next.js and Supabase.

## Development

### Environment

Copy `.env.example` to `.env.local` and fill in the values from your Supabase project (Project Settings → API Keys / Data API).

```bash
cp .env.example .env.local
```

### With Docker (recommended)

```bash
docker compose up --build
```

Open http://localhost:3000. Source changes hot-reload. Environment variables are read from `.env.local` if present.

Stop with `Ctrl+C` or `docker compose down`. Run `docker compose down -v` to also remove the cached `node_modules` and `.next` volumes, e.g. after changing dependencies.

### Without Docker

Requires Node.js 24.

```bash
npm install
npm run dev
```

### Branch flow

1. Each ticket gets its own branch from the latest `dev`: `git fetch origin && git checkout -b feat/msg-NN-<slug> origin/dev`. A ticket that depends on an unmerged ticket in the same phase branches from that ticket's branch instead.
2. Open a PR into `dev`. CI and the branch-flow checks must pass. A phase's PRs are merged together, in dependency order.
3. On merge, the ticket is closed, moved to Done on the board, and its branch is deleted (`.github/workflows/ticket-board.yml`).
4. Releases fast-forward `main` to `dev` (`git merge --ff-only dev`), so `main` is always an ancestor of `dev`.

### Checks

```bash
npm run typecheck
npm run lint
```

## Database

Schema changes live in `supabase/migrations/` as timestamped SQL files and are applied with the Supabase CLI (installed as a dev dependency). Every migration is safe to re-run.

### Hosted project

One-time setup:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>   # asks for the database password
```

Then:

```bash
npm run db:new -- <name>   # create supabase/migrations/<timestamp>_<name>.sql
npm run db:status          # local vs. applied migrations
npm run db:push            # apply pending migrations
```

`db:push` never loads seed data.

### Local database (Docker)

```bash
npm run db:start   # start a local Supabase stack; prints its URL and keys
npm run db:reset   # recreate the schema from migrations and load supabase/seed.sql
npm run db:stop
```

To point the app at it, put the printed API URL and publishable key in `.env.local`. Seed users: `alice@example.test`, `bob@example.test`, `carol@example.test`, password `password123`. They have a direct chat (Alice and Bob) and a group "Team".

### Checks

`supabase/checks/rls_membership_check.sql` proves that non-members can't read or post in a conversation. Paste it into the SQL Editor; it rolls back and leaves no data.
