---
title: 'Count-in before the ramp'
type: 'feature'
created: '2026-10-16'
status: 'done'
baseline_commit: 'd04bbe1fe9c091ec6f7a9c130be036e690c8fcd9'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A Session starts on the first ramp bar immediately, so the player has no time to pick up the tempo before bar 1.

**Approach:** Add a count-in: one bar of four clicks at the Start BPM before ramp bar 0, played with a slightly different click sound. It is on by default and can be switched off on the Idle screen; while it plays, the display shows it is a count-in.

Decisions (made autonomously per user's standing instruction, 2026-10-16): length is exactly one 4/4 bar at the Start BPM; the toggle is a labelled switch "Count-in" on the Idle form, default on, not persisted (resets to on at launch); the count-in never counts towards the Interval or the ramp.

## Boundaries & Constraints

**Always:** `SessionService` owns a `countIn` boolean signal (default `true`) with `setCountIn(on)` that is ignored while playing; `start()` passes it to the scheduler. `Settings`, `validate()` and `rampAt()` stay unchanged. The scheduler, when count-in is on, schedules 4 beats at `startBpm` before ramp bar 0 and emits `BeatEvent`s for them with a new field `countIn: true` (`barIndex: -1`, `tempo: startBpm`, `hold: false`, `barsToNext: 0`); all ramp beats carry `countIn: false` and ramp bar 0 starts exactly one beat interval after count-in beat 4. Count-in clicks use a distinct but related sound: same envelope style, a softer `triangle` wave at lower pitches than the normal click (beat 1 still higher than beats 2–4). The toggle is a `<button type="button" role="switch" aria-checked>` labelled "Count-in" (so Enter/click toggle it natively and the existing global Space handler is unaffected), styled with DESIGN.md tokens, placed between the fields and Start. While count-in plays: blocks light as usual, BPM shows the Start BPM, status line reads "Count-in". Settings strip appends " · count-in" when it is on.

**Never:** No count-in length/tempo options, no persistence, no change to ramp maths, keyboard rules (Space/Enter/Escape) or Electron code.

## I/O & Edge-Case Matrix

| Scenario | Input | Expected |
|---|---|---|
| Default on | 60/96/+6/4, count-in on | 4 count-in clicks at 60 (count-in sound), then ramp bars 0–3 at 60, bar 4 at 66 … |
| Off | same, count-in off | Ramp bar 0 starts immediately (identical to current behaviour) |
| Display during count-in | count-in beat 3 | Block 3 lit, BPM 60, status "Count-in" |
| Toggle while playing | `setCountIn(false)` during Session | Ignored |
| Stop during count-in | Stop on count-in beat 2 | Clicks stop, Idle returns, toggle state unchanged |
| Late tick during count-in | timers stall across count-in | Missed beats skipped; ramp bar 0 still lands one beat after count-in beat 4's slot |

</frozen-after-approval>

## Code Map

- `src/app/core/beat-event.ts` -- add `countIn: boolean`.
- `src/app/audio/click.ts` -- `scheduleClick(ctx, time, accent)`; add a count-in variant (parameter or separate function) with triangle wave and lower frequencies.
- `src/app/audio/scheduler.ts` -- `start(settings, onBeat)`, `tick()`, `advanceBeat()`, late-tick skip loop; add count-in phase before bar 0 (option arg to `start`).
- `src/app/session/session.service.ts` + `session-platform.ts` -- add `countIn` signal, `setCountIn()`, pass option to scheduler.
- `src/app/ui/settings-form/` -- add switch with `countIn` input + `countInChange` output (or model).
- `src/app/ui/settings-strip/settings-strip.ts` -- summary text; add count-in input.
- `src/app/ui/beat-display/beat-display.ts` -- status computed: "Count-in" when `event.countIn`.
- `src/app/app.html` -- bind switch and strip to `session.countIn()` / `session.setCountIn()`.
- Existing specs for all of the above use fakes; extend them.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/core/beat-event.ts` -- add field; update all producers/fixtures.
- [x] `src/app/audio/click.ts` + `click.spec.ts` -- count-in sound; test it uses triangle and lower frequencies than the normal click, beat 1 higher than others.
- [x] `src/app/audio/scheduler.ts` + spec -- count-in phase; tests for matrix rows 1, 2, 6.
- [x] `src/app/session/session.service.ts` + spec -- signal, setter ignored while playing, passed to scheduler.
- [x] `src/app/ui/settings-form/*` -- switch, default on, aria-checked, tests.
- [x] `src/app/ui/settings-strip/*` -- " · count-in" suffix, test.
- [x] `src/app/ui/beat-display/*` -- "Count-in" status, BPM from event tempo, test.
- [x] `src/app/app.html` + `app.spec.ts` -- wiring; test toggle off → first published event is a ramp beat.

**Acceptance Criteria:**
- Given the app opens, then the Count-in switch is on.
- Given Start with count-in on, then the user hears one bar of softer, lower clicks before the normal clicks begin, and the display reads "Count-in" during it.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| E/B: Space on the switch starts playback instead of toggling | low | patch | Intended (Space handler unchanged per intent); behaviour now pinned by a test. Enter/click toggle. |
| E/B: count-in click documented as "softer" | low | patch | Docs reworded to "different, mellower timbre"; gain unchanged. |
| B: screen readers can't tell count-in from bar 0 | low | patch | Announcement "Count-in, {tempo} BPM" during count-in. |
| B: stale `start()` docstring | low | patch | Updated. |
| B: `barIndex: -1` fragile for future `rampAt` callers | low | reject | No caller passes count-in events to `rampAt`. |
| B: default `true` duplicated in form | low | patch | `model.required<boolean>()`. |
| B: `currentBeat(settings)` signature, skip-loop allocation | low | reject | Cosmetic. |
| B: `setCountIn` after stop untested | low | patch | Test added. |
| B: strip `countIn` doc implies snapshot | low | reject | Guard in `setCountIn` keeps them equal. |
| B: switch contrast unrecorded | low | reject | Muted on beat-off ≈ 5:1; on-state uses accent. |
| V: default Scheduler click wiring untested (cast hides signature drift) | maybe-false | defer | Signatures match today; needs integration test with recording context. |

## Verification

**Commands:**
- `source ~/.nvm/nvm.sh && nvm use && npm test -- --watch=false` -- expected: all tests pass
- `npm run build` -- expected: succeeds
- `grep -rE "from '\.\./(audio|session|ui)" src/app/core` -- expected: no output

**Manual checks:**
- `npm start`: Start with defaults → 4 softer clicks with "Count-in", then normal clicks; switch off → starts straight on bar 1.
