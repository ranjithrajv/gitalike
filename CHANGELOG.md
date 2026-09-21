# Changelog

All notable changes to gitalike are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A third skin: **Bitbucket**. It is a *target only* — no host is classified as
  Bitbucket — so any configured GitHub, GitLab or Gitea site can wear it. Its
  Atlassian palette is mapped for each source's own tokens (Primer on GitHub,
  Pajamas on GitLab, `--color-*` on Gitea), it carries GitHub's layout (top bar +
  repo tab row), and its vocabulary is Bitbucket's (`Source`, `Pipelines`,
  `Pull requests`, `Downloads`). The global **Show the web with** radio and the
  per-site picker both offer it (`src/themes/as-bitbucket.css`, `src/lib/ux.js`,
  `src/lib/sites.js`, `src/background.js`).
- A `layout` on each skin (`github` = top bar + tab row, `gitlab` = left
  sidebar) and a matching `gs-layout-*` class on `<html>`, so a skin that shares
  another's shape reuses its structural CSS and passes instead of copying them.
  A kind's setting now holds any theme, not only the one it defaults to, which is
  what lets a target no kind defaults to be chosen for a whole kind
  (`src/lib/sites.js`, `src/content/theme.js`, `src/content/ux.js`,
  `src/popup/popup.js`).

- A per-site skin picker. The popup gains a **Show *this site* with** radio group
  — **Off**, **GitHub UI** or **GitLab UI** — so one host can wear a different
  skin (or none) without changing the global choice, and a GitHub Enterprise
  instance can be skinned without `github.com`. The choice lives in a new
  `gitSameHostSettings` map; choosing the UI a site's markup already is (GitHub
  for `github.com`, GitLab for `gitlab.com`) is treated as off, because
  repainting a site as itself would run the wrong vocabulary and shortcut
  tables. `Alt` + `Shift` + `G` toggles the current site's skin, and removing a
  site clears its choice. The shared `skins` table now owns each skin's product
  name, badge and colour, so the badge and the picker follow the *applied* skin
  rather than the site's product (`src/lib/sites.js`, `src/background.js`,
  `src/popup/`).
- Codeberg (Forgejo) and `gitea.com` (Gitea) are bundled hosts. They are
  GitHub-flavoured, so they are classified as the `github` kind and default to
  the GitLab UI, and the per-site picker can show them with the **GitHub UI**
  instead. Either way a token block re-points Gitea's `--color-*` custom
  properties at the skin's palette (the top bar follows the skin's header
  surface and mark), their repo tabs are relabelled into that product's order,
  reference markers match Gitea's `/pulls/N` links, and dark mode reads Gitea's
  `data-theme` (`src/themes/as-gitlab.css`, `src/themes/as-github.css`,
  `src/lib/ux.js`). The GitLab UI rebuilds the repo tabs as a grouped left
  sidebar (Plan/Code/Build/Deploy) and the GitHub UI restyles them as GitHub's
  underlined tab row; the model behind both is the pure `repoNav` in
  `src/lib/ux.js`. A `sources` table records that Gitea is not GitHub's markup,
  so the GitHub UI is a real skin there rather than a no-op, and the
  GitHub/GitLab `g`-combo remap is skipped on it so Gitea's own shortcuts are
  left alone (`src/lib/sites.js`, `src/content/theme.js`, `src/content/ux.js`).
- The two skin stylesheets are named for the skin they apply, not the forge they
  came from: `themes/as-gitlab.css` and `themes/as-github.css` (was
  `github-as-gitlab.css` / `gitlab-as-github.css`). All four stylesheets are
  injected together and scoped by `html.gs-theme-*`, so the file name should
  track that axis; the old names described only the original two hosts and were
  wrong for the Gitea blocks.
- A selector canary, `tools/selector-canary.mjs` (`npm run canary`), with a
  scheduled workflow (`.github/workflows/canary.yml`). It fetches the live pages
  the skins are verified against — GitHub, GitLab and Codeberg (Forgejo
  project and pull-request pages) — and fails when an anchor the extension
  relies on is gone, so an upstream rename is caught by a daily job rather than
  by a user. A failure also opens or refreshes a tracking issue, so the drift is
  owned.
