# IP Messenger

A modern real-time messenger inspired by IP Messenger, built with Next.js and Supabase.

## Development

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

1. Each ticket gets its own branch from the latest `dev`: `git fetch origin && git checkout -b feat/msg-NN-<slug> origin/dev`.
2. Open a PR into `dev`. CI and the branch-flow checks must pass.
3. On merge, the ticket is closed, moved to Done on the board, and its branch is deleted (`.github/workflows/ticket-board.yml`).
4. Releases fast-forward `main` to `dev` (`git merge --ff-only dev`), so `main` is always an ancestor of `dev`.

### Checks

```bash
npm run typecheck
npm run lint
```
