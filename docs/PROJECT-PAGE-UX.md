# Project pages: GitHub vs GitLab

A **project page** is the landing page for one repository or project —
`github.com/owner/repo` and `gitlab.com/namespace/project`. It is the page most
people arrive at, and the one the captures in [`index.html`](index.html) are
made from, because it is where the two products look least alike.

The difference is not decoration. GitHub treats the page as a **code browser
with a metadata rail**; GitLab treats it as a **README-first overview with a
grouped sidebar**. The vocabulary in `src/lib/ux.js` translates only the visible
surface of that split; the layout underneath it is what the skin has to work
around. This file is the map of both.

## Anatomy

| Surface | GitHub (repo home) | GitLab (project home) |
| --- | --- | --- |
| Navigation shape | Horizontal tab row above the content | Vertical, grouped super-sidebar at the left |
| Navigation model | Flat list | Grouped tree (Project overview, Repository, Issues, Merge requests, CI/CD, Security, Deployments, Analytics, Wiki, …) |
| Landing content | File/folder table **+** README **+** an About rail | README, then a "Project information" block |
| File tree | *Is* the page | Under Repository → Files, one click away |
| Metadata | Right rail: About, Topics, Resources, Stars/Watchers/Forks, Releases, Packages, Contributors, Languages | Main column: description, topics, badges, commit/branch/tag/environment counts, README/License/CHANGELOG/Contributing/Pages, "Created on" |
| Primary action | Green **Code** clone button, **Go to file** | Blue **Code** clone button (with Web IDE) |
| Owned as | `owner / repo`, always two levels | `group / [subgroup /] project`, nested |
| Contextual nav | A tab appears when its feature is enabled | A sidebar item appears when its feature is enabled *and* permitted |