- A **Report a missed spot** link in the popup opens a prefilled issue with the
  host, the applied skin and the fields `CONTRIBUTING.md` asks for. Nothing is
  read from the page; the reporter pastes the element and property themselves
  (`src/popup/`).

### Changed

- The popup's two product checkboxes are one **Show the web with** radio group —
  **GitLab UI**, **GitHub UI** or **Off** — so only one skin is ever active.
  Picking a skin turns the other off, and a state stored with both on is reduced
  to one when the popup opens. The per-kind settings the background and the badge
  read are unchanged (`src/popup/`).

### Fixed

- Elements hidden with the `hidden` attribute are actually hidden now. An
  author `display` rule outranks the UA stylesheet's `[hidden]`, so the popup's
  "open on the other host" button and the new reset link showed as empty boxes
  when they had nothing to say (`src/popup/popup.css`).

## [0.1.2] - 2026-09-21

### Added

- A privacy policy is published with the GitHub Pages preview at
  `docs/privacy.html`, linked from the preview, the README and both store
  listings. It records what gitalike does not collect, what it stores
  (`storage.sync` choices and instances, the page-local theme cache), and what
  it accesses and why (`docs/privacy.html`, `README.md`, `store/`).
- Store publishing is scripted. `npm run publish:chromium` uploads and submits
  the package with the Chrome Web Store **v2** API (v1 is deprecated and stops
  being supported on 15 October 2026); it is a zero-dependency Node script,
  `tools/publish-chromium.mjs`, and reads its credentials from the environment.
  `npm run sign:firefox` signs an unlisted package for addons.mozilla.org with
  `web-ext sign`. The release workflow runs either only when the matching
  repository variable (`CWS_PUBLISH`, `AMO_SIGN`) is set, keeping the store
  credentials scoped to a single step (`.github/workflows/release.yml`,
  `tools/publish-chromium.mjs`).
- Profile pages get the orientation flip, shaped like the target product. On a
  GitHub profile shown as GitLab, the horizontal tab strip becomes a full-height
  GitLab-style super-sidebar headed "Profile", and the profile card moves into
  the content as GitLab's header (a 96px avatar beside the name). On a GitLab
  profile shown as GitHub, the profile super-sidebar is flattened to a single
  row of tabs, dropping GitLab's "Profile" heading and Help menu, and the
  identity moves into a left card under a large avatar beside the README and
  activity (`themes/ux-nav.css`).
- The follower/following counts on a GitLab profile shown as GitHub are copied
  out of the navigation into the profile card under the photo, where GitHub
  shows them, with the navigation copies hidden (`content/ux.js`,
  `themes/ux-nav.css`). GitLab publishes no organisation on a profile, so that
  line stays absent.
- The profile menu is rebuilt as the applied product's: same labels, same order,
  same options. Under the GitHub skin it is exactly GitHub's profile menu —
  Overview, Repositories, Projects, Packages, Stars — mapping Repositories ⇄
  Personal projects, Projects ⇄ Contributed projects and Stars ⇄ Starred
  projects, with the landing item swapped (GitHub's "Overview" ⇄ GitLab's account
  name) and Packages pointed at GitLab's user packages route; GitLab's Activity,
  Groups, Snippets, Followers and Following are dropped. Under the GitLab skin it
  is exactly GitLab's destinations, with GitHub's Activity, Groups and Snippets
  landing on GitLab's own. GitHub's public Achievements block, Pinned repositories
  and Sponsor links are hidden under the GitLab UI (achievements are owner-only
  there, and GitLab has no pinning or sponsoring), and GitLab's README "Read
  more" clip and local-time row are removed under the GitHub UI, which shows the
  README in full and no local time (`content/ux.js`, `themes/ux-nav.css`).
- The GitHub Pages preview (`docs/index.html`) gains GitLab and GitHub
  profile-page swipes beside the project-page ones, captured with
  `npm run screenshots:profiles` (`tools/profile-screenshots.mjs`).
