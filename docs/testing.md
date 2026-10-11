# Testing and regression

Regression testing means re-running the whole test suite after every change, to prove that what worked before still works. In this project one command does that and writes a report:

```bash
npm run test:regression             # standard: before every PR (about 5 minutes)
npm run test:regression -- --quick  # while coding: static checks and unit tests (about 1 minute)
npm run test:regression -- --all    # before a release: everything, including Docker and desktop
```

The report is `regression-report/report.md`, and each step's full output is in `regression-report/<step>.log`. The command exits with an error if any step fails.

## What runs

| Step | Command on its own | What it catches | Needs |
| --- | --- | --- | --- |
| Lint | `npm run lint` | Code mistakes, React and Next.js rule breaks | |
| Type check | `npm run typecheck` | Wrong types, broken imports | |
| Unit and component tests | `npm test` | Broken logic in validation, Server Actions, the email-link callback, components | |
| Production build | `npm run build` | Anything that stops the app from building | |
| Browser tests | `npm run test:e2e` | Broken pages and flows in a real browser, on desktop and on a phone screen | `.env.local` |
| Database security | `npm run db:check` | Row-level security letting non-members read or write chats | Supabase CLI linked (`--db`) |
| Docker image | (in the runner) | A production image that won't build, start or reach Supabase | Docker (`--docker`) |
| Desktop app | `npm run test:desktop` | An installer missing files, a server that won't start, two copies running | Linux (`--desktop`) |

## Test layers

**Unit and component tests** (Vitest, `*.test.ts(x)` next to the code) run in about 10 seconds with no network. Server Actions and the `/auth/confirm` route are tested against a fake Supabase client ([lib/test-utils/server-mocks.ts](../lib/test-utils/server-mocks.ts)), so every rule can be checked without real accounts:

| File | Covers |
| --- | --- |
| `app/(auth)/actions.test.ts` | Sign-in, sign-up, password reset: validation, no account lookup, correct redirects |
| `app/auth/confirm/route.test.ts` | Email links: confirmation, reset, expired links, **no redirects to other sites** |
| `app/(app)/app-actions.test.ts` | Sending messages, starting chats, profile, avatar folder rules, settings |
| `lib/regression.test.ts` | Avatar files, theme choice, the installable-app manifest |
| `lib/validation/validation.test.ts`, `lib/settings.test.ts`, `lib/server-utils.test.ts` | Schemas, settings, log redaction, network info |
| `components/components.test.tsx` | Avatar, message box, message list |

**Browser tests** (Playwright, [e2e/](../e2e/)) build the app and drive Chromium against the real Supabase project. They never create accounts or send emails. The two-user chat test runs only when test users are configured ([e2e/README.md](../e2e/README.md)); otherwise it's reported as skipped. Each test may retry once: one that passes on the retry is reported as **flaky**, which usually means a network blip, not a bug.

**Smoke tests** check that the shipped forms of the app (Docker image, desktop app) start and work.

## When it runs

| When | What | Where |
| --- | --- | --- |
| While coding | `npm run test:regression -- --quick` | Your machine |
| Before opening a PR | `npm run test:regression` | Your machine |
| Every PR and push to dev/main | Lint, type check, unit tests, build, Docker images, browser tests | [ci.yml](../.github/workflows/ci.yml) |
| PRs that change the desktop app | Installers for Windows and Linux, plus the Linux smoke test | [desktop.yml](../.github/workflows/desktop.yml) |
| Every night (03:00 UTC) and on demand | The whole suite with Docker and desktop | [regression.yml](../.github/workflows/regression.yml) (**Actions → Regression → Run workflow**) |
| Before a release | `npm run test:regression -- --all` | Your machine |

## When you fix a bug

Add a test that fails without the fix, then fix it. That's what keeps a bug from coming back. Example: `app/auth/confirm/route.test.ts` has a case for `?next=/\evil.example`, which used to redirect to another site.
