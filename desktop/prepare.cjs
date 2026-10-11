// MSG-34: turns the `next build` standalone output into a self-contained server for the desktop
// app. Next leaves static assets and public/ out of .next/standalone; copy them in, and make
// sure no local .env file ends up in an installer.
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error('No .next/standalone/server.js. Run "npm run build" first.');
  process.exit(1);
}

fs.cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true });
fs.cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });

for (const name of fs.readdirSync(standalone)) {
  if (name.startsWith(".env")) fs.rmSync(path.join(standalone, name));
}

console.log("Desktop server ready in .next/standalone");
