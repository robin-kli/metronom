- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-set-up-a-ramp-on-the-idle-screen.md`
  summary: Built index.html may render blank when loaded from file:// because the bundle uses module scripts.
  evidence: maybe-false (medium if true) — Chrome blocks module scripts from file://; settle in Story 2.1 by loading dist in Electron.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-open-metronom-in-its-own-desktop-window.md`
  summary: Ubuntu 24.04 restricts unprivileged user namespaces, so Electron aborts unless chrome-sandbox is root-owned 4755 or an AppArmor profile exists; document in README (Story 2.2).
  evidence: Reproduced on this machine; verification ran with --no-sandbox.
