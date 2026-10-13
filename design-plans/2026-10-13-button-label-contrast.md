# Primary/confirm button labels meet WCAG AA in every mode

Written against: `43920d2a369131b14070d3766357ee7fdaab2d5a`

> **Executed.** The Changes below were applied and verified: 340 tests pass with
> 100% coverage, `oxlint --deny-warnings` clean, `oxfmt --check` clean.
> `tests/skin-contrast.test.mjs` is new and was proven to fail on both
> regression shapes (a token reverted to `#ffffff`, and a rule reverted to a
> literal label). One correction was made during execution and is recorded
> under **Reconciliation**.

## Evidence chain

- Surface: `src/plugins/skins/github/as-github.css` (confirm buttons, Gitea primary buttons), `src/plugins/skins/gitlab/as-gitlab.css` (primary button + hover), `src/plugins/skins/bitbucket/as-bitbucket.css` (primary/confirm buttons)
- Problem: each of these rules pairs a hardcoded `color: #ffffff !important` with a background that comes from a token which flips between the light and dark palette. The pair is only accessible in light mode.
- Design evidence: measured contrast of the shipped pairs (script in the audit that produced this plan; ratios computed per WCAG 2.x relative luminance):

  | Rule | Fill token | Light value | Dark value | White-on-fill light | White-on-fill dark |
  | --- | --- | --- | --- | --- | --- |
  | `as-github.css:136-138` (`.btn-confirm`, `.gl-button.btn-confirm`, `.btn.btn-confirm`, `button[data-testid="base-button"][data-variant="confirm"]`) | `--gs-success` | `#1a7f37` | `#3fb950` | 5.08:1 ✔ | 2.54:1 ✘ |
  | `as-github.css:377-379` (`html.gs-theme-github[data-theme]` Gitea primary) | `--gs-success` | `#1a7f37` | `#3fb950` | 5.08:1 ✔ | 2.54:1 ✘ |
  | `as-gitlab.css:354-356` (`html.gs-layout-gitlab :is(.Button--primary, .btn-primary)`) | `--gs-accent` | `#1f75cb` | `#428fdc` | 4.70:1 ✔ | 3.39:1 ✘ |
  | `as-gitlab.css:359-361` (same rule `:hover` — only the background changes, the white label is inherited) | `--gs-accent-hover` | `#0b5cad` | `#6fb0f0` | 6.67:1 ✔ | 2.30:1 ✘ |
  | `as-bitbucket.css:256-258` (`html.gs-theme-bitbucket :is(.Button--primary, .btn-primary, .btn-confirm, …)`) | `--gs-accent` | `#0052cc` | `#579dff` | 6.82:1 ✔ | 2.74:1 ✘ |

- Owner: the three `as-*.css` palettes. Every rule above is a full-page-re-skin override (`!important`) applied by a content script, so the host page cannot repair the pair.
- Scope and affected surfaces: `src/plugins/skins/github/as-github.css`, `src/plugins/skins/gitlab/as-gitlab.css`, `src/plugins/skins/bitbucket/as-bitbucket.css`. Runtime paths: a GitHub source wearing the GitLab or Bitbucket skin (rules 3 and 5), and a GitLab/Gitea source wearing the GitHub skin (rules 1 and 2). A GitHub source wearing the GitLab skin also matches rule 4.
- Uncertainty: none for the measurement. One design choice needs the maintainer's call (see Design decision) between a dark-ink label and a vendor-faithful darker fill.

## Design decision

Introduce two label tokens — `--gs-on-accent` and `--gs-on-success` — declared in each skin's light and dark palette block, and use them wherever a fill token carries a text label. This removes the root cause (a fixed literal foreground against a mode-flipping background) instead of patching each rule with a mode-specific literal.

Recommended values, each verified ≥ 4.5:1 on the fill it sits on:

| Skin | Mode | `--gs-on-accent` | `--gs-on-success` |
| --- | --- | --- | --- |
| github | light | *(not declared — no rule paints an accent fill)* | `#ffffff` (5.08:1 on `#1a7f37`) |
| github | dark | *(not declared — see Reconciliation)* | `#0d1117` (7.45:1 on `#3fb950`) |
| gitlab | light | `#ffffff` (4.70:1 on `#1f75cb`) | n/a (no rule paints a success fill) |
| gitlab | dark | `#1f1e24` (4.88:1 on `#428fdc`) | n/a |
| bitbucket | light | `#ffffff` (6.82:1 on `#0052cc`) | n/a |
| bitbucket | dark | `#1d2125` (5.92:1 on `#579dff`) | n/a |

