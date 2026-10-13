# Reorient the GitHub repo nav on the column layouts

Written against: `43920d2a369131b14070d3766357ee7fdaab2d5a`

## Evidence chain

- Surface: the shared layout layer `src/themes/ux-nav.css` (the `as-gitlab` section), the GitHub source's selector `src/plugins/sources/github/index.js`, and the `navRules` of both column-layout skins `src/plugins/skins/{gitlab,bitbucket}/index.js`.
- Problem: the rules that turn GitHub's horizontal repo tab bar into a vertical sidebar match **only** `nav[aria-label="Repository"] ul.UnderlineNav-body`. GitHub's repo nav has moved to a `prc-components-*` container, so on the live page the sidebar is never built and the nav keeps its native `flex-direction: row`. Measured live, off-diagonal, by `node tools/compare/style-parity.mjs --checks`:

  | Cell | layout | score |
  | --- | :--: | :--: |
  | project `github → gitlab` | **0.00** | 7.5 |
  | project `github → bitbucket` | **0.00** | 7.8 |
  | profile `github → gitlab` | 1.00 | 10.0 |
  | profile `github → bitbucket` | 1.00 | 9.8 |

  The same pair scores 1.00 on profile pages, where a different rule orients the profile nav — so the defect is scoped to the **repo** nav on **project** pages, not to the skins generally.

- Design evidence — the repository already knows about the migration and hedges for it in three places, but not in the four that matter:
  - `src/plugins/skins/gitlab/as-gitlab.css:329` — *"GitHub's signed-in repo nav moved to `prc-components-UnderlineItem`, so the old `.UnderlineNav-item` rules below no longer reached it. Both are listed"* — the **active-tab indicator** was updated; the **layout** rules were not.
  - `src/plugins/sources/github/parity.mjs:26-30` — the parity locator already tries the generic fallback:
    ```js
    nav: [
      'nav[aria-label="Repository"] ul.UnderlineNav-body',
      'nav[aria-label="Repository"] ul',        // ← matches today's markup
    ],
    ```
    So the *measuring* tool finds the nav (that is why the cell is scored at all) while the *styling* rules do not.
  - `src/plugins/sources/github/parity.mjs:15` — `ready: '.UnderlineNav-item, .prc-components-UnderlineItem'` — the readiness selector likewise covers both generations.

  The four sites that still carry the stale selector only:

  | Site | What it drives |
  | --- | --- |
  | `src/themes/ux-nav.css:103` | the page grid that makes room for the sidebar |
  | `src/themes/ux-nav.css:111,119,120,126,138` | the vertical list, its rows, links and hover |
  | `src/themes/ux-nav.css:144` | a selector list that includes it |
  | `src/plugins/skins/gitlab/index.js:124` | the reorder rule that ranks the tabs |
  | `src/plugins/skins/bitbucket/index.js:137` | the same for the Bitbucket skin |
  | `src/plugins/sources/github/index.js:117` | `repoNavList`, the canonical hook |

  And two tests *enforce* the stale value: `src/plugins/sources/github/github.test.mjs:17` (`assert.match(SELECTORS.github.repoNavList, /UnderlineNav-body/)`) and `src/plugins/skins/gitlab/gitlab.test.mjs:69` (`assert.match(github.container, /UnderlineNav-body/)`).
- Owner: `src/themes/ux-nav.css` for the geometry, the two skin plugins for the reorder rules, the GitHub source for the canonical selector.
- Scope and affected surfaces: a GitHub source wearing the GitLab or Bitbucket skin, on project pages. Gitea and GitLab sources use different containers (`overflow-menu .overflow-menu-items`, `.super-sidebar`) and are untouched; Gerrit is untouched.
- Uncertainty: the exact class GitHub will use next. The generic `ul` under `nav[aria-label="Repository"]` is the same fallback the measuring tool already uses, so it is the least speculative choice; the stop condition below covers a future change.

## Design decision

Widen the repo-nav selector to cover both generations, expressed once and reused, rather than adding a second block of rules next to the first.

The in-house convention for "either of these" already exists: `src/plugins/sources/github/index.js:115` declares `appHeader: 'header[role="banner"], .AppHeader'` — a comma-separated pair in one string. Use that convention for `repoNavList`, then make the six consumers read it instead of re-typing it:

```js
repoNavList:
  'nav[aria-label="Repository"] ul.UnderlineNav-body, nav[aria-label="Repository"] ul',
```

In CSS, replace the bare `nav[aria-label="Repository"] ul.UnderlineNav-body` in `themes/ux-nav.css` with the same comma-separated list (the list is valid in every position the current selector occupies, including inside the `:has()` at line 47-56 and the descendant selectors). In the two skins' `navRules`, replace the hard-coded `container` string with the source's selector, so a container can never again drift between the source and its skins:

```js
{ source: 'github', container: SELECTORS.github.repoNavList, item: 'li' }
```

`lib/skins.js:56-60` already validates that every `navRules` entry names a registered source and has a container, so a mis-wired value fails at load with the skin named.

Do not widen further (for example to any `nav ul`): the anchor `nav[aria-label="Repository"]` is what keeps the rule scoped to the repo nav, and dropping it would reorient unrelated lists.

## Reuse

