# Epic 1 Context: Practise with a ramping metronome

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver the whole practice experience in the browser (`ng serve`): the user sets Start BPM, Ceiling BPM, Step and Interval, starts a Session, hears an evenly timed click that rises by Step every Interval Bars and holds at the Ceiling, and follows the current beat, BPM and countdown on a large display. Desktop packaging comes in Epic 2; nothing here may depend on Electron.

## Stories

- Story 1.1: Set up a ramp on the Idle screen
- Story 1.2: Hear the tempo ramp up
- Story 1.3: See the beat, tempo and countdown
- Story 1.4: Control playback from the keyboard

## Requirements & Constraints

- Four Settings, all whole numbers: Start BPM, Ceiling BPM, Step, Interval (bars). Launch defaults 60 / 120 / 5 / 4. Nothing is persisted.
- Valid only if every field is a whole number > 0 and Ceiling ≥ Start. Ceiling = Start is valid (constant tempo). No other limits.
- Settings are locked while a Session runs. Every Session starts at the Start BPM; no pause.
- 4/4 only. One click per Beat; beat 1 (Accent) has a distinct click. No sound choice, no volume control.
- Ramp: an Increase of Step at the end of each Interval while tempo + Step ≤ Ceiling; otherwise Hold. Tempo never exceeds Ceiling. Increases land on beat 1 of a Bar. Examples: 60/96/+6/4 → 60,66…96 then Hold; 60/95/+10/4 → 60,70,80,90 then Hold.
- Timing must be steady: no drift, stutter or gap, including at an Increase. Timing beats visual polish.
- Fully offline: no network requests, no web fonts, no audio files.
- Setting up and starting a ramp should take about 10 seconds without help.

## Technical Decisions

- Node 24 LTS (`.nvmrc`), Angular 22.2 CLI (standalone, zoneless, OnPush, signal inputs, no Router, no NgModules), TypeScript 6.0, Vitest.
- Functional core / imperative shell. `src/app/core/` is pure TS importing nothing outside `core/`; `audio/` → `core/`; `session/` → `core/`, `audio/`; `ui/` → `session/`, `core/`. Renderer must never import Electron or Node.
- `core/settings.ts` `validate(settings)` → `{ ok: true } | { ok: false, message }` is the only validity check; every start path goes through `SessionService.start()`.
- `core/ramp.ts` `rampAt(settings, barIndex)` → `{ tempo, hold, barsToNext }`, with `k = floor(barIndex / interval)`, `kMax = floor((ceiling − start) / step)`, `tempo = start + min(k, kMax)·step`, `hold = k ≥ kMax`, `barsToNext = interval − (barIndex mod interval)` when not in Hold. Nothing else computes these.
- Audio: one lazily created `AudioContext` (resumed on each start). Look-ahead scheduler (tick ~25 ms, schedule ~100 ms ahead) on `AudioContext.currentTime`; beat times accumulate `60 / tempo`. No `setInterval`, RxJS timer or CSS animation drives beats. Click = `OscillatorNode` + `GainNode`; Accent = higher pitch. If audio fails, stay Idle and show "No audio output available".
- The scheduler enqueues `BeatEvent { audioTime, beat, barIndex, tempo, hold, barsToNext }`; one `requestAnimationFrame` loop in `SessionService` publishes the latest event with `audioTime ≤ currentTime`.
- `SessionService` (root) owns `settings`, `status ('idle' | 'playing')`, `current: BeatEvent | null` signals; only `updateSettings()` (refused while playing), `start()`, `stop()` mutate. `stop()` keeps Settings; `start()` begins at bar 0.
- Keyboard: only the root component listens on `window:keydown`. Space toggles (always `preventDefault`), Enter starts when Idle, Escape stops.
- Styling: DESIGN.md tokens as CSS custom properties in `src/styles.css`; components never hard-code colours. `<base href="./">`; CSP `default-src 'self'` in `index.html`.
- Tests: full table tests for `core/` (incl. the ramp examples); `session/` with a fake clock.

## UX & Interaction Patterns

- Dark only. Tokens: surface `#0E0F12`, surface-raised `#171A1F`, text `#ECEDEF`, text-muted `#9AA0A8`, border `#6B7280`, beat-off `#2A2E36`, beat-on `#ECEDEF`, accent `#FFB020` (only for beat 1 and Start), accent-foreground `#1A1204`, danger `#FF7A70` (hint only). Radius 4/8/12px; 4px spacing scale. System-ui font, tabular numerals everywhere.
- One window, two states. **Idle:** centred form, labels "Start BPM", "Ceiling BPM", "Step (BPM)", "Every (bars)" in one row (2×2 below ~640px), amber 48px Start button (disabled: beat-off fill, muted text), one hint line in danger colour with the first problem only ("All fields need a whole number above 0" / "Ceiling must be at least the start BPM"), `aria-live="polite"`.
- **Playing:** settings strip on surface-raised, e.g. "60 → 120 BPM · +5 every 4 bars", outlined Stop on the right. Below, filling the window: BPM number (`clamp(64px, 18vmin, 220px)`, bold, muted "BPM" label), four square blocks (`min(20vw, 30vh)`, radius 12px, gap 16px), status line "{n} bars to +{Step}" (singular "1 bar"), or "Holding at {tempo} BPM" in Hold.
- Beat blocks switch instantly, no transitions. Lit beats 2–4 = beat-on, lit beat 1 = accent; unlit beat 1 keeps a 3px amber outline.
- Screen readers: tempo changes announced politely ("66 BPM"); individual beats not announced.
- Microcopy short and plain, no exclamation marks or emoji.

## Cross-Story Dependencies

- 1.1 scaffolds the project, tokens, `core/settings.ts` and the Idle form; later stories build on it.
- 1.2 adds `core/ramp.ts`, `audio/`, `SessionService` and the settings strip with Stop button; 1.3 renders the `BeatEvent`s 1.2 publishes; 1.4 adds the keyboard handler on top of `start()`/`stop()`.
- Epic 2 wraps the finished renderer in Electron and must not require any renderer change beyond what AD-7/AD-8 already demand.
