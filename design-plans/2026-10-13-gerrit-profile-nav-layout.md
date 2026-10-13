# Orient Gerrit's profile nav with the applied layout

Written against: `43920d2a369131b14070d3766357ee7fdaab2d5a`

## Evidence chain

- Surface: `src/content/ux-project.js`, `gerritViewCss(t)` — the stylesheet that lays out the skin's rebuilt Gerrit profile page (`[data-gs-gerrit-view]`), adopted into PolyGerrit's shadow root.
- Problem: the rebuilt profile nav is a horizontal tab strip under **every** skin, so on the two column layouts the tool measures it as `row` where the target is `column`. Live, off-diagonal, from `node tools/compare/style-parity.mjs --checks`:

  | Cell | layout | score |
  | --- | :--: | :--: |
  | profile `gerrit → gitlab` | **0.00** | 8.0 |
  | profile `gerrit → bitbucket` | **0.00** | 8.0 |
  | profile `gerrit → github` | 1.00 | 10.0 |
  | project `gerrit → gitlab` | 1.00 | 9.3 |
  | project `gerrit → bitbucket` | 1.00 | 9.3 |

  The same source scores 1.00 on the GitHub skin and on its own project pages, so the defect is scoped to the **profile** nav under the **column** layouts.
- Design evidence — the same file already gets this right twice, and the rule in question contradicts both:
  1. The header nav (`paintGerritNav`, `ux-project.js:610-624`) is direction-aware:
     ```js
     const direction = t === 'github' ? 'row' : 'column';
     nav.setAttribute('data-gs-gerrit-nav', '');
     gerritNavSheets.adopt(
       root,
       `[data-gs-gerrit-nav]{display:flex !important;flex-direction:${direction} !important;}`,
     );
     ```
     That is why `gerrit → github` is 1.00 and why the project cells are 1.00.
  2. `gerritViewCss` **itself** is already skin-aware, and its non-GitHub branch styles the tabs as sidebar *rows* rather than tabs (`ux-project.js:980-984`):
     ```js
     : 'a{padding:6px 12px !important; … border-radius:var(--gs-radius-md) !important;}' +
       'a[aria-current]{background:var(--gs-accent-subtle) !important;color:var(--gs-accent) …}';
     ```
     A rounded, background-filled item is a sidebar row's treatment; GitHub's tab strip is the only branch with `border-bottom` on the anchor.
  3. But the **container** those rows sit in is a tab strip (`ux-project.js:996-998`):
     ```js
     '[data-gs-gerrit-content]>nav[data-gs-gerrit-profile-nav]{display:flex !important;' +
     'flex-wrap:wrap !important;gap:4px !important;' +
     'border-bottom:1px solid var(--gs-border) !important;margin:0 0 24px !important;}'
     ```
     `flex-wrap: wrap` and a `border-bottom` are a horizontal strip's furniture. The rule is not parameterised by `t`, so the rows styled for a column are laid out as a row.

  A contradiction inside one rule set, on the same element, is the contract: the tab styling says column, the container says row.
- Owner: `src/content/ux-project.js`, `gerritViewCss`.
- Scope and affected surfaces: a Gerrit source wearing the GitLab or Bitbucket skin, on an owner-query page. The GitHub skin keeps its strip; Gerrit project pages and every non-Gerrit source are untouched.
- Uncertainty: none about the contradiction. One thing the plan cannot prove offline is the rendered result, because Gerrit is not a bundled host — `sources/gerrit/parity.mjs` grants an instance (`gerrit-review.googlesource.com`) for the duration of a run, so verification needs that host reachable.

## Design decision

Parameterise the container by the layout, exactly as `paintGerritNav` already does, and let each branch carry the furniture that belongs to it:

