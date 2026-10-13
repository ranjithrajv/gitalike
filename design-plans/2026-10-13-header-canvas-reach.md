# Carry the header and canvas colours to every source

Written against: `43920d2a369131b14070d3766357ee7fdaab2d5a`

## Evidence chain

- Surface: the three skin palettes' header and canvas tokens, and the per-source token bridges that carry them (`src/plugins/sources/*/tokens.css`), as measured by `tools/compare/style-parity.mjs`.
- Problem: the header and canvas colours reach some sources but not others, so `header` (weight **2.0**) and `body` (weight **1.0**) fail on the rest. From a single structured run (`--json`), off-diagonal:

  | Dimension | Target | Failing cells | Measured |
  | --- | --- | --- | :--: |
  | header | gitlab (`#fbfafd`) | `bitbucket → gitlab`, `gerrit → gitlab`, `gitea → gitlab`, `github → gitlab` (project + profile) | **0.88** |
  | header | github (`#25292e`) | `bitbucket → github`, `gerrit → github`, `gitea → github`, `gitlab → github` (project + profile) | **0.20** |
  | body | bitbucket (`#ffffff`) | `gitea → bitbucket`, `github → bitbucket` (project + profile) | **0.91** |
  | body | gitlab (`#ffffff`) | `bitbucket → gitlab`, `gerrit → gitlab`, `gitea → gitlab`, `github → gitlab` (project + profile) | **0.96** |
  | body | github (`#ffffff`) | none | 1.00 |

  The bitbucket skin's header is 1.00 in every cell, so the pattern is not "the tool cannot read headers" — it is that each skin's header rule reaches the markup of the source it was written for and stops there.
- Design evidence — the mechanism, per skin:
  - **github skin** — `--gs-header-bg` (`as-github.css:45`, `:94`) is applied to GitLab and Gitea chrome (`:163`, `:348-350`, `--color-nav-bg`, `--color-header-wrapper` in `sources/gitea/tokens.css`). On an Atlassian or PolyGerrit page the header element is a different node (`header[data-layout-slot="true"]`, `gr-main-header`) and no rule reaches it, so it keeps the source's own bar colour — hence 0.20 against `#25292e`.
  - **gitlab skin** — `as-gitlab.css:211-212` maps Primer's `--color-header-bg` / `--color-header-text` (GitHub pages) and `:263` paints a structural rule; the near-miss 0.88 rather than 0.20 says the rule *mostly* reaches, and the residual is a colour distance worth one digit of the score.
  - **bitbucket skin** — `as-bitbucket.css:209` paints the header directly with `background-color: var(--gs-header-bg) !important` and its bridge covers both `--ds-*` and `--color-*`, which is why it scores 1.00 everywhere.

  So the github skin needs what the bitbucket skin already has: a header rule that does not depend on the source's own header class, and a bridge entry per source's header variable.
- Owner: the three `as-*.css` headers, and the source bridges.
- Scope and affected surfaces: header and canvas only. `link` and `vocab` are other plans; layout is two others.
- Uncertainty: **the github-skin 0.20 is not yet trusted.** An earlier run of the same command measured header **1.00** for those cells. The variance is the subject of `2026-10-13-parity-measurement-determinism.md`, which must land first; the gitlab-skin 0.88 and the body 0.91/0.96 were stable across both runs and can be fixed now.

## Design decision

Give each source's header and canvas a mapping to the skin's tokens, in the source's own bridge, so a skin never has to know a source's markup:

- `sources/gitea/tokens.css` already maps `--color-header-wrapper` — point it at `--gs-header-bg` for the two skins whose header is not `--gs-canvas-subtle` (bitbucket and github), instead of the shared `--gs-canvas-subtle` every skin gets today.
- Add the missing header mapping for the two sources that have none: Atlassian's bar (`--ds-surface-*` / `[data-layout-slot]`) and Gerrit's (`gr-main-header`, reached the way `paintGerritNav` reaches it, via the root custom properties its `sources/gerrit/tokens.css` already re-points).
- Where a source paints its canvas on an inner node, map that node's variable to `--gs-canvas` rather than `--gs-canvas-subtle`, which is what the 0.96 near-misses come from.

The bitbucket skin is the exemplar: one direct `background-color: var(--gs-header-bg)` plus a bridge that names both token families. Copy that shape, do not invent a third approach.

## Reuse

- `as-bitbucket.css:209` — the direct header paint that scores 1.00 in every cell.
- `sources/gitea/tokens.css` — the existing shared bridge, whose `--color-header-wrapper` line is the single place the Gitea header colour is decided.
- `sources/gerrit/tokens.css` — the existing root-custom-property bridge (custom properties inherit across the shadow boundary, per `sources/gerrit/index.js`).
- `--gs-header-bg` / `--gs-canvas` — the tokens every skin already declares in both modes.

