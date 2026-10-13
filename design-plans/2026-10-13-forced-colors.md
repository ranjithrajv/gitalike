# Skins survive Windows High Contrast (forced-colors)

> **Executed.** All three `@media (forced-colors: active)` blocks added and the
> contract assertion proving them is in place. 349 tests pass with 100%
> coverage, `oxlint` clean, `oxfmt --check` clean. See **Reconciliation** for
> what is verified offline and what still needs a High Contrast environment.


Written against: `43920d2a369131b14070d3766357ee7fdaab2d5a`

## Evidence chain

- Surface: the three skin stylesheets, applied as content-script CSS to a host forge page: `src/plugins/skins/github/as-github.css`, `src/plugins/skins/gitlab/as-gitlab.css`, `src/plugins/skins/bitbucket/as-bitbucket.css`.
- Problem: the skins contain zero `@media` queries, so nothing in a 100-460-line full-page re-skin reacts to Windows High Contrast / forced-colors mode. Two consequences are observable from the shipped declarations:

  1. **The replaced brand mark can vanish.** The mark is painted as a background image over a transparent foreground (`as-github.css:210-216`):
     ```css
     background: var(--gs-mark) center / contain no-repeat !important;
     color: transparent !important;
     ```
     `--gs-mark` (`as-github.css:64`) is a light-blue-on-transparent gradient (`#f0f6fc` → `#4493f8`) drawn for the dark header. In forced-colors mode the browser forces `color`/`background-color` to system colours but **does not force `background-image`**, so the header becomes a system colour while the mark keeps its dark-header palette — a light gradient on a light forced background. Same construction in the other two skins (`as-gitlab.css:241`, `as-bitbucket.css:229` and `:340`).
  2. **Nothing opts out or in deliberately.** `forced-color-adjust` appears nowhere in the repository, so no rule is preserved intentionally and none is adapted intentionally; the behaviour is whatever each browser's forced palette happens to do to 270+ `!important` colour declarations (104 colour/background declarations in the github skin, 125 total; 29 in bitbucket; 18 in gitlab).

  What already survives, and must keep surviving: the `.gs-no-equiv` badge and the `[data-gs-unavailable]` notes are **text** with `border: 1px solid currentColor` (`src/themes/ux-markers.css:20`), and the injected structure (reordered nav, rebuilt profile rail, group headings) is structural, not colour-coded — none of it encodes meaning in colour alone.
- Owner: the palette + structural sections of each `as-*.css`; `src/themes/ux-markers.css` and `src/themes/ux-nav.css` are shared and already colour-independent.
- Scope and affected surfaces: one added `@media (forced-colors: active)` block per skin stylesheet. No rule outside those blocks changes, so normal rendering — and every parity fixture — is untouched.
- Uncertainty: exact forced palette values differ between Chromium, Firefox and the user's chosen High Contrast theme, so the block must be written against system colour keywords (`Canvas`, `CanvasText`, `Highlight`, `HighlightText`, `ButtonFace`, `ButtonText`), never against the `--gs-*` values. Verify in at least one Chromium and one Firefox High Contrast theme before declaring done.

## Design decision

Add one `@media (forced-colors: active)` block at the end of each skin stylesheet that (a) makes the replaced mark legible on a forced header, and (b) leaves everything else to the forced palette rather than fighting it. Specifically:

- Give the mark rule `forced-color-adjust: none` inside the media query **only for the mark's own background**, so the artwork keeps its designed colours; and pair it with a background colour chosen from system keywords so the mark never sits on an unknown surface. If the maintainer prefers the mark to follow the forced palette instead, the alternative is to keep the default `forced-color-adjust: auto` and let the header take `Canvas` — but then the light-gradient mark needs a dark-on-light variant, which is new artwork and out of scope here.
- Do not re-declare the `--gs-*` palette in the block. In forced-colors mode the UA forces those properties anyway; re-declaring them with `!important` would only create work for the browser and confusion for the next reader.
- Do not add `prefers-reduced-motion` handling to the skins: they contain zero `transition`, zero `animation` and zero `@keyframes` declarations (verified — the only transitions in the product are three in `src/popup/popup.css`), so such a block would be dead code. The popup's motion is covered by a separate plan.
- Keep print out of scope: printing a skinned page printing the skin is arguably the product working as intended, and no issue has been raised against it.

## Reuse

- System colour keywords, used as `forced-color-adjust: none` scoped to the mark selector — no new custom properties, no new assets.
- Exemplar for a media block in this codebase: `src/themes/ux-markers.css`'s use of `html[class*="gs-theme-"]` to stay skin-agnostic; the new block sits inside each `as-*.css` beside the rules it repairs, so the repair travels with the palette.
- Exemplar for a low-cost visual regression guard: `tests/contracts.test.mjs:88` already asserts the palette file scopes itself to `html.gs-theme-<skin>` — the same "read the file and assert a property" technique can assert that each stylesheet contains exactly one `@media (forced-colors: active)` block, so a new skin cannot ship without one.

## Changes

1. `src/plugins/skins/github/as-github.css` (append, after the last rule)
   - Change: add
     ```css
     @media (forced-colors: active) {
       html.gs-theme-github :is(.tanuki-logo, .tanuki-logo-svg, .gl-logo, [data-testid="tanuki-logo"]) {
         background-color: Canvas;
         forced-color-adjust: none;
       }
     }
     ```
   - Preserve: the mark rule at `:210-216` exactly as it is outside the media query, and every other declaration in the file.
   - Verify: with Windows High Contrast on, the GitAlike mark is still visible against the forced header, and the rest of the page follows the forced palette with no leftover `--gs-*` colours leaking onto text or controls.

