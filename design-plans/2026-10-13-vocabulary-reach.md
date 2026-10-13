# Carry the applied product's navigation words to every source

Written against: `43920d2a369131b14070d3766357ee7fdaab2d5a`

## Evidence chain

- Surface: the skin vocabulary tables (`phrases`, `nav`, `labels`, `chrome`, `groups`, `profileMenu`, `projectTabs`) and the content passes that apply them, measured by `tools/compare/style-parity.mjs`.
- Problem: `vocab` (weight **2.0**) is below 1.00 in eleven off-diagonal cells. Exact missing words, from one structured run (`--json`), diffing the located nav's labels against `PROJECT_VOCAB`/`PROFILE_VOCAB` in `tools/compare/style-recipes.mjs` (each skin's word list comes from its own `parity.mjs`):

  **Project pages**

  | Cell | Score | Missing |
  | --- | :--: | --- |
  | `bitbucket → github` | 0.20 | Code, Actions, Insights, Projects |
  | `bitbucket → gitlab` | 0.40 | CI/CD, Analytics, Issue boards |
  | `gerrit → bitbucket` | 0.67 | Pipelines |
  | `gerrit → github` | 0.40 | Actions, Insights, Projects |
  | `gerrit → gitlab` | 0.40 | CI/CD, Analytics, Issue boards |
  | `gitea → gitlab` | 0.80 | Analytics |
  | `github → gitlab` | 0.80 | Issue boards |

  **Profile pages**

  | Cell | Score | Missing |
  | --- | :--: | --- |
  | `bitbucket → github` | 0.40 | Overview, Packages, Stars |
  | `bitbucket → gitlab` | 0.25 | Activity, Groups, Starred projects, Snippets, Followers, Following |
  | `gitea → bitbucket` | 0.50 | Overview, Snippets |
  | `gitea → github` | 0.60 | Overview, Stars |
  | `gitea → gitlab` | 0.00 | Activity, Groups, Contributed projects, Personal projects, Starred projects, Snippets, Followers, Following — all of them |

