# Marker, "unavailable" and group-heading text meet WCAG AA

Written against: `43920d2a369131b14070d3766357ee7fdaab2d5a`

> **Executed.** Changes (1)-(5) applied as written, plus the design
> documentation the plan asks for. 347 tests pass with 100% coverage, `oxlint`
> clean, `oxfmt --check` clean. Two things were found or corrected during
> execution — see **Reconciliation**.

## Evidence chain

- Surface: `src/themes/ux-markers.css`, `src/themes/ux-nav.css` — the injected "no counterpart", "not available on <source>" and nav group-heading text that every skin paints.
- Problem: these rules colour real text with `--gs-fg-subtle`, a token that measures below 4.5:1 on canvas in every skin, in one or both modes.
- Design evidence: measured ratios (WCAG 2.x relative luminance) of `--gs-fg-subtle` on `--gs-canvas`, per skin and mode, against the proposed replacement `--gs-fg-muted`:

  | Skin | Mode | `--gs-fg-subtle` on canvas | `--gs-fg-muted` on canvas |
  | --- | --- | --- | --- |
  | github | light `#818b98` / `#ffffff` | **3.45:1 ✘** | `#59636e` → 6.11:1 ✔ |
  | github | dark `#6e7681` / `#0d1117` | **4.12:1 ✘** | `#9198a1` → 6.50:1 ✔ |
  | gitlab | light `#89888d` / `#ffffff` | **3.52:1 ✘** | `#737278` → 4.77:1 ✔ |
  | gitlab | dark `#8b8a91` / `#1f1e24` | 4.84:1 ✔ | `#a4a3aa` → 6.62:1 ✔ |
  | bitbucket | light `#7a869a` / `#ffffff` | **3.68:1 ✘** | `#5e6c84` → 5.31:1 ✔ |
  | bitbucket | dark `#8c9bab` / `#1d2125` | 5.70:1 ✔ | `#9fadbc` → 7.08:1 ✔ |

  On `--gs-canvas-subtle` the failing cases are worse: github light 3.24:1 (`#818b98` on `#f6f8fa`) versus 5.74:1 for `#59636e`; bitbucket light 3.37:1 versus 4.87:1; gitlab light 3.38:1 versus 4.58:1.

  Affected text, with sizes that put them in the normal-text (non-large-text) AA band:
  - `src/themes/ux-markers.css:20` — `.gs-no-equiv` badge, `font-size: 10px; font-weight: 600`, plus `border: 1px solid currentColor`.
  - `src/themes/ux-nav.css:697` — `[data-gs-unavailable]` inside `.super-sidebar`, 14px, `!important`.
  - `src/themes/ux-nav.css:1043` — `[data-gs-unavailable]`, 14px, `!important`.
  - `src/themes/ux-nav.css:283` and `:1231` — `.gs-nav-group` headings, 11px, `font-weight: 600`, uppercase, `letter-spacing: 0.04em`.

- Root cause: `--gs-fg-subtle` is dual-purpose. It is also the disabled / placeholder / "tertiary" tier in every source bridge — `src/plugins/sources/gitlab/tokens.css:12,21,54` (`--gl-text-color-disabled`, `--gl-text-color-tertiary`, `--gl-control-placeholder-color`), `src/plugins/sources/bitbucket/tokens.css:23,24,47` (`--ds-text-subtlest`, `--ds-text-disabled`, `--ds-icon-disabled`), `src/plugins/sources/gitea/tokens.css:35,37` (`--color-text-light-3`, `--color-placeholder-text`) — and `as-gitlab.css:125,134,187,206` / `as-bitbucket.css:118,127`. Disabled and placeholder text is exempt from AA, which is very likely why a sub-threshold value was acceptable to ship. `as-github.css` maps nothing to `--gs-fg-subtle` at all (it appears only as a definition at `:28` and `:77`), so in the GitHub skin the token exists purely to colour this text.
- Owner: `src/themes/ux-markers.css` and `src/themes/ux-nav.css`, which are skin-agnostic (`html[class*="gs-theme-"]`) and read whichever skin's palette is active.
- Scope and affected surfaces: the two theme files above, on every page wearing any of the three skins. No skin palette value changes, so no source bridge and no parity fixture is affected.
- Uncertainty: none. Both candidate replacement tokens are already declared in all three skins in both modes, and every measured pair passes.

