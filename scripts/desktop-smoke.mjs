#!/usr/bin/env node
// MSG-35: smoke test for a packaged desktop app (MSG-34).
//
//   node scripts/desktop-smoke.mjs [path to the app binary]
//
// Default binary: dist-desktop/linux-unpacked/ip-messenger (from `npm run desktop:dist -- --linux --dir`).
// Starts the app, checks that its bundled server answers, that a second launch doesn't start a
// second copy, and that quitting stops the server. On a machine without a display, run it under
// xvfb-run. Exits non-zero on the first failed check.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const binary = process.argv[2] ?? "dist-desktop/linux-unpacked/ip-messenger";
const base = "http://127.0.0.1:47321";
const STARTUP_TIMEOUT_MS = 60_000;

if (!existsSync(binary)) fail(`App not found at ${binary}. Build it with: npm run desktop:dist -- --linux --dir`);

// Electron must not run as plain Node (some editors set this), and CI runners can't use
// Chromium's sandbox helper.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("ELECTRON_")));
const args = process.env.CI ? ["--no-sandbox"] : [];

async function get(path) {
  try {
    const response = await fetch(base + path, { redirect: "manual" });
    return { status: response.status, body: await response.text() };
  } catch {
    return { status: 0, body: "" };
  }
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

if ((await get("/manifest.webmanifest")).status !== 0) fail("Port 47321 is already in use; close the running app first.");

const app = spawn(binary, args, { env, stdio: "ignore" });
let exited = false;
app.on("exit", () => (exited = true));

try {
  const started = Date.now();
  while ((await get("/manifest.webmanifest")).status !== 200) {
    if (exited) fail("The app exited during startup (see server.log in its data folder).");
    if (Date.now() - started > STARTUP_TIMEOUT_MS) fail("The app's server did not start within 60 s.");
    await sleep(500);
  }
  pass(`bundled server started in ${((Date.now() - started) / 1000).toFixed(1)} s`);

  const signIn = await get("/sign-in");
  if (signIn.status !== 200 || !signIn.body.includes("Sign in")) fail(`/sign-in returned ${signIn.status}`);
  pass("sign-in page renders");

  for (const path of ["/sw.js", "/offline.html", "/icons/icon-192.png"]) {
    const { status } = await get(path);
    if (status !== 200) fail(`${path} returned ${status}: public/ files are missing from the package`);
  }
  pass("static and PWA files are packaged");

  const second = spawn(binary, args, { env, stdio: "ignore" });
  const secondExit = await Promise.race([
    new Promise((resolve) => second.on("exit", (code) => resolve(code))),
    sleep(20_000).then(() => "timeout"),
  ]);
  if (secondExit === "timeout") {
    second.kill();
    fail("a second launch kept running instead of handing over to the first");
  }
  pass("a second launch hands over to the running app");
} finally {
  if (!exited) app.kill();
}

const stopped = Date.now();
while ((await get("/manifest.webmanifest")).status !== 0) {
  if (Date.now() - stopped > 10_000) fail("the server kept running after the app quit");
  await sleep(250);
}
pass("quitting the app stops its server");
