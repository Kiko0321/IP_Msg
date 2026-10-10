# End-to-end tests (MSG-26)

[Playwright](https://playwright.dev) tests that drive a real browser against a production build of the app and the real Supabase project.

| Test | What it proves |
| --- | --- |
| `two users sign in and exchange messages in real time` | A signs in, finds B in **Contacts**, opens the chat; B opens it too. A's message is saved and shown, and reaches B without a reload; B's reply reaches A. After a reload both messages are still there, in order. |
| `signed-out visitors are sent to sign in` | `/chats` redirects to `/sign-in` |

Each test runs twice: on a desktop browser and on an emulated phone (Pixel 7).

## Test users

The chat test needs **two existing, email-confirmed users**, and B must be findable by display name. It's skipped when they aren't configured. Put them in `.env.e2e.local` (git-ignored, never commit it):

```bash
E2E_USER_A_EMAIL=alice@example.test
E2E_USER_A_PASSWORD=...
E2E_USER_B_EMAIL=bob@example.test
E2E_USER_B_PASSWORD=...
# Optional: B's display name, if not "Bob"
# E2E_USER_B_NAME=Bob
```

Use dedicated test accounts, not real people's. Every run leaves two short `e2e …` messages in their direct chat.

## Running

```bash
npx playwright install chromium   # once
npm run test:e2e                  # builds the app, starts it on :3200, runs all tests
npm run test:e2e:ui               # interactive mode
```

- To test a running deployment instead, set `E2E_BASE_URL=https://…`. No local build is started.
- If a test fails, it saves a screenshot and a trace under `test-results/`. Open one with `npx playwright show-trace <trace.zip>`.

## In CI

The `e2e` job in `.github/workflows/ci.yml` runs only when these repository secrets are set, and is skipped otherwise:

- `E2E_USER_A_EMAIL`, `E2E_USER_A_PASSWORD`, `E2E_USER_B_EMAIL`, `E2E_USER_B_PASSWORD`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, used to build the app