The dark-mode values follow each vendor's own dark-mode pairing: Bitbucket/Atlassian dark uses bright fills with dark ink, and dark ink on a bright green is the accessible pairing for the GitHub skin's success fill. If the maintainer prefers to keep white labels, the alternative is to darken the *fills* (`--gs-success` dark `#3fb950` → `#238636` = 4.63:1 with white; `--gs-accent` dark `#428fdc` → `#1f75cb` = 4.70:1 with white). That alternative also changes the badge/indicator use of the same tokens, so it is the larger change and needs a separate decision; do not mix the two approaches in one plan.

Declare the tokens in both blocks of each skin even where a skin currently uses only one, so a future rule that paints the other fill inherits an accessible label. **(Corrected during execution — see Reconciliation: a token that no fill paints is not declared at all.)**

## Reuse

- `--gs-on-accent` / `--gs-on-success`: new tokens in the existing `--gs-*` palette family, declared beside `--gs-accent` / `--gs-success` in each skin's palette block (`as-github.css:18-65` light, `:67-96` dark; `as-gitlab.css:3-55` light, `:57-91` dark; `as-bitbucket.css:7-53` light, `:55-84` dark).
- Exemplar for the pattern: the existing `--gs-header-bg` / `--gs-header-fg` pair in the same blocks — a fill token with a sibling label token, consumed as `background-color: var(--gs-header-bg); color: var(--gs-header-fg)` (`as-github.css:163-164`).
- Why not reuse an existing token: no existing `--gs-*` token is a "colour that sits on a fill". `--gs-fg`/`--gs-fg-muted` are surface colours and fail on the fills; `--gs-header-fg` is scoped to the header.

## Changes

1. `src/plugins/skins/github/as-github.css`
   - Change: add `--gs-on-success: #ffffff;` to the light block and `--gs-on-success: #0d1117;` to the dark block. Do **not** declare `--gs-on-accent` in this skin (see Reconciliation). Replace `color: #ffffff !important;` with `color: var(--gs-on-success) !important;` at the confirm rule and at the Gitea primary rule.
   - Preserve: the rule's selector lists, fill tokens, `border-color: transparent`, and the Gitea `[data-theme]` gate. The header search field's own `color: #ffffff` is unrelated (it sits on a translucent white over the dark header) and must stay literal.
   - Verify: the confirm button and the Gitea primary button show a dark-green label on the green fill in dark mode, white in light mode; contrast ≥ 4.5:1 in both.

2. `src/plugins/skins/gitlab/as-gitlab.css`
   - Change: add `--gs-on-accent` (`#ffffff` light, `#1f1e24` dark) beside `--gs-accent` in both palette blocks. Replace `color: #ffffff !important;` at line 356 with `color: var(--gs-on-accent) !important;`.
   - Preserve: the hover rule at lines 359-361 sets only the background, so the label token is inherited — leave the selector and the fill untouched.
   - Verify: the primary button's label is dark ink in dark mode at rest and on hover (4.88:1 and 7.20:1), white in light mode (4.70:1 / 6.67:1).

3. `src/plugins/skins/bitbucket/as-bitbucket.css`
   - Change: add `--gs-on-accent` (`#ffffff` light, `#1d2125` dark) beside `--gs-accent` in both palette blocks. Replace `color: #ffffff !important;` at line 258 with `color: var(--gs-on-accent) !important;`.
   - Preserve: the selector list, which intentionally covers both Atlassian (`.Button--primary`) and GitLab-family (`.btn-confirm`, `.gl-button.btn-confirm`, `button[data-testid="base-button"]`) markup on the same page.
   - Verify: the primary/confirm button label is dark ink on `#579dff` in dark mode (5.92:1).

