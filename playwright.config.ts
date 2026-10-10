import { defineConfig, devices } from "@playwright/test";

// MSG-26: end-to-end tests against a production build of the app and the real Supabase project.
// Test-user credentials come from the environment or from .env.e2e.local (git-ignored), see e2e/README.md.
try {
  process.loadEnvFile(".env.e2e.local");
} catch {
  // No local file: rely on the environment (CI secrets).
}

const PORT = Number(process.env.E2E_PORT ?? 3200);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1, // both projects chat as the same two users; run them one after the other
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Builds and serves the app unless E2E_BASE_URL points at an already running one (e.g. a deployment).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: `${baseURL}/sign-in`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