That is not a summary of the products; it is what the two live pages render
today, checked against [`github.com/git/git`](https://github.com/git/git) and
[`gitlab.com/gitlab-org/gitlab`](https://gitlab.com/gitlab-org/gitlab).

## Where the UX diverges

### 1. The homepage's job is different

GitHub's repo home answers *"what's in here?"*. A sortable file table — name,
last commit message, last commit date — is the dominant element, and the README
is rendered below it. GitLab's project home answers *"what is this?"*. The
README *is* the content, the project's metadata is the story around it, and code
navigation is a deliberate second step (Repository → Files). Same repository,
two different first questions.

### 2. Flat versus grouped information architecture

GitHub's repo navigation is one flat row: **Code, Issues, Pull requests,
Actions, Projects, Wiki, Security and quality, Insights**. GitLab's is a nested
tree, where **CI/CD** is a *group* holding Pipelines, Editor, Jobs, Schedules and
Artifacts, while GitHub's **Actions** is a single tab. This is the largest
structural mismatch on the page, and relabelling alone cannot close it: a group
is not a tab. The skin therefore reshapes the navigation rather than only
renaming it — under the GitHub UI GitLab's scattered project destinations are
rebuilt as GitHub's flat tab row, in GitHub's order; under the GitLab UI
GitHub's flat tabs are gathered under GitLab's group headings. The *labels*
follow `NAV`/`NAV_RULES`; the *shape* is `content/ux.js` plus
`themes/ux-nav.css`.

### 3. Metadata in a rail versus in the flow

GitHub parallelises: About, Topics, Resources, star/watch/fork counts, Releases,
Packages, Contributors and Languages sit in a narrow column beside the code.
GitLab serialises: the equivalent — description, topics, badges, commit/branch/
tag/environment counts, and the README/License/CHANGELOG/Contributing/Pages
links — runs down the main column under the README. Both surface the same
document set; they lay it out on opposite axes.

The skin moves the block onto the imitated product's axis: GitHub's About rail
becomes GitLab's full-width **Project information** block (heading renamed by
`paintHeadings`), and GitLab's block becomes GitHub's right-hand **About**
column. GitLab-only rows — the coverage bar, project badges and "Created on" —
are dropped rather than faked, and GitHub-only sections (Releases, Packages, Used
by, Contributors, Languages) are hidden under the GitLab UI.

### 4. "Code" means two things

On GitHub, **Code** is both the nav tab and the clone button. On GitLab the nav
item is **Repository** while the clone button is still **Code**. So
`Code ⇄ Repository` is valid only *inside the navigation region*: applied to
prose it would corrupt the clone button. This is exactly why `NAV` is matched
only within `NAV_SCOPE` (`nav[aria-label="Repository"]`, `.super-sidebar`, …)
and never through `PHRASES` — see
[`src/lib/ux.js`](../src/lib/ux.js) and
[UX-PARITY.md](UX-PARITY.md#navigation).

### 5. Namespace depth

GitHub's breadcrumb is always `owner / repo`. A GitLab project can be nested
under subgroups, so the same project may be one or several levels deep, and the
sidebar carries group-scoped features — Epics, Iterations — with no repo-level
GitHub analogue. `otherHostUrl` refuses a namespace too deep for GitHub's
owner/repo shape rather than guessing a pair.

### 6. Density and tone

GitHub is denser and more utilitarian: counters on tabs, a compact table, a
metadata rail. GitLab is airier and more documentation-like: generous
whitespace, a README-led landing, "Read more" expanders. The skin repaints the
palette and rewrites the words, but it inherits whichever density the underlying
product chose.

## Where they agree

The two products are far more alike than the layout suggests, which is what
makes the skin convincing at all:

- Clone/download behind a **Code** split button, with star, fork and watch in
  the header.
- CI status surfaced as badges near the top.
- Issues and pull/merge requests as first-class nav items carrying counters.
- A find-file affordance — GitHub's `t` / "Go to file", GitLab's "Find file" in
  the Files view.
- The README as the first thing a newcomer reads.
- The same supporting documents (README, License, Contributing, …), whichever
  column they are drawn in.
- Navigation for a feature is hidden until that feature is enabled.

## What gitalike maps

The project page is the surface `src/lib/ux.js` was written against. The full
status matrix is [UX-PARITY.md](UX-PARITY.md); the project-page rows are:

| Surface | GitHub | GitLab | Lives in |
| --- | --- | --- | --- |
| Nav labels | Code, Actions, Pull requests, Insights, Projects | Repository, CI/CD, Merge requests, Analytics, Issue boards | `NAV` |
| Nav order | `ul.UnderlineNav-body` | the repository group of `.super-sidebar` | `NAV_RULES` |
| Tab strip (L→G) | GitHub's flat tabs | GitLab's sidebar, rebuilt into GitHub's tabs | `paintProjectTabs` |
| Tab groups (G→L) | GitHub's flat tabs, gathered under GitLab's headings | GitLab's grouped sidebar | `paintNavGroups` |
| Orientation | horizontal tab row | vertical sidebar | `themes/ux-nav.css` |
| Metadata heading | About | Project information | `paintHeadings` |
| Control labels | Merge pull request, Security and quality | Merge, Security | `LABELS` |
| Reference marker | `#42` | `!42` | `refMarker` |
| Shortcuts | GitHub's `g`-combos replay | GitLab's, delivered as clicks | `SHORTCUTS`, `SHORTCUT_TARGETS` |
| No counterpart | Discussions, Sponsors, Marketplace | Epics, Iterations, Requirements, … | `UNMAPPED` |

The two reorder rules are worth seeing in full, because "the other product's
order" is approximate at group level:

```js
// G→L: GitHub's flat tabs, into GitLab's project order
['Repository', 'Issues', 'Merge requests', 'CI/CD', 'Wiki', 'Analytics', 'Security']

// L→G: GitLab's scattered sidebar, rebuilt as GitHub's flat tab order
['Code', 'Issues', 'Pull requests', 'Actions', 'Projects', 'Wiki', 'Security and quality', 'Insights']
```

## What the skin cannot change

- **The homepage cannot become the other homepage.** A GitLab project skinned
  as GitHub still lands on README + project information, not a file table; a
  GitHub repo skinned as GitLab still lands on its file table, not README-only.
  The skin re-skins, it does not re-render content.
- **The metadata block moves, but only the block.** The description and metadata
  follow the imitated product's axis (see §3), but GitLab-only rows and
  GitHub-only sections are dropped rather than invented, so the two columns
  never carry identical content.
- **The GitHub-skin strip is rebuilt, not just reordered.** GitLab scatters the
  same destinations across a pinned block and collapsible groups, some of which
  (Wiki, Security) it does not render at all, so the tab row is rebuilt from
  GitHub's own tabs in GitHub's order and hosted under the repository header,
  where GitHub puts it. On the other side GitHub's flat tabs are gathered under
  GitLab's group headings, keeping GitLab's structure, see
  [UX-PARITY.md](UX-PARITY.md#navigation-orientation).
- **Group-scoped features are marked, not faked.** A sidebar item with no
  counterpart gets a `≠ GitHub` badge from `UNMAPPED` instead of pretending the
  feature exists.
- **Behaviour behind the chrome is untouched.** Search, notifications and the
  merge flow only change their labels; what they do is the site's.

## See also

- [UX-PARITY.md](UX-PARITY.md) — the full parity status matrix
- [`index.html`](index.html) — live orientation captures of these pages
- [README.md](../README.md#ux-parity) — the user-facing summary
- [CONTRIBUTING.md](../CONTRIBUTING.md#change-the-navigation-order-or-orientation)
  — how to change the order or orientation
