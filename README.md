# metronom

## What it is

metronom is a practice metronome that ramps the tempo up for you. Set a start BPM, a ceiling BPM,
a step and how many bars to play at each tempo; metronom clicks, shows the beat, the current tempo
and the countdown to the next step, and climbs until it reaches the ceiling.

Keyboard: **Space** starts and stops, **Enter** in a settings field starts, **Escape** stops,
**F11** toggles fullscreen in the desktop app.

It runs fully offline: no network requests, no settings are saved between launches. It ships as a single
Linux AppImage (x64), and the same Angular app also runs in a normal browser for development.

## Requirements

- Linux x64 (developed on Ubuntu 24.04).
- Node.js 24 (see `.nvmrc`). With [nvm](https://github.com/nvm-sh/nvm):

  ```sh
  nvm install   # first time only
  nvm use
  ```

- To run the AppImage: `libfuse2` (on Ubuntu 24.04: `sudo apt install libfuse2t64`).

Install dependencies once:

```sh
npm install
```

## Develop

```sh
npm start                  # dev server at http://localhost:4200, reloads on change
npm test                   # unit tests (Vitest) in watch mode
npm test -- --watch=false  # run the tests once
```

## Desktop app

```sh
npm run desktop        # build Angular + Electron main, open metronom in its own window
npm run desktop:smoke  # same build, headless self-check: prints JSON and exits 0 (ok) or 1
```

On Ubuntu 24.04 this fails with a sandbox error until you apply the one-time fix in
[Ubuntu 24.04 sandbox note](#ubuntu-2404-sandbox-note).

## Package

```sh
npm run package
```

This builds the Angular app and the Electron main process, then writes one file:

```
release/metronom-0.1.0-x86_64.AppImage
```

`release/` is cleared on every run and is git-ignored. `npm run package` ends with
`npm run package:verify`, which checks that there is exactly one AppImage, that `app.asar` holds only
the built app, and that the desktop entry does not disable the sandbox.

Install it under a fixed name, so the AppArmor profile below keeps matching across versions:

```sh
mkdir -p ~/Applications
cp release/metronom-*.AppImage ~/Applications/metronom.AppImage
chmod +x ~/Applications/metronom.AppImage
~/Applications/metronom.AppImage
```

The AppImage needs neither Node nor this repository. Add `--smoke` to run the headless self-check
against the packaged app.

### Launcher and desktop icon

```sh
npm run install:desktop
```

This does the copy above for you and adds metronom with its icon to the app menu
(`~/.local/share/applications/metronom.desktop`) and to the desktop (marked as trusted, so GNOME
launches it on double-click). Run it again after each `npm run package` to update the installed app.
The icon is `build/icon.png`; regenerate it with `npm run icon`.

## Ubuntu 24.04 sandbox note

Ubuntu 24.04 blocks unprivileged user namespaces (`kernel.apparmor_restrict_unprivileged_userns=1`),
which the Chromium sandbox inside Electron needs. metronom keeps the sandbox enabled, so you need
one of these one-time fixes. Do not work around it with `--no-sandbox`.

**Development (`npm run desktop`)**: make Electron's sandbox helper root-owned and setuid. Repeat this
after every `npm install` that reinstalls Electron.

```sh
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

**AppImage**: the AppImage mounts itself in a fresh temporary folder on each start, so a setuid
helper cannot be used. Instead, give the AppImage file an AppArmor profile that allows user
namespaces. This assumes the fixed install path `~/Applications/metronom.AppImage` from
[Package](#package):

```sh
APPIMAGE="$(realpath ~/Applications/metronom.AppImage)"

sudo tee /etc/apparmor.d/metronom > /dev/null <<EOF
abi <abi/4.0>,
include <tunables/global>

profile metronom "$APPIMAGE" flags=(unconfined) {
  userns,

  include if exists <local/metronom>
}
EOF

sudo apparmor_parser -r /etc/apparmor.d/metronom
```

Check it worked (expect `"sandboxed": true`):

```sh
~/Applications/metronom.AppImage --smoke | grep '"sandboxed"'
```

Installing a new version over `~/Applications/metronom.AppImage` keeps the profile valid. If you
move the file elsewhere, rerun the commands above with the new path.

Without the profile, the launcher electron-builder puts inside the AppImage detects that user
namespaces are unavailable and starts metronom **without** the Chromium sandbox. metronom then
prints a warning on stderr and the smoke check reports `"sandboxed": false`, so install the
profile rather than relying on that fallback.