## Changes

1. `src/plugins/sources/gitea/tokens.css`
   - Change: replace the shared `--color-header-wrapper: var(--gs-canvas-subtle) !important;` with a per-skin value — `var(--gs-header-bg)` for the github and bitbucket skins, `var(--gs-canvas-subtle)` for gitlab — keeping the `html[data-theme]:is(.gs-theme-gitlab, .gs-theme-github, .gs-theme-bitbucket)` scope.
   - Preserve: every other mapping in the file, and the gitlab skin's own `--color-header-wrapper` override (`as-gitlab.css` keeps its intent).
   - Verify: a Gitea page under the github and bitbucket skins carries the skin's header colour; under gitlab it is unchanged.

2. `src/plugins/sources/bitbucket/tokens.css`
   - Change: add the Atlassian header-surface mapping to `--gs-header-bg` (and its text colour to `--gs-header-fg`) beside the existing `--ds-*` block, so the bar follows the skin rather than Atlassian's own blue.
   - Preserve: `--ds-border-focused`, `--ds-text-subtlest`, `--ds-radius-*` and the rest.
   - Verify: `bitbucket → github` header stops reading Atlassian blue on a GitHub-skinned page.

3. `src/plugins/sources/gerrit/tokens.css`
   - Change: map the root property the PolyGerrit header reads (`--header-background-color`, or the one `paintGerritNav` already touches) to `--gs-header-bg`, so Gerrit's bar follows the skin the way its text already does.
   - Preserve: the palette entries the file already re-points.
   - Verify: a Gerrit page under any skin has the skin's header colour; the `--primary-text-color` override in `paintGerritNav` still wins for the text.

4. `src/plugins/skins/gitlab/as-gitlab.css:211-212, 263`
   - Change: close the residual 0.88 by mapping the remaining header surface tokens to `--gs-header-bg` (the property the current mapping leaves behind), so the gitlab skin's header reaches the whole bar on a GitHub page.
   - Preserve: `--color-header-text`, the `color-scheme` pair, and the structural header rule at `:263`.
   - Verify: `github → gitlab` header reaches 1.00.

5. `src/plugins/sources/{gitea,bitbucket,gitlab}/tokens.css`
   - Change: point each canvas painting variable at `--gs-canvas` rather than `--gs-canvas-subtle` where the tool measures the content region — the gitlab skin's `body { background: var(--gs-canvas-subtle) }` (`as-gitlab.css:236-238`) is the clearest instance, since the fixture's gitlab canvas is `#ffffff`.
   - Preserve: `--gs-canvas-subtle` for surfaces that really are inset (cards, code, timelines).
   - Verify: the `body` dimension reaches 1.00 on `* → gitlab` and `gitea/github → bitbucket`.

## Scope

- Inherit: every source × skin cell, both page families.
- Verify: the header change must not repaint a source's header under the skin that already scores 1.00 (bitbucket) — run the whole live check and compare cell by cell.
- Exclude: `link` (its own plan), `vocab` (its own plan), layout (two existing plans), and the fixture itself — if the fixture's value is wrong for a product, that is a separate finding with its own provenance note.

## Validation

- Product: one page per source under each of the three skins, checking the top bar and the content background by eye against the vendor's real page.
- Interface: light and dark for each skin; signed-out pages (determinism plan first).
- System: `grep -n 'header' src/plugins/sources/*/tokens.css` shows an entry for every source; `grep -n 'gs-header-bg' src/plugins/skins/*/as-*.css` shows each skin declaring it in both mode blocks.
- Repository: `npm test` → 349+ pass; `npm run lint:js`, `npm run fmt:check` clean; **`node tools/compare/style-parity.mjs --checks`** → `header` and `body` report 1.00 in every off-diagonal cell.

## Stop conditions

- Stop until `2026-10-13-parity-measurement-determinism.md` has landed for the github-skin header cells: two runs disagree (1.00 vs 0.20), and painting a header to chase a measurement artefact would be a change made for the tool rather than the product. The gitlab-skin 0.88 and the body 0.91/0.96 are stable across both runs and are not gated.
- Stop if a source's real header cannot be re-pointed because it is drawn inside a closed shadow root: record the source as "header not reachable" in its bridge with the measured value, the way `sources/gerrit/index.js` already records what its palette does and does not reach.

## Design documentation

- After acceptance and validation: record in each source bridge that a source's header and canvas must be mapped to `--gs-header-bg` / `--gs-canvas`, so a new skin inherits the reach instead of re-learning it per source.
