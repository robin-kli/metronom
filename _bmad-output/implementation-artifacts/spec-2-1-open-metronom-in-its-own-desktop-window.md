---
title: 'Story 2.1: Open metronom in its own desktop window'
type: 'feature'
created: '2026-10-16'
status: 'done'
baseline_commit: '0b4f58c27ff91cd8fb3eb9bc01ce56e18ced03be'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** metronom only runs in a browser tab via `ng serve`. The user wants it as its own desktop window on Linux.

**Approach:** Add Electron 44.8 with a thin, sealed `electron/main.ts` that opens one window and loads the production Angular build from disk, plus npm scripts to build and launch it.

## Boundaries & Constraints

**Always:** `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `backgroundThrottling: false`; no preload, no IPC. Load `dist/metronom/browser/index.html` from disk; if ES module scripts do not load over `file://`, serve that folder through a custom privileged scheme (e.g. `app://`, registered as standard + secure before `ready`, handled with `protocol.handle`) restricted to files inside the build folder. Window title "metronom", background `#0E0F12`, default size about 960×640, `minWidth: 480`, `minHeight: 360`, no application menu. Block navigation away from the app and new windows. No network requests. The renderer (`src/`) stays unchanged except where strictly needed, and still works with `ng serve`.

**Never:** No packaging (Story 2.2). No Node/Electron imports in `src/`. No `webSecurity: false`, no disabling CSP, no `allowFileAccessFromFileURLs`.

## I/O & Edge-Case Matrix

| Scenario | Action | Expected |
|---|---|---|
| Launch | `npm run desktop` | Angular prod build, Electron compiles main, one window opens showing the Idle screen |
| Offline | Launch with network off | App loads and plays; no network requests |
| CSP | Launch | No CSP violations or module-load errors in the renderer console |
| Path escape | Request for a path outside the build folder via custom scheme | 404 / refused |
| Navigation | Renderer tries to navigate or open a window | Blocked |

</frozen-after-approval>

## Code Map

- `angular.json` -- prod build outputs to `dist/metronom/browser`; `<base href="./">` and CSP already set in `src/index.html`.
- `package.json` -- scripts `start`, `build`, `test`; add Electron devDependency and desktop scripts; `engines.node >=24.15`.
- `tsconfig.json` -- Angular app config; create a separate `tsconfig.electron.json` for `electron/` so the Angular build ignores it.
- `.gitignore` -- `dist/` already ignored.
- Deferred note: built `index.html` may not render from `file://` because of module scripts — settle it here.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- add `electron@44.8.x` devDependency; `"main"` pointing at compiled main; scripts `build:electron` (tsc -p tsconfig.electron.json), `desktop` (ng build && build:electron && electron .), `desktop:smoke`.
- [x] `tsconfig.electron.json` -- compiles `electron/**/*.ts` to `dist/electron/`, Node module resolution, strict.
- [x] `electron/main.ts` -- window, security settings, loading (file or custom scheme), navigation/new-window blocking, no menu.
- [x] `electron/smoke.ts` (or a `--smoke` flag in main) -- launches, waits for `app-root` to render the settings form, collects renderer console errors and failed requests, prints a JSON result and exits non-zero on any error.
- [x] `src/` -- confirm no changes needed; `grep -rn "electron\|require(" src` empty.

**Acceptance Criteria:**
- Given `npm run desktop`, then a "metronom" window opens with the Idle screen and the full Epic 1 flow works inside it.
- Given the smoke run, then it reports the form rendered, zero console errors, zero CSP violations, zero network requests.

## Implementation Notes

- Loading: went straight to the `app://metronom/` privileged scheme (standard + secure + supportFetchAPI) rather than `file://`, so module scripts and CSP `'self'` have a real origin. The handler reads files with `fs` (small MIME map), decodes the path, and refuses anything resolving outside `dist/metronom/browser` or on another host (404).
- Network: `webRequest.onBeforeRequest` cancels every non-`app:`/`data:`/`blob:`/`devtools:` request; permission requests are denied.
- F11: with `Menu.setApplicationMenu(null)` there is no built-in F11 accelerator, so `before-input-event` toggles fullscreen.
- Smoke: `--smoke` flag in main runs `electron/smoke.ts` (hidden window, waits for the settings form, probes encoded path escapes via `net.fetch`, prints JSON, exits 0/1).
- Host note: Ubuntu 24.04 (`kernel.apparmor_restrict_unprivileged_userns=1`) aborts Electron unless `node_modules/electron/dist/chrome-sandbox` is root-owned 4755 or an AppArmor profile exists; verification here used `--no-sandbox` on the command line only. Story 2.2's AppImage hits the same issue.

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| V/E/B: path-escape probes never reach an existing file | medium | patch | Added 3-level and deep probes; smoke now fails when guard removed (verified). |
| V/B: title, isolation and navigation blocking not asserted | medium | patch | `ok` now checks title, no require/process, one window, URL unchanged after open/navigate. |
| E/B: smoke can hang or pass on rejection/window close | medium | patch | `.catch` → exit 1, 45 s deadline, window-all-closed exits 1 in smoke. |
| E: whenReady failure leaves windowless process | low | patch | `.catch(fail)`. |
| E/B: no permission check handler | low | patch | `setPermissionCheckHandler(() => false)`. |
| E: escapeOk accepts 206/304 | false | reject | Now requires exactly 404 or fetch error. |
| E: directory/deep-link paths 404 | false | reject | No router; single index.html. |
| E: second instance runs another window | low | reject | Not in intent. |
| E: macOS menu shortcuts | false | reject | Linux only. |
| B: resolveBuildFile lacks unit tests | low | reject | Covered by smoke probes, which now fail without the guard. |
| B: smoke doesn't run full Epic 1 flow | low | reject | Manual check in spec; renderer flow unit-tested. |
| B: Ubuntu 24.04 sandbox abort not documented | medium | defer | README is Story 2.2's task; recorded in deferred-work. |
| B: symlinks not resolved before containment check | low | reject | Build output contains no symlinks. |
| B: no CSP / nosniff response headers | low | reject | `<meta>` CSP enforced; smoke reports zero violations. |
| B: `url === APP_ORIGIN` branch dead | low | reject | Harmless. |
| B: 4xx from protocol handler may not show in webRequest | maybe-false | reject | Would surface as console error, which the smoke checks. |
| B: no dev loop against `ng serve` | low | reject | Renderer dev uses browser `ng serve`. |

## Verification

**Commands:**
- `source ~/.nvm/nvm.sh && nvm use 24 && npm test -- --watch=false` -- expected: all tests pass
- `npm run build && npm run build:electron` -- expected: both succeed
- `npm run desktop:smoke` (use `xvfb-run -a` if no display) -- expected: exit 0, form rendered, no errors
- `grep -rn "electron" src` -- expected: no output

**Manual checks:**
- `npm run desktop`: window opens, Space starts the click, resize scales the beat display, F11 fullscreen works.
