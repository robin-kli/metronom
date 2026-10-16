---
title: 'Story 1.3: See the beat, tempo and countdown'
type: 'feature'
created: '2026-10-16'
status: 'done'
baseline_commit: 'baae3fe6b7064ee7faaf04a0be8a24c171dd98f3'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** While playing, the user only sees the settings strip. They need a large display showing which beat it is, the current BPM and the bars until the next increase, so they can follow along out of the corner of their eye.

**Approach:** Add a `BeatDisplay` component under the settings strip that renders only `SessionService.current()` (the published `BeatEvent`) plus the Step from Settings: BPM number, four beat blocks, and a status line. It fills the remaining window and scales with it.

## Boundaries & Constraints

**Always:** Render-only: the component reads `session.current()` and `session.settings().step`; it never computes tempo, hold, beat or countdown. Standalone, `OnPush`, signals. Colours via CSS variables only. Blocks switch instantly — no `transition` or `animation` on them. Beat 1 lit = `--color-accent`; beats 2–4 lit = `--color-beat-on`; unlit = `--color-beat-off`; beat 1 always has a 3px `--color-accent` outline/border. Sizes: BPM `clamp(64px, 18vmin, 220px)` bold tabular with muted "BPM" label; blocks square `min(20vw, 30vh)`, radius `--radius-lg`, gap `--space-4`; status line `clamp(16px, 3.5vmin, 32px)` muted. Exact copy: "{n} bars to +{step}", "1 bar to +{step}", "Holding at {tempo} BPM". Tempo changes announced once each via a visually hidden `aria-live="polite"` region ("66 BPM"); beats are not announced (blocks `aria-hidden`).

**Never:** No timers, rAF or audio access in the component. No keyboard handling (1.4). No change to scheduler/ramp logic.

## I/O & Edge-Case Matrix

| Scenario | `current` | Display |
|---|---|---|
| Before first beat sounds | `null` | No block lit; BPM shows Settings start BPM; status line empty |
| Ramping, beat 1 | beat 1, tempo 60, hold false, barsToNext 4 | Block 1 amber; BPM 60; "4 bars to +5" (step 5) |
| Ramping, beat 3, last bar | beat 3, barsToNext 1 | Block 3 beat-on; "1 bar to +5" |
| Hold | tempo 120, hold true | "Holding at 120 BPM" |
| Tempo change | 60 → 66 | live region text becomes "66 BPM"; unchanged while tempo stays 66 |

</frozen-after-approval>

## Code Map

- `src/app/session/session.service.ts` -- `current: Signal<BeatEvent | null>`, `settings`, `status`; reuse, do not change.
- `src/app/core/beat-event.ts` -- `BeatEvent { audioTime, beat 1–4, barIndex, tempo, hold, barsToNext }`.
- `src/app/app.html` / `app.css` -- Playing branch renders `<app-settings-strip>` inside `main.playing` (flex column); add the display below it, filling remaining height.
- `src/app/ui/settings-strip/` -- sibling component pattern to follow (standalone, OnPush, spec style).
- `src/styles.css` -- tokens.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/ui/beat-display/beat-display.ts|html|css` -- component with inputs `event: BeatEvent | null`, `startBpm: number`, `step: number` (pure presentational); BPM, four blocks, status line, hidden live region.
- [x] `src/app/ui/beat-display/beat-display.spec.ts` -- one test per matrix row: lit block and class, beat-1 accent class, BPM text, status copy incl. singular and Hold, live region updates only on tempo change, blocks `aria-hidden`.
- [x] `src/app/app.html` / `app.css` -- in the Playing branch, render `<app-beat-display>` bound to `session.current()`, `session.settings()`; display flex-grows and centres its content vertically.
- [x] `src/app/app.spec.ts` -- extend the play test: after a published event, the display shows the lit block and BPM.

**Acceptance Criteria:**
- Given a running Session, when the window is resized, then BPM, blocks and status line scale and stay centred without scrolling at ≥ 480×360.
- Given the click for a beat sounds, then the matching block lights in the same frame the event is published, with no fade.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| E/B: `?? 0` fallbacks for start/step in app.html | low | reject | Settings are validated before Playing; fallback is unreachable. |
| E/B: beat outside 1–4 lights nothing silently | false | reject | Scheduler only emits beats 1–4. |
| E: 480×360 vertical budget tight | maybe-false | reject | Would be low; estimate fits; UX floor is "not guaranteed below". |
| E: DOM update may lag the published event by a frame | low | reject | ≤16 ms; below perceptible threshold for this use. |
| B: app test tempo equals start BPM | low | patch | Event now uses tempo 85. |
| B: event → null transition untested | low | patch | Test added. |
| B: horizontal overflow under ~400px | false | reject | Minimum window is 480px per UX. |
| B: `vh` vs `dvh` | low | reject | Desktop Electron window; no collapsing toolbar. |
| B: "60BPM" read as one word by screen readers | low | patch | Visual BPM `aria-hidden`; live region announces. |
| B: `.visually-hidden` defined per component | low | reject | Single use today. |
| B: `beat` typed as number, `step` lacks doc | low | reject | Cosmetic. |
| B: entering Hold not announced | low | reject | UX: nothing marks entering Hold; not in intent. |

## Verification

**Commands:**
- `source ~/.nvm/nvm.sh && nvm use 24 && npm test -- --watch=false` -- expected: all tests pass
- `npm run build` -- expected: succeeds
- `grep -rnE "transition|animation" src/app/ui/beat-display` -- expected: no output
- `grep -rnE "rampAt|setTimeout|requestAnimationFrame" src/app/ui` -- expected: no output

**Manual checks:**
- `npm start`, Start with 60/72/6/1: block highlight follows the click, beat 1 amber, BPM steps 60→66→72, status line counts down then reads "Holding at 72 BPM".
