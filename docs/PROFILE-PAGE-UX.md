# Profile pages: GitHub vs GitLab

A **profile page** is one account's public page — `github.com/<user>` and
`gitlab.com/<user>`. Where the [project page](PROJECT-PAGE-UX.md) differs mostly
in *layout*, the profile page differs in *content*: GitHub treats it as a
**portfolio and social graph**, GitLab as an **identity card and activity log**.

That is why the skin maps less here than on a repository. Most of what separates
the two profiles is not a word or a container the extension can retarget, but a
different set of destinations. This file is the map of both.

## Anatomy

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

## Where the UX diverges

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

### 6. Near-pairs that are not exact pairs

Several labels look like counterparts but are not, which is why they are absent
from the navigation tables rather than translated: GitHub **Repositories** vs
GitLab **Personal projects**, GitHub **Stars** vs GitLab **Starred projects**,
GitLab profile **Snippets** vs GitHub's account-level **Gists**. The account
dropdown pair `Your gists ⇄ Your snippets` is in `CHROME`, but it is the *menu*
label, not a profile tab — GitHub has no Snippets/Gists tab on a profile at all.

## Where they agree

- A **Follow** action in the header, with avatar, display name and handle.
- A **profile README** rendered from the `<user>/<user>` repository.
- A **contribution graph / activity calendar** as the pulse of the account.
- An **Achievements** block, and a **Member since / Joined** line.
- A **starred** destination (Stars ⇄ Starred projects).
- A list of the account's **own repositories/projects**.
- Company/group, location and website as identity metadata.

## What gitalike maps

The profile page is largely unmapped territory for the vocabulary tables, and
deliberately so — there is little exact vocabulary to carry across. What does
apply:

| Surface | GitHub | GitLab | Lives in |
| --- | --- | --- | --- |
| Account chrome (dropdown) | Your repositories, Your stars, Your gists, Your organizations | Your projects, Starred projects, Your snippets, Your groups | `CHROME` |
| No counterpart | Sponsors, Marketplace | (GitLab lacks them) | `UNMAPPED` |
| Reference marker | `#42` | `!42` | `refMarker` |
| Shortcuts | GitHub's `g`-combos replay | GitLab's, delivered as clicks | `SHORTCUTS`, `SHORTCUT_TARGETS` |
| Orientation | horizontal tab row | vertical sidebar group | `themes/ux-nav.css` |
| Follower/following counts | under the photo | in the navigation | `content/ux.js` — GitLab's are copied into the card |

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
- **Profile navigation labels are not in `NAV`.** `NAV_SCOPE` includes
  `.super-sidebar`, so the relabelling pass runs there, but `NAV` holds only the
  repository-group labels (Code, Pull requests, …). GitLab's profile items —
  Activity, Groups, Contributed projects, Personal projects, Starred projects,
  Snippets, Followers, Following — and GitHub's profile tabs pass through
  untouched. The near-pairs in §6 are the reason: none is an exact match for a
  repository label, and several have no clean counterpart.

**Open on the other host** is absent on a profile, in both directions. That is
correct rather than a gap: a profile is not an `owner/repo` path, and the two
hosts issue different usernames, so there is no path to map between them.
`otherHostUrl` returns null for a single-segment path.

## What the skin cannot change

- **Pinned cards cannot appear on GitLab.** GitHub curates a fixed set of
  repositories; GitLab has no pinning on the profile. The skin repaints the
  cards, it cannot invent the feature — so a GitHub profile skinned as GitLab
  keeps its Pinned section, and a GitLab profile skinned as GitHub has none.
- **A named-first nav item cannot become "Overview".** GitLab's first profile
  item is the account's name; GitHub's is the word Overview. Relabelling would
  have to rewrite the name itself.
- **Count-bearing tabs stay count-bearing.** GitHub puts counts in the tab
  labels; GitLab uses a pill on one item. The skin moves the count to the end of
  the row as a trailing pill, but it cannot remove the counts GitHub renders
  into the labels — the shape of the navigation is the site's.
- **GitHub's profile is not re-rendered as GitLab's three-column page.** The
  navigation becomes a full-height super-sidebar and the identity card moves
  into the content as GitLab's header, but GitHub's card keeps its
  followers/achievements/block content flowing down the content column; GitLab's
  separate Info/Contact rail and the name-first landing item are not recreated.
- **GitLab publishes no organisation on a profile.** Its "Info" block carries
  location, local time and member-since — but no company — so a GitHub-skinned
  GitLab profile cannot show the organisation line GitHub's card has.
- **Sponsors and Marketplace stay GitHub-only.** They are marked `≠ GitLab`, not
  recreated.

## See also

- [PROJECT-PAGE-UX.md](PROJECT-PAGE-UX.md) — the repository/project landing page
- [UX-PARITY.md](UX-PARITY.md) — the full parity status matrix
- [`src/lib/ux.js`](../src/lib/ux.js) — the vocabulary, navigation and shortcut tables
- [`themes/ux-nav.css`](../src/themes/ux-nav.css) — the orientation rules
