- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-set-up-a-ramp-on-the-idle-screen.md`
  summary: Built index.html may render blank when loaded from file:// because the bundle uses module scripts.
  evidence: maybe-false (medium if true) — Chrome blocks module scripts from file://; settle in Story 2.1 by loading dist in Electron.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-open-metronom-in-its-own-desktop-window.md`
  summary: Ubuntu 24.04 restricts unprivileged user namespaces, so Electron aborts unless chrome-sandbox is root-owned 4755 or an AppArmor profile exists; document in README (Story 2.2).
  evidence: Reproduced on this machine; verification ran with --no-sandbox.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-install-metronom-from-a-single-appimage.md`
  summary: electron-builder's AppRun silently adds --no-sandbox when unprivileged userns is blocked (Ubuntu 24.04 without the AppArmor profile); no config option. Fix would need a patched AppRun (e.g. patch-package or repacking the AppImage).
  evidence: Reproduced on this machine; AppImage --smoke passes without passing --no-sandbox.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-install-metronom-from-a-single-appimage.md`
  summary: electron-builder's AppRun adds --no-sandbox when `unshare -Ur` fails, so the AppImage runs unsandboxed until the AppArmor profile is installed.
  evidence: Reproduced on Ubuntu 24.04; app now warns and reports "sandboxed": false. Fix needs AppRun patching or the user installing the README profile.
