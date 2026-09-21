# UX parity

What gitalike matches between GitHub and GitLab beyond colour, and where the two
directions still differ. The tables themselves live in `src/lib/ux.js`; this file
is the map and the scorecard.

## Skins

A skin is a *target* UI — its key is the `html.gs-theme-<name>` class and its
stylesheet is `themes/as-<name>.css`. There are three: **GitLab**, **GitHub** and
**Bitbucket**. Bitbucket is both a target and a source — a Bitbucket host wears
the GitHub or GitLab UI, and any source can be pinned to the Bitbucket UI.
Gerrit is a source only. A skin
names the shape it is built to in `SITES.skins[<name>].layout` (`github` = top
bar + tab row, `gitlab` = left sidebar); Bitbucket's repo nav is a left
sidebar, so it reuses GitLab's layout, but its menu is flat — grouping follows
the skin, so it gets no GitLab group headings — and only its palette, words and
tab set differ. The directional tables below still describe the two-way pair;
Bitbucket's are in `src/lib/ux.js` under `bitbucket` and are covered by
`tests/ux.test.mjs`.

## Directions

- **G→L** — a GitHub-flavoured site shown with the GitLab UI
  (`html.gs-theme-gitlab`, `themes/as-gitlab.css`)
- **L→G** — a GitLab-flavoured site shown with the GitHub UI
  (`html.gs-theme-github`, `themes/as-github.css`)
- **→B** — any source shown with the Bitbucket UI
  (`html.gs-theme-bitbucket`, `themes/as-bitbucket.css`, layout `gitlab`)
- **B→G / B→L** — a Bitbucket source shown with the GitHub or GitLab UI. There
  are no Bitbucket selectors or nav rules yet (its page is a client-rendered SPA
  with no capturable public repository page), so the structure stays Bitbucket's;
  the palette is mapped from its Atlassian `--ds-*` tokens, and the
  source-agnostic passes — copy, control labels and reference markers — run on
  top.
- **Ger→G / Ger→L** — a Gerrit source shown with the GitHub or GitLab UI. Same
  vocabulary-only treatment as Bitbucket, and without even the reference-marker
  support: Gerrit identifies a change by number/Change-Id, not a `#`/`!` marker.

## Status

| Surface | G→L | L→G | Lives in |
| --- | :--: | :--: | --- |
| Colour tokens | ✅ | ✅ | `themes/*.css` |
| Structural CSS | ✅ 22 rules | ✅ 14 rules | `themes/*.css` |
| Own mark in the other palette | ✅ | ✅ | `--gs-mark` |
| Copy — `PHRASES` | ✅ 9 | ✅ 9 | `lib/ux.js` |
| Control labels — `LABELS` | ✅ 4 | ✅ 4 | `lib/ux.js` |
| Account/menu chrome — `CHROME` | ✅ 4 | ✅ 4 | `lib/ux.js` |
| No-counterpart markers — `UNMAPPED` | ✅ 3 | ✅ 15 | `lib/ux.js` |
| Nav labels — `NAV` | ✅ 5 | ✅ 5 | `lib/ux.js` |
| Nav reorder — `NAV_RULES` | ✅ 1 rule | ✅ 1 rule | `lib/ux.js` |
| Nav orientation | ✅ | ✅ | `themes/ux-nav.css` |
| Project tab strip | ✅ gathered into groups | ✅ rebuilt as GitHub's tabs | `content/ux-*.js` + `themes/ux-nav.css` |
| Project metadata placement | ✅ | ✅ | `themes/*.css` |
| Metadata heading | ✅ Project information | ✅ About | `content/ux-*.js` |
| Activity graph palette | ✅ GitLab indigo | ✅ GitHub green | `themes/ux-nav.css` |
| Profile metadata rail | ✅ About/Info/Contact | — | `content/ux-*.js` |
| One skin at a time | ✅ | ✅ | `popup/popup.js` |
| References — `refMarker` | ✅ | ✅ | `lib/ux.js` |
| Shortcuts — `SHORTCUTS` | ✅ 3 | ⚠️ 2 of 3 | `lib/ux.js` |
| "Open on the other host" | ✅ | ✅ | `lib/ux.js` + popup |

Legend: ✅ done · ❌ not built

