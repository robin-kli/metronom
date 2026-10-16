# Addendum: metronom

Detail that belongs downstream (PRD / architecture) rather than in the brief.

## Technical constraints (from Robin)

- Framework: **Angular**.
- Delivery: built as a web app, packaged with **Electron**, and used as a **local desktop app on Linux**.

## Notes for architecture

- Timing accuracy is the core quality bar. Schedule audio clicks ahead of time on the Web Audio API clock rather than with `setInterval`, and drive the visuals from the audio schedule so sound and display stay in sync, including at tempo-step boundaries.
