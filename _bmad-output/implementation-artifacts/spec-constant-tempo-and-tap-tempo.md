---
title: 'Play without ramping, and tap tempo'
type: 'feature'
created: '2026-10-25'
status: 'done'
baseline_commit: 'e7f5c423501dfae86691d39b95c1f653d2b2c1b2'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-metronom-2026-10-16/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-metronom-2026-10-16/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** metronom always ramps, so a plain steady metronome means faking Start = Ceiling. A tempo also can't be measured by tapping along.

**Approach:** (1) A "Ramp" switch (on by default) next to Count-in. When it's off, only the "Tempo BPM" field (Start BPM relabelled) is shown, and the Session plays at that tempo with "Steady at {n} BPM". (2) A tap row under the fields: a Tap button plus the T key. All taps in a run are averaged, strong outliers are dropped, and the result goes live into Start/Tempo BPM.

Both goals ship together because the user asked for them in one request. UX by Sally (2026-10-25) is in EXPERIENCE.md ("Ramp switch", "Tap row", "Tap Tempo") and DESIGN.md (`switch`, `button-tap`, `tap-readout`). Decisions taken from it:
- Ramp is not persisted. Off hides Ceiling/Step/Every and their steppers. Validation checks only Start, with the message "Tempo needs a whole number above 0". Hidden values are kept. Switching Ramp on raises a valid Ceiling that is below Start up to Start.
- Constant mode: the arrows shift Start only (±1, floor 1). A song click sets Start to the song's BPM. The strip reads "{n} BPM · constant" (+ " · count-in").
- A run ends after a pause of more than 2.5 s, or on Start. BPM = round(60000 / mean interval), halves round up. With ≥ 4 intervals, an interval more than 30% off the median is dropped; if fewer than 3 would remain, all are used. The count shows every tap.
- From the 2nd tap, Start is written on every tap. In Ramp mode a valid Ceiling below the result is raised to it. Idle only. T works anywhere except the song text fields; repeat and modifiers are ignored. Tap counts on pointerdown, isn't a Tab stop and never takes focus.
- Readout: "—" / "Tap at least twice", then "{n}" / "{k} taps". It's aria-hidden. A polite live region says "Tapped {n} BPM" once, when a run of ≥ 2 taps ends.

## Boundaries & Constraints

**Always:** BPM math and the setting rules are pure functions in `core/`. `App.onKeydown` stays the only keyboard handler. Settings changes go through `SessionService` (refused while playing). The tap clock is injectable (fake timers / `performance.now`) for tests. Styling uses only the existing tokens; nothing is amber.

**Never:** No new persistence. No change to `rampAt` or the scheduler's timing. No tapping while Playing. No reset button. No sliding window.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Constant play | Ramp off, Start 90, Ceiling empty | Valid; every bar 90, status "Steady at 90 BPM" | N/A |
| Constant invalid | Ramp off, Start empty | Start disabled, "Tempo needs a whole number above 0" | N/A |
| Ramp back on | Start 150, Ceiling 120 | Ceiling 150 | N/A |
| Arrow constant | Ramp off, 60/120, ArrowUp | 61/120 | N/A |
| Song constant | Ramp off, song 140 | Start 140, Ceiling unchanged | N/A |
| Tap mean | taps at 0, 500, 1000, 1500 | 120 | N/A |
| Tap outlier | intervals 500,500,500,500,900 | 900 dropped → 120 | N/A |
| Too few left | intervals 500,1000,1000,500 | all used → 80 | N/A |
| Tap one | single tap | readout placeholder, Start unchanged | N/A |
| Run reset | gap 2600 ms | new run, count 1 | N/A |
| Ceiling raise | Ramp on, 60/120, taps → 150 | 150/150 | N/A |
| T in song name | focus Artist, press t | types "t", no tap | N/A |

</frozen-after-approval>

## Code Map

