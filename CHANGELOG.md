# Changelog

All notable changes to GitAlike are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A **skin and source contract** (`tests/contracts.test.mjs`) that derives the
  skin list from `THEMES` and the source list from `SELECTORS` and names every
  part a new skin or source must supply, so a contributor gets a checklist
  rather than unrelated failures. `tests/ux.test.mjs` now derives the same lists
  and scans every theme file for the `// css` selectors.
- A **Plugins** section on the site and a **Plugin proposal** issue template
  publish the registry — the three skins and the three sources — and invite new
  ones. The page is pinned to the registries by `tests/contracts.test.mjs`, so a
  new plugin cannot ship without appearing there.
- The selector canary now watches **gitea.com** as well as Codeberg, so both
  hosts of the shared Gitea/Forgejo markup family are covered and a divergence
  between the two projects' UIs would fail the daily job (`src/plugins/sources/`).
- `defineSkin`/`defineSource` constructors wrap every registry entry. They fill
  the optional capabilities, validate the required ones, and fail at load with
  the whole list of what a plugin is missing, so a half-added skin or source is
  one clear error rather than a silent no-op on a page. The API version travels
  in the published registry (`src/plugins/core.js`).
- A generated **plugin registry**: `npm run registry` emits `plugins.json` from
  the source registries and rewrites the site's Plugins chips, and
  `tools/registry.mjs` is the one place both come from. `npm run registry:check`
  fails CI when either is out of date, so a plugin cannot ship unlisted.
- `node tools/new-plugin.mjs skin <name>` (or `source <name>`) scaffolds a
  self-contained plugin folder — its `index.js`, a test beside it, and, for a
  skin, its stylesheet and `CONTENT_CSS` entry — wires the entry into every load
  list and relists it on the site; `--dry-run` reports the same plan without
  writing.
- **Gerrit is captured and measured like the other sources.** The capture harness
  grants `gerrit-review.googlesource.com` and registers it as the `gerrit` kind
  for the run only, so the shipped extension still ships no Gerrit host. Project
  and change-list frames exist (`docs/gerrit-*.png`), the docs page shows them,
  and `parity-visual`, `parity-style` and `style-parity` (which pierces
  PolyGerrit's open shadow roots) all include Gerrit's row.
- **Bitbucket and Gerrit are full source plugins now**, with hooks and canary
  pages like the other sources. Bitbucket Cloud is watched on its `#root` app
  shell and, being light DOM, `paintBitbucketNav` reaches its repository bar;
  Gerrit is watched on `gr-app#pg-app`. Both are recoloured by re-pointing the
  design tokens each app reads from the root — Atlassian's `--ds-*`, and
  PolyGerrit's `--primary-text-color` and friends, which inherit across Gerrit's
  shadow boundary (`themes/gs-tokens.css`). Gerrit's copy and navigation inside
  shadow DOM are not reached yet. A source with no hooks at all can still declare
  `markup: false`, and `lib/sources.js` validates at load that a selector is a
  string and that a canary page pins a declared hook.
- A richer published registry: `plugins.json` carries each plugin's
  `description`, a skin's declared `capabilities`, and a source's `markup` flag
  and bundled hosts. `PLUGINS.md` is a generated author catalog and
  `npm run plugins` prints the registry. A plugin may pin the API it was written
  against with `minApiVersion`, checked by `assertCompatible`, and
  `lib/skins.js` validates a skin's `navRules` source cross-references at load.
- A shared test loader (`tools/plugin-test.mjs`) for the per-plugin tests, and
  `src/plugins/core.test.mjs` for the plugin API's own acceptance and rejection
  cases.
- A **layout parity** read (`tools/compare/layout-parity.mjs`,
  `npm run layout-parity`): for every source × skin it gates, on the live pages,
  that the page carries the skin's `gs-layout-*` class and that its navigation
  is oriented as that layout is (row for `github`, column for `gitlab`),
  reporting group headings and profile shape. A pair whose source declared no
  navigation or profile capability is reported `n/a` rather than failed; every
  source declares one now. Unlike the other parity reads it exits non-zero on a
  mismatch, so a layout regression fails a run instead of lowering a score.
- **Gerrit is skinned more fully.** PolyGerrit's header surface now takes the
  applied skin's bar (`--header-background`/`--header-text-color` mapped from the
  skin), so the top bar reads as the product rather than Gerrit's own; and
  **Gitiles** — the server-rendered code browser Gerrit serves at
  `gerrit.googlesource.com/<project>/`, which is not PolyGerrit — is recoloured
  from the skin's `--gs-*` variables (header, links, metadata), scoped to the
  `gerrit` source (`themes/gs-tokens.css`, `themes/ux-nav.css`).
