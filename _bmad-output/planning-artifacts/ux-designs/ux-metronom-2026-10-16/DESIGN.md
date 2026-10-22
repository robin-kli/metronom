---
name: metronom
description: Minimal dark speed-trainer metronome for the Linux desktop. Plain Angular, no component library; this file is the whole visual system.
status: final
created: 2026-10-16
updated: 2026-10-22
sources:
  - ../../prds/prd-metronom-2026-10-16/prd.md
  - ../../briefs/brief-metronom-2026-10-16/brief.md
colors:
  surface: '#0E0F12'
  surface-raised: '#171A1F'
  text: '#ECEDEF'
  text-muted: '#9AA0A8'
  border: '#6B7280'
  beat-off: '#2A2E36'
  beat-on: '#ECEDEF'
  accent: '#FFB020'
  accent-foreground: '#1A1204'
  danger: '#FF7A70'
typography:
  # System stack, no bundled fonts (offline app). All numerals tabular.
  bpm-display:
    fontFamily: 'system-ui, sans-serif'
    fontSize: 'clamp(64px, 18vmin, 220px)'
    fontWeight: '700'
    lineHeight: '1'
    fontFeature: 'tabular-nums'
  status-line:
    fontFamily: 'system-ui, sans-serif'
    fontSize: 'clamp(16px, 3.5vmin, 32px)'
    fontWeight: '500'
    lineHeight: '1.2'
    fontFeature: 'tabular-nums'
  label:
    fontFamily: 'system-ui, sans-serif'
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.3'
    letterSpacing: 0.04em
  input:
    fontFamily: 'system-ui, sans-serif'
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    fontFeature: 'tabular-nums'
  body:
    fontFamily: 'system-ui, sans-serif'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 4px
  md: 8px
  lg: 12px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '6': 24px
  '8': 32px
  '12': 48px
components:
  beat-block:
    background: '{colors.beat-off}'
    radius: '{rounded.lg}'
    size: 'min(20vw, 30vh)'
    gap: '{spacing.4}'
  beat-block-on:
    background: '{colors.beat-on}'
  beat-block-accent-on:
    background: '{colors.accent}'
  beat-block-accent-off:
    background: '{colors.beat-off}'
    border: '3px solid {colors.accent}'
  settings-input:
    background: '{colors.surface-raised}'
    foreground: '{colors.text}'
    border: '1px solid {colors.border}'
    radius: '{rounded.sm}'
    typography: '{typography.input}'
  settings-stepper:
    background: '{colors.surface-raised}'
    foreground: '{colors.text}'
    border: '1px solid {colors.border}'
    radius: '{rounded.md}'
    height: 48px
    glyphSize: 28px
    gap: '{spacing.2}'
  button-start:
    background: '{colors.accent}'
    foreground: '{colors.accent-foreground}'
    radius: '{rounded.md}'
    height: 48px
  button-stop:
    background: 'transparent'
    foreground: '{colors.text}'
    border: '1px solid {colors.border}'
    radius: '{rounded.md}'
    height: 48px
  settings-strip:
    background: '{colors.surface-raised}'
    foreground: '{colors.text-muted}'
    typography: '{typography.body}'
---

## Brand & Style

metronom looks like a piece of practice hardware, not a web page: a dark panel with big, high-contrast numbers and four lights. The screen is read from the corner of the eye while both hands are busy, so everything is judged by one question: can you tell which beat it is in a quarter of a second?

The style is plain and functional. There is no decoration, no gradients, no icons beyond what a control needs. One warm accent colour is the only colour in the app, and it always means "beat 1".

## Colors

