---
title: 'Story 1.1: Set up a ramp on the Idle screen'
type: 'feature'
created: '2026-10-16'
status: 'done'
baseline_commit: 'c3263c82065471603f18e373e528a10310093d6a'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There is no app yet. The user needs to open metronom and see the four ramp settings, pre-filled, with immediate feedback on whether they can start.

**Approach:** Scaffold an Angular 22 app at the repo root with the layered source tree from the architecture, add the DESIGN.md tokens as CSS variables, a pure `validate()` in `core/`, and an Idle settings form with a Start button and validation hint. Start does nothing yet beyond being enabled or disabled (playback is Story 1.2).

## Boundaries & Constraints

**Always:** Node 24 (`.nvmrc`). Standalone, zoneless, `OnPush` components with signals; no Router, no NgModules. `src/app/core/` imports nothing outside `core/`. Colours only through CSS custom properties. System-ui font, tabular numerals. Exact microcopy: labels "Start BPM", "Ceiling BPM", "Step (BPM)", "Every (bars)"; messages "All fields need a whole number above 0" and "Ceiling must be at least the start BPM". `<base href="./">`, CSP `default-src 'self'` (+ `style-src 'self' 'unsafe-inline'` only if needed).

**Never:** No audio, scheduler, SessionService, keyboard handler or Electron code (later stories). No persistence (no localStorage). No web fonts, CDN, or UI library. No limits beyond the validation rules.

## I/O & Edge-Case Matrix

| Scenario | Input (start, ceiling, step, every) | Expected | Error Handling |
|----------|------|---------|----------------|
| Defaults | 60, 120, 5, 4 | ok; Start enabled; hint empty | N/A |
| Equal ceiling | 100, 100, 5, 4 | ok | N/A |
| Ceiling below start | 120, 100, 5, 4 | not ok | "Ceiling must be at least the start BPM" |
| Empty field | 60, —, 5, 4 | not ok | "All fields need a whole number above 0" |
| Zero / negative | 60, 120, 0, 4 / -1 | not ok | "All fields need a whole number above 0" |
| Decimal | 60.5, 120, 5, 4 | not ok | "All fields need a whole number above 0" |
| Both problems | 0, -5, 5, 4 | not ok | whole-number message first |

</frozen-after-approval>

## Code Map

- Repo is empty apart from `README.md`, `.gitignore`, `_bmad/`, `.claude/`, `_bmad-output/`. Scaffold Angular at the repo root (`ng new metronom --directory .`), keeping existing files.
- `.gitignore` -- already ignores `node_modules/`, `dist/`, `.angular/` is NOT listed: add it.
- `_bmad-output/implementation-artifacts/epic-1-context.md` -- distilled requirements, tokens, AD rules.

## Tasks & Acceptance

**Execution:**
- [x] `.nvmrc` -- `24` -- pins Node for Angular 22.
- [x] repo root -- `npx @angular/cli@22.2 new metronom --directory . --style=css --routing=false --ssr=false --zoneless --skip-git --test-runner=vitest` (adapt flags to what CLI 22 accepts) -- scaffold.
- [x] `src/index.html` -- title "metronom", `<base href="./">`, CSP meta -- offline + file:// loading.
- [x] `src/styles.css` -- all DESIGN.md tokens as `--color-*`, `--radius-*`, `--space-*`, font stack, `font-variant-numeric: tabular-nums`, body background/colour -- UX-DR1.
- [x] `src/app/core/settings.ts` -- `Settings` type (`startBpm`, `ceilingBpm`, `step`, `interval`, numbers or null), `DEFAULT_SETTINGS`, `validate()` -- AD-2.
- [x] `src/app/core/settings.spec.ts` -- table tests for the matrix.
- [x] `src/app/ui/settings-form/` -- component: four labelled number inputs bound to a `Settings` signal, Start button disabled unless valid, hint line `aria-live="polite"`; emits `start` -- UX-DR2–5.
- [x] `src/app/app.ts` (+ template/css) -- root: holds settings signal with defaults, renders the form centred.
- [x] `src/app/audio/`, `src/app/session/` -- create with a `.gitkeep` so the layout exists.
- [x] `src/app/ui/settings-form/settings-form.spec.ts` -- renders defaults, disables Start on invalid input, shows hint.
- [x] `.gitignore` -- add `.angular/`.