- **Gerrit's GitHub-skin header is proportioned like GitHub's app bar.** Under
  the GitHub skin the bar is 64px with GitHub's nav type (a 20px wordmark,
  14px/600 labels) and its text token is flipped so the search field reads
  light-on-dark instead of dark-on-dark; the search input's own shadow root
  gets a rounded pill. It is a re-proportioning, not a rebuild: Gerrit has no
  repository tab row or About rail, so those GitHub surfaces stay unreproduced,
  and the sidebar layouts are unchanged (`paintGerritNav`).
- **Gerrit's nav words are the applied product's.** Its "Changes" list reads
  *Pull requests* (GitHub) / *Merge requests* (GitLab) and its "Browse" reads
  *Code* / *Repository* / *Source*, relabelled inside the header's shadow root
  with the originals restored on revert (`GERRIT_NAV_WORDS`, `paintGerritNav`).
  The `id`s Gerrit's handlers use are untouched; `compare.nav` rises from 0.5 to
  0.8 and Gerrit's project score to 5.1–5.4.
- **Gitea/Forgejo now honours the applied product's `g`-combos.** Gitea
  implements no combos of its own and GitLab ignores synthetic keys, so delivery
  is a **trusted click** on the repository-navigation link: `g p` / `g b` under
  the GitHub UI and `g m` / `g p` under the GitLab UI navigate (verified live on
  Codeberg), while the linkless combo is left undelivered and the Bitbucket UI
  defines no combos. `shortcutTargets` gains GitLab's labels, `ux-core` admits
  the `gitea` source (and never replays a combo into it), and `compare` credits
  Gitea's reachable share — its project score moves 7.9–8.1 → 8.5–8.6 and its
  profile score 5.6–5.7 → 6.2.
- **Layout parity raised across the sources.** Gitea/Forgejo and Bitbucket
  profile navigation is reoriented to the applied layout
  (`themes/ux-nav.css`: Gitea's profile tab menu becomes a sidebar list under a
  sidebar layout, Bitbucket's workspace nav becomes a row under the GitHub
  layout), and Gerrit's header navigation is reoriented too — PolyGerrit's roots
  are *open*, so `paintGerritNav` reaches the nav and injects a style into its
  shadow root, which a document stylesheet cannot. The three sources declare
  `compare.profile` (and Gerrit `compare.nav`), and the rubric now uses
  `compare.profile` as a fraction, so partial profile coverage scores partially.
  `layout-parity` is now 24/24 gated and passing, and an independent jev pass
  over the same signals grades every pair 9.3–9.9 (was 2.8–9.9). Gerrit's header
  is turned into a fixed **left column** (a sidebar) under the sidebar layouts,
  with the change list beside it, and left as a top bar under the GitHub layout
  (`paintGerritNav`, injecting into the two shadow roots that hold the header and
  `main`). Gitea/Forgejo profiles now follow the skin too: under a sidebar layout
  the header (avatar, name, bio, website) becomes the left rail with the tabs and
  content beside it (`paintGiteaProfile` + `themes/ux-nav.css`). Bitbucket's
  repository bar is also grouped into the applied skin's headings (GitLab's
  Plan/Code/Build/…) by `paintBitbucketNav` where that skin groups, closing the
  flat-menu gap the corrected rubric exposed.
