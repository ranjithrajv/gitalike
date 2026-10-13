# Token tiers that claim a distinction deliver one

> **Executed.** All four changes applied as written. 349 tests pass with 100%
> coverage, `oxlint --deny-warnings` clean, `oxfmt --check` clean. The parity
> rubric is byte-identical to the pre-change baseline. See
> **Reconciliation** for one scope note.


Written against: `43920d2a369131b14070d3766357ee7fdaab2d5a`

## Evidence chain

- Surface: the three skin palettes — `src/plugins/skins/github/as-github.css`, `src/plugins/skins/gitlab/as-gitlab.css`, `src/plugins/skins/bitbucket/as-bitbucket.css` — and the source bridges that consume them.
- Problem: two tier pairs are declared as scales but carry identical values, so consumers that read the "subtle" or "small" tier get the "normal" tier's rendering.
- Design evidence, measured from the shipped declarations:

  **Radius scales (light block / dark block)**

  | Skin | `--gs-radius-sm` | `--gs-radius-md` | `--gs-radius-lg` | Distinct steps? |
  | --- | --- | --- | --- | --- |
  | github | `4px` (`:48`) | `6px` (`:49`) | `8px` (`:50`) | 3 — correct |
  | gitlab | `4px` (`:53`) | `4px` (`:54`) | `8px` (`:55`) | 2 — sm == md |
  | bitbucket | `3px` (`:54`) | `3px` (`:55`) | `8px` (`:56`) | 2 — sm == md |

  **Border tiers (light / dark)**

  | Skin | `--gs-border` | `--gs-border-muted` | Distinct? |
  | --- | --- | --- | --- |
  | github | `#d1d9e0` (`:30`) | `#d1d9e0` (`:31`) | no |
  | github dark | `#3d444d` (`:79`) | `#3d444d` (`:80`) | no |
  | gitlab | `#dcdcde` (`:30`) | `#e8e8eb` (`:31`) | yes |
  | bitbucket | `#dfe1e6` (`:34`) | `#ebecf0` (`:35`) | yes |

  Consumers that read the collapsed tiers:

  - Radius: `src/plugins/sources/gitlab/tokens.css:58` (`--gl-border-radius-sm` ← `--gs-radius-sm`) and `:59` (`--gl-border-radius-base` ← `--gs-radius-md`) resolve to the same value under the gitlab and bitbucket skins; `src/plugins/sources/bitbucket/tokens.css:72-73` (`--ds-radius-small` ← sm, `--ds-radius-medium` ← md) likewise; `src/plugins/skins/gitlab/as-gitlab.css:221-222` (`--borderRadius-small` / `--borderRadius-medium`) likewise.
  - Border: while the **github** skin is active, `src/plugins/sources/gitlab/tokens.css:34` (`--gl-border-color-subtle`) and `src/plugins/sources/gitea/tokens.css:45-46` (`--color-timeline`, `--color-expand-button`) read `--gs-border-muted`, which equals `--gs-border`, so those surfaces take the normal border colour.
  - No consumer reads `--gs-radius-sm` or `--gs-border-muted` *inside* the github skin itself, so the defect is invisible in that file and only shows on the skinned page.

- Owner: the palette blocks of the three `as-*.css` files. The consumers are the source bridges and the two skins that alias Primer token names.
- Scope and affected surfaces: `src/plugins/skins/{github,gitlab,bitbucket}/as-*.css`, plus consumers that must be updated if a token is removed: `src/plugins/sources/{gitlab,gitea,bitbucket}/tokens.css`, `src/plugins/skins/gitlab/as-gitlab.css:221-223,142-146`, `src/plugins/skins/bitbucket/as-bitbucket.css:135-139,283`.
- Uncertainty: whether a vendor genuinely wants sm == md (GitLab's own scale is close to flat, and Atlassian's small step is small). The correction below is safe either way — it makes the alignment explicit rather than guessing a new value — but the stop condition records the vendor check that should happen before any value is changed.

