# Desktop app (Windows and Linux)

IP Messenger also ships as a desktop app with installers. The app is self-contained: it carries the app's server inside and talks to Supabase directly, so it **doesn't need the website to be hosted**. Each installer works with the Supabase project it was built for.

| Platform | Installer | Install |
| --- | --- | --- |
| Windows 10/11 (64-bit) | `IP-Messenger-Setup-<version>.exe` | Run it and follow the steps. Windows SmartScreen may warn, because the installer isn't code-signed: choose **More info → Run anyway**. |
| Linux, any distro (x64) | `ip-messenger-<version>-x86_64.AppImage` | `chmod +x ip-messenger-*.AppImage`, then run it. No install needed. |
| Debian / Ubuntu (x64) | `ip-messenger-<version>-amd64.deb` | `sudo apt install ./ip-messenger-*.deb`, then start **IP Messenger** from the app menu. |

## Getting the installers

**From GitHub (recommended).** The [Desktop app workflow](../.github/workflows/desktop.yml) builds them on real Windows and Linux machines:

- **Actions → Desktop app → Run workflow.** When it finishes, download the installers from the run's **Artifacts**.
- **Pull requests** that change the desktop app build both installers too (with placeholder Supabase values, so only to check the packaging).
- **Release:** push a version tag and the installers are also published as a GitHub Release:
  ```bash
  git checkout main && git pull
  git tag v0.1.0 && git push origin v0.1.0   # the tag should match "version" in package.json
  ```

One-time setup: add the repository secrets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (**Settings → Secrets and variables → Actions**). They are compiled into the app.

**On your own machine (Linux installers).** Uses the Supabase values from `.env.local`:

```bash
npm run desktop                        # build and open the app without installing
npm run desktop:dist -- --linux        # AppImage + .deb in dist-desktop/
```

The `.deb` needs the `ar` tool: `sudo apt install binutils`.

Build the Windows installer on Windows (`npm run desktop:dist -- --win`) or on GitHub. Building it on Linux would bundle Linux-only parts of the server.

## How it works

- [desktop/main.cjs](../desktop/main.cjs) is the Electron main process. It starts the bundled Next.js server (the `next build` standalone output) on `http://127.0.0.1:47321`, which is reachable only from your computer, and shows it in the app window. If port 47321 is taken, the app picks a free one.
- Only one copy runs at a time; opening it again focuses the open window.
- Links to other sites open in your normal browser.
- The server's log is `server.log` in the app's data folder: `%APPDATA%\ip-messenger` on Windows, `~/.config/ip-messenger` on Linux. If the app can't start, the error message says where it is.
- [desktop/prepare.cjs](../desktop/prepare.cjs) copies static files into the standalone server and makes sure no `.env` file is packaged. [desktop/electron-builder.yml](../desktop/electron-builder.yml) defines the installers.

## Email links (sign-up confirmation, password reset)

Email links open in your **browser**, not in the desktop app. Add the desktop address to Supabase so they're accepted: **Authentication → URL Configuration → Redirect URLs** → `http://127.0.0.1:47321/auth/confirm**`.

- **Sign-up confirmation:** clicking the link (while the desktop app is open) confirms the account. Then sign in in the desktop app.
- **Password reset:** a reset link only works in the browser where it was requested. So, with the desktop app open, request it from your browser at **http://127.0.0.1:47321/forgot-password**, open the email link in that same browser and choose the new password there. Then sign in to the desktop app with it.

## Updates

The app doesn't update itself. Install the newer installer over the old one; your sign-in is kept.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `npm run desktop` prints a Node version or "electron: not a valid app" | Your terminal has `ELECTRON_RUN_AS_NODE` set (some editors set it). Run `unset ELECTRON_RUN_AS_NODE` and try again. |
| `npm install` stops at "Downloading Electron binary" | Slow connection. Run `node node_modules/electron/install.js` to retry the download. |
| AppImage doesn't start on Ubuntu 22.04+ | Install FUSE 2: `sudo apt install libfuse2`. |
| "IP Messenger could not start" | Open the `server.log` named in the message. A Supabase or network error there usually means the installer was built without the right `NEXT_PUBLIC_*` values. |