- Project pages get the orientation flip too, shaped like the target product. On
  the GitLab skin, GitHub's repo tabs become a real left sidebar with GitLab's
  group headings (Plan, Code, Build, Deploy, …), the items take GitLab's words
  ("Work items", "Pipelines") and GitLab's order, GitLab-only items on GitHub
  carry a `≠ GitHub` marker, and GitHub's top bar is hidden, since GitLab
  navigates from the sidebar alone. On the GitHub skin, GitLab's stacked project
  blocks are flattened into GitHub's single aligned tab row, showing only
  GitHub's own options — Code, Issues, Pull requests, Actions, Projects, Wiki,
  Security, Insights, Settings (`src/lib/ux.js`, `src/content/ux.js`,
  `src/themes/ux-nav.css`, `src/themes/github-as-gitlab.css`).
- A pre-commit gate runs the same checks CI does plus the cheap ones it does
  not: staged blobs are scanned for merge conflict markers, CRLF, missing
  final newlines, invalid JSON, syntax errors, oversized files and leaked
  credentials, `package.json`/`package-lock.json` are checked for version
  drift, and `npm test` and `npm run lint` run before the commit is created.
  It is dependency-free (`tools/pre-commit.mjs`, `.githooks/pre-commit`) and
  installs itself via `npm install` or `npm run hooks:install`; `git commit
  --no-verify` bypasses it, with CI still the backstop.

### Changed

- The in-page mark is now gitalike's own two-way swap arrow, recoloured to the
  other product's palette, instead of a recoloured copy of the other product's
  logo. The extension no longer bundles GitHub's Octocat or GitLab's Tanuki
  artwork; only the palette is borrowed (`logos/`, `themes/*.css`).
- The Chrome Web Store and addons.mozilla.org listings were corrected: they had
  claimed the extension never rewrites the page, which stopped being true when
  the copy, reference-marker, navigation and shortcut parity shipped
  (`store/listing-chrome.md`, `store/listing-firefox.md`).
- The GitHub Pages preview's screenshot pairs were recaptured, so the skinned
  shots show the gitalike mark. The project-page pairs, previously captured by
  hand, now have a tool (`tools/project-screenshots.mjs`) matching the profile
  pairs'.
- Added the trademark attributions the platforms' brand guidelines ask for —
  GitLab's ™ symbol plus its proprietorship statement, and a GitHub trademark
  line — to the README, both store listings and the extension's manifest
  description.
- Relicensed from MIT to GPL-3.0-or-later. A distributed fork now has to stay
  free software, and a new `NOTICE` records the copyright and an additional term
  under GPLv3 section 7 reserving the gitalike name and the GitHub/GitLab marks.
- Performance: content scripts and stylesheets are now registered only for the
  hosts gitalike is set up on, instead of being injected into every page, so an
  unconfigured page parses neither. This adds the `scripting` permission; the
  all-sites access is unchanged (`manifest.base.json`, `background.js`).
- Performance: the UX content script's whole-body mutation observer is attached
  only while a skin is on and torn down when it is switched off; phrase
  translation is a single alternation pass instead of one per phrase; copy and
  control-label rewrites share one traversal; the mutation batch is de-duplicated
  by ancestor; the navigation, group and profile-menu containers are cached; and
  the undo ledger drops nodes the framework has discarded (`src/lib/ux.js`,
  `content/ux.js`, `content/theme.js`).
- Performance: the toolbar badge refresh reads synced state once for all tabs and
  writes only when the badge actually changes (`background.js`).
- The repository description and metadata now sit where the imitated product
  puts it: GitHub's right-hand "About" sidebar becomes GitLab's full-width
  "Project information" block above the content on the GitLab skin, and GitLab's
  block becomes GitHub's right-hand About column on the GitHub skin. GitHub's
  extra metadata sections — Releases, Packages, Used by, Contributors, Languages
  — are hidden on the GitLab skin, where GitLab's project page lists a fixed,
  smaller set (`src/content/ux.js`, `src/themes/ux-nav.css`,
  `src/themes/github-as-gitlab.css`).