- Design evidence — three distinct root causes, and they are not the same fix:
  1. **The nav is not reached at all.** For `github → gitlab` and `github → bitbucket` the words the skins *do* have (`Analytics`, `Issue boards` are both in the gitlab skin's `nav` table) never appear, because the pass that rewrites the nav never fires — the stale container selector. This is the same defect as `2026-10-13-layout-reorient-github-nav.md`, and fixing it should lift these two cells with no vocabulary work.
  2. **The wrong element is measured.** On Bitbucket profile pages the located nav's labels were `Atlassian uses cookies…`, `Atlassian cookies and tracking notice` — a consent surface and the footer, not the repo or profile nav. That is `2026-10-13-parity-measurement-determinism.md`, not a missing word: the skin's own `paintBitbucketNav` marks `[data-gs-bb-nav]` and the tool's selector list prefers it, so once the consent surface stops being read the cell may already pass.
  3. **Genuinely missing entries.** `gitea → gitlab` profile is 0.00 with labels `Members26, Issue boards0, Packages1 1, Repositories20` — Gitea's *repo* nav words on a *profile* page, i.e. the gitlab skin's rebuilt profile menu was not found. And `gitea → bitbucket`/`gitea → github` are missing exactly the first and last items of their word lists (`Overview`, `Stars`, `Snippets`), which are the profile-menu items the skin rebuilds — so the rebuilt menu is present but not the one measured, or is missing entries.
- Owner: the three skins' vocabulary tables and the content passes.
- Scope and affected surfaces: vocabulary only; layout and colour are separate plans.
- Uncertainty: which of the three causes drives each cell, because (2) currently masks (3). Sequence matters: determinism first, then the GitHub-nav plan, then this one — otherwise this plan's evidence table changes under it.

## Design decision

Fix vocabulary in the order the causes allow, and only where a real counterpart exists:

1. **Land the two gating plans first** (`parity-measurement-determinism`, `layout-reorient-github-nav`), then re-run `--json` and re-derive the missing words from this table. Do not write vocabulary entries against evidence that the measurement is about to change.
2. **For words with a counterpart**, add the entry to the right table, not to all of them: `phrases` for text that can appear in prose, `nav` for whole labels inside a navigation region, `labels` for control labels, `chrome` for account-menu wording, `groups`/`projectTabs`/`profileMenu` for structures the skin rebuilds. The gitlab skin's own files document this split — `labels` exists precisely so `Merge`/`Rebase` stay out of prose.
3. **For words with no counterpart**, mark them, do not translate them. The product already has the honest mechanism: `unmapped` + the `≠ <product>` marker (`tests/contracts.test.mjs:104-112`, `themes/ux-markers.css`) and `hide` for a destination the applied product has no page for. A word that cannot be mapped and is left untranslated is a *correct* result the score penalises — those cells are the ceiling, and the plan must say so rather than chase them.
4. **Where the rebuilt menu is the missing piece**, fix the pass, not the table: the gitlab skin's `profileMenu` emits `Activity/Groups/Contributed projects/Personal projects/Starred projects/Snippets/Followers/Following` — all eight words — so a 0.00 cell means the rebuilt menu was not found on a Gitea profile page.

## Reuse

- The skins' own vocabulary tables, split by scope as their comments describe (`phrases` / `nav` / `labels` / `chrome` in `skins/gitlab/index.js:26-77`).
- `paintBitbucketNav` and `paintGiteaProfile` (`src/content/ux-project.js`) — the passes that mark the rebuilt nav for the stylesheet; the profile-menu rebuild is `profileMenu` in each skin.
- The `≠ <product>` marker (`themes/ux-markers.css`) and `unmapped` — the existing way the product says "this feature does not exist here".
- `PROJECT_VOCAB` / `PROFILE_VOCAB` in `tools/compare/style-recipes.mjs` — the word lists the score uses, already per-skin and per-page.

## Changes

1. Gate: `2026-10-13-parity-measurement-determinism.md` and `2026-10-13-layout-reorient-github-nav.md` land and merge first.
   - Change: none in this plan until they do.
   - Verify: `node tools/compare/style-parity.mjs --json` re-run; the table above re-derived from its output.
   - Why: two of the three causes disappear into other plans, and the 0.00/0.25 cells are currently measured through a consent surface.

2. `src/plugins/skins/gitlab/index.js` — `profileMenu`, `nav`, `groups`
   - Change: for the words that survive step 1 (expected: `Analytics`, `Issue boards` on github/gitea sources, and the profile-menu words on a Gitea profile page), confirm each has an entry and add the missing ones; for a word with no counterpart, add it to `unmapped` so it is *marked* rather than silently wrong.
   - Preserve: the existing split between `phrases`, `nav`, `labels` and `chrome`, and every existing entry.
   - Verify: `gitea → gitlab` profile and `github → gitlab` project reach 1.00, or every remaining word is named in `unmapped`.

3. `src/plugins/skins/github/index.js` — `nav`, `chrome`, `hide`
   - Change: the same for `Code, Actions, Insights, Projects` (project) and `Overview, Packages, Stars` (profile) on Bitbucket and Gerrit sources — add the entry, or mark the item `≠ GitHub` where the source has no such page.
   - Preserve: the existing `hide` list (20 entries) and `topbarHide`.
   - Verify: `bitbucket → github` and `gerrit → github` reach 1.00 or every remaining word is marked.

4. `src/plugins/skins/bitbucket/index.js` — `keep`, `projectTabs`, `profileMenu`
   - Change: `Pipelines` on Gerrit (the single missing word in `gerrit → bitbucket`), and the profile-menu items Gitea's page does not carry (`Overview`, `Snippets`) — either the pass emits them or they are marked unavailable.
   - Preserve: `keep` (the whitelist that deliberately hides non-Bitbucket items) and `projectTabs`.
   - Verify: `gerrit → bitbucket` and `gitea → bitbucket` reach 1.00 or the residual is marked.

5. `src/content/ux-project.js` — the pass, where the table is not the problem
   - Change: if the re-derived table shows a rebuilt menu that exists but is not measured (the `gitea → gitlab` profile pattern), make the rebuild mark its nav the way `paintBitbucketNav` marks `[data-gs-bb-nav]`, so the tool's selector list finds it first.
   - Preserve: every existing marker and the `data-gs-ux-skip` attributes.
   - Verify: the located nav on that cell is the rebuilt menu, not the source's own.

## Scope

- Inherit: every source × skin cell in both page families.
- Verify: no existing vocabulary entry is weakened — a word that scores today must keep scoring (`npm test` pins the skins' tables through `NAV`, `PHRASES` and friends).
- Exclude: layout, header/body colour, the fixture's word lists (those come from each skin's `parity.mjs` and are the *target's* vocabulary, not the skin's), and any attempt to translate a word the applied product genuinely lacks.

## Validation

- Product: one page per source per skin, reading the nav aloud against the vendor's real page.
- Interface: project and profile; a repo with many tabs; a profile with many tabs.
- System: `node --input-type=module -e "…"` against `GITALIKE_SKINS.SKINS` to print each skin's table sizes; the diff should show only intended additions.
- Repository: `npm test` → 349+ pass, 100% coverage; `npm run lint:js`, `npm run fmt:check` clean; **`--json`** re-run and the missing-word table re-derived: every row either empty or fully explained by an `unmapped` entry.

## Stop conditions

- Stop if a missing word has no counterpart in the applied product: do not translate it. Mark it and record the cell's ceiling (e.g. "0.80 is this skin's maximum on a Gitea source until Gitea has that destination").
- Stop if the re-derived table still shows consent-surface or footer labels: the determinism plan did not land; do not write vocabulary against unmeasured evidence.
- Stop if closing a word requires the source's shadow DOM to be walked (PolyGerrit's text, per `sources/gerrit/index.js`: "Copy and navigation *inside* the shadow roots are not reached yet… they need the app's roots opened at `document_start`, which is a separate step") — that is a separate, larger plan.

## Design documentation

- After acceptance and validation: record in each skin's `index.js` that a missing vocabulary entry is either a table entry (a real counterpart) or an `unmapped` entry (a marked absence), and that the score's word list is the *target's* vocabulary from `parity.mjs`, so a low score is a finding about the pass, not automatically about the table.