- A **compare-recipe contract** (`tests/compare/recipes.test.mjs`): every
  registry source must have a capture recipe (or a documented exclusion),
  project and profile style-parity selectors, and all of its `compare`
  capabilities, and every skin a target vocabulary. `tools/new-plugin.mjs`
  scaffolds them — a capture stub, selector stubs, the `compare` block and the
  vocab entries — so a new plugin is never silently absent from a parity table;
  the contract names whatever is still missing.

### Changed

- The comparison framework reads its skins and sources from the plugin registry:
  `tools/compare/parity-score.mjs`, `tools/compare/style-parity.mjs` and
  `tests/compare/target-chrome.test.mjs` no longer hand-list them. Each source
  declares its own parity capabilities — `compare`: `palette`, `nav`, `page`,
  `metadata`, `profile`, `refs`, each a fraction — in its plugin file, published
  in `plugins.json`, and the rubric reads those instead of a hardcoded set. The
  capture-based reads take their source set from `captures.mjs` (which throws
  when a source has no recipe or documented exclusion), validate each source's
  skins against the registry, and `style-parity` derives each target's layout
  from the skin's own `layout`.
- The skins and sources are now self-contained folders under `src/plugins/`:
  `src/plugins/skins/<name>/` holds the definition (`index.js`), the palette
  (`as-<name>.css`) and the plugin's own tests (`<name>.test.mjs`), and
  `src/plugins/sources/<name>/` holds the definition and its tests. Each
  `index.js` registers with `defineSkin`/`defineSource` from
  `src/plugins/core.js`, which validates the shape at load. `src/lib/skins.js`
  and `src/lib/sources.js` are now pure derivations of those registrations;
  `src/lib/ux.js` keeps the pure helpers and the shared scopes, and
  `src/lib/sites.js` derives its skin list from the registry. `themes/` now holds
  only the CSS shared across skins. Every plugin entry is wired into each load
  list (the background's `PLUGIN_JS`/`CONTENT_JS`, `popup.html`, the Node loader
  `tools/plugins.mjs`); the Firefox manifest list is generated from the folder by
  `build.mjs`, which also drops the per-plugin tests from the bundle.
  `tests/contracts.test.mjs` checks each folder is self-contained and wired, and
  `npm test` discovers the per-plugin tests. The tables and their consumers are
  unchanged.

### Fixed

- Gerrit's header navigation stays reoriented wherever PolyGerrit renders it —
  the rule was scoped to `gr-main-header`, which the nav is not always inside,
  so it fell back to a row under the sidebar skins (`paintGerritNav` now marks
  the nav and targets the marker). The rules injected into Gerrit's shadow roots
  are also constructed stylesheets (`adoptedStyleSheets`) rather than `<style>`
  nodes, so one appended into the wrong root can no longer render its CSS as
  visible text on the page (`src/content/ux-project.js`).
- The `≠` no-counterpart marker is styled under every skin, not only GitLab and
  GitHub — Bitbucket's badge had been left unstyled. It now targets any active
  `gs-theme-*` class, so a new skin inherits it (`src/themes/ux-markers.css`).
- The contributor guide no longer lists a `skins` entry in `src/lib/sites.js` as
  a step, and the contract test no longer asks for one: `sites.js` derives its
  skin list from the `skins.js` registry, so that edit was a no-op. `sites.test`
  likewise stopped pinning the three skin names, which made a new skin a second
  edit. `navGroupFor`'s parameter is named `theme` rather than `layout`, which is
  what every caller actually passes (`src/lib/ux.js`).

## [0.1.3] - 2026-09-21

### Added

