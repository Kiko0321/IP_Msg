#!/usr/bin/env node
// MSG-35: runs the regression suite in one go and writes a report. See docs/testing.md.
//
//   npm run test:regression            static checks, unit tests, production build, browser tests
//   npm run test:regression -- --quick static checks and unit tests only (about a minute)
//   npm run test:regression -- --all   also the RLS check, the Docker image and the desktop app
//
// Single extras: --db, --docker, --desktop. Each step's full output goes to
// regression-report/<step>.log; the summary goes to regression-report/report.md. (Not under
// test-results/, which Playwright empties when it starts.)
// Exits non-zero if any step fails.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, createWriteStream } from "node:fs";
import { platform } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

const flags = new Set(process.argv.slice(2));
const quick = flags.has("--quick");
const all = flags.has("--all");
const want = (extra) => all || flags.has(extra);

const OUT = "regression-report";
mkdirSync(OUT, { recursive: true });

// Same values the app uses (NEXT_PUBLIC_*), and the e2e test users if configured.
for (const file of [".env.local", ".env.e2e.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Optional.
  }
}
// Child processes must not inherit editor switches that turn Electron into plain Node.
delete process.env.ELECTRON_RUN_AS_NODE;

const DOCKER_PORT = 3300;
const DOCKER_NAME = "ip-messenger-regression";

/** Steps run in order; `skip` returns a reason to skip, `run` returns extra notes or throws. */
const steps = [
  { id: "lint", title: "Lint (ESLint)", run: () => sh("npm run lint") },
  { id: "typecheck", title: "Type check (tsc)", run: () => sh("npm run typecheck") },
  { id: "unit", title: "Unit and component tests (Vitest)", run: () => sh("npx vitest run", unitSummary) },
  { id: "build", title: "Production build (next build)", skip: () => quick && "--quick", run: () => sh("npm run build") },
  {
    id: "e2e",
    title: "Browser tests (Playwright, desktop + phone)",
    skip: () => quick && "--quick",
    // The build step above already built the app; retries=1 marks network blips as "flaky".
    run: () => sh("npx playwright test --retries=1 --reporter=list", e2eSummary, { E2E_SKIP_BUILD: "1" }),
  },
  {
    id: "db",
    title: "Database security (RLS check on the linked project)",
    skip: () => !want("--db") && "add --db or --all",
    run: () => sh("npm run db:check", (log) => (log.includes("PASS") ? "PASS" : "")),
  },
  {
    id: "docker",
    title: "Production Docker image (build, start, health)",
    skip: () => !want("--docker") && "add --docker or --all",
    run: dockerSmoke,
  },
  {
    id: "desktop",
    title: "Desktop app (package for Linux, launch, smoke test)",
    skip: () => (!want("--desktop") && "add --desktop or --all") || (platform() !== "linux" && "Linux only"),
    run: async () => {
      await sh("npm run desktop:prepare");
      await sh("npx electron-builder --config desktop/electron-builder.yml --publish never --linux --dir");
      const display = process.env.DISPLAY || process.env.WAYLAND_DISPLAY ? "" : "xvfb-run -a ";
      return sh(`${display}node scripts/desktop-smoke.mjs`, (log) => `${log.match(/✓/g)?.length ?? 0} checks`);
    },
  },
];

let currentLog;