**Codeberg (Forgejo)** and **gitea.com (Gitea)** are a third source product,
`gitea`. They are GitHub-flavoured, so they can wear either UI: under the GitLab
UI the repo tabs are rebuilt as a grouped sidebar, and under the GitHub UI as
GitHub's tab row. See [Codeberg / Gitea](#codeberg--gitea).

## Parity scoring

The status matrix above says *what exists*. This scores how much of the imitated
product's own surface a given source actually reproduces under each skin: the
weighted share of the target product's page that the skin matches, out of 10.
It is a coverage estimate, not a quality judgement, and it says nothing about
the source's own features — only how closely the applied UI reads as the product
it is pretending to be.

The score is derived from the tables in `src/lib/ux.js` and the pass gating in
`src/content/ux-*.js`, not measured. Each page type has its own rubric, a set of
weighted dimensions; a cell is the sum of (weight × share reproduced), rounded
to one decimal.

**Project pages** — palette & tokens 12; navigation orientation 18; nav labels
10; nav order 8; nav groups 6; nav keep/hide 10; metadata block & heading 12;
control labels 6; reference markers 5; no-counterpart markers 5; shortcuts 8.

**Profile pages** — palette & activity-graph palette 12; orientation 16; rebuilt
profile menu 20; identity/card reshape 12; pinned/landing heading 5; account
chrome 8; copy & control labels 8; no-counterpart markers 6; reference markers
5; shortcuts 8.

A source shown with its own UI is the native pair: no skin is painted, so every
dimension is satisfied and the score is 10.0. There is no `—`.
"Open on the other host" is left out of the score in both rubrics: it is
theme-independent, and it is absent on profiles by design.

`Codeberg` and `gitea.com` are the Gitea/Forgejo sources; `bitbucket.org` is the
Bitbucket source; Gerrit has no bundled host (its instances are added one origin
at a time from the popup).

### Project pages, sources × skins

| Source ↓ / Skin → | GitHub UI | GitLab UI | Bitbucket UI |
| --- | :--: | :--: | :--: |
| **GitHub** | 10.0 | 9.7 | 8.4 |
| **GitLab** | 9.7 | 10.0 | 8.4 |
| **Gitea / Forgejo** | 8.1 | 7.9 | 8.0 |
| **Bitbucket** | 3.6 | 3.0 | 10.0 |
| **Gerrit** | 2.2 | 1.6 | 2.2 |

### Profile pages, sources × skins

| Source ↓ / Skin → | GitHub UI | GitLab UI | Bitbucket UI |
| --- | :--: | :--: | :--: |
| **GitHub** | 10.0 | 9.9 | 6.7 |
| **GitLab** | 9.5 | 10.0 | 6.7 |
| **Gitea / Forgejo** | 5.0 | 5.0 | 4.3 |
| **Bitbucket** | 3.4 | 3.4 | 10.0 |
| **Gerrit** | 2.1 | 2.1 | 2.1 |

### Where the points are lost

- **GitHub → GitLab, project (9.7)** — the reference direction. It loses only on
  nav keep/hide, which is GitLab's hide-list rather than GitLab's full menu: a
  GitHub DOM cannot grow the destinations GitLab has and GitHub does not.
- **GitHub → Bitbucket, project (8.4)** — palette, nav words, order and the
  keep-list map, with Bitbucket's flat sidebar. The metadata is GitLab's block
  rather than a captured Bitbucket shape, no shortcut table exists for Bitbucket,
  and the issue-reference marker is partial.
- **GitLab → GitHub, project (9.7)** — a full rebuild; the only loss is `g n`
  (notifications ⇄ todos), which has no navigation link to click and so is
  G→L only.
- **GitLab → Bitbucket, project (8.4)** — the sidebar, tab words, order and
  keep-list map, with Bitbucket's flat menu. The metadata, reference and shortcut
  dimensions are partial for Bitbucket.
- **Gitea → GitHub (8.1) / GitLab (7.9)** — the repo nav is rebuilt or restyled
  and reordered, but Gitea's description and topics keep Gitea's placement and
  its own `g`-combos are left alone, costing the metadata and shortcut
  dimensions. The GitHub UI edges it because Gitea is GitHub-flavoured and
  GitHub's whitelist matches its menu more closely than GitLab's hide-list.