## Design decision

Make the alignment explicit and prove it with an assertion, instead of leaving two tokens that pretend to be different steps:

1. Where a skin's two smallest radii are the same value on purpose, declare the alias — `--gs-radius-sm: var(--gs-radius-md);` — so the file itself states "one step, not two", and leave the consumers alone. No visual change.
2. Where the github skin's muted border is meant to be subtler, restore the distinction with Primer's own `border.muted` values, which are the alpha variants: `#d1d9e0b3` (light) and `#3d444db3` (dark). The alpha is what makes them subtler than `border.default`, which is why the solid duplicate reads as a flat line.
3. Add a token assertion to `tests/contracts.test.mjs` (or a sibling file beside the contract tests) that fails when a declared scale has two adjacent steps with identical values unless the alias form in (1) is used, and when a `-muted` tier equals its base tier. This is what turns the current silent drift into a visible failure for the next skin.

## Reuse

- `--gs-radius-*` and `--gs-border*`: the existing tier families, declared in each skin's palette blocks. No new primitive is needed.
- Exemplar for the alias form: `src/plugins/skins/github/as-github.css:349` already expresses a derived value with `color-mix(in srgb, var(--gs-header-fg) 14%, transparent)`, so a derived/aliased token is an established pattern in these files.
- Exemplar for the assertion style: `tests/contracts.test.mjs:69-85` (`SKIN_REQUIRED`) and `:291-300` ("a skin declares the capabilities it fills") — mechanical, per-skin, naming the exact missing or wrong piece.

## Changes

1. `src/plugins/skins/gitlab/as-gitlab.css:53-54`
   - Change: `--gs-radius-sm: 4px;` → `--gs-radius-sm: var(--gs-radius-md);` (keep `--gs-radius-md: 4px;` and `--gs-radius-lg: 8px;` untouched).
   - Preserve: every consumer, including `--borderRadius-small` at `:221` and `--gl-border-radius-sm` in `sources/gitlab/tokens.css:58`; rendering is identical.
   - Verify: no radius rendering changes anywhere; the declaration now reads as one step with an alias.

2. `src/plugins/skins/bitbucket/as-bitbucket.css:54-55`
   - Change: `--gs-radius-sm: 3px;` → `--gs-radius-sm: var(--gs-radius-md);` (keep `--gs-radius-md: 3px;`).
   - Preserve: `--ds-radius-small` / `--ds-radius-medium` in `sources/bitbucket/tokens.css:72-73` and the direct consumer at `as-bitbucket.css:283`.
   - Verify: no rendering change; alias declared.

3. `src/plugins/skins/github/as-github.css:31` and `:80`
   - Change: `--gs-border-muted: #d1d9e0;` → `--gs-border-muted: #d1d9e0b3;` and `--gs-border-muted: #3d444d;` → `--gs-border-muted: #3d444db3;`
   - Preserve: `--gs-border` (`#d1d9e0` / `#3d444d`), which stays the normal tier and is used by every bordered surface in the skin.
   - Verify: `--gl-border-color-subtle` on a GitLab source, and `--color-timeline` / `--color-expand-button` on a Gitea source, now render lighter than the default border while the github skin is active; nothing else moves, because nothing else reads the muted tier in this skin.

4. `tests/contracts.test.mjs` (new test beside `describe('skin contract')`)
   - Change: parse each skin's palette blocks and assert (a) no two adjacent steps of a declared scale carry the same literal unless one is declared as `var()` of the other, and (b) no `--gs-*-muted` token equals its base token. Message must name the skin, the mode and the token pair, in the style of the existing `missing.push(...)` checklist.
   - Preserve: the existing suites; this test is additive.
   - Verify: the test passes after changes (1)-(3) and fails if a skin reintroduces a silent duplicate step.

## Scope