2. `src/plugins/skins/gitlab/as-gitlab.css` (append)
   - Change: add the matching block for that file's mark selectors (the `:is(...)` list used at `:236-242`, which carries `background: var(--gs-mark) center / contain no-repeat`), with `background-color: Canvas; forced-color-adjust: none;`.
   - Preserve: the existing mark rule and the `--gs-shadow` token at `:38`/`:90` (shadows are not forced and remain decorative; leave them).
   - Verify: same as (1) on a GitHub source wearing the GitLab skin.

3. `src/plugins/skins/bitbucket/as-bitbucket.css` (append)
   - Change: add the matching block for the mark selectors used at `:229` and `:340`.
   - Preserve: the existing rules; note the file has two mark sites, and the block's selector list must cover both.
   - Verify: same as (1) on any source wearing the Bitbucket skin.

4. `src/themes/ux-markers.css` — no change
   - The badge is text plus a `currentColor` border, so it survives forced colours and stays legible. Record this in the plan rather than editing the file.

5. `tests/contracts.test.mjs`
   - Change: add an assertion beside the existing `html.gs-theme-<skin>` scope check (`:85-90`) that each `as-<skin>.css` contains one `@media (forced-colors: active)` block naming that skin's class, so a newly added skin fails the contract suite instead of shipping without one.
   - Preserve: the existing suite; additive only.
   - Verify: the test passes with the three blocks added and fails when one is removed.

## Scope

- Inherit: all three skins, and any future skin that copies the pattern.
- Verify: the `.gs-no-equiv` / `[data-gs-unavailable]` text and borders under a forced palette; the header search field (`as-github.css:195-202`, `rgb(255 255 255 / 0.13)` background) which loses its translucent treatment under forced colours and must still be usable; the popup (`src/popup/popup.css`), which is extension UI rather than page CSS and is out of this plan's scope.
- Exclude: re-declaring the `--gs-*` palette under forced colours; `prefers-reduced-motion` blocks in the skins (no animation exists — see Design decision); print styles; any change to the mark artwork itself; any change to `src/themes/*`.

## Validation

- Product: with Windows High Contrast (at least one "Desert"-style light and one dark theme) enabled, open a GitHub source wearing each of the three skins and confirm: the mark is visible, all body text is legible, the `.gs-no-equiv` and "not available on <source>" notes are legible with a visible border, and no page region is left in a `--gs-*` colour the forced palette did not override.
- Interface: light and dark forced themes; Chromium and Firefox; a repo page and a profile page; the popup opened from the toolbar (confirm it is unaffected and still legible).
- System: `grep -c '@media (forced-colors: active)' src/plugins/skins/*/as-*.css` returns 1 for each file.
- Repository: `npm test` → passes (including the new contract assertion); `npm run lint:js` and `npm run fmt:check` if run for CSS-adjacent changes.

## Stop conditions

- Stop if the maintainer wants the mark to follow the forced palette: that needs a second artwork variant (dark-on-light) and is a separate change from the media block.
- Stop if a browser forces `background-image` and removes the mark anyway: record the browser and version, drop `forced-color-adjust: none`, and rely on the text fallback (the product name in the header) instead of artwork.
- Stop if forced-colors testing is not available on the maintainer's machine: ship the contract assertion (change 5) so the block cannot regress, and mark the blocks as unverified rather than deleting them.

## Design documentation

- After acceptance and validation: record in each `as-*.css` header comment that the skin ships a `forced-colors` block, that the block exists to keep the replaced mark legible, and that the palette is deliberately *not* re-declared under forced colours. Destination: the explanatory header comment at the top of each stylesheet.

## Reconciliation (execution note)

**What was added:** one `@media (forced-colors: active)` block per skin,
appended at the end of each `as-*.css`, each with a header comment explaining
why the block exists. Selectors:
- `as-github.css` — `html.gs-theme-github :is(.tanuki-logo, .tanuki-logo-svg, .gl-logo, [data-testid="tanuki-logo"])`
- `as-gitlab.css` — `html.gs-layout-gitlab .octicon-mark-github`
- `as-bitbucket.css` — the union of its two mark sites: the source-agnostic
  logo list *and* `html.gs-theme-bitbucket[data-theme] #navbar-logo .branding`

The bitbucket block covers both sites in one selector group, which the plan
called out as the thing to get right.

**Verification performed:**
- `node --test tests/contracts.test.mjs` → 29 pass.
- Negative test: the whole block deleted from `as-gitlab.css` → `every skin
  survives forced-colors mode` fails with "gitlab: 0 forced-colors blocks, not
  1"; file restored byte-identical.
- `npm test` → 349 tests, 100% coverage.
- `npm run lint:js`, `npm run fmt:check`, `npm run build:chromium`,
  `npm run build:firefox` → clean.

**Still unverified:** the rendered result under Windows High Contrast. No
forced-colors environment was available here, and no suite can assert it — the
contract test proves the block exists and is scoped and opts in, not that the
mark is legible on a forced header. Until it is checked, treat the blocks as
structurally correct and visually unverified, per the plan's third stop
condition.