- `repoNavList` — the existing canonical hook in `src/plugins/sources/github/index.js:117`, already the single place the source names its repo nav.
- `appHeader: 'header[role="banner"], .AppHeader'` — the existing "either of these" convention in the same object (line 115).
- `src/plugins/sources/github/parity.mjs:26-30` — the measuring tool's two-entry `nav` locator; the plan aligns the styling selectors to what the tool already believes.
- `src/plugins/skins/gitlab/as-gitlab.css:329-348` — the exemplar for covering both generations: the active-tab indicator lists `.UnderlineNav-item` **and** `prc-components-UnderlineItem`, with a comment saying why. Follow that shape (list both, comment the reason).
- Exemplar for a test that accepts either: `src/plugins/sources/github/github.test.mjs:17` becomes `/UnderlineNav-body|<ul>/` rather than being deleted.

## Changes

1. `src/plugins/sources/github/index.js:117`
   - Change: `repoNavList: 'nav[aria-label="Repository"] ul.UnderlineNav-body', // css` → the comma-separated pair above, keeping the `// css` marker.
   - Preserve: every other selector in the object, and the `from`/`pages` blocks.
   - Verify: `SELECTORS.github.repoNavList` matches both the legacy list and the current one.

2. `src/themes/ux-nav.css:47-56, 103-150`
   - Change: replace the six bare `nav[aria-label="Repository"] ul.UnderlineNav-body` occurrences with the comma-separated list. Add one comment above the first one naming the reason (GitHub moved the nav to a `prc-components-*` container; both generations are listed, matching the active-tab indicator in `as-gitlab.css`).
   - Preserve: the grid, the `display: contents` wrapper rule, the row/link/hover declarations, and the Gitea/GitLab blocks.
   - Verify: a GitHub project page wearing the GitLab or Bitbucket skin renders the repo nav as a vertical column beside the repo header.

3. `src/plugins/skins/gitlab/index.js:124`
   - Change: `container: 'nav[aria-label="Repository"] ul.UnderlineNav-body'` → `container: SELECTORS.github.repoNavList`, importing the source's selectors the way the file already reaches `plugins/core.js`.
   - Preserve: `source: 'github'`, `item: 'li'`, the `order` derivation, and the Gitea rule beside it.
   - Verify: `NAV_RULES.gitlab` still ranks GitHub's tabs, and now reaches the current markup.

4. `src/plugins/skins/bitbucket/index.js:137`
   - Change: the same substitution.
   - Preserve: the GitLab and Gitea rules beside it, `keep`, and `projectTabs`.
   - Verify: the Bitbucket skin reorders GitHub's repo tabs again.

5. `src/plugins/sources/github/github.test.mjs:17` and `src/plugins/skins/gitlab/gitlab.test.mjs:69`
   - Change: accept either generation — `/UnderlineNav-body|nav\[aria-label="Repository"\] ul/` — with a comment naming the migration, so the test documents the hedge instead of pinning the legacy value.
   - Preserve: the rest of both assertions.
   - Verify: `npm run test:unit` passes; the test now fails if *both* generations are dropped.

## Scope

- Inherit: every consumer of `SELECTORS.github.repoNavList` — the sidebar rules, both skins' reorder rules, and any future consumer, which now gets the hedge for free.
- Verify: a Gitea and a GitLab source under both skins (their containers are different; the change must not reach them), and a GitHub project page under the GitHub skin (`html.gs-layout-github` — the sidebar rules are `gs-layout-gitlab`-scoped, so the GitHub skin is unaffected).
- Exclude: the active-tab indicator rules in `as-gitlab.css:336-348` (already cover both generations); the profile-nav rules (`layout` already 1.00 there); the Gerrit and Gitea containers; any change to `navWords`/vocabulary tables.

## Validation

- Product: open `github.com/<owner>/<repo>` with the GitLab skin applied, then with the Bitbucket skin applied; confirm the repo tabs are a vertical sidebar and the repo header sits above the content.
- Interface: signed-in GitHub (the migration is signed-in, per the `as-gitlab.css:329` comment), a repo with many tabs, and a repo with few; narrow viewport where the sidebar must not overflow.
- System: `grep -rn 'UnderlineNav-body' src/` returns only the comma-separated lists and their comments; `grep -rn 'nav\[aria-label="Repository"\] ul\.UnderlineNav-body$' src/` returns nothing bare.
- Repository: `npm test` → 349+ pass with 100% coverage; `npm run lint:js`, `npm run fmt:check` clean; **`node tools/compare/style-parity.mjs --checks`** (live) → `project github → gitlab` and `project github → bitbucket` show `layout 1` instead of `0`, and the project-family mean rises for both column skins.

## Stop conditions

- Stop if the live check still reports `layout 0` after the change: GitHub has moved the nav again, and the correct move is to read the current markup from the live page (the tool's own `nav` locator in `sources/github/parity.mjs` is the place that knows) rather than to guess a third selector.
- Stop if widening the selector reorients a nav that is not the repo nav on some page: keep the legacy-only rule scoped to `ul.UnderlineNav-body` and add the generic rule under the same `nav[aria-label="Repository"]` anchor, so the two generations stay distinguishable.

## Design documentation

- After acceptance and validation: record in `src/themes/ux-nav.css` (the `as-gitlab` section header) and in `src/plugins/sources/github/index.js` that the repo-nav selector covers two generations of GitHub markup, why, and that a skin's `navRules` container must be read from the source's selector rather than re-typed.
