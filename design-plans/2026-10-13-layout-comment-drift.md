# The layout-class comment names the pair that actually shares a layout

> **Executed.** The comment in `src/content/theme.js` now names the correct
> pair and points at the derived `LAYOUTS` table. No code changed. One of the
> four "actions" in this plan was already done by plan 2 — see
> **Reconciliation**.


Written against: `43920d2a369131b14070d3766357ee7fdaab2d5a`

## Evidence chain

- Surface: `src/content/theme.js` — the content script that keeps `gs-theme-*` and `gs-layout-*` classes on `<html>`.
- Problem: the comment explaining why layout classes exist names the wrong pair of skins, so a contributor reading it will write structural CSS against the wrong assumption.
- Design evidence:
  - `src/content/theme.js:47-49`: *"so structural CSS shared by two skins that have the same shape (GitHub and Bitbucket are both top bar + tab row) can be written once, against the layout, instead of per theme."*
  - The actual declarations: `src/plugins/skins/github/index.js:21` → `layout: 'github'`; `src/plugins/skins/gitlab/index.js:21` → `layout: 'gitlab'`; `src/plugins/skins/bitbucket/index.js:23` → `layout: 'gitlab'`.
  - So the skins that share a layout class are **gitlab and bitbucket** (left sidebar), and github is alone (top bar + tab row). The comment's *mechanism* is right — `LAYOUTS` at `theme.js:38-40` is derived from the skins table, so no list is hand-kept — but its example is inverted.

  The mechanism's correctness is what makes this a comment-only defect rather than a rendering one: `theme.js:41-54` derives `LAYOUTS` from `SITES.skins` and toggles `gs-layout-<name>` from the active skin's own `layout` value, so `html.gs-layout-gitlab` already matches exactly the gitlab and bitbucket skins, whichever way the comment reads.
- Owner: `src/content/theme.js` comment only.
- Scope and affected surfaces: none beyond the comment. Every rule that consumes `gs-layout-*` keeps working unchanged.
- Uncertainty: none — the three `layout:` values and the comment text are both in the tree at this commit.

## Design decision

Correct the parenthetical so it names the sharing pair, and state the derived nature of `LAYOUTS` in the same breath, because that is the property a contributor most needs (a new skin inherits the mechanism, not a hand-kept list). No code change: the behaviour is already correct, and changing it would alter which pages 20 existing `gs-layout-*` rules fire on.

## Reuse

- The comment style already used in this file (`theme.js:84-131`, which explains each forge's dark-mode marker and why the computed `color-scheme` fallback is deliberately not used).
- The existing `LAYOUTS` derivation at `theme.js:38-40` — the comment should point at it, not restate it.

## Changes

1. `src/content/theme.js:47-49`
   - Change: replace the parenthetical with: *(GitLab and Bitbucket are both a left sidebar; GitHub is the top bar + tab row)*, and add that `LAYOUTS` is derived from the skins table above, so a new layout needs no edit here.
   - Preserve: the `LAYOUTS` derivation code, the `gs-layout-<name>` toggle loop, and the rest of the file verbatim.
   - Verify: reading the comment, a contributor writes `html.gs-layout-gitlab` expecting it to match the gitlab and bitbucket skins — which is what the runtime does.

## Scope

- Inherit: nothing; this is documentation.
- Verify: `grep -rn 'gs-layout-' src/plugins/skins/*/as-*.css src/themes/*.css` — 20 consumers — is unchanged and still fires as before.
- Exclude: changing any `layout:` value; changing how `LAYOUTS` is derived; any rename of the `gs-layout-*` classes.

## Validation

- Product: none required — no behaviour changes.
- Interface: none.
- System: the comment matches the three `layout:` declarations; `LAYOUTS` still derives them.
- Repository: `npm run fmt:check` and `npm run lint:js` pass (comment-only edit).

## Stop conditions

- Stop if a maintainer considers the comment accurate under a different reading (for example "GitHub and Bitbucket are both *forges* with a top bar"): then instead of editing the comment, expand it to name all three layouts explicitly so no reading is ambiguous.

## Design documentation

- After acceptance: none beyond the corrected comment itself.

## Reconciliation (execution note)

**Already done by plan 2.** The second site this plan was written to find was
found and fixed while executing plan 2: `src/themes/ux-nav.css:12-14` carried
the same wrong claim ("the GitHub/Bitbucket pair shares the github layout") and
was corrected there, because plan 2 was editing that file anyway. So this plan's
Changes (1) — the `src/content/theme.js` comment — was the only work left, and
it is done.

**Verification performed:** comment-only edit; `npm test`, `npm run lint:js`
and `npm run fmt:check` clean; `npm run build:chromium` and
`npm run build:firefox` both build.

**Nothing else in the repo claims which pair shares a layout:**
`grep -rn 'gs-layout-' src --include='*.js'` now resolves every claim against
the three `layout:` declarations in the skin plugins, and the derived
`LAYOUTS` in `theme.js` is the only mechanism, not a hand-kept list.
