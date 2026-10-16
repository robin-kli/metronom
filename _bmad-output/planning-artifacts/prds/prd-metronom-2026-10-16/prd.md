---
title: "PRD: metronom"
status: final
created: 2026-10-16
updated: 2026-10-16
---

# PRD: metronom

## 0. Document Purpose

This PRD defines v1 of metronom for the UX, architecture, and epics/stories steps. It builds on the final product brief (`../../briefs/brief-metronom-2026-10-16/brief.md`) and does not repeat its background. Terms in §3 are used exactly as defined. Technical choices (Angular, Electron, audio timing) are recorded in `addendum.md`, not here.

## 1. Vision

metronom is a free, minimal speed-trainer metronome for the Linux desktop. You set where to start, where to stop, and how fast to climb. It then raises the tempo automatically while you play, so you never have to stop practising to change a setting. A large display shows where you are in the bar at a glance.

## 2. Target User

### 2.1 Jobs To Be Done

- When I'm building speed on a passage, I want the tempo to rise on its own in small steps, so I can stay focused on playing.
- While I play, I want to see which beat I'm on and when the next increase is coming, without hunting for it on the screen.
- I want a tool that opens and is ready in seconds, with nothing to learn, sign up for, or pay for.

### 2.2 Key User Journeys

- **UJ-1. Robin ramps up a passage.** Robin opens metronom, enters start 60, ceiling 96, step 6, every 4 bars, and presses the spacebar. The click starts at 60 BPM and the display highlights beats 1–4, counting down the bars to the next increase. Every 4 bars the tempo rises by 6, until it holds at 96. Robin presses the spacebar to stop. Pressing it again starts over from 60.

## 3. Glossary

- **Start BPM**: the tempo a Session begins at.
- **Ceiling BPM**: the highest tempo a Session may reach. The tempo never exceeds it.
- **Step**: the number of BPM added at each Increase.
- **Interval**: the number of Bars played at one tempo before the next Increase.
- **Increase**: raising the current tempo by one Step at the end of an Interval.
- **Hold**: the state in which no further Increase can happen, because the next one would exceed the Ceiling BPM. The tempo stays constant until the Session stops.
- **Settings**: Start BPM, Ceiling BPM, Step, and Interval together.
- **Session**: one run of the metronome, from Start to Stop.
- **Bar**: four Beats (4/4 time).
- **Beat**: one click. Beat 1 of each Bar is the **Accent**.

## 4. Features

### 4.1 Settings

**Description:** One compact form holds the four Settings. They can be edited only while no Session is running. Realizes UJ-1.

#### FR-1: Enter Settings

The user can enter Start BPM, Ceiling BPM, Step, and Interval as whole numbers.

**Consequences (testable):**
- All four fields are visible on a single screen without scrolling.
- No upper or lower limits are imposed beyond FR-2.

#### FR-2: Reject unplayable Settings

The user cannot start a Session with Settings that cannot run. `[ASSUMPTION]`

**Consequences (testable):**
- Start is disabled when any field is empty, not a whole number, or zero or less.
- Start is disabled when Ceiling BPM is lower than Start BPM.
- Ceiling BPM equal to Start BPM is allowed and plays a constant tempo.

#### FR-3: Lock Settings during a Session

While a Session is running, the user cannot change the Settings.

**Consequences (testable):**
- All Settings fields are read-only from Start until Stop.

### 4.2 Playback and Ramp

**Description:** Start begins a Session at the Start BPM. After each Interval the tempo goes up by one Step, unless that would exceed the Ceiling BPM, in which case the Session enters Hold. Realizes UJ-1.

#### FR-4: Start and Stop a Session

The user can start and stop a Session with an on-screen button or the spacebar.

**Consequences (testable):**
- The spacebar toggles between Start and Stop whenever the app window has focus, including while a field has focus.
- Every Session begins at the Start BPM, even when the previous Session reached a higher tempo.
- There is no pause. Stop ends the Session.

#### FR-5: Ramp the tempo

The system applies an Increase at the end of every Interval while the current tempo plus one Step is no higher than the Ceiling BPM.

**Consequences (testable):**
- Start 60, Ceiling 96, Step 6, Interval 4: tempos 60, 66, 72, 78, 84, 90, 96, each held for 4 Bars, then Hold at 96.
- Start 60, Ceiling 95, Step 10, Interval 4: tempos 60, 70, 80, 90, then Hold at 90. The tempo never goes above the Ceiling BPM.
- Increases take effect exactly on the first Beat of a Bar.

#### FR-6: Click sound

The system plays one click per Beat, with a distinct click for the Accent.

**Consequences (testable):**
- There is one click sound in two variants (normal and Accent). There is no choice of sound and no in-app volume control.

**Feature-specific NFRs:**
- Clicks are evenly spaced at the current tempo, with no audible drift, stutter, or gap, including at an Increase.

### 4.3 Beat Display

**Description:** While a Session runs, a large display uses all the available window space to show where the user is. Realizes UJ-1.

#### FR-7: Show the current Beat

The display highlights the current Beat (1–4) of the Bar, and the Accent stands out visually from Beats 2–4.

**Consequences (testable):**
- The highlight changes at the same moment as the click is heard.
- The display scales to fill the window when it is resized.

#### FR-8: Show tempo and countdown

The display shows the current tempo in BPM and how many Bars remain before the next Increase.

**Consequences (testable):**
- The countdown decreases by one at each new Bar and resets after each Increase.
- In Hold, the countdown is replaced by an indication that the tempo is holding. `[ASSUMPTION]`

## 5. Non-Goals

- Not a full-featured metronome: no time signatures other than 4/4, no subdivisions, no tap tempo, no sound library.
- No saved presets, history, or any data kept between launches.
- No percentage-based settings.
- No decreasing tempo or looping ramps.
- No accounts, sync, or network use. Linux desktop only, with no mobile, Windows, or macOS builds.

## 6. MVP Scope

### 6.1 In Scope

- FR-1 to FR-8.
- A Linux desktop app that works fully offline.

### 6.2 Out of Scope for MVP

- Everything in §5. Revisit only if Robin finds a real need while practising.

## 7. Success Metrics

- **SM-1:** Robin sets up a ramp and starts a Session within about 10 seconds of opening the app, without help. Validates FR-1, FR-4.
- **SM-2:** Robin uses metronom for speed practice instead of other apps. Validates FR-5 to FR-8.
- **SM-C1 (counter-metric):** Number of features. Do not grow it; every addition must earn its place against the minimal interface.

## 8. Open Questions

None blocking.

## 9. Assumptions Index

- §4.1 FR-2: Start is disabled for empty, non-whole, zero or negative values, and when Ceiling BPM is lower than Start BPM.
- §4.3 FR-8: In Hold, the bar countdown is replaced by a "holding" indication.
