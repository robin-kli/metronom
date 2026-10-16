---
status: final
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-metronom-2026-10-16/prd.md
  - _bmad-output/planning-artifacts/prds/prd-metronom-2026-10-16/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-metronom-2026-10-16/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-metronom-2026-10-16/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-metronom-2026-10-16/EXPERIENCE.md
---

# metronom - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for metronom, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: The user can enter Start BPM, Ceiling BPM, Step, and Interval as whole numbers. All four fields are visible on one screen without scrolling, and no limits are imposed beyond FR2.
FR2: Start is disabled when any field is empty, not a whole number, or zero or less, or when Ceiling BPM is lower than Start BPM. Ceiling equal to Start is valid and plays a constant tempo.
FR3: While a Session runs, the Settings cannot be changed.
FR4: The user can start and stop a Session with an on-screen button or the spacebar, which works even while a field has focus. Every Session begins at the Start BPM. There is no pause.
FR5: An Increase of one Step is applied at the end of every Interval while the current tempo plus Step is no higher than the Ceiling BPM, and otherwise the Session is in Hold. The tempo never exceeds the Ceiling. Increases take effect on the first Beat of a Bar. (Example 60/96/+6/4: 60, 66 … 96, then Hold. Example 60/95/+10/4: 60, 70, 80, 90, then Hold.)
FR6: One click plays per Beat, with a distinct variant for the Accent (beat 1). There is no sound choice and no in-app volume control.
FR7: The display highlights the current Beat (1–4), with the Accent visually distinct. The highlight changes at the same moment as the click is heard, and the display scales with the window.
FR8: The display shows the current tempo in BPM and the Bars remaining until the next Increase. The countdown decreases each Bar and resets after an Increase. In Hold, it is replaced by a holding indication.

### NonFunctional Requirements

NFR1: Clicks are evenly spaced at the current tempo, with no audible drift, stutter, or gap, including at an Increase (PRD FR-6 NFR).
NFR2: The app works fully offline and makes no network requests (PRD §6.1, Architecture AD-8).
NFR3: Within about 10 seconds of opening the app, a ramp can be set up and started without help (PRD SM-1).
NFR4: Linux desktop only. No data is kept between launches (PRD §5).

### Additional Requirements

