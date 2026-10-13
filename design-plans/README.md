# Design plans

Implementation plans produced by the skin UI/UX audit ([`improve-ui`](../.opencode/skills/improve-ui/SKILL.md) method), one per selected change.

Written against commit `43920d2a369131b14070d3766357ee7fdaab2d5a`.

**All six are executed.** Each plan carries an `**Executed.**` banner and a `Reconciliation` section recording anything that differed from the plan as written, plus the verification evidence.

| Plan | Root problem | Files touched | Confidence |
| --- | --- | --- | --- |
| [Button label contrast](2026-10-13-button-label-contrast.md) ✅ | Button labels are a hardcoded `#ffffff` over a token-driven fill, so they fail AA in dark mode in all three skins (2.30:1–3.39:1) | 3 `as-*.css` palettes + 4 rules + new `tests/skin-contrast.test.mjs` | High |
| [Marker text contrast](2026-10-13-marker-text-contrast.md) ✅ | `--gs-fg-subtle` (the disabled/placeholder tier) also colours the injected marker, "unavailable" and group-heading text at 3.24:1–4.12:1 | `src/themes/ux-markers.css`, `src/themes/ux-nav.css` + contrast test extended | High |
| [Token tier collapse](2026-10-13-token-tier-collapse.md) ✅ | Radius and border tiers declare distinctions they do not deliver (`sm == md` in gitlab and bitbucket; `--gs-border-muted == --gs-border` in github) | 3 `as-*.css` + `tests/contracts.test.mjs` | High |
| [Forced colours](2026-10-13-forced-colors.md) ✅ | No `@media (forced-colors: active)` anywhere, so the replaced brand mark can disappear on a forced header | 3 `as-*.css` + contract test | Medium |
| [Popup motion](2026-10-13-popup-motion.md) ✅ | The product's only three transitions have no `prefers-reduced-motion` guard, one uses the `background` shorthand | `src/popup/popup.css` | Medium |
| [Layout comment drift](2026-10-13-layout-comment-drift.md) ✅ | `theme.js` names "GitHub and Bitbucket" as the pair sharing a layout class; the sharing pair is gitlab + bitbucket | `src/content/theme.js` (comment only) + second site in `src/themes/ux-nav.css` | High |

## What the execution produced

- **`tests/skin-contrast.test.mjs`** (new, 15 tests) — the durable half of plans 1
  and 2: every declared `--gs-on-*` clears 4.5:1 on the fill it labels in both
  modes; a label token is never declared in one mode only; no rule writes a
  literal `color:` over a `var(--gs-*)` fill; every text tier clears 4.5:1 on
  `--gs-canvas` and `--gs-canvas-subtle`; and no theme file *uses* the disabled
  tier. Each assertion was proven to fail by reintroducing the defect.
- **Two new contract tests in `tests/contracts.test.mjs`** — `a scale declares
  its steps, and a tier that repeats says so` (plan 3) and `every skin survives
  forced-colors mode` (plan 4). Both also proven to fail by reintroduction.
- **Six palette/structure/comment changes** across three skins, two theme files,
  the popup stylesheet and `theme.js`.

## Still open (not plan work, recorded here so it is not lost)

1. **Forced-colours blocks are structurally correct but visually unverified** —
   no High Contrast environment was available. Nothing asserts legibility.
2. **Popup motion is unverified by a suite** — no test asserts popup CSS today;
   the `transitionend` check was done by reading the source, not by a test.
3. **`npm run plugins:validate` fails on a clean checkout** —
   `source 'github' names counterpart 'gitlab', which is not registered` (and
   the mirror for gitlab). Pre-existing at `43920d2`, unrelated to these plans;
   `npm test` and `npm run registry:check` both pass. Worth its own plan.

## Scored improvement backlog (layout / parity)

Proposed by the fidelity re-score. Cell scores are live, off-diagonal, from
`tools/compare/style-parity.mjs --checks`; each row names the weighted gain
available if that dimension reaches 1.00 in the cells that miss it.

The full route to 10 is **[`PATH-TO-10.md`](PATH-TO-10.md)** — five plans in
dependency order, with the ceilings stated.

| Candidate | Dimension (weight) | Cells that miss it | Gain if fixed | Plan |
| --- | --- | --- | --- | --- |
| The live check is not reproducible (consent surfaces, session state) | gate | every cell | 0 — but every number below is untrusted until it lands | [`parity-measurement-determinism`](2026-10-13-parity-measurement-determinism.md) |
| GitHub repo nav never becomes a sidebar under the column layouts | layout (2.0) | project `github → gitlab` 0.00, project `github → bitbucket` 0.00 | +2.0 in both cells; project family gitlab 8.6 → ~9.1, bitbucket 9.2 → ~9.7 | [`layout-reorient-github-nav`](2026-10-13-layout-reorient-github-nav.md) |
| Gerrit's rebuilt profile nav is a tab strip under the column layouts | layout (2.0) | profile `gerrit → gitlab` 0.00, profile `gerrit → bitbucket` 0.00 | +2.0 in both cells; profile family bitbucket 9.1 → ~9.6, gitlab 8.4 → ~8.9 | [`gerrit-profile-nav-layout`](2026-10-13-gerrit-profile-nav-layout.md) |
| Header and canvas colours stop at the source each skin was written for | header (2.0), body (1.0) | header 0.88 on 8 `→ gitlab` cells, 0.20 on 8 `→ github` cells (needs the gate first); body 0.96 on 8, 0.91 on 4 | 2.0 × 8 + 1.0 × 12 | [`header-canvas-reach`](2026-10-13-header-canvas-reach.md) |
| Vocabulary left untranslated | vocab (2.0) | 11 cells below 1.00, from 0.00 to 0.80 | 2.0 × up to 11 — the largest single lever | [`vocabulary-reach`](2026-10-13-vocabulary-reach.md) |
| Explore/dashboard, settings, signIn, signOut are unscored | n/a | `PAGES` in `style-parity.mjs` has only `project` and `profile` | unknown — unmeasured, not unearned | not written |

## Executing a new plan here

Each plan is self-contained and assumes no context from the audit or this
conversation. Follow its Changes section literally; its Validation section
names the exact commands and the rendered states to check. If a stop condition
triggers, stop and report rather than widening the scope.
