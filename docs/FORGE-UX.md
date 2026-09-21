# Forge UX

gitalike re-skins one forge's interface onto another. This is the map of the
source products it handles — GitHub, GitLab, Gitea/Forgejo (Codeberg,
`gitea.com`), Bitbucket and Gerrit — and the three UIs it can paint them with:
**GitLab**, **GitHub** and **Bitbucket**. The structural passes and the
vocabulary tables live in `src/lib/ux.js`; this file is the map and the
reasoning.

## The skins

A skin is a *target* UI: its key is the `html.gs-theme-<name>` class and its
stylesheet is `themes/as-<name>.css`. There are three — `gitlab`, `github` and
`bitbucket` — and each names the shape it is built to in
`SITES.skins[<name>].layout` (`gitlab` = top bar plus left sidebar, `github` =
top bar plus horizontal tab row). Bitbucket reuses the GitLab layout, so the
structural passes apply unchanged and only its palette, words and tab set
differ.

A source product wears the *other* product's UI by default (GitHub ⇄ GitLab);
Gitea is GitHub-flavoured and can wear either; Bitbucket is both a source and a
target — a Bitbucket host wears the GitHub or GitLab UI, and any source can be
chosen for the Bitbucket UI. Gerrit is a source only, added one instance at a
time. The popup picks one skin at a time, with a per-site override — see
[UX-PARITY.md](UX-PARITY.md#skin-selection).

## Directions

- **G→L** — a GitHub-flavoured site shown with the GitLab UI
  (`html.gs-theme-gitlab`, `themes/as-gitlab.css`)
- **L→G** — a GitLab-flavoured site shown with the GitHub UI
  (`html.gs-theme-github`, `themes/as-github.css`)
- **→B** — any source shown with the Bitbucket UI
  (`html.gs-theme-bitbucket`, `themes/as-bitbucket.css`)
- **B→G / B→L** — a Bitbucket source shown with the GitHub or GitLab UI, with
  no structural pass yet (see [Other forges](#other-forges))
- **Ger→G / Ger→L** — a Gerrit source shown with the GitHub or GitLab UI, the
  same vocabulary-only treatment

## Captures

[`index.html`](index.html) lays each pair over itself as a before/after swipe,
captured at 1280×900 by `npm run screenshots` (project pages) and
`npm run screenshots:profiles` (profiles). The Codeberg captures sit beside
them: `codeberg-default.png` (Gitea as it ships) and the same page skinned
`codeberg-gitlab.png` / `codeberg-github.png` / `codeberg-bitbucket.png`.

## Project pages: GitHub vs GitLab


A **project page** is the landing page for one repository or project —
`github.com/owner/repo` and `gitlab.com/namespace/project`. It is the page most
people arrive at, and the one the captures in [`index.html`](index.html) are
made from, because it is where the two products look least alike.

The difference is not decoration. GitHub treats the page as a **code browser
with a metadata rail**; GitLab treats it as a **README-first overview with a
grouped sidebar**. The vocabulary in `src/lib/ux.js` translates only the visible
surface of that split; the layout underneath it is what the skin has to work
around. This file is the map of both.

### Anatomy

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

### Where the UX diverges

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
follow `NAV`/`NAV_RULES`; the *shape* is `content/ux-*.js` plus
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

### Where they agree

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

### What gitalike maps

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

### What the skin cannot change

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

### See also

- [UX-PARITY.md](UX-PARITY.md) — the full parity status matrix
- [`index.html`](index.html) — live orientation captures of these pages
- [README.md](../README.md#ux-parity) — the user-facing summary
- [CONTRIBUTING.md](../CONTRIBUTING.md#change-the-navigation-order-or-orientation)
  — how to change the order or orientation

## Profile pages: GitHub vs GitLab


A **profile page** is one account's public page — `github.com/<user>` and
`gitlab.com/<user>`. Where the [project pages](#project-pages-github-vs-gitlab) differ mostly
in *layout*, the profile page differs in *content*: GitHub treats it as a
**portfolio and social graph**, GitLab as an **identity card and activity log**.

That is why the skin maps less here than on a repository. Most of what separates
the two profiles is not a word or a container the extension can retarget, but a
different set of destinations. This file is the map of both.

### Anatomy

| Surface | GitHub (user profile) | GitLab (user profile) |
| --- | --- | --- |
| Header | Avatar, handle, **Follow** | Large avatar, display name, `@handle` |
| Navigation shape | Horizontal tab row | Vertical super-sidebar, headed **Profile** |
| Navigation model | Flat list, most tabs carrying a count | Flat list of destinations, under the person's name |
| Navigation items | Overview, Repositories *n*, Projects, Packages, Stars *n*, More | *\<name\>*, Activity, Groups, Contributed projects, Personal projects, Starred projects, Snippets, Followers *n*, Following |
| Main content | **Pinned** repository cards, then contribution activity | Profile README, then activity calendar, then Personal projects |
| Sidebar | Avatar, bio, followers/following counts, organization, location, Achievements, Block or report | Achievements, Info (Member since), Contact (social links) |
| Cross-repo work | Folded into Overview: contribution graph, "contributed to"; Stars is a tab; organizations sit in the sidebar | Split into destinations: Groups, Contributed projects, Personal projects, Starred projects |
| Primary action | Follow; Sponsor when sponsorable | Follow; subscribe to the activity feed (RSS) |

That is not a summary of the products; it is what the two live pages render
today, checked against [`github.com/torvalds`](https://github.com/torvalds) and
[`gitlab.com/dzaporozhets`](https://gitlab.com/dzaporozhets).

### Where the UX diverges

### 1. Portfolio versus identity

GitHub curates: up to six **Pinned** repository cards are the first and largest
thing on the page, each showing description, language, stars and forks. Who the
person is matters less than what they have built. GitLab enumerates: its
Overview leads with the profile README, then activity, then a plain "Personal
projects" list. Nothing is pinned; the profile is an index of what the account
has done, not a selection of highlights.

### 2. Flat, count-bearing tabs versus a "Profile" sidebar

GitHub's navigation is one horizontal row — **Overview, Repositories 12,
Projects, Packages, Stars 2**, with a **More** overflow — and the counts are part
of the labels. GitLab's navigation is a super-sidebar group headed **Profile**,
and its first item is not "Overview" but the *person's own name*. Counts appear
only as a pill (Followers). So even the two "landing" entries do not share a
name: GitHub says Overview, GitLab says the account's name.

### 3. The Overview is a different page

GitHub's Overview is a contribution graph and pinned code. GitLab's Overview is
a profile README in a bordered card with a **Read more** expander, then a
contribution calendar, then projects. Both products now support a profile README
(the `<user>/<user>` repository), so the feature matches — how it is framed does
not. GitHub treats the README as ordinary content; GitLab treats it as a
collapsible card.

### 4. Cross-repo work is split differently

GitLab gives each cross-repo concern its own destination: **Groups**,
**Contributed projects**, **Personal projects**, **Starred projects**. GitHub
folds most of that into the Overview — a contribution graph and a "contributed
to" list — keeps **Stars** as a tab, and puts the account's organizations in the
sidebar rather than in navigation. Same information, one navigation list versus
a graph plus a sidebar.

### 5. Social and recognition surface

Both have **Follow**, an **Achievements** block and a star list. They part ways
at the edges: GitHub's follower/following counts sit as links under the handle
and it has **Sponsors** and **Marketplace**, neither of which GitLab offers;
GitLab exposes an **activity RSS feed** and keeps followers/following as
navigation destinations. Sponsors and Marketplace are the two the skin already
marks as having no counterpart (see `UNMAPPED`).

### 6. The menu is rebuilt as the applied product's

Several labels name the same destination without matching word for word, and the
two products each have destinations the other lacks. Rather than show a mix, the
profile menu is rebuilt as the applied product's. Under the **GitHub** skin the
menu is exactly GitHub's profile page — **Overview, Repositories, Projects,
Packages, Stars** — with GitLab's *Personal projects* as **Repositories**, its
*Contributed projects* as **Projects**, its *Starred projects* as **Stars**, the
landing item swapped (GitHub's **Overview** ⇄ GitLab's account name), and
**Packages** pointed at GitLab's user packages route. GitLab's items with no
GitHub profile tab — Activity, Groups, Snippets, Followers, Following — do not
appear there. Under the **GitLab** skin the menu is exactly GitLab's profile
destinations — the account name, **Activity, Groups, Contributed projects,
Personal projects, Starred projects, Snippets, Followers, Following** — with
GitHub's Overview, Repositories, Projects and Stars remapped, and GitHub's
Activity, Groups and Snippets brought across to GitLab's own Activity, Groups and
Snippets. Achievements are shown to a GitLab account's owner rather than on its
public profile, so GitHub's public Achievements block is hidden under the GitLab
UI.

### 7. The activity graph wears each product's palette

The contribution calendar is the same idea on both products but a different
colour: GitHub's greens run `#aceebb` → `#116329`, GitLab's indigos `#d2dcff` →
`#303470`. The skin repaints the graph to the imitated product's palette in both
directions, so a skinned profile reads like the product it is pretending to be
rather than a recoloured GitHub (`themes/ux-nav.css`).

### Where they agree

- A **Follow** action in the header, with avatar, display name and handle.
- A **profile README** rendered from the `<user>/<user>` repository.
- A **contribution graph / activity calendar** as the pulse of the account.
- An **Achievements** block, and a **Member since / Joined** line.
- A **starred** destination (Stars ⇄ Starred projects).
- A list of the account's **own repositories/projects**.
- Company/group, location and website as identity metadata.

### What gitalike maps

Most of the profile's vocabulary has no exact counterpart, so the copy tables
(`PHRASES`, `LABELS`) do not carry it. What applies:

| Surface | GitHub | GitLab | Lives in |
| --- | --- | --- | --- |
| Account chrome (dropdown) | Your repositories, Your stars, Your gists, Your organizations | Your projects, Starred projects, Your snippets, Your groups | `CHROME` |
| Profile navigation | Overview, Repositories, Projects, Packages, Stars | the name, Activity, Groups, Contributed/Personal/Starred projects, Snippets, Followers, Following | `content/ux-*.js` — rebuilt as the applied product's menu |
| No counterpart | Sponsors, Marketplace | (GitLab lacks them) | `UNMAPPED` |
| Reference marker | `#42` | `!42` | `refMarker` |
| Shortcuts | GitHub's `g`-combos replay | GitLab's, delivered as clicks | `SHORTCUTS`, `SHORTCUT_TARGETS` |
| Orientation | horizontal tab row | vertical sidebar group | `themes/ux-nav.css` |
| Metadata rail (G→L) | card flows down the content column | organization, location and links move to an About/Info/Contact rail | `content/ux-profile.js` — `paintProfileRail` |
| Pinned section | Pinned | Personal projects | `paintHeadings` |
| Activity palette | green | indigo | `themes/ux-nav.css` |
| Follower/following counts | under the photo | in the navigation | `content/ux-*.js` — GitLab's are copied into the card |

Two scoping facts make the profile behave differently from the project page:

- **Orientation is flipped both ways.** G→L separately targets GitHub's profile
  navigation (`nav[aria-label="User profile"]`): the sticky horizontal tab strip
  becomes a full-height GitLab-style super-sidebar in the left rail, headed
  "Profile", and the profile card moves into the content as GitLab's header
  (a 96px avatar beside the name). The profile page's two `container-xl`
  wrappers are dissolved to a page grid for this, the same way the repository
  header and tabs are. L→G restyles `.super-sidebar` generally (see
  [`themes/ux-nav.css`](../src/themes/ux-nav.css)), and because GitLab's profile
  navigation is a single flat super-sidebar group, it is flattened to one row of
  tabs — the "Profile" heading and the Help menu, which GitHub's profile has no
  place for, are hidden. The identity also moves from a top header with a small
  avatar into a left card under a large avatar, with the README/activity beside
  it, which is GitHub's profile shape.
- **Profile navigation is rebuilt in `content/ux-profile.js`, not `NAV`.** `NAV` carries
  the repository labels only, and a profile's destinations are a different set
  with a different count. The content script therefore replaces the profile menu
  with the applied product's — same labels, same order, same options — reusing a
  source item where a destination lines up and adding the rest. Where the
  applied product has no page for an item the closest real page is used, the
  landing item takes the other product's label, and the whole menu is restored
  on switch-off (see §6). This needs the page, not just a label table.

**Open on the other host** is absent on a profile, in both directions. That is
correct rather than a gap: a profile is not an `owner/repo` path, and the two
hosts issue different usernames, so there is no path to map between them.
`otherHostUrl` returns null for a single-segment path.

### What the skin cannot change

- **Pinned cards are relabelled, not invented.** GitHub curates a fixed set of
  repositories; GitLab has no pinning on the profile. A GitHub profile skinned
  as GitLab keeps the cards, under GitLab's **Personal projects** heading, so
  the section GitLab shows is present — but the set is the pinned selection, not
  the full list — and a GitLab profile skinned as GitHub has no Pinned section
  to show.
- **A named-first nav item cannot become "Overview".** GitLab's first profile
  item is the account's name; GitHub's is the word Overview. Relabelling would
  have to rewrite the name itself.
- **Count-bearing tabs stay count-bearing.** GitHub puts counts in the tab
  labels; GitLab uses a pill on one item. The skin moves the count to the end of
  the row as a trailing pill, but it cannot remove the counts GitHub renders
  into the labels — the shape of the navigation is the site's.
- **GitHub's profile is re-shaped, not re-rendered.** The navigation becomes a
  full-height super-sidebar and the identity card moves into the content as
  GitLab's header; the organization, location and contact links are cloned into
  a right-hand **About / Info / Contact** rail, and the pinned section becomes
  **Personal projects**. What cannot be recreated is GitLab's name-first landing
  item and the Info rows GitHub publishes no data for (local time, member
  since).
- **GitLab publishes no organisation on a profile.** Its "Info" block carries
  location, local time and member-since — but no company — so a GitHub-skinned
  GitLab profile cannot show the organisation line GitHub's card has.
- **Sponsors and Marketplace stay GitHub-only.** They are marked `≠ GitLab`, not
  recreated.

### See also

- [UX-PARITY.md](UX-PARITY.md) — the full parity status matrix
- [`src/lib/ux.js`](../src/lib/ux.js) — the vocabulary, navigation and shortcut tables
- [`themes/ux-nav.css`](../src/themes/ux-nav.css) — the orientation rules

## Other forges

**Codeberg (Forgejo)** and **`gitea.com` (Gitea)** are a third source product,
`gitea`. They are GitHub-flavoured, so they can wear either UI: under the GitLab
UI their repo tabs are rebuilt as a grouped left sidebar, and under the GitHub
UI as GitHub's underlined tab row. Gitea's description and topics keep Gitea's
own placement — they are not moved into a GitLab "Project information" block or
a GitHub "About" rail — and Gitea's own `g`-combos are left alone.

**Bitbucket** is both a skin and a source. As a *skin* it is chosen from the
popup for any source: its layout is GitLab's (Bitbucket's repo nav is a left
sidebar), but its menu is flat — grouping follows the skin, so it takes no GitLab
group headings — and what differs is its palette (`#0052cc`), its words and its
tab set (`Source`, `Pull requests`, `Pipelines`, `Issues`). As a *source*,
`bitbucket.org` (and any Bitbucket Data Center host you add) can wear the GitHub
or GitLab UI. Only the source-agnostic passes run on it — copy, control labels
and reference markers (Bitbucket's `/pull-requests/N` routes are matched); there
is no token block, `SELECTORS` entry or `NAV_RULES` rule for its markup, because
Bitbucket Cloud renders its repository page client-side and serves no capturable
public page to key them on. The scorecard in
[UX-PARITY.md](UX-PARITY.md#parity-scoring) carries that gap as its own row.

**Gerrit** is a source only, and has no bundled host: an instance is added from
the popup one origin at a time. Its PolyGerrit UI is client-rendered like
Bitbucket Cloud, so it gets the same vocabulary-only treatment — copy and
control labels — with no token, `SELECTORS` or `NAV_RULES` coverage. Its changes
are numbered (`/c/<project>/+/<N>`) with a Change-Id, not a `#`/`!`
pull-request marker, so the reference-marker pass does not reach it either. The
scorecard carries it as its own row.

The current forge specifics — which Gitea selector each pass hooks, the
`overflow-menu` handling, and the per-skin tables — are in
[UX-PARITY.md](UX-PARITY.md#codeberg--gitea) and `src/lib/ux.js`.

## See also

- [UX-PARITY.md](UX-PARITY.md) — the full parity status matrix
- [`index.html`](index.html) — live orientation captures
- [`src/lib/ux.js`](../src/lib/ux.js) — the vocabulary, navigation and shortcut tables
- [`themes/ux-nav.css`](../src/themes/ux-nav.css) — the orientation rules