- `github` — keep the strip: `flex-direction: row; flex-wrap: wrap; border-bottom`.
- `gitlab` / `bitbucket` — make it a column: `flex-direction: column; align-items: stretch;` with the wrapping and the bottom border dropped, so the rounded, accent-filled rows already styled in the non-GitHub branch read as a vertical list of nav items (the shape both targets use for a profile's secondary nav).

Reuse the existing expression rather than inventing a second one: `t === 'github' ? 'row' : 'column'` is already the file's way of naming this decision, twice. No new marker, no new element, no change to the furniture the profile rail is built from.

## Reuse

- `paintGerritNav`'s `direction` (`ux-project.js:610`) — the existing primitive naming the layout decision; the adopted sheet pattern (`gerritNavSheets.adopt`) is the existing mechanism for reaching into a shadow root.
- `gerritViewCss(t)`'s existing `t === 'github' ? … : …` branch (`:974-984`) — the tab treatment already differs per layout; the container now follows it.
- The `[data-gs-gerrit-profile-nav]` marker (`:1717`, `:996`) — the element the tool measures; no new attribute is needed.

## Changes

1. `src/content/ux-project.js:996-998`
   - Change: replace the single horizontal container rule with a direction-aware pair, keeping the `margin: 0 0 24px` and the shared properties:
     - `github`: `display:flex !important; flex-direction:row !important; flex-wrap:wrap !important; gap:4px !important; border-bottom:1px solid var(--gs-border) !important;`
     - otherwise: `display:flex !important; flex-direction:column !important; align-items:stretch !important; gap:2px !important;` (no `flex-wrap`, no `border-bottom`)
   - Preserve: every other declaration in `gerritViewCss`, the two tab treatments, the grid areas (`rail` / `content`), and the `[data-gs-ux-skip]` markers `paintGerritSubjectHeader` sets on the nav.
   - Verify: on a Gerrit owner-query page wearing the GitLab or Bitbucket skin, the profile nav is a vertical list of tabs; under the GitHub skin it is unchanged.

2. `src/content/ux-project.js` — no other change
   - The tab anchors already have the per-layout treatment (rounded + accent-subtle background for column, underline for row), so a vertical container needs no further styling. If the vertical list looks cramped against the `border-radius`, adjust `gap` only — do not add borders.

## Scope

- Inherit: both column-layout skins, on Gerrit owner-query pages only.
- Verify: the GitHub skin's strip is byte-identical in behaviour (same rule text as before), and a Gerrit *project* page — where the header nav is oriented by `paintGerritNav` — is untouched.
- Exclude: `paintGerritNav` (already correct); the Gerrit rail (`gerritRailCss`), which is already a grid column; every non-Gerrit source; any change to `GERRIT_PROFILE_FURNITURE`.

## Validation

- Product: open a Gerrit owner query (`/q/owner:…`) with the GitLab skin, then the Bitbucket skin, then the GitHub skin; confirm the profile tabs are a vertical list for the first two and a strip for the third.
- Interface: a profile with many tabs (where `flex-wrap: wrap` currently wraps the strip onto a second line) and one with few; a narrow viewport, where the column must not overflow the content grid.
- System: `grep -n "flex-wrap" src/content/ux-project.js` shows it only in the GitHub branch.
- Repository: `npm test` → 349+ pass, 100% coverage; `npm run lint:js`, `npm run fmt:check` clean; **`node tools/compare/style-parity.mjs --checks`** → `profile gerrit → gitlab` and `profile gerrit → bitbucket` report `layout 1`, lifting both cells to 10.0 and the profile family for bitbucket from 9.1 to ~9.6 and for gitlab from 8.4 to ~8.9.

## Stop conditions

- Stop if the live run cannot reach `gerrit-review.googlesource.com`: verify only what is provable offline (the rule is parameterised the same way `paintGerritNav` is, which is proven on project pages) and record the result as structurally correct, visually unverified — do not "fix" by guessing at a different selector.
- Stop if the vertical list collides with the `rail` grid area or the `≠ Gerrit` markers: that is a layout regression elsewhere and needs its own change, not a tweak to this rule.

## Design documentation

- After acceptance and validation: record in `gerritViewCss`'s comment that the profile nav follows the applied layout — strip for `github`, list for the column layouts — and that a container's furniture (`flex-wrap`, `border-bottom`) belongs to the layout, not to the element.
