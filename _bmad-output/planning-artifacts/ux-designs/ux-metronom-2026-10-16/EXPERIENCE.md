---
title: "EXPERIENCE: metronom"
status: final
created: 2026-10-16
updated: 2026-10-25
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

No menus, dialogs, settings pages, or navigation. On launch, the Settings fields are filled with defaults: Start 60, Ceiling 120, Step 5, Interval 4, Ramp on, Count-in on. `[ASSUMPTION: defaults; Settings, Ramp and Count-in are not saved, so every launch shows these. Only the song library is saved between launches (2026-10-17, Ramp added 2026-10-25).]`

**Constant mode** (2026-10-25): with the Ramp switch off, metronom is a plain metronome. Tempo BPM is the same value as Start BPM under another label, so switching never loses or copies anything.

## Voice and Tone

Short, plain, no exclamation marks.

| Do | Don't |
|---|---|
| "3 bars to +5" | "Next increase in 3 bars!" |
| "Holding at 115 BPM" | "Ceiling reached 🎉" |
| "Ceiling must be at least the start BPM" | "Invalid input. Please check your values." |
| Labels: "Start BPM", "Ceiling BPM", "Step (BPM)", "Every (bars)" | Labels that need explaining |
| "Steady at 120 BPM", "Tap", "7 taps" (2026-10-25) | "Constant mode active", "Tap here to set tempo" |

## Component Patterns

| Component | State | Behavioral rules |
|---|---|---|
| Settings form | Idle | Four number fields in order Start BPM → Ceiling BPM → Step → Every. Tab moves through them in that order. Validation runs on every change. Enter in any field starts the Session if Settings are valid. |
| Field steppers | Idle | Under each of the four Settings fields sits a row of two large buttons, "−" and "+", each half the field's width (see `DESIGN.md` stepper). They change only their own field by 1. "−" is disabled when the field is empty or the result would be below 1; "+" on an empty field sets it to 1. The steppers are not Tab stops and never take focus when clicked, so Tab order, Space and Enter behave exactly as before. The native spinner arrows inside the number fields are hidden. Labels for screen readers: "Decrease {label}" / "Increase {label}". (2026-10-22) |
| Ramp switch | Idle | A switch labelled "Ramp", left of Count-in in the switch row, same look and handling (click, or Enter when focused; Space stays Start/Stop). On by default. Off: Ceiling, Step and Every and their steppers are hidden (not just disabled), Start BPM is relabelled "Tempo BPM", and validation checks only that field. The hidden values are kept and come back unchanged when Ramp is switched on again, with one exception: if Ceiling is now below Start, Ceiling is raised to Start, so Start is never blocked by a field you couldn't see. Tab order: fields → Ramp → Count-in → Start. `[ASSUMPTION: Ceiling raise on switch-back]` (2026-10-25) |
| Tap row | Idle | Under the Settings fields: a Tap button and a readout. Each tap (mouse press on the button, or the T key) adds to the current tap run. The readout shows "— BPM" and "Tap at least twice" before the second tap, then the run's tempo and count ("112 BPM", "7 taps"). From the second tap on, the result is written live into Start BPM (Tempo BPM in constant mode), so there is no "Use" step and the hands can go straight back to the instrument. In Ramp mode, if the tapped Start is above Ceiling, Ceiling is raised to match (Step and Every untouched); it never drops below what it was before the run (2026-10-25). Typing or stepping the field during a run is fine; the next tap overwrites it. Hidden while Playing. See Tap tempo below. (2026-10-25) |
| Start button | Idle | Disabled while Settings are invalid. Click or spacebar starts the Session. |
| Validation hint | Idle | One line under Start, showing the first problem only: "All fields need a whole number above 0" or "Ceiling must be at least the start BPM". In constant mode the only message is "Tempo needs a whole number above 0" (2026-10-25). Empty when valid. |
| Song library | Idle | Under the Settings form, headed "Songs". Saved songs listed as "{Artist} – {Song} · {BPM} BPM", followed by " · max {My max}" when one is set, sorted by Artist then Song; the list scrolls when long. Clicking a song sets Ceiling BPM to its BPM, lowering Start BPM to it if Start is above; in constant mode it sets Tempo BPM to the song's BPM and leaves the hidden Ceiling alone (2026-10-25) ("My max" is information only and never changes the Settings). Each row has a ✎ edit button and a × remove button (no confirmation). Form: Artist, Song, BPM, My max (BPM), Save; Save is disabled until the input is valid (names not blank, BPM a whole number above 0, My max empty or a whole number above 0, with no upper limit and allowed above BPM), Enter in a field saves (or updates, in edit mode), and the form clears after saving. Saving an existing Artist + Song (case-insensitive) replaces it. ✎ loads the song into the same form (edit mode), replacing whatever was in it, and focuses Artist: the button reads "Update" and a "Cancel" button appears. Update changes the song in place, including Artist and Song; if the new Artist + Song matches another saved song, that one is replaced. Cancel, a successful Update, or removing the song being edited clears the form and leaves edit mode. "My max" is typed by hand; nothing updates it automatically. Empty state: "No saved songs yet". If saving to disk fails, the hint "Songs could not be saved" shows under the form. Hidden while Playing. |
| Settings strip | Playing | Read-only summary, e.g. "60 → 120 BPM · +5 every 4 bars", with the Stop button at the right; " · count-in" is appended when Count-in is on. In constant mode: "120 BPM · constant" (2026-10-25). Replaces the form, so Settings can't be edited (FR-3). |
| Beat display | Playing | Four beat blocks; the current one lit, beat 1 in the accent colour. The BPM number above shows the current tempo. Both update on the exact Beat they belong to (FR-7). |
| Status line | Playing | "{n} bars to +{Step}" (singular "1 bar to +5"), decreasing at the start of each Bar. In Hold: "Holding at {tempo} BPM". During a count-in: "Count-in". In constant mode: "Steady at {tempo} BPM" from the first Bar, never a countdown and never "Holding" (2026-10-25). |

