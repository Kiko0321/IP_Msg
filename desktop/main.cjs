// MSG-34: desktop app (Windows, Linux). Runs the Next.js standalone server inside Electron and
// shows it in a window, so the app works without hosting: it talks to Supabase directly.
// See docs/desktop.md.
const { app, BrowserWindow, Menu, dialog, shell, utilityProcess } = require("electron");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

// Fixed port so the address (and the Supabase redirect URL for email links) stays the same.
// If something else already uses it, a free port is picked instead.
const PREFERRED_PORT = 47321;
const HOST = "127.0.0.1"; // never reachable from the network
const STARTUP_TIMEOUT_MS = 30_000;

// Packaged: electron-builder copies the server to resources/server. From source: .next/standalone.
const serverDir = app.isPackaged
  ? path.join(process.resourcesPath, "server")
  : path.join(__dirname, "..", ".next", "standalone");

let server;
let mainWindow;
let appUrl;

// One window only: a second launch focuses the running app instead of starting another server.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(start);
}

async function start() {
  Menu.setApplicationMenu(null);
  try {
    const port = await pickPort(PREFERRED_PORT);
    appUrl = `http://${HOST}:${port}`;
    startServer(port);
    await waitForServer(`${appUrl}/manifest.webmanifest`);
    createWindow();
  } catch (error) {
    dialog.showErrorBox(
      "IP Messenger could not start",
      `${error.message}\n\nDetails are in ${logPath()}`,
    );
    app.quit();
  }
}

function startServer(port) {
  const serverJs = path.join(serverDir, "server.js");
  if (!fs.existsSync(serverJs)) throw new Error(`Server not found at ${serverJs}. Run "npm run desktop:prepare".`);

  const log = fs.createWriteStream(logPath(), { flags: "w" });
  server = utilityProcess.fork(serverJs, [], {
    cwd: serverDir,
    serviceName: "IP Messenger server",
    stdio: "pipe",
    env: { ...serverEnv(), NODE_ENV: "production", PORT: String(port), HOSTNAME: HOST },
  });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  server.on("exit", (code) => {
    server = undefined;
    // During startup, start() reports the failure; afterwards, say so here.
    if (!app.isQuitting && mainWindow) {
      dialog.showErrorBox("IP Messenger stopped", `The app's server exited (code ${code}). Details are in ${logPath()}`);
      app.quit();
    }
  });
}

// The parent's environment minus Electron's own switches (e.g. ELECTRON_RUN_AS_NODE, set by some
// editors' terminals), which aren't meant for the server.
function serverEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("ELECTRON_")));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 360,
    minHeight: 500,
    title: "IP Messenger",
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#171717",
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => (mainWindow = undefined));

  // Links to other sites open in the normal browser; the window only shows the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(appUrl)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  mainWindow.loadURL(appUrl);
}

function openExternal(url) {
  if (/^https?:\/\//.test(url) || url.startsWith("mailto:")) shell.openExternal(url);
}

function pickPort(preferred) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => {
      // Taken: let the OS choose a free one.
      const fallback = net.createServer();
      fallback.listen(0, HOST, () => {
        const { port } = fallback.address();
        fallback.close(() => resolve(port));
      });
    });
    probe.listen(preferred, HOST, () => probe.close(() => resolve(preferred)));
  });
}

async function waitForServer(url) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!server) throw new Error("The app's server exited during startup.");
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("The app's server did not start in time.");
}

function logPath() {
  return path.join(app.getPath("userData"), "server.log");
}

app.on("before-quit", () => {
  app.isQuitting = true;
  server?.kill();
});

app.on("window-all-closed", () => app.quit());