## Design decision

Point the five text rules at `--gs-fg-muted` — the existing secondary-text tier — instead of `--gs-fg-subtle`, and leave `--gs-fg-subtle` to the disabled / placeholder / tertiary mappings where it belongs. This is a reuse decision, not a new primitive: `--gs-fg-muted` already exists in every palette block, already means "secondary text", and passes AA on canvas and canvas-subtle in all six palette variants. Keeping the two tiers honest is what makes the markers legible without disturbing any disabled-control styling.

Do not raise `--gs-fg-subtle` itself: it would lighten disabled and placeholder text on every source, which is a different (and mostly cosmetic) change with its own consumers.

## Reuse

- `--gs-fg-muted`: defined at `as-github.css:27` / `:76`, `as-gitlab.css:12` / `:66`, `as-bitbucket.css:16` / `:64`.
- Exemplar: `as-github.css:172` and `:185` use `color: var(--gs-header-fg)` for header text; the theme files already follow the same "read a `--gs-*` tier" pattern at `themes/ux-nav.css:283` and `:1231` without a literal fallback.
- The existing `var(--gs-fg-subtle, #8b8a91)` fallbacks become `var(--gs-fg-muted, #737278)` — the GitLab light value, matching the current fallback's intent of a neutral mid-grey. Keep the fallback form so the rules stay safe if a future skin forgets the tier.

## Changes

1. `src/themes/ux-markers.css:20`
   - Change: `color: var(--gs-fg-subtle, #8b8a91);` → `color: var(--gs-fg-muted, #737278);`
   - Preserve: the badge's geometry, `border: 1px solid currentColor`, `pointer-events: none` and `user-select: none`, and the `html[class*="gs-theme-"]` gate that makes it skin-agnostic.
   - Verify: the `≠ GitLab` badge reads at ≥ 4.5:1 on both canvas and canvas-subtle in every skin and mode, and its border tracks the same colour.