- **Gitea → Bitbucket, project (8.0)** — Bitbucket's flat sidebar is the closest
  fit to Gitea's rebuilt nav, so the structure tracks the target best of the
  three; metadata, references and shortcuts are again the losses.
- **GitHub → GitLab (9.9) / GitLab → GitHub (9.5), profile** — the rail, the
  re-shaped card and the rebuilt menu all land. The deductions are the one thing
  neither source can supply: GitLab has no pinning, so "Personal projects" is
  still GitHub's pinned selection, and GitHub's Pinned section has no GitLab
  data. `g n` is the other deduction in the L→G direction.
- **GitHub / GitLab → Bitbucket, profile (6.7)** — the menu is rebuilt from
  Bitbucket's own destinations, but Bitbucket has no public profile of its own,
  so the identity card is not re-shaped (the rail and stats passes are
  GitLab/GitHub only) and shortcuts are unmapped.
- **Gitea → any skin, profile (4.3–5.0)** — the profile passes are keyed to
  GitHub's and GitLab's profile markup (`SELECTORS.github.profile*`,
  `SELECTORS.gitlab.profile*`), so a Gitea/Forgejo profile gets the shared
  palette, copy, account-chrome and reference-marker work but none of the menu,
  rail or card rebuilding. This is the largest scoring gap, and the docs make no
  profile claim for Gitea/Forgejo; the captures agree — there is no
  `codeberg-profile-*.png` in `docs/`.
- **Bitbucket as a source (3.6 / 3.0 project, 3.4 profile)** — still a low row,
  because only the palette and the source-agnostic passes reach it: copy,
  control labels and reference markers (its `/pull-requests/N` routes are
  matched). Bitbucket Cloud exposes Atlassian's `--ds-*` design tokens on
  <html>, so the GitHub and GitLab skins re-point them at their own palette
  (`themes/gs-tokens.css`), including the top bar; that is the `palette`
  dimension. There is still no
  `SELECTORS` entry or `NAV_RULES` rule for Bitbucket markup, so orientation,
  navigation, metadata and shortcuts stay near zero. That is a statement about
  missing *structural* coverage, not a bug: Bitbucket Cloud is a client-rendered
  SPA and serves no capturable public repository page, so its hooks cannot be
  verified the way GitHub's, GitLab's and Gitea's are. The diagonal is 10.0
  because a source on its own UI needs no transformation.
- **Gerrit as a source (2.2 / 1.6 project, 2.1 profile)** — the lowest row: it
  has neither structural hooks nor a token layer the skins map, so palette joins
  orientation, navigation, metadata and shortcuts in staying near zero, and even
  the reference markers do not carry over — Gerrit identifies a change by its
  change number (`/c/<project>/+/<N>`) and a Change-Id, not a `#`/`!`
  pull-request number — so the `refs` dimension is partial too. Copy and control
  labels are the only passes that reach it.

The scores are computed by `tools/compare/parity-score.mjs` (`npm run parity`, or
`npm run parity -- --detail` for the per-dimension breakdown) and
`tests/parity-score.test.mjs` fails if this section and the module disagree.

## Copy

`PHRASES` rewrites ordinary page text. Both directions carry the same nine
pairs and every GitHub key is produced by a GitLab value:

| GitHub | GitLab |
| --- | --- |
| Pull request / Pull requests | Merge request / Merge requests |
| Go to file | Find file |
| Gist / Gists | Snippet / Snippets |
| Insights | Analytics |
| Codespaces | Workspaces |
| Dependabot | Dependency scanning |
| GitHub Actions | CI/CD |

One wording note, and the only asymmetry that is not a gap: GitHub calls the
feature "Actions" in its navigation and "GitHub Actions" in prose, while GitLab
calls it "CI/CD". The forward direction maps the prose name
(`GitHub Actions → CI/CD`) and the nav name is handled by `NAV`
(`Actions → CI/CD`); the reverse maps `CI/CD → Actions`, the word GitHub
actually shows in that position.

`LABELS` rewrites a *whole control label* only — a button, tab, menu item or
link — never prose. It is the reason ordinary words like "Merge" and "Rebase"
are safe to translate. Every entry round-trips:

| GitHub | GitLab |
| --- | --- |
| Merge pull request | Merge |
| Squash and merge | Squash commits |
| Rebase and merge | Rebase |
| Security and quality | Security |