4. `src/plugins/skins/gitlab/as-gitlab.css` — note only, no edit
   - The primary-button rule is keyed on `html.gs-layout-gitlab`, and `src/plugins/skins/bitbucket/index.js:23` declares `layout: 'gitlab'`, so the rule also matches while the Bitbucket skin is active. Both rules then paint the same accent + white pair, so this plan's token change keeps both paths correct. Do not "fix" the shared selector in this plan.

## Scope

- Inherit: every rule that consumes `--gs-on-accent` / `--gs-on-success`; the hover state of the GitLab primary button, which inherits the label from the base rule.
- Verify: other consumers of `--gs-accent` as a fill. As of this commit there are none besides the rules above (`background-color: var(--gs-accent)` appears at `as-bitbucket.css:256` and `as-gitlab.css:354`; `as-github.css` never paints an accent fill — its primary is green). The `--gs-mark` data-URI rules and `--gs-accent-subtle` badge backgrounds are decorative and carry `--gs-fg`, not a button label; leave them.
- Exclude: `--gs-success` used as *text* (badge and indicator colour), the `as-gitlab.css:342` `::after` underline (`--gs-purple`, decorative, no text), and any change to the fill tokens themselves (see Design decision).

## Validation

- Product: on a GitHub source wearing the GitLab skin, and a GitLab or Gitea source wearing the GitHub skin, click into a page with a primary and a confirm button; read the label colour.
- Interface: light mode and dark mode for each of the three skins; rest and hover on the GitLab primary button; a GitHub source page and a Gitea/Codeberg page under the GitHub skin (`html.gs-theme-github[data-theme]`).
- System: confirm the new tokens are declared in both mode blocks of each skin and that no rule still carries a literal `#ffffff` label on an accent/success fill (`grep -n 'color: #ffffff' src/plugins/skins/*/as-*.css` should return nothing on the button rules).
- Repository: `npm test` → all suites pass, coverage still 100%. Add a contrast assertion alongside `tests/contracts.test.mjs` that parses each palette block and asserts every `--gs-on-*` value reaches 4.5:1 on its paired fill in both modes; `node --test` must fail when a pair regresses.

## Stop conditions

- Stop if the maintainer chooses the fill-darkening alternative: that changes `--gs-success` / `--gs-accent` values, which also feed badge, indicator and marker colours, and needs its own plan covering those consumers.
- Stop if a rule is found that paints an accent/success fill and cannot take a token (for example a UA-controlled native control); report it instead of forcing the change.

## Reconciliation (execution note)

**What changed from the plan as written:** the github skin does not declare `--gs-on-accent` in either mode. The plan asked for it "so a future rule that paints the other fill inherits an accessible label", with the value `#ffffff`.

**Why:** the first execution declared it, and the new contrast test immediately failed on `--gs-on-accent: #ffffff` over `--gs-accent: #2f81f7` at 3.75:1 in dark mode — no rule paints an accent fill in that skin, so the token was speculative *and* broken. Declaring a passing value (`#0d1117`, 5.05:1) would have kept the test green while shipping a token nobody can use yet, and a future rule using it would have to override the value it inherited anyway. The codebase's own convention settles it: `lib/skins.js:88-93` and `SKIN_CAPABILITIES` publish only what a skin declares, and `tests/contracts.test.mjs:291-300` asserts "a skin declares the capabilities it fills" rather than filling defaults that are never read.

**Consequence for a future rule:** if a rule ever paints an accent fill in the github skin, it must declare `--gs-on-accent` in both blocks at that point, and the contrast test will reject any value below 4.5:1 on the fill it labels.

**Verification performed:**
- `node --test tests/skin-contrast.test.mjs` → 8 pass, 0 fail.
- Negative test 1: `--gs-on-success: #0d1117` reverted to `#ffffff` → `github dark: every labelled fill clears 4.5:1` fails.
- Negative test 2: a rule's `color: var(--gs-on-success)` reverted to `color: #ffffff` → `no rule writes a literal label over a token fill` fails.
- `npm test` → 340 tests, 100% line/branch/function coverage on `src/plugins/`.
- `npm run lint:js` and `npm run fmt:check` → clean.


## Design documentation

- After acceptance and validation: record in `docs/` (or the skin file header, following each file's existing comment style) that button label colours come from `--gs-on-accent` / `--gs-on-success`, that a fill token never carries a literal label colour, and that AA 4.5:1 on the fill is the shipped floor. No other doc edit.
