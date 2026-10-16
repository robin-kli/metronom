---
title: "Product Brief: metronom"
status: final
created: 2026-10-16
updated: 2026-10-16
---

# Product Brief: metronom

## Summary

metronom is a free, minimal speed-trainer metronome that runs as a desktop app on Linux. You set a start tempo and a ceiling. metronom raises the tempo by a fixed number of BPM every few bars until it reaches the ceiling. While it plays, the screen shows where you are in the bar so clearly that you can follow it out of the corner of your eye.

It does one job well: getting a passage up to speed gradually, without fiddling with settings mid-practice.

## The Problem

Building speed on an instrument means playing a passage slowly, then a little faster, over and over. With a plain metronome you have to stop, change the BPM, and start again, which breaks your concentration every few bars.

The speed trainers that already do this automatically are bloated, complicated, or not free. A simple, clean one that runs on Linux is hard to find.

## The Solution

One small screen with a handful of controls (tempos in BPM):

- **Start BPM**: the tempo you begin at.
- **Ceiling BPM**: the tempo where the increase stops.
- **Step**: how many BPM the tempo goes up each time.
- **Every N bars**: how often it goes up.
- **Start / Stop**.

*Example:* start 60, ceiling 96, +6 BPM every 4 bars. It plays 60, 66, 72 … 96 BPM, then holds at 96.

**While it plays**, a large display fills the window. It highlights the current beat (1–4) and shows the current BPM and the bars left until the next increase. Beat 1 is accented both in sound and on screen.

## What Makes This Different

Nothing about it is clever, and that's the point. It is free, quick to understand, and has no accounts, ads, or feature sprawl. It's built for one person's practice routine, with no attempt to compete on features.

## Who This Serves

Robin, and any musician who practises gradual speed-building on an instrument and wants a no-nonsense tool on a Linux desktop.

## Success Criteria

- Within about 10 seconds of opening the app, you can set a ramp and start playing, without reading anything.
- The beat position can be read at a glance while playing.
- Timing is steady, with no audible drift or stutter, including at the moment the tempo steps up. Timing accuracy matters more than visual polish.
- Robin actually uses it instead of the alternatives.

## Scope

**In (v1):**
- 4/4 only
- The BPM-step ramp described above, holding at the ceiling
- A large visual beat display with an accented beat 1 and a countdown to the next increase
- A Linux desktop app, built with Angular and packaged with Electron

**Out (v1):**
- Percentage-based settings of any kind
- Other time signatures and subdivisions
- Saved presets or any persistence
- Decreasing tempo or looping the ramp
- Accounts, sync, mobile, Windows/macOS builds

## Open Questions (for the PRD)

- Sound: a single click sound, or a choice of sounds? Is a volume control needed?
- Can settings be changed while it's playing, or only when stopped?
- At the ceiling: just hold, or also show a visual "done" state?
- What happens if the step doesn't land exactly on the ceiling (for example, 60 → 95 in +10 steps): cap at the ceiling, or stop below it?