`NAV` relabels app navigation on an exact whole-label match inside a known nav
region: `Code ⇄ Repository`, `Actions ⇄ CI/CD`, `Pull requests ⇄ Merge requests`,
`Insights ⇄ Analytics`, `Projects ⇄ Issue boards`.

`CHROME` covers the account and menu chrome the two products name differently —
`Your repositories ⇄ Your projects`, `Your gists ⇄ Your snippets`,
`Your stars ⇄ Starred projects`, `Your organizations ⇄ Your groups` — again as
whole control labels only, so a bare "Settings" (the repo tab) is never touched.

## No counterpart

Some features have no equivalent in the other product. Rather than leave them
looking native, `UNMAPPED` marks them: `content/ux-*.js` appends a small
`≠ GitLab` / `≠ GitHub` badge (and a `data-gs-no-equiv` attribute) to a nav item
or control whose whole label names such a feature. Examples: GitLab's Epics,
Iterations, Requirements, Service Desk, Merge trains, Feature flags, Terraform
modules, Model registry, Model experiments, Test cases, Incidents, Error
tracking, On-call schedules, Alert management and Value stream analytics;
GitHub's Discussions and Sponsors.

A feature with a real counterpart is never marked — the two tables are disjoint,
and a test enforces it — and every badge is removed when the skin is switched
off.

## Navigation

Labels are matched in both directions, and both directions reorder. GitHub's repo
tabs are a flat `ul.UnderlineNav-body`, so the whole set is reordered. GitLab's
project navigation is a nested group tree — one `ul` per group — so there is no
single flat list; the one group that maps onto GitHub's repo tabs, the repository
("Code") group, is reordered in place (Code before Pull requests). GitLab's
groups themselves keep GitLab's order: flattening them would change GitLab's
information architecture rather than match GitHub's.

Both reorders move items only among the slots they already occupy and leave
unrecognised children where they are, so an unfamiliar markup change degrades to
"no reorder". A reorder is applied once and then left alone for a moment, so a
framework that re-renders its list cannot make the two of us thrash.

## Navigation orientation

GitHub's app navigation is a horizontal tab row; GitLab's is a vertical sidebar,
and each skin flips the orientation so the skinned site navigates the way the
product it imitates does.

- **G→L** — GitHub's repo tabs become a real left sidebar, beside the repo header
  and content. The tab bar and the repo header share one wrapper
  (`main > div.tmp-pt-3`), so the wrapper is made `display: contents` and `main`
  becomes a grid; without that the tabs can only sit above the content. GitHub's
  responsive tab bar also hides its items and clones them into an overflow menu
  once they stop fitting the bar, so the real rows are forced back on. The
  sidebar sticks while the (very long) content scrolls, and its items are
  gathered under GitLab's group headings (Code, Build, Secure, Analyze), which
  GitHub's flat tab bar has no notion of. The logged-out GitHub top bar is
  restyled to GitLab's light bar with a hairline bottom border; the signed-in
  app header is hidden instead, since GitLab has no top menubar.
- **L→G** — GitLab's sidebar is replaced by GitHub's tab row. GitLab's page is a
  grid (`.layout-page.page-with-super-sidebar` is `232px 1032px …`, with the
  sidebar in column one), so the grid is collapsed to a single column. GitLab
  scatters the same destinations across a pinned block and collapsible groups —
  duplicating some and not rendering others (Wiki, Security) at all — and its
  group tree gives no single list to reorder, so the row is *rebuilt* rather
  than reordered: `paintProjectTabs` reuses the link GitLab renders for each
  destination and synthesises the two it omits, in GitHub's order. The row is
  hosted under the repository header, where GitHub puts it, and GitLab's own
  sidebar shell is hidden on the repository root; a project page without that
  header keeps the strip at the top.

## Description & metadata

GitHub keeps the repository description and metadata in a right-hand "About"
sidebar; GitLab shows the same information in a full-width "Project information"
block above the content. Each skin moves it to match the product being imitated:

- **G→L** — GitHub's About sidebar becomes a full-width block above the content
  (GitHub's `PageLayout` is flex, so its content is made a column and the
  sidebar pane ordered first) and its heading is renamed "Project information".
  GitHub-only sections — Releases, Packages, Used by, Contributors, Languages —
  are hidden, since GitLab's block lists a fixed, smaller set.
