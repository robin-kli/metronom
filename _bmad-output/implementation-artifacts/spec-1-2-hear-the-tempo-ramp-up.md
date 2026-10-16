---
title: 'Story 1.2: Hear the tempo ramp up'
type: 'feature'
created: '2026-10-16'
status: 'done'
baseline_commit: '75e37b0dbc344c81483f00248998c4bfe565e229'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Start does nothing yet. The user needs to hear an evenly timed click that rises by Step every Interval bars and holds at the Ceiling, and to stop it again.

**Approach:** Add the pure ramp function, a look-ahead audio scheduler with a synthesised click, and a root `SessionService` that owns Settings, status and the current `BeatEvent`. While playing, the form is replaced by a read-only settings strip with a Stop button. Beat visuals are Story 1.3; keyboard is Story 1.4.

## Boundaries & Constraints

**Always:** `rampAt(settings, barIndex)` in `core/ramp.ts` is the only place tempo, hold and barsToNext are computed (formula in epic context). Scheduler times everything on `AudioContext.currentTime` with a ~25 ms `setTimeout` tick scheduling ~100 ms ahead; beat times accumulate `60 / tempo`; tempo changes only at beat 1 of a Bar. Click = `OscillatorNode` + `GainNode` with a short envelope; beat 1 higher pitch. One lazily created `AudioContext`, resumed on each start. `SessionService` owns `settings`, `status`, `current` signals; only `updateSettings()` (no-op while playing), `start()`, `stop()` mutate. `start()` refuses invalid Settings via `validate()` and always begins at bar 0. A single `requestAnimationFrame` loop publishes the latest `BeatEvent` whose `audioTime ≤ currentTime` to `current`.

**Never:** No `setInterval`, RxJS timer or CSS animation driving beats. No audio files, no volume control. No beat blocks/BPM display/status line (1.3), no keyboard handling (1.4). UI never computes tempo or beats.

## I/O & Edge-Case Matrix

| Scenario | Settings (start, ceiling, step, interval) | Expected `rampAt` | Error Handling |
|---|---|---|---|
| Ramp | 60, 96, 6, 4 | bars 0–3: 60, barsToNext 4,3,2,1; bar 4: 66; bars 24+: 96, hold | N/A |
| Overshoot | 60, 95, 10, 4 | 60, 70, 80, 90 per 4 bars; bar 12+: 90, hold | N/A |
| Equal | 100, 100, 5, 4 | bar 0: 100, hold | N/A |
| First step overshoots | 60, 62, 5, 4 | bar 0: 60, hold | N/A |
| Interval 1 | 60, 70, 5, 1 | 60, 65, 70 then hold; barsToNext 1 while ramping | N/A |
| Audio fails | AudioContext throws / resume rejects | stays idle | hint shows "No audio output available" |

</frozen-after-approval>

## Code Map

- `src/app/core/settings.ts` -- `Settings` (fields may be null), `DEFAULT_SETTINGS`, `validate()`; reuse. Ramp takes validated settings (non-null numbers).
- `src/app/app.ts` / `app.html` -- currently holds the settings signal and an empty `onStart()`; switch to `SessionService`.
- `src/app/ui/settings-form/settings-form.ts` -- `settings = model.required<Settings>()`, `start` output, hint from `validate()`. Add an optional `extraHint` input (or equivalent) so the session's audio error can be shown on the same hint line.
- `src/app/audio/.gitkeep`, `src/app/session/.gitkeep` -- replace with real files.
- `src/styles.css` -- tokens; strip uses `--color-surface-raised`, `--color-text-muted`, `--color-border`.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/core/ramp.ts` + `ramp.spec.ts` -- `ValidSettings` type and `rampAt()`; table tests for the matrix.
- [x] `src/app/session/beat-event.ts` -- `BeatEvent { audioTime, beat (1–4), barIndex, tempo, hold, barsToNext }`.
- [x] `src/app/audio/click.ts` -- `scheduleClick(ctx, time, accent)`.
- [x] `src/app/audio/scheduler.ts` + spec -- class taking an audio-context-like object and timer functions (injectable for tests); `start(settings, onBeat)` / `stop()`; schedules clicks and calls `onBeat(BeatEvent)` per scheduled beat. Tests with a fake clock: beat spacing, bar counting, increase lands on beat 1, hold, stop halts scheduling.
- [x] `src/app/session/session.service.ts` + spec -- signals, `updateSettings`, `start`, `stop`, `audioError` signal, rAF publish loop; tests with fakes for bar-0 start, invalid refusal, updateSettings ignored while playing, stop keeps settings, audio failure stays idle.
- [x] `src/app/ui/settings-strip/` -- shows e.g. "60 → 120 BPM · +5 every 4 bars" on surface-raised with an outlined Stop button (48px, `--radius-md`) at the right; emits `stop`.
- [x] `src/app/app.ts` / `app.html` / `app.css` -- Idle: form bound to `session.settings`; Playing: strip at top. Remove the local settings signal.

**Acceptance Criteria:**
- Given valid Settings, when Start is clicked, then clicks are heard evenly at the Start BPM and the tempo rises by Step on beat 1 every Interval bars until Hold.
- Given a running Session, then the form is replaced by the strip and Settings cannot change; when Stop is clicked, clicks stop and the form returns with the same Settings.
- Given the next Start after a Stop, then it begins again at the Start BPM.

## Implementation Notes

- Review patch: `BeatEvent` lives in `src/app/core/beat-event.ts` (shared by audio and session), not `session/`.

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| E/B: late tick schedules missed beats in the past (burst) | medium | patch | Loop had no `nextTime < now` guard; now skips missed beats keeping counters. |
| E/B: unbounded BPM can freeze the tick loop | low | reject | Intent: no limits; absurd tempos not everyday; guard adds complexity. |
| E: settings edited during async resume | low | reject | Window is milliseconds; form state is not changed by start. |
| E: closed AudioContext never recovers | maybe-false | reject | Would be low; app never closes the context. |
| E/B: audioError stays after edits | low | patch | Cleared in `updateSettings()`. |
| E/B: rAF queue grows while frames paused | low | patch | `enqueue()` now trims sounded events. |
| E: highlight ignores output latency | low | patch | `publish()` subtracts `outputLatency`. |
| B: AudioContext left running after Stop | low | patch | `stop()` suspends the context. |
| B: double casts at platform boundary | low | reject | No named failure; types are internal. |
| B: BeatEvent and ScheduledBeat duplicated | medium | patch | Single `BeatEvent` moved to `core/beat-event.ts`. |
| B: focus lost when form and strip swap | low | reject | Keyboard control arrives in Story 1.4 (Space works from anywhere). |
| V/B: click.ts untested | medium | patch | Added `click.spec.ts` with recording fake context. |
| V/B: App audio-failure hint binding untested | medium | patch | Added app test with rejecting `resume`. |
| B: SettingsStrip accepts nullable Settings | low | reject | Only rendered while playing with validated Settings. |
| B: tautological constants test | low | reject | Harmless; behaviour covered by fake-clock tests. |

## Verification

**Commands:**
- `source ~/.nvm/nvm.sh && nvm use 24 && npm test -- --watch=false` -- expected: all tests pass
- `npm run build` -- expected: succeeds
- `grep -rnE "setInterval|interval\(|timer\(" src/app --include=*.ts | grep -v spec` -- expected: no output
- `grep -rE "from '\.\./(audio|session|ui)" src/app/core` -- expected: no output

**Manual checks:**
- `npm start`, press Start with 60/72/6/1: hear 60 BPM for one bar, then 66, then 72 and hold; accent audible on beat 1.