- Code is linted and formatted with the **Vite+ / Oxc** tools:
  [`oxlint`](https://oxc.rs/docs/guide/usage/linter) (`npm run lint:js`) and
  [`oxfmt`](https://oxc.rs/docs/guide/usage/formatter) (`npm run fmt`,
  `npm run fmt:check`). Both run in the pre-commit gate and in CI. Only code is
  formatted — the hand-wrapped Markdown, the YAML, the HTML and the theme CSS
  are left alone (`.oxlintrc.json`, `.oxfmtrc.json`).
- A third skin: **Bitbucket**. Any configured GitHub, GitLab, Gitea or Bitbucket
  site can wear it. Its Atlassian palette is mapped for each source's own tokens
  (Primer on GitHub, Pajamas on GitLab, `--color-*` on Gitea), its repository
  navigation is a left sidebar (so it reuses GitLab's layout), and its vocabulary
  and tab set are Bitbucket's — taken from an archived Bitbucket repository page:
  Source, Commits, Branches, Pull requests, Pipelines, Deployments, Jira issues,
  Security, Downloads. The global **Show the web with** radio and the per-site
  picker both offer it (`src/themes/as-bitbucket.css`, `src/lib/ux.js`,
  `src/lib/sites.js`, `src/background.js`).
- **Bitbucket is a source product too.** `bitbucket.org` is bundled as the
  `bitbucket` kind, and a Bitbucket Data Center host can be added from the popup,
  so a Bitbucket site can be shown with the GitHub or GitLab UI. Its markup is
  its own: the source-agnostic passes run — copy, control labels, account chrome
  and reference markers (its `/pull-requests/N` routes are matched) — but there
  is no token block, `SELECTORS` entry or `NAV_RULES` rule for it yet, because
  Bitbucket Cloud renders its repository page client-side and serves no
  capturable public page to key them on. The parity scorecard carries the gap as
  its own row (`src/lib/sites.js`, `src/lib/ux.js`, `src/content/ux-copy.js`,
  `src/popup/`, `src/manifest.base.json`, `tools/compare/parity-score.mjs`).
- **Gerrit is a source too.** It is added one instance at a time from the popup
  (there is no canonical host to bundle) and can be shown with the GitHub or
  GitLab UI. Like Bitbucket it is vocabulary-only: its PolyGerrit UI is
  client-rendered, so there is no token, `SELECTORS` or `NAV_RULES` coverage;
  and its changes are numbered (`/c/<project>/+/<N>`) with a Change-Id rather
  than a `#`/`!` pull-request marker, so the reference-marker pass does not reach
  it either (`src/lib/sites.js`, `src/popup/`, `tools/compare/parity-score.mjs`).
- **Auto-discovery of a link's forge.** When a host is not set up yet, the popup
  reads the address and highlights the product it looks like, so a pasted deep
  link needs only a confirmation: `/-/merge_requests/42` is GitLab, `/pull/42`
  GitHub, `/pulls/42` Gitea/Forgejo, `/pull-requests/42` Bitbucket and
  `/c/project/+/42` Gerrit — even on a host never seen before. It is a pure read
  of the URL (no page access, no network, no new permission), falls back to the
  hostname, and leaves the product buttons for a bare host it cannot place.
  Pressing Enter takes the highlighted product (`src/lib/ux.js` `guessForge`,
  `src/popup/popup.js`, `tests/ux.test.mjs`).
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
- A selector canary, `tools/compare/selector-canary.mjs` (`npm run canary`), with a
  scheduled workflow (`.github/workflows/canary.yml`). It fetches the live pages
  the skins are verified against — GitHub, GitLab and Codeberg (Forgejo
  project and pull-request pages) — and fails when an anchor the extension
  relies on is gone, so an upstream rename is caught by a daily job rather than
  by a user. A failure also opens or refreshes a tracking issue, so the drift is
  owned.
- A **Report a missed spot** link in the popup opens the bug-report form with the
  host, the applied skin and the version prefilled by field id. Nothing is read
  from the page; the reporter pastes the element and property themselves
  (`src/popup/`).
- Issue and pull-request templates. `.github/ISSUE_TEMPLATE/` holds a bug report
  (host, signed-in, site theme, browser, version, expected-versus-saw, element
  and property, screenshots) and a feature request (kind, proposal, counterpart,
  the ground rules), behind a chooser that links the live preview, the README and
  `CONTRIBUTING.md`; `.github/PULL_REQUEST_TEMPLATE.md` carries the
  pull-request checklist. Blank issues stay enabled.
- The **See it** gallery now covers the **Bitbucket source**: a project page and
  its workspace repositories page, each shown against the GitHub and GitLab UIs.
  Bitbucket's markup has no palette or navigation pass yet, so the cards say so
  and the skins visibly change only the words. The capture table gained the two
  jobs, `docs/index.html` the two cards, and `tools/compare/screenshots.mjs` a
  `GS_ONLY` filter so one job can be re-shot without rewriting every PNG
  (`tools/compare/captures.mjs`, `docs/index.html`, `docs/bitbucket-*.png`).
- The end-to-end suite runs on a schedule (and on demand) in
  `.github/workflows/e2e.yml`, beside the selector canary. It drives the live
  sites, so it is not a commit gate, but it is the only test of the CSS and DOM
  layer and should not wait to be run by hand.
- Publishing to the Microsoft Edge Add-ons store is scripted:
  `npm run publish:edge` (`tools/publish-edge.mjs`), alongside the Chrome Web
  Store and addons.mozilla.org scripts.
- The computed-style parity gate scores against a **reviewed, skin-independent
  reference** now (`tests/fixtures/target-chrome.json`): the target products'
  real header / canvas / link colours, not the applied skin's own `--gs-*`
  variables, so the score measures fidelity to the product rather than
  self-consistency. The gate also fails when a skin's header or canvas is the
  wrong colour, and `tests/compare/target-chrome.test.mjs` pins the light
  palettes to the same fixture offline (`tools/compare/style-parity.mjs`).
- A **Bitbucket-source page now repaints** under the GitHub and GitLab UIs.
  Bitbucket Cloud exposes Atlassian's `--ds-*` design tokens on `<html>`, so the
  shared token layer re-points the semantic ones — surfaces, text, links,
  borders, icons, selected/brand backgrounds and radii — at the applied skin's
  palette, and gives the top bar that skin's header treatment. The markup is
  still Bitbucket's (no `SELECTORS` entry or `NAV_RULES` rule), so metadata stays
  partial (`src/themes/gs-tokens.css`, `tools/compare/parity-score.mjs`,
  `docs/UX-PARITY.md`).
- A Bitbucket source's **navigation is now relabelled and reoriented**.
  `paintBitbucketNav` finds the repository bar and the workspace side nav by
  content (Bitbucket's classes are hashed), relabels their items to the applied
  product's words — `NAV` for the repository bar, a small profile map for the
  account nav — and reorients them: a sidebar under the GitLab/Bitbucket UI, a
  tab row under GitHub. It is scoped by URL so the bar and the account nav are
  handled separately, and every change reverts with the skin
  (`src/lib/ux.js`, `src/content/ux-project.js`, `src/themes/ux-nav.css`).
- The logged-out top bar's **source-only marketing words are hidden** under the
  opposite skin: GitHub's "Open Source"/"Enterprise" links and its "Sign up" CTA
  under the GitLab UI, GitLab's "Why GitLab"/"Explore" and its "Get free trial"
  under the GitHub UI. The words both products share ("Platform", "Solutions",
  "Resources", "Pricing") are left alone, and every change reverts with the skin
  (`TOPBAR_HIDE`, `src/content/ux-nav.js`).
- An **independent semantic-judge check** of the two headline skin directions,
  over TypeSafe's Jev model (`tools/compare/parity-judge.mjs`,
  `npm run parity:judge`). The recorded run is in
  `tests/fixtures/parity-judge.json`, quoted in `docs/UX-PARITY.md`, and pinned
  offline by `tests/compare/parity-judge.test.mjs`.

### Changed

- The product is now **GitAlike** — *any git platform, preferred UX.* The
  extension, its toolbar title, the popup, both store listings and the docs use
  it. The lowercase `gitalike` slug is unchanged where it is an address or an
  identifier — the repository and Pages URLs, `package.json`'s name, the mark
  files, the `GITALIKE_UX` global, the `gitalike-theme`/`gitalike-ux` script ids
  and the release asset names — so existing links, the `gitalike@riseup.net`
  Gecko id and installed copies keep working. The store name fits Chrome's
  45-character limit.
- Permissions are scoped. The bundled hosts (`github.com`, `gitlab.com`,
  `codeberg.org`, `gitea.com`) are granted at install, and a self-hosted
  instance is granted one origin at a time from the popup's Add a site click
  (`optional_host_permissions`) instead of the extension holding access to all
  sites. `code.swecha.org` is no longer bundled — it is a self-hosted GitLab, so
  it goes through the same per-origin flow. A test keeps the manifest's static
  host list in step with the `builtin` table (`src/manifest.base.json`,
  `src/background.js`, `src/popup/popup.js`, `tests/sites.test.mjs`).
- The GitLab skin shows GitHub's top bar instead of hiding it, restyled to
  GitLab's light bar with a hairline border and GitAlike's mark. GitLab has a
  light top bar above its sidebar, so hiding GitHub's was the stale half of a
  contradictory pair (`src/themes/as-gitlab.css`).
- The popup's two product checkboxes are one **Show the web with** radio group —
  **GitLab UI**, **GitHub UI** or **Off** — so only one skin is ever active.
  Picking a skin turns the other off, and a state stored with both on is reduced
  to one when the popup opens. The per-kind settings the background and the badge
  read are unchanged (`src/popup/`).
- Grouping follows the skin, so only GitLab groups its sidebar. `NAV_GROUPS`/
  `navGroupFor` are keyed by the skin, and both the live pass and Gitea's
  rebuild look them up by skin: a skin that shares GitLab's layout (Bitbucket)
  keeps its flat list, so GitHub's flat tabs are not gathered under GitLab's
  headings and a GitLab source's own headings are dropped under Bitbucket. The
  `LABELS`/`CHROME` round-trip test — which only held for a pair of skins — is
  replaced by a coverage property across all three targets
  (`src/lib/ux.js`, `src/content/ux-nav.js`, `src/content/ux-project.js`,
  `src/themes/ux-nav.css`, `tests/ux.test.mjs`).
- Each skin moves the repository metadata to the imitated product's place and
  heading. Under the GitLab skin GitHub's About sidebar becomes a full-width
  "Project information" block (heading renamed), the GitHub-only sections
  (Releases, Packages, Used by, Contributors, Languages) are hidden, and the
  contribution graph is repainted GitLab indigo; under the GitHub skin GitLab's
  block becomes the right-hand About column (heading renamed "About"), GitLab's
  coverage bar, badges and "Created on" are dropped, and the graph is repainted
  GitHub green (`src/content/ux-project.js`, `src/content/ux-profile.js`,
  `src/themes/ux-nav.css`).
- Under the GitHub skin a GitLab project's scattered sidebar is rebuilt as
  GitHub's flat tab row — Code, Issues, Pull requests, Actions, Projects, Wiki,
  Security and quality, Insights — and hosted under the repository header, where
  GitHub puts it; Gitea's row gains the Wiki and Insights tabs Gitea has routes
  for (`src/content/ux-project.js`, `src/lib/ux.js`).
- Profile pages are shaped like the target product: on a GitHub profile shown as
  GitLab the organization, location and contact links move into an
  About/Info/Contact rail and Pinned becomes Personal projects; a profile wearing
  the Bitbucket skin drops the rail and the contribution graph, which Bitbucket
  does not have (`src/content/ux-profile.js`, `src/themes/as-bitbucket.css`).

### Fixed

- A GitLab project shown with the Bitbucket skin is now reordered to Bitbucket's
  tab order. `NAV_RULES.bitbucket` had a rule for a GitHub and a Gitea source
  but none for GitLab, so its sidebar kept GitLab's order (Repository, Branches,
  Commits, …) instead of Bitbucket's (Source, Commits, Branches, …); the rule
  resolves GitLab's repository group by its displayed label ("Source") the same
  way the GitHub skin's GitLab rule does (`src/lib/ux.js`, `tests/ux.test.mjs`).
- Elements hidden with the `hidden` attribute are actually hidden now. An
  author `display` rule outranks the UA stylesheet's `[hidden]`, so the popup's
  "open on the other host" button and the new reset link showed as empty boxes
  when they had nothing to say (`src/popup/popup.css`).
- The one-skin rule is enforced where the data is read, not only in the popup:
  `stateFrom` collapses a state whose kinds disagree to a single skin, so a
  profile upgraded from the two-switch model cannot leave two skins active or
  lose one silently when the popup first opens (`src/lib/sites.js`).
- The GitHub-skin project strip no longer shows a stray list bullet before its
  first tab, or GitLab's "Project" sidebar label for which GitHub's repo header
  has no counterpart (`src/content/ux-project.js`, `src/themes/ux-nav.css`).
- The GitLab skin hides GitHub's **signed-in app header** (`.AppHeader`,
  `header.GlobalNav`) — GitLab has no top menubar. The logged-out marketing
  header is still restyled to GitLab's light bar (`src/themes/as-gitlab.css`).
