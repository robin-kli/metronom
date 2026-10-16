---
title: 'Story 1.4: Control playback from the keyboard'
type: 'feature'
created: '2026-10-16'
status: 'done'
baseline_commit: 'f54e5913c2e19c9eeb6a08290099728d51a56295'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** With both hands on the instrument, the user cannot reach for the mouse to start or stop the metronome.

**Approach:** One window-level `keydown` handler on the root `App` component: Space toggles start/stop from anywhere, Enter in a settings field starts, Escape stops. All paths go through `SessionService.start()` / `stop()`.

## Boundaries & Constraints

**Always:** Only `App` listens, via `host: { '(window:keydown)': ... }` (or `@HostListener('window:keydown')`). Space always calls `preventDefault()` (no space typed into a field, no page scroll, no second activation of a focused button) and toggles: idle → `session.start()`, playing → `session.stop()`. Ignore auto-repeat (`event.repeat`) and keys with Ctrl/Alt/Meta modifiers. Enter starts only when idle and the event target is a settings `<input>`; Enter on a focused button keeps its native behaviour. Escape stops only when playing. `start()` already refuses invalid Settings, so Space/Enter with invalid Settings do nothing and the hint stays.

**Never:** No key handling in any other component. No new shortcuts beyond Space, Enter, Escape. No changes to session, audio or core logic.

## I/O & Edge-Case Matrix

| Scenario | State / focus | Key | Expected |
|---|---|---|---|
| Space start | idle, valid, focus in a field | Space | Session starts; field value unchanged; default prevented |
| Space stop | playing, focus anywhere | Space | Session stops; form returns |
| Space on focused Start | idle, focus on Start button | Space | Exactly one start (no double toggle) |
| Space invalid | idle, invalid Settings | Space | No start; hint still shown |
| Auto-repeat | playing | Space held (repeat) | Only the first keydown toggles |
| Enter in field | idle, valid, focus in field | Enter | Session starts |
| Enter invalid | idle, invalid, focus in field | Enter | Nothing happens |
| Escape | playing | Escape | Session stops |
| Escape idle | idle | Escape | Nothing happens |
| Modifier | idle | Ctrl+Space | Ignored |

</frozen-after-approval>

## Code Map

- `src/app/app.ts` -- root component; has `session = inject(SessionService)`, `onStart()` (`void this.session.start()`), `onStop()`. Add the handler here.
- `src/app/session/session.service.ts` -- `status()`, async `start(): Promise<boolean>`, `stop()`; reuse unchanged.
- `src/app/ui/settings-form/settings-form.html` -- four `<input type="number">` then `<button type="button" class="start">`; DOM order already gives Tab order Start BPM → Ceiling → Step → Every → Start. No changes expected.
- `src/app/ui/settings-strip/settings-strip.html` -- Stop `<button type="button">`.
- `src/app/app.spec.ts` -- existing fake `SESSION_PLATFORM` pattern for playing/idle tests; reuse.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/app.ts` -- add `onKeydown(event: KeyboardEvent)` bound to `window:keydown` implementing the rules above.
- [x] `src/app/app.spec.ts` -- one test per matrix row, dispatching `KeyboardEvent`s on the focused element / window and asserting `session.status()`, field values and `defaultPrevented`.

**Acceptance Criteria:**
- Given any state, when the user uses only the keyboard (Tab, Space, Enter, Escape), then they can edit the Settings, start and stop a Session without a mouse.
- Given the code, then no component other than `App` binds keydown/keyup listeners (`grep -rn "keydown\|keyup" src/app --include=*.ts --include=*.html | grep -v spec` shows only `app.ts`).

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| B/E: Space/Escape cannot cancel a start awaiting `resume()` | low | reject | Resume settles in milliseconds; fixing needs a new "starting" signal and conflicts with "Escape stops only when playing". |
| B/E: focused-Start "exactly once" and "no typed space" tests cannot fail in jsdom | low | reject | Real guarantee is keydown preventDefault (honoured by Chromium/Electron); covered by manual check. |
| B: focus falls to body on start/stop | low | reject | Space/Escape work from anywhere; not in intent. |
| B/V: modifier guard only tested for Space | medium | patch | Added Ctrl/Alt/Meta + Enter and + Escape tests. |
| B/E: repeat test sends repeats while idle | low | patch | Test now repeats while playing. |
| B/E: Enter during IME composition starts | low | patch | `event.isComposing` guard + test. |
| B: Enter detection tied to `app-settings-form` selector | low | reject | Single form; no named failure today. |
| B/E: Space swallowed globally; `defaultPrevented` ignored | low | reject | Spec requires always preventing Space; no other key handlers exist. |
| B: fixtures not destroyed in keyboard tests | low | patch | `fixture.destroy()` in `afterEach`. |

## Verification

**Commands:**
- `source ~/.nvm/nvm.sh && nvm use 24 && npm test -- --watch=false` -- expected: all tests pass
- `npm run build` -- expected: succeeds
- `grep -rn "keydown\|keyup" src/app --include=*.ts --include=*.html | grep -v spec` -- expected: only `src/app/app.ts`

**Manual checks:**
- `npm start`: click into Ceiling, press Space → plays, no space typed; Space → stops; Enter in a field → plays; Escape → stops.
