# Production image (MSG-28): Next.js standalone server, non-root, ~150 MB.
#
#   docker build \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
#     -t ip-messenger .
#   docker run -p 3000:3000 ip-messenger
#
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so they are build
# arguments, not runtime env. Both are public by design (access is enforced by RLS).
# See docs/deployment.md.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# The desktop app's Electron binary (MSG-34) isn't needed to build the server.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
# Same flaky-network settings as Dockerfile.dev: IPv4 first, patient retries, resumable cache.
RUN --mount=type=cache,target=/root/.npm \
    NODE_OPTIONS="--no-network-family-autoselection --dns-result-order=ipv4first" \
    npm ci --prefer-offline --no-audit --no-fund \
    --fetch-retries=5 \
    --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=120000 \
    --fetch-timeout=300000

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The standalone output contains server.js and only the node_modules it needs; static assets
# and public/ (PWA icons, service worker, offline page) are copied next to it so server.js serves them.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/sign-in').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