- The Chrome Web Store and addons.mozilla.org listings no longer say
  `code.swecha.org` is bundled — it was unbundled in 0.1.3 — and now list
  `bitbucket.org` among the five hosts granted at install, in the permission
  justifications and the privacy text as well as the description.
- The store short descriptions and the manifest description name Bitbucket
  alongside GitHub and GitLab, matching the three skins the extension ships.

## [0.1.2] - 2026-09-21

### Added

- A privacy policy is published with the GitHub Pages preview at
  `docs/privacy.html`, linked from the preview, the README and both store
  listings. It records what GitAlike does not collect, what it stores
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

- The in-page mark is now GitAlike's own two-way swap arrow, recoloured to the
  other product's palette, instead of a recoloured copy of the other product's
  logo. The extension no longer bundles GitHub's Octocat or GitLab's Tanuki
  artwork; only the palette is borrowed (`logos/`, `themes/*.css`).
- The Chrome Web Store and addons.mozilla.org listings were corrected: they had
  claimed the extension never rewrites the page, which stopped being true when
  the copy, reference-marker, navigation and shortcut parity shipped
  (`store/listing-chrome.md`, `store/listing-firefox.md`).
- The GitHub Pages preview's screenshot pairs were recaptured, so the skinned
  shots show the GitAlike mark. The project-page pairs, previously captured by
  hand, now have a tool (`tools/project-screenshots.mjs`) matching the profile
  pairs'.
- Added the trademark attributions the platforms' brand guidelines ask for —
  GitLab's ™ symbol plus its proprietorship statement, and a GitHub trademark
  line — to the README, both store listings and the extension's manifest
  description.
- Relicensed from MIT to GPL-3.0-or-later. A distributed fork now has to stay
  free software, and a new `NOTICE` records the copyright and an additional term
  under GPLv3 section 7 reserving the GitAlike name and the GitHub/GitLab marks.
- Performance: content scripts and stylesheets are now registered only for the
  hosts GitAlike is set up on, instead of being injected into every page, so an
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

First public release. GitAlike re-skins GitHub as GitLab and GitLab as GitHub:
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
