---
title: 'Arrow keys while playing, separate exercise library, clearer switches'
type: 'feature'
created: '2026-11-08'
status: 'done'
route: 'dispatch'
baseline_commit: 'e2a9b5ab6befafad6a7ccec4498792250fac4240'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-metronom-2026-10-16/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** (1) ArrowUp/ArrowDown only nudge BPM while idle; Robin wants to speed up/slow down while practising. (2) One "Songs" list mixes songs and exercises. (3) The Ramp / Count-in switches look almost the same on and off.

**Approach:** (1) Arrow keys shift the ramp (or the Tempo with Ramp off) by ±1 while playing too; the running scheduler picks up the new settings at the next beat. (2) A second, identical library "Exercises" with its own storage, shown side by side with "Songs". (3) Sally (UX) redesigns the switch on/off state.

Decisions (user said "no further questions"; Robin's standing rule is autonomous fast path):
- Multi-goal kept in one spec — [ASSUMPTION] user wants all three shipped together.
- [ASSUMPTION] Exercise fields mirror songs: "Source" (book, teacher, …) + "Exercise" + "BPM" + "My max (BPM)"; same validation, same edit/remove/pick behaviour.
- [ASSUMPTION] Live nudge takes effect from the next scheduled beat (not the next bar); ramp position (bar index) is kept.

## Boundaries & Constraints

**Always:** Existing songs stay under `metronom.songs.v1`; exercises use `metronom.exercises.v1`. Arrow keys still ignored in library fields and with Ctrl/Alt/Meta. Start never drops below 1. The settings strip shows the new values live.

**Never:** No restart of the session on nudge (no count-in replay, no bar reset). Field edits, song picks, Ramp/Count-in toggles stay refused while playing. No migration that moves existing songs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nudge ramp while playing | Ramp on, 60→120, bar 5, ArrowUp | Start 61, Ceiling 121; next beat plays at old tempo +1 | N/A |
| Nudge constant while playing | Ramp off, Tempo 90, ArrowDown | Tempo 89, next beat at 89 BPM | N/A |
| Nudge below 1 while playing | Start 1, ArrowDown | Nothing changes | ignored |
| Nudge during count-in | count-in bar, ArrowUp | count-in continues at Start+1 | N/A |
| Exercise saved | Source "Stick Control", Exercise "p.5", 100 | appears only under Exercises, persisted | "Exercises could not be saved" on write failure |
| Old storage | only `metronom.songs.v1` present | Songs unchanged, Exercises empty | N/A |

</frozen-after-approval>

## Code Map

- `src/app/app.ts` -- `onKeydown` ArrowUp/Down returns early when `playing`; `shiftSettings` calls `session.updateSettings` (refused while playing).
- `src/app/session/session.service.ts` -- `updateSettings` ignores while playing; `start` builds `played` (`ramp ? settings : constantSettings(settings)`) and hands it to `scheduler.start`.
- `src/app/session/session-platform.ts` -- `SessionScheduler` interface (start/stop); fakes in `session.service.spec.ts`.
- `src/app/audio/scheduler.ts` -- `this.settings` read per beat in `tick()`/`currentBeat()`; swapping it changes tempo from the next beat.
- `src/app/core/settings.ts` -- reuse `shiftRange`, `shiftTempo`, `constantSettings`.
- `src/app/session/song-library.service.ts` -- storage key + error message constants; `load()` / `commit()`.
- `src/app/ui/song-library/*` -- one list + add/edit form; heading "Songs", labels Artist/Song; `.add` 5-column grid.
- `src/app/app.html` / `app.css` -- idle layout stacks form and one `<app-song-library>`.
- `src/app/ui/settings-form/settings-form.css` -- `.switch*` styles (Sally owns).

## Tasks & Acceptance

**Execution:**
- [x] `src/app/audio/scheduler.ts` -- add `update(settings)` that swaps settings while running -- live tempo change.
- [x] `src/app/session/session-platform.ts` -- add `update` to `SessionScheduler`.
- [x] `src/app/session/session.service.ts` -- add `nudge(delta)`: shift via `shiftRange`/`shiftTempo` by `ramp()`; idle → `updateSettings`; playing → set settings and `scheduler.update(played)` when still valid.
- [x] `src/app/app.ts` -- ArrowUp/Down call `session.nudge` in both states.
- [x] `src/app/session/song-library.service.ts` -- make storage key / error message overridable; add `ExerciseLibraryService` (`metronom.exercises.v1`, "Exercises could not be saved").
- [x] `src/app/ui/song-library/*` -- input `kind: 'songs' | 'exercises'` picks service, heading, labels, empty text; form grid 2 columns so it fits half width.
- [x] `src/app/app.html`, `src/app/app.css` -- `.libraries` row with Songs + Exercises side by side, stacked under ~900px; exercise picks use the same `onSongSelect`.
- [x] `src/app/ui/settings-form/settings-form.css` + DESIGN.md -- Sally's switch redesign.
- [x] specs for scheduler update, session nudge while playing, app arrow while playing, exercise library storage/labels.

**Acceptance Criteria:**
- Given a running session, when ArrowUp is held, then the BPM climbs by 1 per key repeat and the strip shows it, without restarting.
- Given the idle screen, when I look at the libraries, then Songs and Exercises appear side by side with identical controls.
- Given either switch, when it toggles, then on and off are distinguishable without relying on hue alone.

## Implementation Notes

- The switch task (settings-form.css/.html, DESIGN.md) is implemented by a separate UX agent in parallel; the implementer must not edit those files.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Route | Evidence |
|---|--------|---------|---------|-------|----------|
| 1 | edge+blind+vgap | nudge during `start()` await is lost to the scheduler | medium | patch | `start()` read settings before `await ctx.resume()`; status still idle so nudge went through updateSettings |
| 2 | blind | EXPERIENCE.md still says arrows are Idle-only, single Songs library | medium | patch | lines 52-53, 77, 96, 121 contradict new behaviour; later agents would follow them |
| 3 | blind | DESIGN.md lacks the libraries row layout | low | patch | direct doc addition |
| 4 | edge | no upper BPM bound on held ArrowUp while playing | low | reject | pre-existing (idle arrows and fields unbounded); needs very long hold to matter |
| 5 | edge | `kind` change while editing hits wrong library | false | reject | `kind` is a static attribute in app.html; never changes at runtime |
| 6 | blind | subclass getters overriding before field init is fragile | low | reject | works and tested; refactor adds surface for no user harm |
| 7 | blind | missing exercise edit/remove/keyboard tests | low | reject | same code path as songs, already covered by song tests + shared selector |
| 8 | blind | missing live-nudge Hold / constant-announcement tests | low | reject | rampAt with shifted start/ceiling is covered by existing ramp tests |
| 9 | blind | song-centric names now cover exercises | low | reject | cosmetic rename across many files |
| 10 | blind | switch lacks forced-colors fallback / off hover; scheduler doc line long | low | reject | thumb position + ✓ still convey state; prettier passes |
| 11 | blind | nudged values after Stop unspecified | false | reject | kept, consistent with idle nudges and "Settings are kept" on stop |

## Verification

**Commands:**
- `npx ng test --watch=false` -- expected: all pass
- `npm run package` -- expected: AppImage builds and verifies; then `npm run install:desktop`
