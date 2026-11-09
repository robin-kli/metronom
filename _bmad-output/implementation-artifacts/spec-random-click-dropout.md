---
title: 'Random click dropout (Random switch + audible %)'
type: 'feature'
created: '2026-11-09'
status: 'done'
route: 'dispatch'
baseline_commit: '9d9de19b66fc2dd2c7e7ae3dbb0bcae8d6fa3b69'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-metronom-2026-10-16/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-metronom-2026-10-16/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Robin wants to practise holding time without hearing every click: a "randommeter" that randomly leaves clicks out.

**Approach:** A third switch "Random" with an "Audible %" field (0–100). With Random on, each click is independently audible with probability N% and otherwise silent; at 100% every click plays. Everything else (timing, ramp, display, keys) stays the same.

Decisions (user: "no questions"; Robin's standing rule is autonomous fast path):
- [ASSUMPTION] Random is off at launch, Audible % defaults to 50; neither is persisted (same as Ramp / Count-in).
- [ASSUMPTION] The count-in bar is always fully audible, so the start stays clear; Random applies from ramp bar 0 (also in constant mode).
- [ASSUMPTION] Accented beat 1 is subject to Random like every other click.
- [ASSUMPTION] Only sound is dropped: the beat display, pulse, countdown and tempo keep running on silent beats.
- [ASSUMPTION] Like Ramp / Count-in, Random and Audible % are locked while playing; the settings strip appends " · random N%".

## Boundaries & Constraints

**Always:** Each click is decided independently (no pattern, no memory). 100% → every click; 0% → no ramp-bar clicks. Audible % must be a whole number 0–100 when Random is on, otherwise Start is disabled with the hint "Audible % needs a whole number from 0 to 100". With Random off the % field is hidden and its value is kept.

**Never:** No change to beat timing, scheduling look-ahead, onBeat events or the visual display. No persistence. No change to library, tap or arrow-key behaviour.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Random off | any % | every click plays | N/A |
| 100% | Random on, 100 | every click plays | N/A |
| 0% | Random on, 0, Count-in on | 4 count-in clicks, then silence; display still beats | N/A |
| 25% | Random on, 25, rng 0.2 / 0.3 | 0.2 → click, 0.3 → silent | N/A |
| Invalid % | Random on, empty / 101 / 2.5 | Start disabled, hint shown | Space/Start ignored |
| Invalid % hidden | Random off, % empty | Start allowed | N/A |

</frozen-after-approval>

## Code Map

- `src/app/audio/scheduler.ts` -- `tick()` calls `this.click(...)` per beat and pushes to `pending`; add `SchedulerOptions.audibleChance` (0..1, default 1) and an injectable `random: () => number` (constructor 4th arg, default `Math.random`). Skip `click` + `pending` push when `!inCountIn && random() >= chance`; `onBeat` still fires. Keep `update()` untouched.
- `src/app/session/session.service.ts` -- add `_random` (false) / `_randomPercent` (50) signals, `setRandom(on)`, `setRandomPercent(n | null)` (ignored while playing); `start()` refuses when Random on and % invalid; passes `audibleChance: random ? percent/100 : 1`.
- `src/app/core/settings.ts` -- add `MSG_AUDIBLE_PERCENT` and `isAudiblePercent(value)` (integer 0..100).
- `src/app/ui/settings-form/settings-form.{ts,html}` -- third switch "Random" after Count-in; when on, an "Audible %" number input (min 0, max 100, step 1) with −/+ steppers (±5, clamped 0..100); validation combines with `validate()`.
- `src/app/ui/settings-form/settings-form.css` -- Sally owns the look of the Random row.
- `src/app/ui/settings-strip/settings-strip.ts` -- inputs `random`, `randomPercent`; append " · random N%".
- `src/app/app.html` / `src/app/app.ts` -- wire the new model/inputs; Space-start uses `session.start()` refusal (check `onKeydown`).
- Reuse the existing `.switch` markup; do not alter Ramp / Count-in behaviour.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/audio/scheduler.ts` (+spec) -- audibleChance + injectable rng; count-in exempt.
- [x] `src/app/core/settings.ts` (+spec) -- `isAudiblePercent`, message.
- [x] `src/app/session/session.service.ts` (+spec) -- signals, setters, start guard, chance passed.
- [x] `src/app/ui/settings-form/*` (+spec) -- Random switch, Audible % field with steppers, hint/Start gating.
- [x] `src/app/ui/settings-strip/*` (+spec) -- " · random N%".
- [x] `src/app/app.html`, `src/app/app.ts` (+spec) -- wiring.
- [x] DESIGN.md / EXPERIENCE.md + settings-form.css -- Sally (UX agent).

**Acceptance Criteria:**
- Given Random on at 50%, when playing for many bars, then roughly half the clicks sound while the beat display keeps pulsing on every beat.
- Given Random off, when playing, then behaviour is identical to before this change.

## Implementation Notes

- UX (Sally) edits DESIGN.md, EXPERIENCE.md and the Random-row CSS in parallel; the developer adds markup with classes `switch random` and `.random-percent` and does not style beyond layout.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Route | Evidence |
|---|--------|---------|---------|-------|----------|
| 1 | vgap | no session test for Random at 0% | medium | patch | only 25/40/invalid tested; a falsy guard would silently refuse 0% |
| 2 | blind | DESIGN.md `random-percent` YAML inserted inside `tap-readout` | medium | patch | diff shows block after `value:`, duplicate `gap` |
| 3 | edge | stepper on fractional % stays invalid (2.5 → 7.5) | low | patch | `nudgePercent` adds to raw value; direct fix |
| 4 | blind | stop-cancel test does not prove dropout | low | patch | assertion held before the change |
| 5 | blind | `.random-percent` `flex-basis:100%` meaningless in column :host; hedging comment | low | patch | :host is column flex, align-items stretch; direct deletion |
| 6 | blind | EXPERIENCE.md responsive switch wording conflicts | low | patch | two 480px sentences, Random wrap unspecified |
| 7 | blind | SessionService class doc omits Random | low | patch | direct doc fix |
| 8 | edge+blind | strip may show "random null%" | false | reject | strip only renders while playing; `start()` refuses Random on with null % |
| 9 | edge+blind | scheduler accepts NaN / out-of-range chance | false | reject | only caller passes 1 or a validated percent/100 |
| 10 | blind | no test that count-in makes no rng draws | low | reject | `isAudible` returns before `random()` when `inCountIn`; added test adds little |
| 11 | blind | ordering test omits `.random-percent`; Enter/arrow in % field untested | low | reject | Enter/arrow handling is the existing global keydown path, unchanged |
| 12 | blind | spec Code Map / record incomplete | low | reject | fix edits this build's spec |
| 13 | blind | no screen-reader announcement for stepper % changes | low | reject | same as existing BPM steppers (pre-existing pattern) |

## Verification

**Commands:**
- `npx ng test --watch=false` -- expected: all pass
- `npm run package` -- expected: AppImage builds; then `npm run install:desktop`