## State Patterns

| State | Treatment |
|---|---|
| Launch | Idle with default Settings, Start enabled. No splash or intro. |
| Invalid Settings | Start disabled, hint line explains the first problem. The fields stay editable. |
| Start BPM = Ceiling BPM | Valid. Plays at a constant tempo, and the status line shows Hold straight away. Still works, but the Ramp switch is now the intended way to play a steady tempo (2026-10-25). |
| Constant mode, playing | Strip "120 BPM · constant", BPM number, beat blocks, status "Steady at 120 BPM". The tempo never changes, so the tempo is announced once. (2026-10-25) |
| Ceiling hidden below Start | Can happen in constant mode (arrows, typing, tapping, songs). Nothing is shown; switching Ramp back on raises Ceiling to Start. (2026-10-25) |
| First Increase would exceed the Ceiling | Valid. Plays at the Start BPM in Hold from the first Bar. |
| Playing, ramping | Settings strip, BPM, beat blocks, countdown. |
| Hold | Same as ramping, but the status line reads "Holding at {tempo} BPM". No sound or flash marks entering Hold. |
| Stopped | Returns to Idle with the same Settings still filled in, ready to start again from the Start BPM. |
| Audio unavailable | If audio can't start, stay in Idle and show the hint line "No audio output available". `[ASSUMPTION]` |

## Interaction Primitives

- **Spacebar**: toggles Start/Stop from anywhere in the window, including while a field has focus. It never types a space into a field and never activates a focused button a second time.
- **Enter**: in a field, starts the Session (same as Start).
- **T** (Idle only, 2026-10-25): one tap, same as pressing the Tap button. Works from anywhere in the window, including inside the Settings fields (where it never types), except the Song library text fields, where it types a "t". Key repeat is ignored (holding T is one tap). Upper and lower case both count; Ctrl/Alt/Meta combos are ignored. Does nothing while Playing.
- **Arrow Up / Arrow Down** (Idle only): in constant mode they shift Tempo BPM only, by +1 / −1, stopping at 1 (2026-10-25). In Ramp mode they shift Start BPM **and** Ceiling BPM together by +1 / −1, so the ramp keeps its width and just moves. Works from anywhere in the window, including inside the four Settings fields, where it replaces the browser's own +1 on that field. Holding the key repeats. In Ramp mode, Down does nothing once Start BPM is 1 (both stay put, so the gap is never squeezed), and the arrows do nothing if Start or Ceiling is empty or not a whole number; in constant mode Down stops at 1 and the arrows do nothing if Tempo is empty or not a whole number (2026-10-25). Exempt: the Song library fields (Artist, Song, BPM, My max) keep their normal arrow-key behaviour. While Playing the arrows do nothing, because Settings are locked (FR-3). Modifier combos (Ctrl/Alt/Meta) are ignored. `[ASSUMPTION: Idle only; Shift+arrow has no special meaning] (2026-10-22)`
- **Tab / Shift+Tab**: moves through the fields and the Start button.
- **Mouse**: click Start / Stop, the field steppers, the switches and Tap. The Tap button counts the tap on mouse/pointer *press*, not on release, so the timing matches the musician's hand; like the steppers it is not a Tab stop and never takes focus (the T key is its keyboard route). No mouse-only actions.
- **Escape**: stops a running Session (same as Stop). `[ASSUMPTION]`

