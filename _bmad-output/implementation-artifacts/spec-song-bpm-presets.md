---
title: 'Saved songs: store a song BPM and quick-select it'
type: 'feature'
created: '2026-10-17'
status: 'done'
baseline_commit: 'e653fcb352b225e907512dd8695d9891ae830736'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-metronom-2026-10-16/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The user practises the same songs again and again and has to retype each song's tempo every launch, because nothing is kept between sessions.

**Approach:** Add a "Songs" library to the Idle screen. The user saves a song with Artist, Song and BPM (all required). Clicking a saved song quick-selects it and fills that BPM into the Settings. The library is stored in the renderer's `localStorage`, so it survives restarts both in the browser and in the Electron app.

Decisions (made autonomously per the user's standing instruction, 2026-10-17; this deliberately lifts the v1 "no persistence" rule for songs only):
- [ASSUMPTION] Selecting a song sets **Ceiling BPM** to the song's BPM (the speed being trained towards). Start, Step and Interval stay as they are, except that Start BPM is lowered to the song BPM when it would otherwise be above it, so the Settings stay valid.
- Songs are identified by Artist + Song, trimmed and case-insensitive. Saving an existing pair replaces its BPM (no duplicates).
- The list is sorted by Artist, then Song. Each row has a remove button. There is no confirmation dialog (EXPERIENCE.md: no dialogs).
- Only the song library is persisted. Settings and the count-in switch still reset at launch.

## Boundaries & Constraints

**Always:** Pure logic (`Song` type, `validateSong`, key normalisation, upsert, remove, sort, parsing of stored data) lives in `src/app/core/songs.ts`, with no Angular/DOM imports. Persistence lives in a root-provided `SongLibraryService` in `src/app/session/`; it exposes a readonly `songs` signal and `save(song)` / `remove(song)`, and it reads storage through an injection token (`SONG_STORAGE`, defaulting to `localStorage`) so tests use a fake. The storage key is `metronom.songs.v1` and holds a JSON array of `{ artist, title, bpm }`. Missing, corrupt or partly invalid stored data loads as the valid entries only (or empty), and never throws. If storage is unavailable or a write throws, the in-memory list still updates and the library shows "Songs could not be saved". BPM must be a whole number above 0 (no upper limit, like FR-1). Artist and Song must not be empty after trimming. The values are stored trimmed. Selecting goes through `SessionService.updateSettings()`, so it is refused while playing. The UI is a standalone OnPush component `ui/song-library/` under the Settings form on the Idle screen, styled only with DESIGN.md tokens. Its add form is a `<form>`: Enter in its fields saves, and Save is disabled while the input is invalid. Space must type a normal space in the Artist and Song text fields. The root keyboard handler leaves Space alone when the event target is a text `<input>` inside `app-song-library`; every other Space rule stays as it is.

**Never:** No Electron/IPC/preload changes (AD-7) and no network access. Settings, count-in and window state are not persisted. No import/export, no editing in place (re-saving the same Artist + Song replaces it), no search, no changes to the ramp, scheduler or audio.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Save | "Metallica", "One", 140 | Row "Metallica – One · 140 BPM" appears; storage holds it; form clears | N/A |
| Restart | stored list exists | List shows on launch, sorted | N/A |
| Duplicate | save " metallica ", "ONE", 150 | Still one row; BPM 150 | N/A |
| Invalid input | empty artist, or BPM 0 / 12.5 / empty | Save disabled | N/A |
| Select | Settings 60/120/5/4, song 140 | Settings 60/140/5/4 | N/A |
| Select below start | Settings 100/120/5/4, song 90 | Settings 90/90/5/4 | N/A |
| Remove | click remove on a row | Row is gone from the list and from storage | N/A |
| Corrupt storage | `"{not json"` or `[{"artist":1}]` | Empty list (valid entries kept) | No throw |
| Storage throws | `setItem` throws | List updates in memory | Hint "Songs could not be saved" |
| Space in text field | Space in Artist field | Space typed; Session not started | N/A |

</frozen-after-approval>

## Code Map

- `src/app/core/settings.ts` -- `Settings`, `validate()`; reuse the positive-whole-number rule (export a helper or mirror it in `songs.ts`).
- `src/app/core/songs.ts` (new) + spec -- pure library logic and parsing.
- `src/app/session/song-library.service.ts` (new) + spec -- signal store + `SONG_STORAGE` token (pattern: `session-platform.ts` `SESSION_PLATFORM` token with a factory default).
- `src/app/session/session.service.ts` -- `updateSettings()` (no change expected; selection computes new Settings in the UI or in a small `applySong(settings, song)` core helper).
- `src/app/ui/settings-form/*` -- style reference for inputs, labels, focus ring, hint line; do not change its behaviour.
- `src/app/ui/song-library/` (new) -- list + add form; outputs `select` with the Song (or calls services directly, matching how `App` wires the form).
- `src/app/app.html` / `app.ts` -- render the library under the form in `.idle`; Space exemption in `onKeydown`.
- `src/app/app.css` -- `.idle` currently centres one child; stack form + library in a column, scrollable when tall.
- `src/app/app.spec.ts` -- the "renders the settings form with defaults" test queries every `input`; scope it to `app-settings-form`.
- `ARCHITECTURE-SPINE.md` -- add a short AD for song persistence; update the "no persistence" Deferred line.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/core/songs.ts` + `songs.spec.ts` -- types, `validateSong`, `songKey`, `upsertSong`, `removeSong`, `sortSongs`, `parseSongs`, `applySong(settings, bpm)` -- table tests for the matrix rows Duplicate, Invalid, Select, Select below start, Corrupt.
- [x] `src/app/session/song-library.service.ts` + spec -- load on construction, save/remove persist, write-failure signal -- tests with a fake storage: Restart, Remove, Storage throws.
- [x] `src/app/ui/song-library/*` + spec -- form (Artist, Song, BPM, Save), list rows (select button + remove button with `aria-label="Remove {artist} – {title}"`), empty state "No saved songs yet", hint with `aria-live="polite"`.
- [x] `src/app/app.{html,ts,css}` + `app.spec.ts` -- wiring, Space exemption, layout -- tests: Select row updates the form fields, Space in the Artist field does not start.
- [x] `ARCHITECTURE-SPINE.md` -- record the persistence decision.

**Acceptance Criteria:**
- Given a song was saved, when the app is closed and reopened, then the song is still listed.
- Given the Idle screen, when the user clicks a saved song, then the Ceiling BPM field shows its BPM, and Start begins a ramp towards it.
- Given a Session is playing, then the song library is not shown.

## Implementation Notes

- Persistence verified outside the app: an Electron probe registering the same privileged `app://` scheme read back a `localStorage` value after a restart (userData-backed). Songs saved under `ng serve` (localhost origin) are separate from the desktop app's.
- Output renamed `songSelect` (review) to avoid the native `select` event.

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| Self: output `select` collides with the native bubbling `select` DOM event | high | patch | Selecting text in Artist/Song bubbles `select` to the host, so `onSongSelect(Event)` sets ceilingBpm to undefined. Renamed to `songSelect`, with a test. |
| E/B: BPM `[value]` binding wipes a briefly unparseable entry ("1e") | low | patch | bpm turns null and the binding writes ''. Bindings removed; the native form resets after a save. |
| V/B: Space on library BPM field and buttons untested; Space in BPM starts | low | patch | The frozen intent exempts only text fields, so behaviour stays as specified. Test added to pin it. |
| B: list unbounded, pushes add form off screen | low | patch | `.list` capped with `max-height` and scrolls. |
| B: EXPERIENCE.md still says nothing is saved | low | patch | Doc updated with a Song library row. |
| E: song selected while `start()` awaits `resume()` | low | reject | The window is milliseconds long. The same race already exists for form edits. |
| E: `save()` accepts an unvalidated Song | false | reject | The only caller passes `validateSong()` output. |
| E: two windows share localStorage, last write wins | false | reject | Single sealed window (AD-7). There is no second window. |
| E/B: unreadable stored entries are dropped on the next write | low | reject | Only reachable by hand-editing storage. A backup key adds new surface. |
| B: read failure is invisible until a save | low | reject | Shows on the first save. A load-error state adds complexity. |
| B: focus lost after removing a row | low | reject | Fixing it needs focus management. Mouse-first secondary list. |
| B: no "selected" feedback on a row | low | reject | The Ceiling field visibly changes. An active state is new behaviour. |
| B: re-save also replaces the name casing | false | reject | Intended: the latest spelling wins, which lets a typo be fixed. |
| B: Enter-to-save not testable in jsdom | low | reject | Native form submit. Covered by `requestSubmit` tests. |
| B: Electron persistence only checked manually | false | reject | Verified: an Electron probe with the same privileged `app://` scheme read back a `localStorage` value after a restart. |
| B: library hint not tied via aria-describedby | low | reject | Cosmetic for a11y. The hint is a live region. |
| B: spec logs empty while in review | false | reject | They are filled in at this step. |

## Verification

**Commands:**
- `source ~/.nvm/nvm.sh && nvm use && npm test -- --watch=false` -- expected: all tests pass
- `npm run build` -- expected: succeeds
- `grep -rE "from '\.\./(audio|session|ui)" src/app/core` -- expected: no output

**Manual checks:**
- `npm run desktop`: save a song, quit, relaunch, and check the song is still listed. Clicking it should set Ceiling BPM.
