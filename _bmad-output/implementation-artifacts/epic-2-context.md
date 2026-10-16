# Epic 2 Context: Run metronom as a Linux desktop app

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Wrap the finished Angular renderer (Epic 1) in a sealed Electron shell so metronom opens in its own window and ships as a single offline Linux AppImage. The renderer must keep working unchanged in a normal browser via `ng serve`.

## Stories

- Story 2.1: Open metronom in its own desktop window
- Story 2.2: Install metronom from a single AppImage

## Requirements & Constraints

- Linux desktop only; fully offline; no network requests at runtime; nothing persisted between launches.
- Timing must stay steady: the window must not throttle timers or audio when unfocused or partly hidden.
- Window freely resizable; minimum about 480 × 360px; F11 fullscreen just grows the display.
- Delivery is one AppImage that runs on a machine without Node or the repo.

## Technical Decisions

- Node 24 LTS, Angular 22.2, TypeScript 6.0, Electron 44.8, electron-builder 26.15 (Linux AppImage target only).
- `electron/` never imports from `src/`, and nothing in `src/` imports Electron or Node.
- One `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; no preload script, no IPC.
- The renderer loads the built Angular output (`dist/metronom/browser`) from disk. Angular emits ES module scripts, which Chromium may refuse over `file://`; serving the build through a privileged custom scheme registered before `app.ready` keeps module loading and CSP `default-src 'self'` working.
- CSP in `index.html` is `default-src 'self'; style-src 'self' 'unsafe-inline'`; must produce no violations in Electron.
- No auto-update, code signing, CI, other package formats or launcher/icon integration (deferred).

## Cross-Story Dependencies

- 2.1 adds Electron, `electron/main.ts`, its build step and run script; 2.2 packages exactly that output with electron-builder and documents commands in the README.