- **Surface (`#0E0F12`)**: the near-black background. Dark keeps glare low on a music stand and makes the lit beat stand out.
- **Surface raised (`#171A1F`)**: input fields and the settings strip, one step lighter than the surface.
- **Text (`#ECEDEF`)**: all primary text and the BPM number (16:1 on surface).
- **Text muted (`#9AA0A8`)**: labels, the settings strip, secondary info (7:1 on surface).
- **Border (`#6B7280`)**: input and Stop-button borders. Meets the 3:1 non-text contrast minimum.
- **Beat off (`#2A2E36`) / Beat on (`#ECEDEF`)**: an unlit and a lit beat block. Off is deliberately low-contrast, so the lit block is the only bright thing on screen.
- **Accent (`#FFB020`)**: amber, used only for the Accent (beat 1) and the Start button. It is never used for hover states, decoration, or errors.
- **Danger (`#FF7A70`)**: the validation hint text only.

Dark theme only in v1. There is no light theme and no following of the desktop theme.

## Typography

System font stack (`system-ui`), so nothing has to be bundled or downloaded. Every role that shows numbers uses tabular numerals, so the BPM and countdown never change width as digits change.

- **BPM display**: the largest thing on the Playing screen, scaling with the window.
- **Status line**: the countdown / Hold message under the beat blocks.
- **Input**: large enough to read the settings at a glance from playing position.
- **Label / Body**: small text for field labels, the settings strip, and the validation hint.

## Layout & Spacing

One window, one column, everything centred. Spacing uses a 4px scale.

- **Idle**: the settings form sits in the middle of the window: four fields in a row (two by two in narrow windows) with labels above and a −/+ stepper pair below each, then the Start button, then the validation hint line.
- **Playing**: a slim settings strip runs across the top. Beneath it, centred vertically: BPM number, the row of four beat blocks, the status line. The beat row and BPM scale with the window (`vmin`/`vw`), so the display always uses the available space.

Minimum useful window: about 480 × 360px.

## Elevation & Depth

None. No shadows; layering is done only with the surface and surface-raised tones.

## Shapes

Soft but not round: `{rounded.sm}` for inputs, `{rounded.md}` for buttons, `{rounded.lg}` for beat blocks. The blocks are square.

## Components

- **Beat block**: a square of `{colors.beat-off}`. When it is the current beat, it fills with `{colors.beat-on}`. Block 1 instead fills with `{colors.accent}`, and when unlit it keeps a 3px `{colors.accent}` outline so beat 1 can be found even between clicks. Blocks change state instantly, with no fade.
- **BPM number**: `{typography.bpm-display}` in `{colors.text}`, followed by a small "BPM" label in `{colors.text-muted}`.
- **Status line**: `{typography.status-line}` in `{colors.text-muted}`.
- **Settings input**: number field on `{colors.surface-raised}` with a `{colors.border}` outline. When the Settings are locked they are not shown as inputs (see settings strip).
- **Settings stepper**: a pair of buttons, "−" and "+", directly under each Settings input and sharing its width (two equal halves, `{spacing.2}` apart). 48px tall with a 28px glyph, so they are easy to hit from playing position. Body uses `{colors.surface-raised}` with a `{colors.border}` outline, same family as the input. Hover: the border turns `{colors.text}`. Pressed: fill `{colors.beat-off}`. Disabled: glyph `{colors.text-muted}` at reduced opacity, no hover. Never amber. The input itself hides the browser's spinner arrows.
- **Start button**: `{colors.accent}` fill, dark text. Disabled: `{colors.beat-off}` fill, `{colors.text-muted}` text.
- **Stop button**: outlined, transparent.
- **Settings strip**: one line on `{colors.surface-raised}` showing the locked Settings as plain text, with the Stop button at its right end.
- **Validation hint**: one line of `{typography.body}` in `{colors.danger}` under the Start button.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep the lit beat block the brightest thing on screen | Add a second accent colour |
| Use amber only for beat 1 and Start | Use amber for hover, focus or errors |
| Switch beat blocks instantly | Animate, fade, or pulse the beats |
| Use tabular numerals for every number | Let the BPM jump in width between values |
| Let the Playing display scale with the window | Fix the beat display at a small pixel size |
