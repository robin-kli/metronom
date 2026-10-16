# Addendum: metronom PRD

Technical detail for the architecture step, carried over from the brief addendum and the PRD session.

## Platform

- Built as a web app with **Angular**, packaged with **Electron**, and run as a local desktop app on Linux.
- Must work fully offline. No network calls.

## Audio timing

- Steady timing is the main quality bar. Schedule clicks ahead of time on the Web Audio API clock rather than with `setInterval`.
- Drive the Beat Display from the audio schedule, so the highlight and the click stay in sync, including at an Increase (FR-5, FR-7).
- The click can be synthesised (a short oscillator burst) or a bundled sample. A higher pitch or volume for the Accent is enough.

## Spacebar handling

- FR-4 requires the spacebar to toggle Start/Stop even while a field has focus. Handle it at window level and stop the browser default, so a focused button isn't activated twice and the page doesn't scroll.