- Documented the project-page parity notes (`docs/PROJECT-PAGE-UX.md`), the
  companion to the profile-page notes.

### Fixed

- A control label that also contains a translated phrase is no longer mangled:
  the exact whole-label lookup now runs on the original text before phrase
  translation, so GitHub's "Merge pull request" button shows GitLab's "Merge"
  rather than "Merge merge request" (`src/lib/ux.js`, `content/ux.js`).
- The repo navigation's order and group tables now name the displayed label
  "Work items" (GitHub's "Issues" under the GitLab UI), so it sorts in place and
  gets its "Plan" heading instead of dropping to the end of the navigation
  (`src/lib/ux.js`).
- The profile menu no longer rebuilds on project pages. It had selected the
  project sidebar's pinned and group sections as well, injecting GitHub's profile
  menu three times and hiding the project navigation; it is now gated to GitLab
  profile pages, like the follower/following copy, and the GitHub-skin strip
  takes GitHub's dark bar colour rather than GitLab's light sidebar one
  (`content/ux.js`).
- The G→L profile rail is gated to GitHub's desktop breakpoint, so mobile keeps
  GitHub's own profile tab row (`themes/ux-nav.css`).
- `package-lock.json` had drifted from `package.json` (`0.1.0` after the `0.1.1`
  release). It is back in lockstep, and the pre-commit gate now fails when the
  two disagree.

### Security

- Stored instance hostnames are validated as bare hostnames before they become
  `scripting.registerContentScripts` match patterns. A synced `gitSameInstances`
  value that is not a hostname (a `*` or `*.corp.example` key, a path or a port)
  is ignored, so it can no longer re-broaden injection to all sites
  (`src/lib/sites.js`, `background.js`).
- Synced settings and instances that are not plain objects are discarded, so a
  tampered value cannot be iterated as a map or throw when written back
  (`src/lib/sites.js`).
- The follower/following copies on a GitLab profile shown as GitHub are rebuilt
  from sanitized clones: script-bearing elements and `on*`/`srcdoc`/`javascript:`
  attributes are stripped before insertion (`content/ux.js`).
- The one-off injection used when a host is added re-reads the tab immediately
  before injecting, so a navigation between the query and the injection cannot
  land the scripts on a different origin (`background.js`).
- The popup warns when a site is added from an `http://` address or while the
  current page is plain `http` (`popup.js`).
- The build no longer copies editor/OS junk or source maps that happen to sit in
  `src/` into the store bundle (`build.mjs`).
- CI pins `actions/checkout` and `actions/setup-node` to full commit SHAs, scopes
  the release token to its job, installs with `npm ci --ignore-scripts`, and adds
  a pull-request workflow that runs the tests, `web-ext lint` and a runtime
  dependency audit (`.github/workflows/`).

## [0.1.1] - 2026-09-20

### Added

- Account/menu chrome is translated too (`CHROME`): "Your repositories" ⇄
  "Your projects", "Your gists" ⇄ "Your snippets", "Your stars" ⇄
  "Starred projects", "Your organizations" ⇄ "Your groups".
- Navigation orientation is matched both ways (`themes/ux-nav.css`): GitHub's
  repo tabs become a vertical, GitLab-style column, and GitLab's sidebar becomes
  a horizontal top strip (GitLab's page grid is collapsed to one column first,
  so the content stays full width).

### Changed

- Internal tidy-up, no behaviour change. The storage schema (`STORAGE_KEYS`,
  `stateFrom`), the theme list (`THEMES`) and the on/off predicate (`kindOn`)
  now live once in `src/lib/sites.js` instead of being repeated by the content
  script, popup, background and screenshot tool. `THEMES` is derived from
  `kinds`, and the GitHub → GitLab route table from its inverse, so the two
  directions cannot drift. The UX content script's per-node passes moved behind
  one `paintNode`, and which product a forge host is (`hostProduct`) moved next
  to the host-pair table. Dead surface was dropped: `isOn`, `translateLabel`
  and `orderItems` (none had a production caller) and the `builtin` /
  `translatePath` exports; `kinds[*].setting` went too, since it always mirrors
  the kind's key.

### Fixed

- The UX content script now **throttles** its DOM updates instead of debouncing
  them. A trailing debounce is starved on a page that mutates continuously —
  GitHub's repo page does — so nodes added while the page keeps changing were
  never painted. The first mutation now schedules a run and later ones batch
  into it.

## [0.1.0] - 2026-09-20

First public release. gitalike re-skins GitHub as GitLab and GitLab as GitHub:
it repaints the interface from the other product's design tokens, then matches
its words and habits. It never changes what the site *does* — no requests are
intercepted, no data is touched — and every change is reverted when a skin is
switched off.

### Added

- Two skins, driven by a class on `<html>`: `gs-theme-gitlab` on
  GitHub-flavoured sites and `gs-theme-github` on GitLab-flavoured ones, plus a
  dark palette for either.
- A UX layer carrying what CSS cannot: copy is translated ("Pull request"
  becomes "Merge request"), reference markers are swapped, the repo navigation is
  relabelled and reordered, and the other product's `g`-shortcuts work. It skips
  code, inputs, editable regions and `[data-gs-ux-skip]`, and undoes every change
  when the skin is switched off.
- An "open on the other host" action — a popup button and `Alt`+`Shift`+`O` —
  that maps the current page onto the other forge (`pull` ⇄
  `-/merge_requests`, issues, file views and so on), for the two public hosts.
- A `≠ GitLab` / `≠ GitHub` marker on a feature the other product does not have
  (GitLab's Epics, Iterations, Requirements, Service Desk, …; GitHub's
  Discussions and Sponsors), instead of leaving it looking native.
- Bundled support for `github.com`, `gitlab.com` and `code.swecha.org`, and a
  popup flow for classifying any other instance — GitHub Enterprise Server and
  self-hosted GitLab included — either on the page in front of you or by typing
  its address.
- Address parsing that accepts bare hosts and full URLs and refuses anything
  that is not an http(s) web address, including `javascript:` and other
  non-http schemes.
- Independent on/off switches per product, with the current site's row
  highlighted and every host each switch covers listed.
- `Alt`+`Shift`+`G` keyboard command to toggle the site you are on, and a
  `GL`/`GH` toolbar badge while a skin is active.
- No network access of any kind: both stylesheets are bundled and both logos are
  inline data URIs.

### Changed

- GitHub's signed-in header (`header.GlobalNav`) is now matched, so it gets
  GitLab's colour and hairline border instead of ending up greyer than the page.
- Dark-mode detection asks the OS directly when GitHub is set to "sync with
  system", instead of reading back its own `color-scheme`.
- GitLab's explicit light mode (`gl-light`) is now honoured, so a light GitLab on
  a dark desktop is no longer skinned dark.
- Logo art was redrawn to recolour the site's own mark in the other brand's
  palette (the shape is never swapped between products), replacing the earlier
  monochrome stand-ins.

### Fixed

- GitLab's filled "Sign in" button no longer renders white-on-white on the
  skinned top bar.
- The `<img>` logo fallback no longer repaints project avatars named "GitLab".
- The popup no longer throws if its shared host list fails to load.
- GitLab's search field no longer keeps a light background under light
  placeholder text.
- GitHub header text no longer stays near-white after the bar is flipped light.

### Notes

- **Text is rewritten.** Labels, copy and reference markers are translated, and
  the repo nav is relabelled and reordered, so a label copied out of the page
  carries the other product's wording. Code, inputs, editable regions and
  `[data-gs-ux-skip]` are never touched, and the nav only reorders its own items
  among the slots they already occupy.
- Keyboard shortcuts are delivered by clicking the site's own navigation link
  where one exists, because GitLab ignores synthetic key events; `g n`
  (notifications) has no link and is GitHub-only.
- The Firefox build declares `data_collection_permissions: none` and requires
  Firefox 142. The Chromium build targets Manifest V3.
- Verified against the live sites in Chromium, including a signed-in session;
  see the README's Verification section for what was and was not exercised.
