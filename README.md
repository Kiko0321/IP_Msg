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

### Checks

```bash
npm run typecheck
npm run lint
```