- **L→G** — GitLab's "Project information" block becomes a right column beside
  the file list and its heading is renamed "About", the way GitHub's reads.
  GitLab-only rows — the coverage bar, project badges and "Created on" — are
  dropped, since GitHub's About has no counterpart.

Profile pages get the same treatment, shaped like the target product's profile
rather than just re-oriented. G→L targets GitHub's profile navigation
(`nav[aria-label="User profile"]`) separately: the sticky horizontal tab strip
becomes a full-height super-sidebar in the left rail, headed "Profile", and the
profile card moves into the content as GitLab's header — a 96px avatar beside
the name. The organization, location and contact links are cloned into a
right-hand About/Info/Contact rail (`paintProfileRail`), and GitHub's pinned
section is relabelled GitLab's "Personal projects". GitHub splits the profile
across two `container-xl` wrappers, so both
are dissolved to a page grid (the profile equivalent of the repository
header/tab wrapper trick above). L→G turns GitLab's `.super-sidebar` into a
horizontal strip as usual, and because a profile's sidebar is a single flat
group it is flattened to one row of tabs: the "Profile" heading and the Help
menu are hidden. The GitLab profile is also re-shaped into GitHub's card: the
identity (avatar over the name) and the Info/Contact rail move into a left
column, with the README/activity beside them, and the follower/following counts
are copied out of the navigation to sit under the photo. The profile menu itself
is rebuilt as the applied product's — same labels, same order, same options.
Under the GitHub skin it is exactly GitHub's profile menu (`Overview`,
`Repositories`, `Projects`, `Packages`, `Stars`), mapping Repositories ⇄
Personal projects and Stars ⇄ Starred projects and pointing Packages at GitLab's
user packages route; GitLab's Activity, Groups, Snippets, Followers and
Following have no GitHub profile tab and are dropped. Under the GitLab skin it is
exactly GitLab's destinations (the account name, `Activity`, `Groups`,
`Contributed projects`, `Personal projects`, `Starred projects`, `Snippets`,
`Followers`, `Following`), with GitHub's Activity, Groups and Snippets landing
on GitLab's Activity, Groups and Snippets. GitHub's public Achievements block is
hidden under the GitLab UI, since GitLab shows achievements to the owner rather
than on a public profile. (GitLab publishes no organisation on a profile, so
that line cannot be shown.) The contribution graph is repainted to the imitated
product's palette in both directions — GitHub's greens for the GitHub skin,
GitLab's indigos for the GitLab skin (`themes/ux-nav.css`).

## Skin selection

The popup chooses **one skin for the whole extension**: a single **Show the web
with** radio group — **GitLab UI**, **GitHub UI** or **Off** — so the two skins
can never both be active. The choice is mapped onto the per-kind settings the
background, badge and content scripts already read (only one kind is ever on),
and a state stored with both skins on is reduced to one when the popup opens. A
per-site picker can still override a single host with **Off**, **GitHub UI** or
**GitLab UI**, stored in the `gitSameHostSettings` map; choosing a site's own UI
is treated as off (`popup/`, `lib/sites.js`).

## References

`refMarker` reads the link's `href`: a `/pull/N` or `/-/merge_requests/N` link
shows `!N` under the GitLab UI and `#N` under the GitHub UI. Issue links are
left as `#N`, which is correct in both products.

## Shortcuts

| On screen | press | destination | delivered by |
| --- | --- | --- | --- |
| G→L | `g m` | GitHub pull requests | synthetic key (`g p`) |
| G→L | `g p` | GitHub projects | synthetic key (`g b`) |
| G→L | `g t` | GitHub notifications | synthetic key (`g n`) |
| L→G | `g p` | GitLab merge requests | click on the "Pull requests" nav link |
| L→G | `g b` | GitLab projects | click on the "Projects" nav link |
| L→G | `g n` | GitLab todos | synthetic key (`g t`) — **not delivered** |

GitHub honours synthetic key events, so the G→L combos replay the site's own
combo. GitLab rejects them (`event.isTrusted` is false), so the L→G combos that
have a navigation link are delivered as a **trusted click** on that link
instead. The one combo with no link — `g n` (notifications ⇄ todos) — still
falls back to a synthetic key and therefore does not work on GitLab; it is the
one shortcut that is G→L only.

