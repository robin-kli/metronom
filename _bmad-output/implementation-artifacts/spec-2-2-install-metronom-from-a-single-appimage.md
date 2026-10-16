---
title: 'Story 2.2: Install metronom from a single AppImage'
type: 'feature'
created: '2026-10-16'
status: 'done'
baseline_commit: '220d0805380370f5a95641bbb64999572f0e9b2c'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** metronom only runs from the repo with Node installed. The user wants one file they can run like any other desktop app.

**Approach:** Configure electron-builder 26.15 to package the existing Angular build and Electron main into a single Linux AppImage, add a `package` script, and document setup, run and package commands in the README.

## Boundaries & Constraints

**Always:** Linux AppImage target only (x64). Package only `dist/electron/**`, `dist/metronom/browser/**` and `package.json`, keeping the `dist/electron` ↔ `dist/metronom/browser` layout `electron/main.ts` expects. `productName` "metronom", `appId` e.g. `dev.metronom.app`, `linux.category` "Audio", artifact name `metronom-${version}-${arch}.AppImage`, output folder `release/` (git-ignored). The Chromium sandbox stays enabled in the shipped app. README documents: Node 24 (`nvm use`), `npm install`, `npm start` (browser dev), `npm test`, `npm run desktop`, `npm run package`, running the AppImage (`chmod +x`), and the Ubuntu 24.04 sandbox requirement with the one-time fixes (root-owned 4755 `chrome-sandbox` for dev, an AppArmor profile allowing `userns` for the AppImage path), with exact commands.

**Never:** No other targets (deb, rpm, snap, Flatpak), no publishing, auto-update or code signing. No `--no-sandbox` baked into the app, scripts or desktop entry. No changes to `src/` or the security settings in `electron/main.ts`.

## I/O & Edge-Case Matrix

| Scenario | Action | Expected |
|---|---|---|
| Package | `npm run package` | Builds Angular + Electron main, writes exactly one `release/metronom-0.1.0-x86_64.AppImage` (or the arch name electron-builder uses) |
| Contents | Inspect `app.asar` | Contains `dist/electron/main.js`, `dist/metronom/browser/index.html`, `package.json`; no `src/`, `node_modules` dev deps, `_bmad*` or specs |
| Run offline | Run the AppImage (with `--smoke`) on this machine | Smoke passes: form rendered, no errors, no network |
| Git | `git status` after packaging | `release/` not listed |

</frozen-after-approval>

## Code Map

- `package.json` -- `"main": "dist/electron/main.js"`, version `0.0.0` (bump to `0.1.0`), scripts `build`, `build:electron`, `desktop`, `desktop:smoke`; `engines.node >=24.15`; Electron in devDependencies (electron-builder requires it there).
- `electron/main.ts` / `electron/smoke.ts` -- `--smoke` flag prints JSON and exits 0/1; build dir resolved relative to `dist/electron/`; do not change.
- `README.md` -- currently just `# metronom`.
- `.gitignore` -- add `release/`.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- sandbox note from Story 2.1 to resolve via README.
- This machine (Ubuntu 24.04) has `kernel.apparmor_restrict_unprivileged_userns=1`; local verification runs need `--no-sandbox` passed on the command line only. libfuse2 is installed.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- add `electron-builder@~26.15` devDependency, version `0.1.0`, `description`, `author`, script `package`: `ng build && npm run build:electron && electron-builder --linux AppImage`.
- [x] `electron-builder.yml` -- config per Boundaries.
- [x] `.gitignore` -- add `release/`.
- [x] `README.md` -- sections: What it is, Requirements, Develop, Desktop app, Package, Ubuntu 24.04 sandbox note.

**Acceptance Criteria:**
- Given `npm run package`, then exactly one AppImage is produced in `release/` and it starts metronom offline.
- Given a fresh reader, when they follow the README, then they can run, test, launch and package the app and fix the sandbox error on Ubuntu 24.04.

## Implementation Notes

- electron-builder auto-adds Angular's runtime `dependencies` as `node_modules` in `app.asar`; `!node_modules/**` in `files` keeps the asar to `dist/electron`, `dist/metronom/browser` and `package.json` (Angular is already bundled).
- electron-builder's default desktop entry is `Exec=AppRun --no-sandbox %U`; `appImage.executableArgs: []` makes it `Exec=AppRun %U`.
- Not configurable in electron-builder 26.15: its generated `AppRun` (both toolsets) appends `--no-sandbox` when `unshare -Ur true` fails, i.e. on Ubuntu 24.04 without the AppArmor profile. Confirmed on this machine: the AppImage starts (smoke ok) without `--no-sandbox` because of this fallback. README tells users to install the profile and states the fallback; logged in deferred-work.md.
- Review follow-up: `package` clears `dist/electron` and `release/` first and ends with `package:verify` (`scripts/verify-package.mjs`: one AppImage, asar layout, no `--no-sandbox` in `Exec=`); `electron/main.ts` warns on stderr under `--no-sandbox` and the smoke JSON reports `sandboxed` (not part of `ok`); category is `AudioVideo;Audio`.
- AppArmor profile from the README could not be tested here (no non-interactive sudo).

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| V/B: packaged layout, desktop Exec and artifact count unchecked | medium | patch | `package:verify` added and chained into `package`; pass and fail cases exercised. |
| B/E: AppRun silently adds --no-sandbox when userns blocked | medium | patch | Stderr warning + `"sandboxed"` in smoke JSON; fallback itself deferred (needs AppRun patching). |
| B/E: AppArmor profile tied to versioned name / unresolved path | low | patch | README installs to fixed `~/Applications/metronom.AppImage`, `realpath` in profile. |
| B/E: stale dist/electron and release/ contents | low | patch | `package` clears both first. |
| B: `category: Audio` invalid main category | low | patch | `AudioVideo;Audio`. |
| E: README "nothing saved" false (Electron userData) | low | patch | Reworded to "no settings are saved". |
| B: no app icon | low | reject | Icon/launcher integration deferred by the epic. |
| B: README doesn't add a menu entry | low | reject | Launcher integration deferred. |
| B: version hard-coded in README | low | patch | Covered by fixed install name. |
| B: no license field | low | reject | Private project. |

## Verification

**Commands:**
- `source ~/.nvm/nvm.sh && nvm use 24 && npm test -- --watch=false` -- expected: all tests pass
- `npm run package` -- expected: one `release/*.AppImage`
- `npx @electron/asar list release/linux-unpacked/resources/app.asar | head -50` -- expected: only dist/electron, dist/metronom/browser, package.json
- `release/metronom-*.AppImage --smoke --no-sandbox` -- expected: JSON `"ok": true`, exit 0
- `git status --short` -- expected: no `release/` entries