Not included: tapping while Playing, an explicit tap Reset button (a pause resets the run), scroll-to-change values, drag, right-click menus, press-and-hold auto-repeat on the stepper buttons (the arrow keys already repeat).

## Accessibility Floor

- All text meets WCAG AA contrast; the lit beat block is far above it (values in `DESIGN.md`).
- Beat 1 is distinguished by colour **and** by its permanent outline, so it isn't identified by colour alone.
- Every field has a visible label tied to the input. The validation hint is announced (`aria-live="polite"`). When Ramp switches, the relabelled field keeps its label tie, so "Tempo BPM" is what is read out. (2026-10-25)
- Tap tempo (2026-10-25): the visible readout is `aria-hidden` and changes on every tap. A separate visually hidden polite live region speaks once per run, when the run ends (2.5s after the last tap): "Tapped 112 BPM". Single-tap runs say nothing. The Tap button's accessible name is "Tap tempo, key T". Ramp and Count-in are `role="switch"` with `aria-checked`.
- Keyboard operation is complete: nothing needs the mouse.
- The beat display is not announced to screen readers beat by beat (that would be noise). Tempo changes are announced politely ("66 BPM").
- Flashing: the highlight moves from block to block. One block is lit at any time, and the whole screen never flashes. Above 180 BPM, the highlight changes more than three times a second, which is past the WCAG flash threshold. Because the PRD sets no tempo limit, this is accepted for a personal tool. `[NOTE FOR UX: revisit if the app is ever shared]`

## Responsive & Platform

- The window is freely resizable. The Playing display scales with it; the Idle form stays a fixed comfortable size, centred.
- Below about 640px wide, the four fields wrap into two rows of two. In constant mode the single Tempo field stays one column wide and centred. The tap row and the switch row stay single lines down to 480px; below that they may wrap (readout under the button, Count-in under Ramp). (2026-10-25)
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

### Flow 2: Robin taps a song's tempo and plays along steadily (2026-10-25)

1. Idle. Robin clicks the Ramp switch off. Only "Tempo BPM" remains, holding 60.
2. With the guitar on, they press T along with the recording in their head. After the second tap the readout shows "104 BPM" over "2 taps" and the Tempo field already reads 104.
3. They keep tapping for about ten beats. One tap lands late; it is dropped, and the readout settles on "112 BPM", "11 taps". The field reads 112.
4. They stop tapping. 2.5 seconds later the screen reader hears "Tapped 112 BPM"; the run is over.
5. Space. The strip reads "112 BPM · constant", the status line "Steady at 112 BPM". Arrow keys do nothing until Stop; after Stop, ArrowUp makes it 113.

## Tap Tempo (2026-10-25)

- **Run**: taps belong to one run until there is a pause of more than 2.5 seconds; the next tap then starts a new run (readout back to "— BPM", "Tap at least twice" until its second tap). There is no maximum run length. The slowest tempo a run can catch is therefore 24 BPM. `[ASSUMPTION: 2.5s]`
- **Measuring**: the tempo comes from **all** intervals of the run, not a sliding window: BPM = 60 000 ÷ the average interval in ms, rounded to the nearest whole BPM (halves round up).
- **Outliers**: once the run has at least 4 intervals (5 taps), any interval more than 30% shorter or longer than the run's median interval is left out of the average (a missed tap, a double hit). If that would leave fewer than 3 intervals, all intervals are used. The tap count shows every tap, including the dropped ones. `[ASSUMPTION: 30%, minimum 4]`
- **Where it goes**: live into Start BPM / Tempo BPM from the second tap, recalculated on every tap (see Tap row). Each recalculation replaces the value, so the field shows the run's current best estimate.
- **When**: Idle only. Leaving Idle (Start) ends the run; Stop returns with the readout showing "— BPM".