- **No starter template beyond the Angular CLI.** Scaffold with Angular CLI 22.2 (standalone components, zoneless, Vitest), then add Electron 44.8 and electron-builder 26.15. This is Epic 1, Story 1.
- **Node.js 24 LTS (≥ 24.15) is required.** The local machine has v20.20.2, which is below Angular 22's minimum.
- **Layering (functional core, imperative shell):** `core/` is pure TypeScript with no imports outside `core/`. `audio/` → `core/`; `session/` → `core/`, `audio/`; `ui/` → `session/`, `core/`. `electron/` never imports `src/`.
- **AD-1:** `core/ramp.ts` `rampAt(settings, barIndex)` → `{ tempo, hold, barsToNext }` using the `k`/`kMax` formula. It is the only place these values are computed.
- **AD-2:** `core/settings.ts` `validate(settings)` → `{ ok } | { ok: false, message }`. Every start path goes through `SessionService.start()`.
- **AD-3:** a look-ahead scheduler on `AudioContext.currentTime` (tick about every 25 ms, scheduling about 100 ms ahead). No `setInterval`, RxJS timer, or CSS animation drives Beats.
- **AD-4:** the scheduler enqueues `BeatEvent { audioTime, beat, barIndex, tempo, hold, barsToNext }`. One rAF loop in `SessionService` publishes the current event, and components only render it.
- **AD-5:** `SessionService` owns the `settings`, `status`, and `current` signals. Only `updateSettings()` (refused while playing), `start()`, and `stop()` mutate them. `start()` always begins at bar 0.
- **AD-6:** a single `window:keydown` handler on the root component. Space toggles and calls `preventDefault`, Enter starts, Escape stops.
- **AD-7:** Electron `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, no preload, and no IPC. It loads the built `index.html` from disk, and the renderer also runs in a normal browser.
- **AD-8:** CSP `default-src 'self'`, no web fonts or CDN assets, and the click synthesised with `OscillatorNode` + `GainNode`.
- **Conventions:** standalone `OnPush` components with signal inputs, no Router or NgModules, DESIGN.md tokens as CSS custom properties in `src/styles.css`, `<base href="./">`, one lazily created `AudioContext` (if it fails, stay idle and show "No audio output available").
- **Packaging:** electron-builder producing a Linux AppImage only.
- **Tests:** Vitest. Full table tests for `core/`, including the FR5 examples. `session/` tested with a fake clock.

### UX Design Requirements

UX-DR1: Implement the DESIGN.md colour, typography, radius, and spacing tokens as CSS custom properties: surface `#0E0F12`, surface-raised `#171A1F`, text `#ECEDEF`, text-muted `#9AA0A8`, border `#6B7280`, beat-off `#2A2E36`, beat-on `#ECEDEF`, accent `#FFB020`, accent-foreground `#1A1204`, danger `#FF7A70`. Use the system-ui font with tabular numerals for every number. Dark theme only.
UX-DR2: Idle layout: a centred settings form with four labelled fields in the order Start BPM → Ceiling BPM → Step (BPM) → Every (bars), in one row that wraps to 2×2 below about 640px wide. The Start button and the validation hint line sit below the fields.
UX-DR3: Launch defaults are Start 60, Ceiling 120, Step 5, Every 4, with Start enabled.
UX-DR4: Validation hint: one line in the danger colour showing only the first problem ("All fields need a whole number above 0" or "Ceiling must be at least the start BPM"), announced with `aria-live="polite"`, and empty when valid.
UX-DR5: Start button: amber fill, 48px tall. Disabled state uses the beat-off fill with muted text.
UX-DR6: Playing layout: the settings form is replaced by a settings strip (surface-raised, muted text, e.g. "60 → 120 BPM · +5 every 4 bars") with an outlined Stop button at its right end. The beat display fills the rest of the window.
UX-DR7: Beat display: four square blocks (`min(20vw, 30vh)`, radius 12px). The current block is lit, beats 2–4 in beat-on and beat 1 in accent, and the blocks switch instantly with no animation. Beat 1 keeps a permanent 3px amber outline when unlit.
UX-DR8: The BPM number (`clamp(64px, 18vmin, 220px)`, bold, tabular) sits above the blocks, with a small muted "BPM" label.
UX-DR9: Status line below the blocks: "{n} bars to +{Step}" (singular "1 bar to +5"). In Hold: "Holding at {tempo} BPM". When Start equals Ceiling, or the first step would overshoot, Hold shows from the first Bar.
UX-DR10: Keyboard: Space toggles from anywhere without typing into a field or double-activating a focused button. Enter in a field starts the Session when Settings are valid, and Escape stops it. Tab order is the fields, then Start.
UX-DR11: Accessibility: visible labels tied to their inputs, and the validation hint is announced. Beats are not announced, but tempo changes are announced politely ("66 BPM"). Keyboard operation is complete. Beat 1 is distinguished by its outline as well as by colour.
UX-DR12: Stop returns to Idle with the Settings unchanged. If audio is unavailable, the app stays Idle and shows "No audio output available" in the hint line.
UX-DR13: Microcopy follows the EXPERIENCE.md voice: short and plain, with no exclamation marks or emoji.

### FR Coverage Map

FR1: Epic 1 - Enter the four Settings
FR2: Epic 1 - Reject unplayable Settings
FR3: Epic 1 - Lock Settings during a Session
FR4: Epic 1 - Start/Stop with button and spacebar
FR5: Epic 1 - BPM-step ramp with Hold
FR6: Epic 1 - Click sound with Accent
FR7: Epic 1 - Beat highlight in sync with the click
FR8: Epic 1 - BPM and countdown / Hold display
NFR1: Epic 1 - Steady timing (AudioContext scheduler)
NFR2: Epic 1 (no network code, CSP) + Epic 2 (offline desktop shell)
NFR3: Epic 1 - Defaults and one-screen form
NFR4: Epic 2 - Linux desktop packaging; Epic 1 keeps no persistence

## Epic List

### Epic 1: Practise with a ramping metronome
Robin can set a start BPM, ceiling, step and interval, start a Session with the spacebar, hear an evenly timed click that steps up every N bars and holds at the ceiling, and follow the beat, BPM and countdown on a large display. Runs in the browser via `ng serve`.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8 (+ NFR1, NFR2, NFR3; UX-DR1–UX-DR13)

### Epic 2: Run metronom as a Linux desktop app
Robin can launch metronom as a standalone, offline Linux app from a single AppImage file, with no browser or dev server.
**FRs covered:** none new; delivers NFR2, NFR4 and Architecture AD-7, AD-8 packaging

## Epic 1: Practise with a ramping metronome

Robin can set a start BPM, ceiling, step and interval, start a Session, hear an evenly timed click that steps up every N bars and holds at the ceiling, and follow the beat, BPM and countdown on a large display. Runs in the browser via `ng serve`.

### Story 1.1: Set up a ramp on the Idle screen

