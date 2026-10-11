# Deployment

The app is a Next.js server and the database is the hosted Supabase project. Deploying means:
1. Apply the database migrations.
2. Build and run the app with the production environment variables.
3. Tell Supabase Auth the production URL.

## 1. Database

From an up-to-date `dev` or `main`, with the CLI linked to the production project ([README → Database](../README.md#database)):

```bash
npm run db:push     # apply pending migrations (dry run first: npx supabase db push --dry-run)
npm run db:check    # RLS check: must print PASS
```

Always push migrations **before** deploying code that uses them.

## 2. Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | build time | Project URL, e.g. `https://<ref>.supabase.co` (no path) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | build time | `sb_publishable_…`. Public by design; access is enforced by RLS |
| `LOG_LEVEL` | runtime, optional | `debug`, `info` (default), `warn`, `error` ([observability.md](observability.md)) |
| `PORT`, `HOSTNAME` | runtime, optional | Docker image defaults `3000` / `0.0.0.0` |

`NEXT_PUBLIC_*` values are compiled into the browser bundle, so **changing them needs a rebuild**. The app never needs the Supabase **secret** key or the database password; don't put them in the app's environment.

## 3a. Docker (any container host or VM)

The production [Dockerfile](../Dockerfile) builds the standalone server and runs it as the non-root `node` user, with a health check on `/sign-in`.

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
  -t ip-messenger .

docker run -d --name ip-messenger -p 3000:3000 --restart unless-stopped ip-messenger
```

Put it behind HTTPS: the host's load balancer, or a reverse proxy such as Caddy or nginx. Session cookies need HTTPS in production. If you use nginx, disable response buffering for streaming (`proxy_buffering off`).

This works on Render, Fly.io, Railway, Google Cloud Run, a VPS, and so on. Use the Dockerfile as the build and pass the two `NEXT_PUBLIC_*` values as **build** arguments or variables.

CI builds this image and smoke-tests it on every PR (`.github/workflows/ci.yml`, job `docker`).

### Prebuilt image (GitHub Container Registry)

Every release (push to `main`) also publishes the image to GHCR ([publish.yml](../.github/workflows/publish.yml)), built with the real Supabase values, so a host can pull it instead of building:

```bash
docker pull ghcr.io/kiko0321/ip-messenger:latest     # newest release
docker pull ghcr.io/kiko0321/ip-messenger:sha-<commit> # a specific release, for pinning or rollback
```

One-time setup:

1. Add the repository secrets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (**Settings → Secrets and variables → Actions**). Without them the workflow fails with a clear error. The same secrets also enable the CI e2e job.
2. After the first publish, the package appears under the repository's **Packages**. To pull it without logging in, set its visibility under **Package settings**. Otherwise log in with `echo <token> | docker login ghcr.io -u <user> --password-stdin`, using a token with `read:packages`.

To re-publish without a release (for example after changing the secrets): **Actions → Publish image → Run workflow**.

## 3b. Vercel (no Docker)

1. Import the GitHub repository in Vercel. It detects Next.js.
2. Set **Production branch** to `main`.
3. Add both `NEXT_PUBLIC_*` variables for Production (and Preview if you want preview deployments).
4. Deploy. `output: "standalone"` in `next.config.ts` is ignored by Vercel and is harmless.

## 4. Supabase Auth URLs

In the Supabase Dashboard, go to **Authentication → URL Configuration**:

- **Site URL:** `https://<your-domain>`
- **Redirect URLs:** add `https://<your-domain>/auth/confirm**`. Keep `http://localhost:3000/auth/confirm**` for local development. The `**` also allows the password reset link's `?next=/reset-password`.

Without this, confirmation and password reset emails link to the wrong host.

## 5. Verify

| Check | Expected |
| --- | --- |
| `https://<your-domain>/api/health/supabase` | `{"ok":true,"authStatus":200,…}` |
| Sign up or sign in | You land on the home page |
| Chat between two accounts | Messages appear live; unread badges update |
| Server logs | One JSON line per event; a startup line `"msg":"server started"` |
| `https://<your-domain>/manifest.webmanifest` and `/sw.js` | Both load; the browser offers to install the app |

Installing the app (PWA) needs HTTPS; `localhost` is the only exception.

## Moderation

User reports (MSG-43) are stored in the `reports` table: who reported whom, the reason, optional details and a copy of the reported message's text. Review them in the Supabase Dashboard (**Table Editor → reports**, or `select * from reports order by created_at desc` in the SQL Editor). Users can only file and see their own reports, so the Dashboard (or the service role) is the only place they're all visible. To act on one, for example to remove an abusive account, use **Authentication → Users**.

## Release flow

`main` is the production branch and only ever **fast-forwards** to `dev`:

```bash
git checkout main && git merge --ff-only origin/dev && git push origin main
```

Run `npm run db:push` first if the release contains new migrations.
