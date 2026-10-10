# Error monitoring and logging

How to find out what went wrong, without logging secrets.

## What gets logged

The server writes one JSON object per line ([lib/logger.ts](../lib/logger.ts)):

```json
{"time":"2026-10-10T16:40:53.272Z","level":"error","msg":"request failed","digest":"2817453001","method":"POST","path":"/chat/…","routePath":"/chat/[id]","routeType":"action","error":{"name":"Error","message":"…","stack":"…"}}
```

| Source | Event |
| --- | --- |
| `instrumentation.ts` `register` | `server started` (runtime) |
| `instrumentation.ts` `onRequestError` | `request failed`: every uncaught server error in Server Components, Route Handlers, Server Actions and the proxy |
| Your code | `logger.info/warn/error(message, fields)` |

`LOG_LEVEL` (`debug`, `info`, `warn`, `error`; default `info`) sets the minimum level. `warn` and `error` go to stderr, the rest to stdout.

## Tracing a user report

1. When a page fails, the user sees **"Something went wrong"** with an **Error ID** ([app/error.tsx](../app/error.tsx), [app/global-error.tsx](../app/global-error.tsx)).
2. Search the server logs for that ID in the `digest` field:
   ```bash
   docker compose logs web | grep '"digest":"2817453001"'
   ```
   On a hosting platform, use its log search for `2817453001`.
3. That entry has the route, the kind of request, and the full error with its stack.

Server errors are shown to users without details on purpose: the message and stack only appear in the server log.

## What is never logged

- **Request data:** for failed requests only the method and the path (without the query string) are recorded. Headers, cookies and bodies are not.
- **Secret fields:** keys matching `password`, `secret`, `token`, `apiKey`, `authorization`, `cookie`, `session`, `jwt`, `dsn` or `credential` are replaced with `[REDACTED]` at any depth.
- **Secret-looking values,** under any key and inside error messages and stacks:
  - Supabase keys (`sb_secret_…`, `sb_publishable_…`)
  - JWTs
  - passwords in `postgres://` connection strings

Even so, don't pass whole request objects, headers or environment variables to the logger.

## Adding a hosted error tracker later

The app has no third-party error service, which would need an account and a DSN. To add one (for example Sentry), call it from `onRequestError` in `instrumentation.ts`, next to the logger, and from `app/error.tsx` and `app/global-error.tsx` for browser errors. Keep its DSN in an environment variable. A DSN is not a secret, but it is still configuration.