**Acceptance Criteria:**
- Given Node 24, when `npm test` and `npm run build` run, then both succeed.
- Given the app is served, when it opens, then the four fields show 60/120/5/4, Start is enabled (amber, 48px), and everything is centred and visible without scrolling, wrapping to 2×2 below ~640px.
- Given an invalid edit, then Start is disabled (beat-off fill, muted text) and only the first problem is shown in the danger colour.

## Implementation Notes

- Scaffolded with `npx @angular/cli@22.2 new metronom --directory . --style=css --routing=false --ssr=false --zoneless --commit=false --test-runner=vitest --ai-config=none --package-manager=npm`. CLI 22 aborts on merge conflicts with existing `README.md`/`.gitignore`, so both were moved aside during scaffolding and restored unchanged (plus `.angular/`). `@angular/router` stays in `package.json` from the scaffold but is not used.
- `style-src 'unsafe-inline'` is needed: Angular injects component styles as `<style>` elements.
- Production `optimization.styles.inlineCritical` is `false`: critical-CSS inlining adds an inline `<script>` that `default-src 'self'` blocks, which would leave the global stylesheet stuck on `media="print"`.
- Inputs use `FormsModule` `ngModel` (one-way `[ngModel]` + `(ngModelChange)`) so typing is never overwritten by the model write-back; an empty/unparseable field becomes `null`. `SettingsForm.settings` is a `model.required<Settings>()`, two-way bound from `App`.
- The unused `@angular/router` dependency has since been removed from `package.json` (supersedes the scaffold note above).
- Start is `type="button"` (no `<form>` submit) so Enter-to-start is left to Story 1.4's root keyboard handler.

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| E: huge whole numbers pass validation | false | reject | Intent says no limits beyond the validation rules. |
| E: step overshooting ceiling unhandled | false | reject | Ramp/Hold handles overshoot (Story 1.2); validation is correct per matrix. |
| E: dist index.html blank from file:// (module scripts) | maybe-false | defer | Applies to Electron loading in Epic 2; settle by loading dist in Electron. |
| V: Implementation Notes say router kept, but it was removed | low | reject | Fix is a spec edit; note appended by implementer instead. |
| B: tsconfig lacks strict / strictTemplates | medium | patch | Confirmed missing; added both, compiles clean. |
| B: inputs not linked to hint (aria-describedby) | low | patch | Direct attribute addition; hint now `#settings-hint`. |
| B: disabled Start not focusable | low | reject | Spec requires a disabled button; hint is announced via aria-live. |
| B: hint flickers mid-edit | false | reject | UX requires validation on every change. |
| B: 1e3 / +60 accepted | low | reject | Valid whole numbers; not met in everyday use. |
| B: update() NaN path untested | low | patch | Test added (viewToModelUpdate(NaN) → null, Start disabled). |
| B: App Start wiring untested | low | reject | onStart is an intentional stub until Story 1.2. |
| B: no lint/format scripts | low | reject | Not in intent; architecture grep is the spec's check. |
| B: no engines field | low | patch | Added `engines.node >=24.15`. |
| B: diff missing lockfile/favicon | false | reject | Excluded from review diff on purpose; both present in tree. |
| B: disabled button uses beat-off token | false | reject | Spec/UX explicitly specify beat-off fill. |
| B: hard-coded sizes and 640px breakpoint | low | reject | Cosmetic; values match DESIGN.md. |

## Verification

**Commands:**
- `source ~/.nvm/nvm.sh && nvm use 24 && npm test -- --watch=false` -- expected: all tests pass
- `npm run build` -- expected: build succeeds, no CSP or budget errors
- `grep -rE "from '\.\./(audio|session|ui)" src/app/core` -- expected: no output