- `src/app/core/settings.ts` -- `validate(settings, ramp = true)` (constant: only Start is checked, `MSG_TEMPO_WHOLE`); `shiftTempo(settings, delta)`; `applyRampOn(settings)` (raises Ceiling); `constantSettings(valid)` → `{...valid, ceilingBpm: startBpm}` so `rampAt` holds from bar 0.
- `src/app/core/songs.ts` -- `applySong`: add a `ramp` param; constant sets Start only.
- `src/app/core/tap-tempo.ts` (new) -- `tapBpm(intervals)` (mean/outlier rule), `TAP_RESET_MS = 2500`, `applyTap(settings, bpm, ramp)`.
- `src/app/session/session.service.ts` -- `_ramp` signal (`ramp`, `setRamp`, which applies `applyRampOn` when switched on). `start()` validates with ramp and passes `constantSettings` when it's off.
- `src/app/session/tap-tempo.service.ts` (new) -- the run state (`times`), the readout signals `bpm`/`count`, `announcement`, and `tap()` that writes via `session.updateSettings(applyTap(...))`. An end-of-run timer sets the announcement. An `effect` on `session.status()` ends the run when it becomes playing.
- `src/app/ui/tap-pad/` (new) -- Tap button + readout, `(pointerdown)` → `tap.tap()`, `mousedown` preventDefault, 100 ms pressed class (also on T, via a `lastTap` counter signal from the service).
- `src/app/ui/settings-form/*` -- `ramp` model; visible fields computed (Start only, label "Tempo BPM"); `validate(settings, ramp)`; the switch row with Ramp + Count-in (generalise the `.count-in` CSS into `.switch`); host the tap pad between fields and switches.
- `src/app/ui/settings-strip/*`, `src/app/ui/beat-display/*` -- `ramp` input; constant texts.
- `src/app/app.{ts,html}` -- wire `ramp`; the `t`/`T` key case; arrows use `shiftTempo` when ramp is off; `onSongSelect` passes ramp.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/core/settings.ts`, `songs.ts`, `tap-tempo.ts` + specs -- pure rules -- matrix rows Constant invalid, Ramp back on, Song constant, Tap mean/outlier/too few, Ceiling raise.
- [x] `src/app/session/session.service.ts`, `tap-tempo.service.ts` + specs -- state, constant start, run reset, announcement, end on start.
- [x] `src/app/ui/tap-pad/*`, `settings-form/*`, `settings-strip/*`, `beat-display/*` + specs -- UI per DESIGN.md.
- [x] `src/app/app.{ts,html}` + spec -- wiring, T key, constant arrows.

**Acceptance Criteria:**
- Given Ramp off and a valid Tempo, when the user presses Space, then every bar plays at Tempo and the strip reads "{n} BPM · constant".
- Given Idle, when the user presses T five times 500 ms apart, then the Start field reads 120 and the readout shows "120" and "5 taps".

## Implementation Notes

- `constantSettings(settings)` takes the Settings (valid Start) rather than `ValidSettings`: hidden Step / Every may be empty in constant mode, so they fall back to 1 to keep `rampAt` finite (no effect, since Ceiling = Start). `rampAt` and the scheduler are unchanged.
- The tap run also ends when the end-of-run timer fires (2.5 s after the last tap), so the next tap after the announcement always starts a fresh run.
- `SettingsForm.ramp` is `model(true)` (not required) so existing hosts keep working.
- Review patches: taps < 100 ms after the previous one (`TAP_MIN_GAP_MS`) are ignored as double hits; in Ramp mode each estimate is applied against the Ceiling saved at the run's first tap, so Ceiling = max(that, estimate); the Tap pad only flashes for taps after it mounted; `.tap:active` removed; `aria-keyshortcuts="T"`.
- Count-in default in EXPERIENCE.md corrected to "on" to match the code.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence / route |
|---|---|---|---|---|
| 1 | verification-gap, edge-case | Tap button flashes on every return to Idle | medium | The root service keeps `lastTap` nonzero and the effect runs on remount. Patched: only flash on a change after mount, with a test. |
| 2 | blind, edge-case | A double hit (pointer + T, bounce) writes thousands of BPM | medium | Outlier rule needs ≥ 4 intervals; a 10 ms pair gives 6000. Patched: taps < 100 ms after the previous one are ignored. |
| 3 | blind | A noisy early estimate ratchets Ceiling up for good | medium | `applyTap` raised against the live Ceiling on every tap. Patched: raise against the Ceiling at run start (never below it); EXPERIENCE wording updated. |
| 4 | blind | `.tap:active` holds the pressed fill | low | Direct deletion; `.pressed` covers mouse taps. Patched. |
| 5 | blind | No `aria-keyshortcuts` | low | One attribute. Patched. |
| 6 | blind | Arrow bullet in EXPERIENCE reads as Ramp-only rules applying to constant mode | low | Doc wording. Patched. |
| 7 | blind, edge-case | Ramp/tap/settings change during the async `start()` window | low | Same pre-existing millisecond window as the earlier review (#4 in spec-bpm-nudge); fix adds a starting state. Rejected. |
| 8 | blind | Announcement lost when Start follows within 2.5 s | low | The tap pad (and its live region) unmounts on Start anyway; the tempo is announced by the beat display. Rejected. |
| 9 | blind | Tap button dead for synthetic click (virtual cursor) | low | T is the documented keyboard route; adds a branch. Rejected. |
| 10 | blind, edge-case | Timer vs. comparison disagree at exactly 2500 ms / throttled timers | low | Sub-ms boundary; either outcome is reasonable. Rejected. |
| 11 | blind | T taps from the song BPM / My max number fields | low | Frozen intent exempts only the song text fields. Rejected. |
| 12 | blind | Code Map describes `constantSettings(valid)` | low | Fix edits this build's spec; deviation already in Implementation Notes. Rejected. |
| 13 | blind | Service timer not cleared on destroy | low | Root service lives for the app; tests only. Rejected. |
| 14 | blind | Zero-length intervals show "Tap at least twice" with count 2 | false | Unreachable after #2 (gaps < 100 ms are ignored). |
| 15 | blind | Missing tests (start window, song number fields, announcement on Start) | low | Belong to rejected #7, #11, #8. Rejected. |
| 16 | edge-case | T during IME composition | false | Settings inputs are numeric; song text fields are exempt. |
| 17 | edge-case | Failed start keeps the run open | low | Nothing wrong results: Idle continues normally. Rejected. |
| 18 | edge-case | Shift+T taps though "modifiers are ignored" | false | Frozen intent: modifiers = Ctrl/Alt/Meta as for arrows; UX says upper and lower case both count. |

## Verification

**Commands:**
- `npx ng test --watch=false` (Node 24: `~/.nvm/versions/node/v24.22.0/bin`) -- expected: all pass
- `npx ng build` -- expected: success