function sh(command, summarize, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    currentLog.write(`$ ${command}\n`);
    const child = spawn(command, { shell: true, env: { ...process.env, ...extraEnv } });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (chunk) => {
        output += chunk;
        currentLog.write(chunk);
      });
    }
    child.on("close", (code) => {
      const note = summarize?.(stripAnsi(output)) ?? "";
      if (code === 0) resolve(note);
      else reject(Object.assign(new Error(`"${command}" exited with code ${code}`), { note }));
    });
  });
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function unitSummary(log) {
  return log.match(/Tests\s+(.+?)\s*\(/)?.[1] ?? "";
}

function e2eSummary(log) {
  return ["passed", "flaky", "failed", "skipped"]
    .map((word) => log.match(new RegExp(`(\\d+) ${word}`))?.[0])
    .filter(Boolean)
    .join(", ");
}

async function dockerSmoke() {
  const args = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
    .map((name) => `--build-arg ${name}`)
    .join(" ");
  await sh(`docker build ${args} -t ${DOCKER_NAME} .`);
  await sh(`docker rm -f ${DOCKER_NAME} >/dev/null 2>&1 || true`);
  await sh(`docker run -d --name ${DOCKER_NAME} -p ${DOCKER_PORT}:3000 ${DOCKER_NAME}`);
  try {
    const base = `http://localhost:${DOCKER_PORT}`;
    for (let i = 0; i < 60; i++) {
      const ok = await fetch(`${base}/sign-in`).then((r) => r.ok, () => false);
      if (ok) break;
      await sleep(1000);
    }
    const health = await fetch(`${base}/api/health/supabase`).then((r) => r.json(), () => ({}));
    if (!health.ok) throw new Error(`health check failed: ${JSON.stringify(health)}`);
    await sh(`test "$(docker exec ${DOCKER_NAME} whoami)" = node`);
    return "starts, reaches Supabase, runs as non-root";
  } finally {
    await sh(`docker rm -f ${DOCKER_NAME}`).catch(() => {});
  }
}

const results = [];
const started = Date.now();
console.log(`Regression suite (${quick ? "quick" : all ? "all" : "standard"})\n`);

for (const step of steps) {
  const reason = step.skip?.();
  if (reason) {
    results.push({ ...step, status: "skipped", note: reason, seconds: 0 });
    console.log(`  -  ${step.title}  (skipped: ${reason})`);
    continue;
  }
  const logFile = `${OUT}/${step.id}.log`;
  mkdirSync(OUT, { recursive: true });
  currentLog = createWriteStream(logFile);
  if (process.stdout.isTTY) process.stdout.write(`  …  ${step.title}`);
  const t0 = Date.now();
  let status = "passed";
  let note = "";
  try {
    note = (await step.run()) ?? "";
  } catch (error) {
    status = "failed";
    note = [error.note, error.message].filter(Boolean).join(" · ");
  }
  await new Promise((resolve) => currentLog.end(resolve));
  const seconds = Math.round((Date.now() - t0) / 1000);
  results.push({ ...step, status, note, seconds, logFile });
  const mark = status === "passed" ? "✓" : "✗";
  process.stdout.write(`${process.stdout.isTTY ? "\r" : ""}  ${mark}  ${step.title}  ${seconds}s${note ? `  (${note})` : ""}\n`);
  if (status === "failed") {
    const tail = readFileSync(logFile, "utf8").trim().split("\n").slice(-15).join("\n    ");
    console.log(`    ${tail}\n    Full log: ${logFile}`);
  }
}

const failed = results.filter((r) => r.status === "failed");
const total = Math.round((Date.now() - started) / 1000);
const commit = await new Promise((resolve) => {
  const git = spawn("git", ["rev-parse", "--short", "HEAD"]);
  let out = "";
  git.stdout.on("data", (chunk) => (out += chunk));
  git.on("close", () => resolve(out.trim()));
});

const icon = { passed: "✅", failed: "❌", skipped: "⏭️" };
const report = [
  `# Regression report`,
  ``,
  `- **Result:** ${failed.length ? `❌ ${failed.length} step(s) failed` : "✅ all steps passed"}`,
  `- **Commit:** ${commit} · **When:** ${new Date().toISOString()} · **Duration:** ${total}s`,
  ``,
  `| Step | Result | Time | Notes |`,
  `| --- | --- | --- | --- |`,
  ...results.map((r) => `| ${r.title} | ${icon[r.status]} ${r.status} | ${r.seconds}s | ${r.note.replace(/\|/g, "\\|")} |`),
  ``,
  `Logs: \`${OUT}/<step>.log\`. Browser test traces: \`test-results/\`.`,
  ``,
].join("\n");
writeFileSync(`${OUT}/report.md`, report);
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, report, { flag: "a" });

console.log(`\n${failed.length ? `✗ ${failed.length} failed` : "✓ All passed"} in ${total}s. Report: ${OUT}/report.md`);
process.exit(failed.length ? 1 : 0);