- Inherit: every consumer of the aliased or restored tokens; no consumption site needs editing because the token names and (for radius) values are unchanged.
- Verify: `src/plugins/sources/*/tokens.css` mappings that read these tiers — `sources/gitlab/tokens.css:34,58-60`, `sources/gitea/tokens.css:45-46`, `sources/bitbucket/tokens.css:38,72-74`; the parity fixtures in `tests/fixtures/target-chrome.json`, since the github muted border changes pixels on GitLab and Gitea sources.
- Exclude: the github skin's radius scale (already three distinct steps); any change to `--gs-radius-lg`; any attempt to give the bitbucket and gitlab skins different vendor radii — that is a separate, vendor-verified decision (see Stop conditions).

## Validation

- Product: a GitLab source and a Gitea source wearing the github skin, checking subtle borders and timelines; a GitHub source wearing the gitlab and bitbucket skins, checking control radii.
- Interface: light and dark for each skin; a repo page (tabs, boxes, controls) and a profile page (rail, timeline), where the muted border is most visible.
- System: `grep -n 'gs-radius-sm' src/plugins/skins/*/as-*.css` shows the alias form in gitlab and bitbucket; `grep -n 'gs-border-muted' src/plugins/skins/github/as-github.css` shows the alpha values.
- Repository: `npm test` → passes; `npm run parity:judge` (and `npm run style-parity` / `npm run layout-parity` if the maintainer runs them) should show no unintended delta beyond the github muted-border restoration on GitLab/Gitea sources.

## Stop conditions

- Stop if a vendor check shows GitLab or Atlassian genuinely wants sm == md as a *value* rather than an alias: then keep the duplicate literals and record the exception in the new token test's allow-list with a comment naming the vendor scale, rather than forcing an alias.
- Stop if the alpha muted border breaks the parity gates or a fixture: revert change (3) and file the border-tier question separately, since changes (1), (2) and (4) are independent.

## Design documentation

- After acceptance and validation: record in each skin's palette comment that the radius scale is two steps plus a large (alias declared where sm == md), and that `--gs-border-muted` is the subtler tier and must never equal `--gs-border`. Destination: the section comment above each palette block, matching the existing explanatory style.

## Reconciliation (execution note)

**Verification performed:**
- `node --test tests/contracts.test.mjs` → 29 pass, 0 fail.
- Negative test: `--gs-radius-md` in the github skin changed to `4px` so it
  equalled `--gs-radius-sm` → `a scale declares its steps, and a tier that
  repeats says so` fails; file restored byte-identical.
- `npm test` → 349 tests, 100% coverage on `src/plugins/`.
- `npm run parity` (the committed rubric, offline) → **byte-identical** to the
  pre-change baseline: every cell, project and profile.
- `npm run build:chromium` and `npm run build:firefox` → both build.
- `npm run lint:js`, `npm run fmt:check` → clean.

**Not verified here, and why:** `npm run style-parity` and `npm run
layout-parity` launch a real browser against **live** forge pages, so they are
the project's on-demand checks rather than commit gates (their own header says
so). A before/after comparison needs `dist/` built in a clean checkout; the
attempt timed out. The offline half of that gate —
`tests/compare/target-chrome.test.mjs` — passes unchanged, and it is the
assertion that pins the skins to `tests/fixtures/target-chrome.json`. The
consumers of the changed tokens (`--gl-border-color-subtle`,
`--color-timeline`, `--color-expand-button`) are borders and timelines, which
none of the rubric's six dimensions (theme, layout, header, body, link, vocab)
measures. Run the style-parity tool when a browser and the forges are
convenient, and expect the only delta to be the github skin's muted border on
GitLab and Gitea sources.

**Scope note:** change (3) gives the github skin's muted border an alpha
(`#d1d9e0b3` / `#3d444db3`), which is what makes it a *different* tier rather
than a duplicate. The contract test permits the alpha form for exactly this
reason; if a maintainer prefers solid values, the alternative is to alias
`--gs-border-muted: var(--gs-border)` and accept that the subtler tier does not
exist in that skin.
