- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-set-up-a-ramp-on-the-idle-screen.md`
  summary: Built index.html may render blank when loaded from file:// because the bundle uses module scripts.
  evidence: maybe-false (medium if true) — Chrome blocks module scripts from file://; settle in Story 2.1 by loading dist in Electron.