Deliberately unmapped, in both directions: `g c`, `g i`, `g a`, `g w`, `g s`,
`g d`, `g g`, and every single key (`t`, `/`, `.`, `?`, `s`). The single keys
mostly already agree between the products, and the `g`-combos above are the only
pairs with an unambiguous counterpart.

## Open on the other host

The popup shows **Open this page on GitLab / GitHub** when the current page is on
one of the two public forges, and the same action is bound to `Alt`+`Shift`+`O`.
`otherHostUrl` maps the path between the products — repo root,
`pull` ⇄ `-/merge_requests`, `issues` ⇄ `-/issues`, `tree` / `blob` / `commits`,
`releases`, `wiki` ⇄ `-/wikis`, `actions` ⇄ `-/pipelines` — and preserves the
query and fragment. It returns nothing for a self-hosted host (there is no pair
to guess) or a path that is not a repository, so the button is simply absent
there.

## Codeberg / Gitea

Codeberg (Forgejo) and gitea.com (Gitea) are a third source product, `gitea`.
They are GitHub-flavoured, so they can wear either UI, and each skin re-orients
their navigation:

- **Gitea → GitLab** — the horizontal repo tab row (`overflow-menu`) is rebuilt
  as GitLab's left sidebar, with GitLab's Plan/Code/Build/Deploy group headings,
  the active row tinted, and counts as trailing figures. The `overflow-menu` web
  component collapses its own tabs into a "more" popup once they stop fitting, so
  it is kept off-screen at a width where its tabs stay in the DOM for the rebuild
  (`content/ux-project.js` `paintGiteaNav`, `UX.repoNav`), and the stylesheet hides it.
- **Gitea → GitHub** — the tab row is restyled in place as GitHub's underlined
  UnderlineNav: muted inactive tabs, an orange active underline, GitHub's rounded
  counter pills, and a single hairline under the row. It is not rebuilt.

Gitea's description and topics keep Gitea's own placement — they are not moved
into a GitLab "Project information" block or a GitHub "About" rail — and Gitea's
own `g`-combos are left alone.

## Not built

- **Behaviour** behind search, notifications and the merge flow: only their
  labels change, not what they do.

## Extending

Add to `PHRASES` for prose, `LABELS` for a control label, `CHROME` for account
chrome, `NAV` for a nav label, `SELECTORS` for a DOM hook, `SHORTCUTS` for a
`g`-combo. Keep control words in `LABELS`/`CHROME`, not `PHRASES` — the control
scope is what makes an ordinary word safe. The tests enforce that every `LABELS`
and `CHROME` entry round-trips and that `PHRASES` stays the same size in both
directions.

A selector a pass keys on goes in `SELECTORS`, under the *source* product whose
markup it matches — `src/content/ux-*.js` reads it from there rather than carrying
a literal. Name the hook in a `CANARY_PAGES` entry too, and
`npm run canary` will assert the live forge still serves it.

## Verification

- **Live**, in Chromium with `dist/chromium` loaded: G→L copy, nav relabel and
  reorder, `#42 → !42`, `g m` navigating to the repo's pull requests, and a clean
  revert of all of it; L→G copy, nav relabel, the repository group reordered
  (`Code` before `Pull requests`), `!42 → #42` (and back on revert), and `g p`
  navigating to the project's merge requests. The popup's "Open this page on
  GitLab" button resolved `github.com/git/git/pull/1875` to
  `gitlab.com/git/git/-/merge_requests/1875`, and `open-other-host` was
  registered alongside `toggle-site`. Nine `≠ GitHub` badges appeared on
  GitLab-only features, a mapped item carried none, an injected `Discussions`
  tab was marked `≠ GitLab`, and every badge was removed on switch-off. Both
  orientations rendered correctly: GitHub's repo tabs as a vertical column, and
  GitLab's sidebar as a horizontal strip with the project content still full
  width (1231px). A GitHub profile (`github.com/torvalds`) was checked too: its
  profile tabs became a vertical panel in the left rail, the profile card below
  it, and the pinned content kept the full right column.
- **Unit**, `tests/ux.test.mjs`: every table and helper, including the `LABELS`
  and `CHROME` round-trips, `PHRASES` symmetry, `labelMatches`, `otherHostUrl`,
  and that `UNMAPPED` never overlaps a translated label.