As a musician,
I want to open metronom and see a clean dark screen with the four ramp settings already filled in,
So that I can adjust them and know immediately whether they are playable.

**Acceptance Criteria:**

**Given** Node.js 24 LTS is installed
**When** the project is scaffolded with Angular CLI 22.2 (standalone, zoneless, Vitest, no Router) using the source tree in the Architecture spine
**Then** `ng serve` shows the Idle screen and `ng test` runs green
**And** the layer directories `core/`, `audio/`, `session/` and `ui/` exist, and `core/` imports nothing outside itself

**Given** the app is opened
**When** the Idle screen renders
**Then** four labelled whole-number fields appear in the order Start BPM, Ceiling BPM, Step (BPM), Every (bars), pre-filled with 60, 120, 5, 4 (UX-DR3)
**And** all fields and the Start button are visible without scrolling, centred, and wrap to 2×2 below about 640px wide (FR1, UX-DR2)

**Given** the DESIGN.md tokens
**When** styles are applied
**Then** every colour, radius, spacing and type token exists as a CSS custom property in `src/styles.css` and components reference only those variables (UX-DR1)
**And** numbers use tabular numerals and the system-ui font, with no web fonts loaded

**Given** `core/settings.ts` `validate(settings)`
**When** any field is empty, not a whole number, or zero or less
**Then** it returns `{ ok: false, message: "All fields need a whole number above 0" }`
**And** when Ceiling BPM is lower than Start BPM it returns `"Ceiling must be at least the start BPM"`, and Ceiling equal to Start is valid (FR2)

**Given** invalid Settings on the Idle screen
**When** the user edits a field
**Then** the Start button is disabled (beat-off fill, muted text) and the hint line in the danger colour shows only the first problem, announced via `aria-live="polite"` (UX-DR4, UX-DR5)
**And** when the Settings become valid the hint empties and Start is enabled (amber, 48px tall)

**Given** the Settings validation
**When** unit tests run
**Then** table tests cover every invalid case, the equal-ceiling case and a valid case
**And** all labels and messages follow the EXPERIENCE.md voice: short, plain, no exclamation marks or emoji (UX-DR13)

### Story 1.2: Hear the tempo ramp up

As a musician,
I want pressing Start to play an evenly timed click that rises by Step every Interval and holds at the ceiling,
So that I can build speed without stopping to change the tempo.

**Acceptance Criteria:**

**Given** `core/ramp.ts` `rampAt(settings, barIndex)`
**When** called for Start 60, Ceiling 96, Step 6, Interval 4
**Then** bars 0–3 return tempo 60 with barsToNext 4,3,2,1; bars 24 and later return tempo 96 with `hold: true` (FR5)
**And** for 60/95/+10/4 the tempo sequence is 60, 70, 80, 90, then Hold at 90; for Start = Ceiling, and for a first step that would overshoot, Hold applies from bar 0

**Given** valid Settings
**When** the user clicks Start
**Then** `SessionService.start()` creates or resumes a single `AudioContext`, begins at bar 0 and the look-ahead scheduler (tick about 25 ms, about 100 ms ahead) schedules clicks on `AudioContext.currentTime` (AD-3)
**And** each Bar's tempo comes only from `rampAt`, and Increases take effect on beat 1 of a Bar

**Given** a running Session
**When** a click plays
**Then** it is synthesised with `OscillatorNode` + `GainNode`; beat 1 uses the distinct Accent variant (higher pitch); there are no audio files and no volume control (FR6, AD-8)
**And** for each scheduled click a `BeatEvent { audioTime, beat, barIndex, tempo, hold, barsToNext }` is enqueued for the display (AD-4)

**Given** a running Session
**When** the Idle form is replaced
**Then** a settings strip shows the locked Settings, e.g. "60 → 120 BPM · +5 every 4 bars", with an outlined Stop button at its right (FR3, UX-DR6)
**And** `updateSettings()` is refused while playing

**Given** a running Session
**When** the user clicks Stop
**Then** the scheduler is torn down, no further clicks sound, and the Idle form returns with the same Settings; the next Start begins again at the Start BPM (FR4, UX-DR12)

**Given** the `AudioContext` cannot be created or resumed
**When** the user clicks Start
**Then** the app stays Idle and the hint line shows "No audio output available" (UX-DR12)

**Given** the session logic
**When** unit tests run with a fake clock
**Then** they verify bar-0 start, the beat and bar counting across an Increase, Hold behaviour, and that Stop leaves Settings intact

### Story 1.3: See the beat, tempo and countdown

As a musician,
I want a large display that lights the current beat, shows the BPM and counts down to the next increase,
So that I can follow my position in the bar out of the corner of my eye.

