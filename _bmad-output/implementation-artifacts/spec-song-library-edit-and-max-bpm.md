---
title: 'Saved songs: edit them and record my max BPM'
type: 'feature'
created: '2026-10-17'
status: 'done'
baseline_commit: 'ad71ab30fd49be906690cbaca08559a5991d61a1'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-song-bpm-presets.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A saved song can only be removed and re-added, never changed. There is also nowhere to note how fast the user can currently play it.

**Approach:** Each saved song row gets an edit button, which loads the song into the existing form so it can be changed and saved back. Songs get a new optional field, "My max (BPM)": the highest tempo the user can play the song at so far, typed in by hand and shown in the row.

Decisions (made autonomously per the user's standing instruction, 2026-10-17):
- [ASSUMPTION] "My max" is information only. Selecting a song still only applies its BPM as before (Ceiling, lowering Start if it is above). Nothing writes "My max" automatically.
- "My max" is optional. When filled in it must be a whole number above 0, with no upper limit; it may be above the song BPM.
- Editing changes the song in place, including its Artist and Song. If the edited Artist + Song matches another saved song, that other entry is replaced (the same rule as saving a duplicate).
- The form is shared: in edit mode its button reads "Update" and a "Cancel" button appears. Cancel, a successful Update, or removing the song being edited clears the form and leaves edit mode.

## Boundaries & Constraints

**Always:** `Song` gains `maxBpm: number | null`. The rules stay pure in `core/songs.ts`: `validateSong` accepts an empty max and rejects an invalid one, and a replace operation removes the original entry by key and then upserts the edited one. The storage key stays `metronom.songs.v1`. Entries saved before this change, which have no `maxBpm`, load with `maxBpm: null`. A stored entry with an invalid `maxBpm` keeps the song and drops the max. `SongLibraryService` gets the replace operation and reuses the existing persistence and error handling. The row reads "{Artist} – {Song} · {BPM} BPM", with " · max {maxBpm}" added when the max is set. The edit button is labelled ✎, with `aria-label="Edit {artist} – {title}"`, and sits next to ×. The form gets a fourth field "My max (BPM)" (`type="number"`, `name="maxBpm"`). Bindings must never rewrite an input while the user is typing (see the "1e" finding in the previous spec): fill the fields only when edit mode starts or the form clears. Enter in the form submits (save or update). Space handling is unchanged: only the text inputs in `app-song-library` are exempt.

**Never:** No automatic max tracking, no progress history, no change to `applySong`, the ramp, the scheduler or the keyboard rules, and no confirmation dialogs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Save with max | "Metallica","One",140, max 110 | Row "Metallica – One · 140 BPM · max 110" | N/A |
| Save without max | max empty | Row without " · max"; `maxBpm: null` stored | N/A |
| Invalid max | max 0 / 12.5 | Save/Update disabled | N/A |
| Start edit | ✎ on "One" | Fields filled 'Metallica','One','140','110'; button "Update"; Cancel shown | N/A |
| Update BPM | edit "One" → 150 | One row, BPM 150; stored | N/A |
| Rename | edit "One" → title "One (live)" | Old row gone, new row present | N/A |
| Rename onto existing | edit "One" → "Battery" (exists) | One "Battery" row with the edited values | N/A |
| Cancel | Cancel in edit mode | Form cleared, "Save", library unchanged | N/A |
| Remove while editing | × on the song being edited | Row gone, form cleared, edit mode left | N/A |
| Old data | stored `[{"artist":"A","title":"B","bpm":90}]` | Loads with `maxBpm: null` | No throw |
| Bad stored max | `maxBpm: "fast"` | Song kept, `maxBpm: null` | No throw |

</frozen-after-approval>

## Code Map

- `src/app/core/songs.ts` -- `Song`, `SongDraft`, `validateSong`, `songKey`, `upsertSong`, `removeSong`, `parseSongs`, `serializeSongs`; add `maxBpm` and `replaceSong(songs, original, edited)`. `applySong` unchanged.
- `src/app/core/songs.spec.ts` -- extend the table tests.
- `src/app/session/song-library.service.ts` -- `save`, `remove`, `commit`; add `update(original, edited)` (or an optional `replacing` arg on `save`).
- `src/app/ui/song-library/song-library.{ts,html,css}` -- signals `artist`, `title`, `bpm`, `draft`, `onSubmit` (resets signals + `form.reset()`); add `maxBpm`, `editing: Song | null`, edit/cancel, ✎ button. Grid `.add` has 4 columns today: rebalance for the 5th control (and Cancel), keeping the 2-column layout under 640px.
- `src/app/ui/song-library/song-library.spec.ts` -- host emits `songSelect`; helpers `type`, `fill`, `submit`; extend.
- `src/app/app.spec.ts` -- no expected change. Space tests target `input[name="bpm"]` and `.pick`.
- `_bmad-output/planning-artifacts/ux-designs/ux-metronom-2026-10-16/EXPERIENCE.md:46` -- update the Song library row.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/core/songs.ts` + spec -- `maxBpm`, validation, `replaceSong`, parsing old and bad data -- matrix rows: Invalid max, Rename, Rename onto existing, Old data, Bad stored max.
- [x] `src/app/session/song-library.service.ts` + spec -- update persists, and a failed write still reports "Songs could not be saved".
- [x] `src/app/ui/song-library/*` + spec -- max field, row suffix, edit mode, Update/Cancel, remove-while-editing -- matrix rows: Save with/without max, Start edit, Update BPM, Cancel, Remove while editing; also typing in a field in edit mode is not overwritten.
- [x] `EXPERIENCE.md` -- describe edit mode and "My max".

**Acceptance Criteria:**
- Given a song saved before this change, when the app launches, then it is still listed and can be edited.
- Given edit mode, when the user presses Enter in a field with valid input, then the song is updated.

## Implementation Notes

- `SongDraft.maxBpm` is optional (missing = empty), so existing draft callers stay valid; `Song.maxBpm` is required (`number | null`).
- Service API: `update(original, edited)` delegates to the pure `replaceSong`.
- Form fields are written only in `onEdit` and `clear()` (via `form.elements`), never by bindings.
- Unparseable "My max" input (e.g. "1e", `validity.badInput`) keeps Save/Update disabled instead of being treated as empty. jsdom sanitises such values, so this path is not unit-tested.

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| V/B: `badInput` guard on "My max" untested | low | patch | Test added that stubs `validity.badInput`. |
| B: focus not moved to the form on ✎; drops to body after Cancel/Update | low | patch | Artist input is focused on edit and when edit mode clears. |
| B: ✎/× without tooltip; `.cancel` has no hover | low | patch | `title` attributes and the hover rule added. |
| B: EXPERIENCE.md says only "Enter saves" | low | patch | Doc now says Enter updates in edit mode and that starting an edit replaces the form. |
| E/B: Space on ✎/Cancel/number fields starts the Session and drops the edit | low | reject | Frozen intent: Space handling unchanged (only text fields exempt), per AD-6. |
| E: ✎ overwrites unsaved form input | low | reject | Intended: starting an edit loads that song. Now documented in EXPERIENCE.md. |
| E: huge max shows "1e+21" | low | reject | Absurd input. No upper limit by design. |
| E/B: update when the original is gone becomes a re-add | false | reject | Removing the edited song clears edit mode. There is no other path in a single window. |
| B: Enter-to-update has no keydown test | low | reject | Native submit, which jsdom can't fire. Covered via `requestSubmit`. |
| B: "does not overwrite while typing" test is weak | low | reject | There are no bindings left to regress. The badInput test covers the risky path. |
| B: no screen-reader cue for edit mode | low | reject | The button label changes to Update. Fuller a11y adds new surface. |
| B: no reason shown when Save is disabled | low | reject | Existing behaviour from the previous spec. |
| B: `clear()` keeps the save-error hint | false | reject | Intended: the hint stays until the next good write. |
| B: whitespace in row span; `bpm-field` hook removed | false | reject | `bpm-field` had no CSS rule. The text renders on one line. |
| B: spec logs empty | false | reject | They are filled in at this step. |

## Verification

**Commands:**
- `source ~/.nvm/nvm.sh && nvm use && npm test -- --watch=false` -- expected: all tests pass
- `npm run build` -- expected: succeeds
- `grep -rE "from '\.\./(audio|session|ui)" src/app/core` -- expected: no output