2. `src/themes/ux-nav.css:697`
   - Change: `color: var(--gs-fg-subtle, #8b8a91) !important;` → `color: var(--gs-fg-muted, #737278) !important;`
   - Preserve: the `!important` (it must beat the host page's sidebar colour), `display: inline-block`, `padding`, `white-space: nowrap` and `cursor: default`.
   - Verify: "not available on <source>" notes in a super-sidebar render at ≥ 4.5:1.

3. `src/themes/ux-nav.css:1043`
   - Change: same substitution as (2).
   - Preserve: `display: inline-flex`, `align-items: center`, `padding`, `white-space: nowrap`, `cursor: default`, and the `!important`.
   - Verify: the rebuilt project-tab unavailable notes render at ≥ 4.5:1.

4. `src/themes/ux-nav.css:283`
   - Change: `color: var(--gs-fg-subtle);` → `color: var(--gs-fg-muted);`
   - Preserve: `font-size: 11px`, `font-weight: 600`, `letter-spacing: 0.04em`, `margin`/`padding`, and the surrounding Gitea nav-group selector.
   - Verify: Gitea repo-nav group headings read at ≥ 4.5:1.

5. `src/themes/ux-nav.css:1231`
   - Change: same substitution as (4).
   - Preserve: the uppercase heading treatment and the surrounding selector.
   - Verify: the second group-heading family reads at ≥ 4.5:1.

## Scope

- Inherit: any future rule in `src/themes/` that needs legible secondary text now has a passing tier to reach for.
- Verify: the source bridges that consume `--gs-fg-subtle` (`sources/{gitlab,bitbucket,gitea}/tokens.css`) are untouched and still resolve; the `.gs-no-equiv` badge border, which uses `currentColor`, changes colour with the text — confirm it still reads as a hairline, not a box.
- Exclude: `--gs-fg-subtle`'s own values and all disabled/placeholder mappings; the `opacity: 0.65` unavailable markers in `src/themes/ux-markers.css` (they blend to 4.66-4.98:1 light and 7.72:1 dark and already pass); the group-heading font treatment; any change to `--gs-fg-muted`.

## Validation

- Product: open a GitHub source wearing the GitLab skin (renders `[data-gs-unavailable]` notes and group headings) and any source that surfaces `.gs-no-equiv` badges (`tests/fixtures/target-chrome.json` covers the reviewed marker cases).
- Interface: all three skins × light and dark, on canvas and on a subtle surface (cards, insets) since the markers appear in both; a narrow viewport where the badges wrap.
- System: `grep -rn 'gs-fg-subtle' src/themes/` returns nothing after the change; `grep -rn 'gs-fg-muted' src/themes/` returns the five rules.
- Repository: `npm test` → passes. Extend the contrast assertion added by the button-label plan (or add a sibling one) so every `--gs-*` text tier is asserted ≥ 4.5:1 against `--gs-canvas` and `--gs-canvas-subtle` in both modes, excluding the tokens explicitly reserved for disabled/placeholder (`--gs-fg-subtle`).

## Stop conditions

- Stop if a marker must stay visually recessive by design (for example a maintainer decision that the badge should read as a whisper): then keep `--gs-fg-subtle` and record the exception in `src/themes/ux-markers.css` with the measured ratio, rather than leaving it undocumented.
- Stop if a fourth palette variant appears (a new skin) that does not declare `--gs-fg-muted`: the plan must then also add the token to that skin.

## Design documentation

- After acceptance and validation: record in `src/themes/ux-markers.css` (header comment) and `src/themes/ux-nav.css` that injected text uses `--gs-fg-muted`, that `--gs-fg-subtle` is reserved for disabled/placeholder/tertiary text where AA does not apply, and that AA 4.5:1 on canvas and canvas-subtle is the shipped floor for injected text.

**Recorded** in both files' header comments (`src/themes/ux-markers.css` header block; `src/themes/ux-nav.css`, a new "Colour:" paragraph in the axes preamble).

## Reconciliation (execution note)

**Test precision.** The first version of the guard in `tests/skin-contrast.test.mjs` flagged any line containing the string `--gs-fg-subtle`. When the design documentation above was written — which names the token in order to forbid it — the test failed on the *prose*. The guard now matches `var(--gs-fg-subtle`, so it catches usage while letting a file document the prohibition. Re-proven: restoring `color: var(--gs-fg-subtle, #8b8a91)` in `ux-markers.css` fails the test; the documented form passes.

**A second site of the layout-comment drift.** `src/themes/ux-nav.css:12-14` carried the same wrong claim as `src/content/theme.js:47-49` — *"the GitHub/Bitbucket pair shares the github layout"* — when the sharing pair is gitlab + bitbucket (`github/index.js:21` is `layout: 'github'`; `bitbucket/index.js:23` is `layout: 'gitlab'`). Corrected here because this plan edits that file, and it sits four lines above the preamble this plan amends. `design-plans/2026-10-13-layout-comment-drift.md` must add this second site to its evidence when executed.

**Verification performed:**
- `node --test tests/skin-contrast.test.mjs` → 15 pass, 0 fail (8 from the button-label plan, 7 here).
- Negative test: a theme rule reverted to `var(--gs-fg-subtle, …)` → `no theme file reaches for the disabled tier` fails; file restored byte-identical.
- `npm test` → 347 tests, 100% coverage on `src/plugins/`.
- `npm run lint:js`, `npm run fmt:check` → clean.
- System grep per the plan: `grep -rn 'var(--gs-fg-subtle' src/themes/` → no matches; `grep -rn 'var(--gs-fg-muted' src/themes/` → 5 rules.

