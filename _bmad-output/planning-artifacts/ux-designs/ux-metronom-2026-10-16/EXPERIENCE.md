---
title: "EXPERIENCE: metronom"
status: final
created: 2026-10-16
updated: 2026-10-16
sources:
  - ../../prds/prd-metronom-2026-10-16/prd.md
  - ../../briefs/brief-metronom-2026-10-16/brief.md
---

# metronom: Experience Spine

## Foundation

A single-window Linux desktop app (Angular inside Electron), used with a keyboard and mouse at a music stand or desk. No UI component library; `DESIGN.md` is the whole visual system. Terms (Start BPM, Ceiling BPM, Step, Interval, Increase, Hold, Session, Accent) are used exactly as defined in the PRD glossary.

## Information Architecture

There is one surface with two states.

| State | Reached from | Purpose |
|---|---|---|
| Idle | App launch; Stop | Enter Settings and start a Session (FR-1, FR-2) |
| Playing | Start (button or spacebar) | Follow the beat, tempo, and countdown (FR-5 to FR-8) |

No menus, dialogs, settings pages, or navigation. On launch, the Settings fields are filled with defaults: Start 60, Ceiling 120, Step 5, Interval 4. `[ASSUMPTION: defaults; Settings are not saved, so every launch shows these. Only the song library is saved between launches (2026-10-17).]`

## Voice and Tone

Short, plain, no exclamation marks.

| Do | Don't |
|---|---|
| "3 bars to +5" | "Next increase in 3 bars!" |
| "Holding at 115 BPM" | "Ceiling reached 🎉" |
| "Ceiling must be at least the start BPM" | "Invalid input. Please check your values." |
| Labels: "Start BPM", "Ceiling BPM", "Step (BPM)", "Every (bars)" | Labels that need explaining |

## Component Patterns

| Component | State | Behavioral rules |
|---|---|---|
| Settings form | Idle | Four number fields in order Start BPM → Ceiling BPM → Step → Every. Tab moves through them in that order. Validation runs on every change. Enter in any field starts the Session if Settings are valid. |
| Start button | Idle | Disabled while Settings are invalid. Click or spacebar starts the Session. |
| Validation hint | Idle | One line under Start, showing the first problem only: "All fields need a whole number above 0" or "Ceiling must be at least the start BPM". Empty when valid. |
| Song library | Idle | Under the Settings form, headed "Songs". Saved songs listed as "{Artist} – {Song} · {BPM} BPM", sorted by Artist then Song; the list scrolls when long. Clicking a song sets Ceiling BPM to its BPM, lowering Start BPM to it if Start is above. Each row has a × remove button (no confirmation). Add form: Artist, Song, BPM, Save; Save is disabled until all three are valid (names not blank, BPM a whole number above 0), Enter in a field saves, and the form clears after saving. Saving an existing Artist + Song (case-insensitive) replaces its BPM. Empty state: "No saved songs yet". If saving to disk fails, the hint "Songs could not be saved" shows under the form. Hidden while Playing. |
| Settings strip | Playing | Read-only summary, e.g. "60 → 120 BPM · +5 every 4 bars", with the Stop button at the right. Replaces the form, so Settings can't be edited (FR-3). |
| Beat display | Playing | Four beat blocks; the current one lit, beat 1 in the accent colour. The BPM number above shows the current tempo. Both update on the exact Beat they belong to (FR-7). |
| Status line | Playing | "{n} bars to +{Step}" (singular "1 bar to +5"), decreasing at the start of each Bar. In Hold: "Holding at {tempo} BPM". |

## State Patterns

| State | Treatment |
|---|---|
| Launch | Idle with default Settings, Start enabled. No splash or intro. |
| Invalid Settings | Start disabled, hint line explains the first problem. The fields stay editable. |
| Start BPM = Ceiling BPM | Valid. Plays at a constant tempo, and the status line shows Hold straight away. |
| First Increase would exceed the Ceiling | Valid. Plays at the Start BPM in Hold from the first Bar. |
| Playing, ramping | Settings strip, BPM, beat blocks, countdown. |
| Hold | Same as ramping, but the status line reads "Holding at {tempo} BPM". No sound or flash marks entering Hold. |
| Stopped | Returns to Idle with the same Settings still filled in, ready to start again from the Start BPM. |
| Audio unavailable | If audio can't start, stay in Idle and show the hint line "No audio output available". `[ASSUMPTION]` |

## Interaction Primitives

- **Spacebar**: toggles Start/Stop from anywhere in the window, including while a field has focus. It never types a space into a field and never activates a focused button a second time.
- **Enter**: in a field, starts the Session (same as Start).
- **Tab / Shift+Tab**: moves through the fields and the Start button.
- **Mouse**: click Start / Stop. No other mouse-only actions.
- **Escape**: stops a running Session (same as Stop). `[ASSUMPTION]`

Not included: tap tempo, scroll-to-change values, drag, right-click menus.

## Accessibility Floor

- All text meets WCAG AA contrast; the lit beat block is far above it (values in `DESIGN.md`).
- Beat 1 is distinguished by colour **and** by its permanent outline, so it isn't identified by colour alone.
- Every field has a visible label tied to the input. The validation hint is announced (`aria-live="polite"`).
- Keyboard operation is complete: nothing needs the mouse.
- The beat display is not announced to screen readers beat by beat (that would be noise). Tempo changes are announced politely ("66 BPM").
- Flashing: the highlight moves from block to block. One block is lit at any time, and the whole screen never flashes. Above 180 BPM, the highlight changes more than three times a second, which is past the WCAG flash threshold. Because the PRD sets no tempo limit, this is accepted for a personal tool. `[NOTE FOR UX: revisit if the app is ever shared]`

## Responsive & Platform

- The window is freely resizable. The Playing display scales with it; the Idle form stays a fixed comfortable size, centred.
- Below about 640px wide, the four fields wrap into two rows of two.
- Below about 480 × 360px the layout isn't guaranteed.
- Fullscreen (F11, via Electron) needs nothing special: the display just grows.

## Key Flows

### Flow 1: Robin ramps up a passage (realizes UJ-1)

1. Robin launches metronom. Idle, with defaults filled in.
2. They type 60, 96, 6, 4 into the four fields. The hint line stays empty.
3. They press the spacebar while still in the last field. The form collapses into the settings strip: "60 → 96 BPM · +6 every 4 bars".
4. Beat 1 lights amber, beats 2–4 light white in turn; the BPM reads 60; the status line counts "4 bars to +6", "3 bars to +6"…
5. On beat 1 of the fifth Bar, the BPM jumps to 66 and the countdown resets.
6. **Climax:** the BPM reaches 96 and the status line changes to "Holding at 96 BPM". Robin keeps playing at full speed without ever touching the keyboard.
7. Robin presses the spacebar. Back to Idle, with 60 / 96 / 6 / 4 still filled in.

**Edge case:** Robin types a ceiling of 50 by mistake. Start greys out and the hint reads "Ceiling must be at least the start BPM". They fix it, and the hint disappears.