**Acceptance Criteria:**

**Given** a running Session
**When** the Playing state renders
**Then** the beat display fills the space below the settings strip: a BPM number above (`clamp(64px, 18vmin, 220px)`, bold, tabular, muted "BPM" label), four square blocks (`min(20vw, 30vh)`, radius 12px) and a status line below (UX-DR6, UX-DR7, UX-DR8)
**And** the display scales when the window is resized (FR7)

**Given** the published `BeatEvent`
**When** its `audioTime` is reached
**Then** a single `requestAnimationFrame` loop in `SessionService` publishes it and the matching block lights at the same moment the click is heard, with no animation or transition (FR7, AD-4)
**And** beats 2–4 light in beat-on, beat 1 lights in accent, and beat 1 keeps a 3px amber outline when unlit

**Given** a ramping Session
**When** each Bar starts
**Then** the status line reads "{n} bars to +{Step}" (singular "1 bar to +{Step}"), decreasing each Bar and resetting after an Increase (FR8, UX-DR9)
**And** the BPM number shows the current tempo

**Given** a Session in Hold
**When** the display updates
**Then** the status line reads "Holding at {tempo} BPM" with no extra sound or flash (FR8, UX-DR9)

**Given** a screen-reader user
**When** the tempo changes
**Then** the new tempo is announced politely (e.g. "66 BPM") and individual beats are not announced (UX-DR11)

**Given** the UI components
**When** reviewed
**Then** they are standalone `OnPush` components that only read `SessionService` signals and never compute beat, tempo or countdown themselves

### Story 1.4: Control playback from the keyboard

As a musician with both hands on my instrument,
I want the spacebar to start and stop playback from anywhere,
So that I never have to reach for the mouse.

**Acceptance Criteria:**

**Given** the app window has focus, Idle, with valid Settings
**When** the user presses Space, including while a field has focus
**Then** the Session starts, no space character is typed and no focused button is activated a second time (FR4, UX-DR10)

**Given** a running Session
**When** the user presses Space or Escape
**Then** the Session stops and returns to Idle (UX-DR10)

**Given** Idle with focus in a field
**When** the user presses Enter
**Then** the Session starts if Settings are valid, and nothing happens if they are invalid

**Given** Idle with invalid Settings
**When** the user presses Space
**Then** no Session starts and the hint line remains

**Given** the keyboard handling
**When** reviewed
**Then** only the root component listens, on `window:keydown`, and Space always calls `preventDefault` (AD-6)
**And** Tab order is Start BPM, Ceiling BPM, Step, Every, Start, and all of it works without a mouse (UX-DR11)

## Epic 2: Run metronom as a Linux desktop app

Robin can launch metronom as a standalone, offline Linux app from a single AppImage file, with no browser or dev server.

### Story 2.1: Open metronom in its own desktop window

As a musician on Linux,
I want metronom to open in its own window instead of a browser tab,
So that it feels like a dedicated practice tool.

**Acceptance Criteria:**

**Given** Electron 44.8 is added as a dev dependency with `electron/main.ts`
**When** the user runs the documented start script (Angular build, then Electron)
**Then** one `BrowserWindow` opens and loads the built `index.html` from disk, and the full Epic 1 flow works inside it (AD-7)
**And** `contextIsolation` is true, `nodeIntegration` is false, `sandbox` is true, and there is no preload script and no IPC

**Given** `<base href="./">` and the CSP `default-src 'self'` in `index.html`
**When** the app runs in Electron with networking disabled
**Then** it loads and plays with no network requests and no CSP violations in the console (NFR2, AD-8)

**Given** the renderer code
**When** run with `ng serve` in a normal browser
**Then** it still works unchanged, and nothing in `src/` imports Electron or Node

**Given** the window
**When** it is resized or made fullscreen (F11)
**Then** the Playing display scales accordingly, and the minimum window size is about 480 × 360px

### Story 2.2: Install metronom from a single AppImage

As a musician on Linux,
I want one AppImage file I can run directly,
So that I can start metronom like any other desktop app without a dev setup.

**Acceptance Criteria:**

**Given** electron-builder 26.15 is configured in `electron-builder.yml` with a Linux AppImage target only
**When** the documented package script runs
**Then** a single `metronom-*.AppImage` is produced in the build output folder (NFR4)

**Given** the AppImage on a Linux machine without Node or the repo
**When** the user marks it executable and runs it
**Then** metronom opens offline and the full Epic 1 flow works

**Given** the repository
**When** a developer reads the README
**Then** it documents the Node 24 requirement and the dev (`ng serve`), desktop-run and package commands
**And** build output folders are ignored by git
