---
title: 'Nudge the ramp with arrow keys and big field steppers'
type: 'feature'
created: '2026-10-22'
status: 'done'
baseline_commit: '0ff22509b4df0139a205a34e2642af97bcaf79ba'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-metronom-2026-10-16/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-metronom-2026-10-16/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** To move the whole practice ramp one BPM faster or slower, the user has to edit two fields. The native number spinners are too small to hit from playing position.

**Approach:** Arrow Up/Down on the Idle screen shifts Start BPM and Ceiling BPM together by ±1. Each of the four Settings fields gets a pair of large "−" / "+" buttons directly beneath it, which change only that field by 1. The native spinners are hidden.

Decisions (made autonomously per the user's standing instruction; UX by Sally, 2026-10-22, see EXPERIENCE.md "Field steppers" and "Arrow Up / Arrow Down"):
- [ASSUMPTION] The arrows only work in Idle. While Playing they do nothing, because Settings are locked (FR-3).
- Arrows work from anywhere, including inside the four Settings fields, where they replace the native +1 (preventDefault). Fields inside `app-song-library` keep their native arrow behaviour.
- Down is refused as a whole (neither value changes) when Start BPM would drop below 1. If Start or Ceiling is not a positive whole number, the arrows do nothing. Auto-repeat is allowed.
- Steppers: "+" on an empty field sets it to 1. "−" is disabled when the field is empty or when the result would be below 1.

## Boundaries & Constraints

**Always:** The shift rule is a pure function in `core/settings.ts`. The keyboard rule lives in `App.onKeydown`, still the only keyboard handler. Ctrl/Alt/Meta + arrow is ignored. Stepper buttons are `type="button"` with `tabindex="-1"` and `aria-label="Decrease {label}"` / `"Increase {label}"`, and they don't take focus on mousedown. That keeps Tab order, Space and Enter unchanged. Steppers write through the same `settings` model as typing. Styling follows DESIGN.md `settings-stepper`: 48px tall, 28px glyph, two equal halves under the input, no amber.

**Never:** No arrow behaviour while Playing. Don't change the song library or its keys. No press-and-hold repeat on the buttons. No Shift+arrow variants. Don't change Step or Interval with the arrows.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Up | Idle 60/120, ArrowUp anywhere | 61/121, default prevented | N/A |
| Down | Idle 60/120, ArrowDown | 59/119 | N/A |
| Down at floor | Start 1, Ceiling 40 | Unchanged | N/A |
| In a settings field | focus Step, ArrowUp | Start/Ceiling +1, Step unchanged, default prevented | N/A |
| Invalid | Start empty | Nothing changes | N/A |
| Song field | focus song BPM, ArrowUp | Settings unchanged, default not prevented | N/A |
| Playing | ArrowUp | Nothing changes | N/A |
| Stepper + | Step 5, click + | Step 6 only | N/A |
| Stepper − floor | Every 1 | − disabled | N/A |
| Stepper on empty | Ceiling empty | + gives 1; − disabled | N/A |

</frozen-after-approval>

## Code Map

- `src/app/core/settings.ts` -- `Settings`, `isPositiveWhole`, `validate`. Add `shiftRange(settings, delta)`: it returns the shifted settings, or the same object when Start/Ceiling are not positive whole numbers or the new Start would be < 1.
- `src/app/core/settings.spec.ts` -- add table tests for `shiftRange`.
- `src/app/app.ts` -- `onKeydown` switch. Add `ArrowUp`/`ArrowDown` cases that apply `shiftRange` via `session.updateSettings`, skipping targets inside `app-song-library`.
- `src/app/app.spec.ts` -- the `keyboard` describe has the helpers `key`, `setup`, `inputs`, `play`; extend it there.
- `src/app/ui/settings-form/settings-form.{ts,html,css}` -- the `fields` loop. Add a `nudge(key, delta)` method and the stepper row inside each `.field`. Hide the spinners (`appearance: textfield` plus the webkit pseudo-elements). The existing `update()` stays.
- `src/app/ui/settings-form/settings-form.spec.ts` -- the Host model binding and `inputs()` helper; extend with stepper tests.
- UX docs are already updated (part of this change; don't edit them).

## Tasks & Acceptance

**Execution:**
- [x] `src/app/core/settings.ts` + spec -- `shiftRange` -- rows Up, Down, Down at floor, Invalid.
- [x] `src/app/app.ts` + spec -- arrow keys -- rows Up, In a settings field, Song field, Playing, plus modifier ignored.
- [x] `src/app/ui/settings-form/*` + spec -- steppers and spinner hiding -- rows Stepper +, − floor, on empty; buttons are not Tab stops.

**Acceptance Criteria:**
- Given Idle with valid Settings, when the user holds ArrowUp, then Start and Ceiling rise together on each repeat, and the gap between them stays the same.
- Given focus in a Settings field, when the user clicks a stepper, then focus stays in that field and Space still starts the Session.

## Implementation Notes

- Implemented directly from the spec (no implementation subagent). `shiftRange` is in `core/settings.ts`. The arrows go in `App.onKeydown` via `session.updateSettings`, which already refuses changes while Playing. Steppers: `nudge`/`canDecrease` in `SettingsForm`; the field markup is now `div.field > label.field-input + div.stepper`.
- Tests need Node ≥ 22 (`~/.nvm/versions/node/v24.22.0`). The default nvm Node 20 is rejected by the Angular CLI.
- Review patch: the song-library exemption was narrowed to its `<input>`s (as the frozen intent says, "fields"), so a focused ✎/×/Save/song row button still lets the arrows shift the range. "+" on a field holding 0 or a negative number now gives 1.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence / route |
|---|---|---|---|---|
| 1 | verification-gap, blind | Arrows exempt for every element in `app-song-library`, incl. buttons | medium | `isInSongLibrary` used `Element.closest`; frozen intent says "fields". Patched to inputs only, with a test. |
| 2 | edge-case | "+" does nothing on a field holding ≤ 0 | low | `next = -4 < 1` returned early. Direct fix, patched, with a test. |
| 3 | edge-case, blind | Steppers keep a decimal value non-whole (2.5 → 3.5) | low | Real, but a decimal is rarely typed and the hint already flags it. The fix adds rounding branches. Rejected. |
| 4 | edge-case | Arrow during the async `start()` window shows shifted settings while playing the old ones | low | `start()` captures settings before `await resume()`. Typing has the same pre-existing window, which is milliseconds long. Rejected. |
| 5 | edge-case, blind | Arrows block page scrolling outside the song library | low | Intended: frozen intent says arrows work "from anywhere". The window is resizable. Rejected. |
| 6 | edge-case | Arrows during IME composition shift the range | false | Every text field is in `app-song-library` and exempt. The settings inputs are numeric. |
| 7 | blind | Keyboard users lose native ±1 on Step/Every | false | Replacing the native +1 in settings fields is a frozen decision. The values can still be typed. |
| 8 | blind | Shift allowed while Ceiling < Start | low | The gap is preserved and validation still flags it. Harmless. Rejected. |
| 9 | blind | Thin tests for focus retention / ArrowDown variants | low | Mousedown preventDefault is tested. jsdom doesn't move focus on click. The ArrowDown path shares its code with ArrowUp. Rejected. |
| 10 | blind | DESIGN token drift (font-weight, opacity) | low | Cosmetic documentation drift. Rejected. |
| 11 | blind | No upper bound on BPM | false | The PRD sets no tempo limit (EXPERIENCE accessibility note). |
| 12 | blind | `appearance` before `-moz-appearance` | low | Direct swap, patched. |
| 13 | blind | `onKeydown` comment says "song fields" but code exempted all of the library | low | Same root cause as #1. Resolved by that patch. |

## Verification

**Commands:**
- `npx ng test --watch=false` -- expected: all tests pass
- `npx ng build` -- expected: build succeeds
