# Contributing to GitAlike

Thanks for taking a look. It is a small extension with a few firm rules; the
rest is straightforward. If you only read one section, read
[Ground rules](#ground-rules).

Looking for what the extension does and how to install it? That is the
[README](README.md).

## Ground rules

**Everything is scoped to a class, and reversible.** The skin hangs off
`gs-theme-gitlab` / `gs-theme-github` on `<html>`. When those classes are absent
the extension must be completely inert — no styling, no rewritten text, nothing
to undo. If you add behaviour, make sure switching the skin off restores the
page exactly.

**Nothing leaves the browser.** No network requests, no telemetry, no remote
code. Both stylesheets ship in the bundle and every logo is an inline data URI.
There is no build-time or runtime dependency for the shipped extension, and we
would like to keep it that way. The only data that leaves the machine is
`chrome.storage.sync`, which the browser syncs to the user's account — the
settings and the hostnames they added, never anything read from a page.

**One source of truth per concern.** Hosts, kinds, address parsing and the
storage schema live in `src/lib/sites.js`; each **skin** — a target UI's
vocabulary, navigation order, profile menu and shortcuts — is one file under
`src/plugins/skins/`; each **source** — a forge markup family's DOM hooks and
canary pages — is one file under `src/plugins/sources/`; `src/lib/skins.js` and
`src/lib/sources.js` derive the flat tables from those registrations; and the
pure helpers that compose them (path translation, forge selection, the shared
nav scopes) live in `src/lib/ux.js`. None touches the DOM, which is what makes
them unit-testable. The manifest repeats hostnames only because the manifest
format cannot read a JavaScript file.

**Stay conservative on the page.** The UX layer must never rewrite text inside
`<code>`, inputs, editable regions or anything marked `[data-gs-ux-skip]`, and
it should only change a navigation label on an exact whole-label match inside a
known navigation region. Over-eager rewriting breaks search, copy/paste and
screen readers. When markup is unfamiliar, prefer doing nothing.

**Logos are original; never bundle a vendor's mark.** The mark painted on a
skinned page is GitAlike's own two-way swap arrow (`src/icons/icon.svg`), only
recoloured to the other product's palette. Never copy a forge's logo — or its
vector path data — into `logos/` or a theme; recolouring someone else's mark is
still shipping their artwork. Sources live in `logos/`; see
[Add or change a logo](#add-or-change-a-logo).

**Keep permissions minimal.** The extension grants the bundled hosts at install,
plus `scripting` to register the content scripts and stylesheets for the hosts it
is set up on; a self-hosted instance is granted one origin at a time from the
popup (see [Why it matches every site](#why-it-matches-every-site)). Adding
another permission needs a very good argument.

## Getting set up

```sh
npm install          # dev-only deps; also installs the git hooks
npm run build        # -> dist/chromium and dist/firefox
npm test             # unit tests, no browser needed
node tools/compare/e2e.mjs   # Playwright end-to-end test against the live sites
npm run lint         # web-ext lint over the Firefox build
npm run lint:js      # oxlint (Vite+ / Oxc) over src, tools and tests
npm run fmt          # oxfmt — format the code in place
npm run package      # store-ready zips -> dist/artifacts/
npm run screenshots  # regenerate store/screenshots/
npm run screenshots:projects  # refresh the docs/ project-page captures
npm run screenshots:profiles  # refresh the docs/ profile-page captures
npm run webp         # generate the docs/ WebP a local preview needs
npm run clean        # remove dist/
```

The docs/ captures are committed as PNGs; the WebP variants `docs/index.html`
prefers are generated at deploy time by `.github/workflows/pages.yml`. A browser
does not fall back to the PNG once a `<picture>` source fails, so run
`npm run webp` after a fresh clone (or after `npm run screenshots`) or the local
preview shows blank captures.

To try it, load `dist/chromium` unpacked — see
[Install](README.md#install) for the click-by-click.

There are no runtime or build dependencies: `build.mjs` uses only Node's
standard library, and the tests use Node's built-in `node:test`. Four dev
dependencies exist: [`web-ext`](https://github.com/mozilla/web-ext) for
`npm run lint` and `npm run package`,
[`playwright-core`](https://playwright.dev/) for `npm run screenshots` and
`node tools/compare/e2e.mjs` (both drive the system Chromium and download no browser of
their own), and the **[Vite+](https://viteplus.dev)/Oxc** pair
[`oxlint`](https://oxc.rs/docs/guide/usage/linter) and
[`oxfmt`](https://oxc.rs/docs/guide/usage/formatter) for `npm run lint:js` and
`npm run fmt`.

### The pre-commit gate

Every commit runs a gate first. It reads the *staged* blobs — not the working
tree — and rejects merge conflict markers, CRLF line endings, missing final
newlines, invalid JSON, JavaScript that fails `node --check`, oversized files
and leaked credentials. It then checks that `package.json` and
`package-lock.json` are in lockstep, and runs `npm test`, `npm run lint`,
`npm run lint:js` and `npm run fmt:check` — the same commands CI runs.

`npm install` wires it up through the `prepare` script (`.githooks/`); if you
cloned before the hooks existed, apply them with:

```sh
npm run hooks:install
```

The checks live in `tools/pre-commit.mjs`, so `npm run precommit` runs exactly
what the hook does. For a genuine emergency, `git commit --no-verify` skips the
gate — CI is still the backstop, so the commit will not land on `main` if it
fails there.

## Layout

```
src/
├── manifest.base.json   shared manifest; the build adds `background` + `version`
├── background.js        keyboard shortcuts and per-tab badge
├── plugins/             ONE FOLDER PER PLUGIN
│   ├── core.js          the defineSkin/defineSource API + validation
│   ├── skins/<name>/    index.js + <name>.test.mjs + as-<name>.css
│   └── sources/<name>/  index.js + <name>.test.mjs
├── lib/
│   ├── skins.js         derives the skin tables from plugins/skins/ — pure
│   ├── sources.js       derives SELECTORS/CANARY_PAGES — pure
│   ├── sites.js         hosts, kinds, parseHost, schema — pure, no DOM
│   └── ux.js            vocabulary/nav/shortcut/path/selector tables — pure, no DOM
├── content/
│   ├── theme.js         applies the theme classes, tracks light/dark
│   └── ux.js            performs the text and nav rewrites, undoably
├── themes/              the CSS shared across skins: gs-tokens.css, the
│                        ux-markers.css no-counterpart badge and the ux-nav.css
│                        orientation rules (a skin's own palette is in its folder)
├── popup/               toolbar UI
└── icons/
logos/                   editable logo sources, inlined into the themes
docs/                    the GitHub Pages preview + UX-PARITY.md — the parity matrix
tests/                   node:test, covers src/lib/ and the plugin contract
tools/                   the plugin registry + scaffold, the store and docs
                         screenshots, the Playwright end-to-end test, and the
                         live selector canary
store/                   submission copy and screenshots
```

`src/plugins/*` registers the skins and sources on
`globalThis.GITALIKE_PLUGINS`; `src/lib/*` is pure data and side-effect-free
helpers derived from it and published on `globalThis.GITALIKE` /
`globalThis.GITALIKE_UX`, shared by the content scripts, the popup, the
background and the tests. `src/content/*` is the only code that touches a page.

## How it works

Both sites are built on design-token systems, and almost everything on the page
reads its colours from a handful of CSS custom properties:

- GitHub → [Primer](https://primer.style/product/primitives/) (`--fgColor-*`,
  `--bgColor-*`, `--borderColor-*`, plus the legacy `--color-*` names)
- GitLab → [Pajamas](https://design.gitlab.com/) (`--gl-*`)

So GitAlike mostly re-points those properties at the other design system's
palette, then fixes up a few structural things the tokens cannot reach (the top
bar, the logo, active-tab accents, navigation orientation). The stylesheets and
two classes do the visual half; a second content script does the copy,
reference, navigation and keyboard half, driven by the tables derived from the
plugin files (`src/plugins/skins/`, `src/plugins/sources/`).

```
content script (document_start, registered for the configured hosts only)
  ├─ reads the cached decision from this origin's localStorage -> applies it now
  ├─ reconciles with chrome.storage.sync                       -> keeps the cache warm
  ├─ mirrors the site's dark mode                              -> html.gs-dark
  └─ reacts to storage + DOM changes

ux content script (inert unless a theme class is present)
  ├─ rewrites page copy and nav labels        -> the skin's plugin tables
  ├─ rewrites # / ! reference markers          by the link's href
  ├─ reorders the repo navigation              into the other product's order
  ├─ marks features the other product lacks    -> a .gs-no-equiv badge
  └─ remaps the other product's g-combos       recording everything so it reverts

stylesheet (registered for the configured hosts, inert unless the class is present)
  html.gs-theme-gitlab { ... }   re-skins GitHub-flavoured sites
  html.gs-theme-github { ... }   re-skins GitLab-flavoured sites
  html.gs-dark         { ... }   dark palette for whichever skin is on
```

### Why it matches every site

GitHub Enterprise Server and self-hosted GitLab live on hostnames nobody can
predict: `github.acme.com`, `code.corp.example`, sometimes with no `github.`
prefix at all. A manifest match pattern cannot wildcard a host's middle —
`https://github.*/*` is not valid — so there is no host list to write at build
time for *every* instance.

So the manifest grants only the bundled hosts (`github.com`, `gitlab.com`,
`codeberg.org`, `gitea.com`, `bitbucket.org`), and declares
`optional_host_permissions` for the rest. When you add an instance in the popup,
it calls `permissions.request()` for that one origin — the Add a site click is a
user gesture, so the browser allows it — and the origin is granted from then on.
A user who never adds an instance sees a narrow install prompt and no dialog at
all; a power user pointing the extension at `code.corp.example` sees one prompt,
once, at the moment they asked for that host. `background.js` then keeps
`scripting.registerContentScripts` scoped to the hosts it knows *and holds
permission for* — the bundled ones plus whatever the user added — and
re-registers when the set changes (a storage change or a permission grant). An
unconfigured page therefore never parses the content scripts or the stylesheets.

The test in `tests/sites.test.mjs` keeps `manifest.base.json`'s static host list
in step with the `builtin` table, since the manifest cannot read `sites.js`.

The extension is inert everywhere it has not been set up: the scripts are only
registered on classified, granted hosts, and every stylesheet is scoped to
`html.gs-theme-*` classes that only get added there.

## Common tasks

### Fix a spot the skin misses

1. In DevTools, find the element and note the property you want to change.
2. **Prefer re-pointing a design token over adding a rule.** Most of the work is
   done by mapping Primer's `--fgColor-*` / `--bgColor-*` and Pajamas' `--gl-*`
   onto our own palette.
3. If a rule really is needed, keep it under `html.gs-theme-*` so it stays inert
   when the skin is off.

Each theme file has three parts:

1. **A palette block** for this extension only: `--gs-canvas`, `--gs-fg`,
   `--gs-accent`, `--gs-purple`, … with a light set and a `html.gs-dark`
   override.
2. **A mapping block** that points the site's own tokens at the palette, e.g.

   ```css
   html.gs-theme-gitlab {
     --fgColor-default: var(--gs-fg) !important;
     --bgColor-accent-emphasis: var(--gs-accent) !important;
   }
   ```

   Add a line here whenever you find a spot the skin misses.

   If the fix is structural rather than colour, add the selector itself to
   `SELECTORS` in the source's plugin file under `src/plugins/sources/` — keyed
   by the *source* product (the site's markup), not the skin applied to it — and
   read it from `src/content/ux-*.js`.
   A literal there cannot be checked by `npm run canary`; a `SELECTORS` entry
   can, and the canary probes every entry a `CANARY_PAGES` page names.

3. **A logo data URI**, `--gs-mark`, that paints GitAlike's own mark in the
   other product's palette — GitLab's red→orange→yellow in the GitHub→GitLab
   skin, Primer's ink and accent blue in the GitLab→GitHub one.

Hosts, products and the bundled host list live in `src/lib/sites.js` — one
source of truth shared by the content script, the popup and the background.

### Support another Git instance

Usually you should not add it to the source at all — that is what the popup's
**Add a site** flow is for, which asks for that one origin when you click. Only
add a *built-in* host for something we want to work out of the box:

1. `src/lib/sites.js` — add it to the `builtin` table.
2. `src/manifest.base.json` — add `*://<host>/*` to `host_permissions`, so it is
   granted at install rather than requested per origin.
3. `tests/sites.test.mjs` — the manifest-permissions test covers it.

A self-hosted instance needs no source or manifest change: the popup requests its
origin at runtime — see
[Why it matches every site](#why-it-matches-every-site).

### Add or change a logo

The mark is GitAlike's own — the same two-way swap arrow as the toolbar icon —
so there is no vendor artwork in the tree. Keep it that way: draw an original
mark rather than copying a forge's.

1. Edit the SVG in `logos/` (these are the editable sources).
2. Re-encode it as a data URI into the relevant theme variable — `--gs-mark` in
   both `src/plugins/skins/gitlab/as-gitlab.css` and
   `src/plugins/skins/github/as-github.css`.
   Injected CSS cannot resolve extension-relative URLs, which is why it is
   inlined rather than linked.
3. Check both light and dark: the two palettes are chosen for their background.

### Add a label translation

1. Add it to the right table in the skin's plugin file under
   `src/plugins/skins/`. `PHRASES` is ordinary page copy,
   `NAV` is navigation labels, `LABELS`/`CHROME` are whole control and account
   labels, `UNMAPPED` is features the other product lacks. Longest key wins, so
   add the plural before the singular.
2. Add a case to `tests/ux.test.mjs`.
3. Do not translate inside code, inputs or editable regions — the content script
   already skips those, so just avoid adding a rule that would need an exception.

### Add a keyboard shortcut

`SHORTCUTS` in the skin's plugin file under `src/plugins/skins/`, plus a test. A combo that has a navigation link
is delivered as a click (`SHORTCUT_TARGETS`); the rest fall back to synthetic key
events.

### Change the navigation order or orientation

`NAV_RULES` in the skin's plugin file under `src/plugins/skins/` holds the desired item order; orientation is CSS
in `themes/ux-nav.css`.

- **G→L** turns GitHub's repo tab bar into a left sidebar by making `main` a grid
  and the tab bar's wrapper `display: contents`, so the repo header and the tabs
  can be placed independently. GitHub's responsive tab bar hides the real items
  and clones them into an overflow menu when they stop fitting the bar, so the
  body items are forced `visibility: visible`. `NAV_GROUPS` gathers the items
  under GitLab's group headings, which the content script inserts after the
  reorder (`paintNavGroups`), and the CSS styles them. GitHub's logged-out top
  bar (`header[role="banner"]`, `.js-header-wrapper`) is restyled to GitLab's
  light bar; the signed-in app header (`.AppHeader`, `header.GlobalNav`) is
  hidden outright under the GitLab skin, because GitLab has no top menubar.
- **L→G** makes GitLab's sidebar horizontal, but GitLab's page is a grid
  (`.layout-page.page-with-super-sidebar`), so that grid is collapsed to one
  column first — otherwise the content keeps the narrow column.

## Adding another forge — contributions welcome

GitAlike knows five source products — GitHub, GitLab, Gitea/Forgejo, Bitbucket
and Gerrit — each one folder under `src/plugins/sources/`, and paints three
skins: GitLab, GitHub and Bitbucket. Every source carries the DOM hooks a skin
keys on and a canary page. A source whose UI is client-rendered is recoloured
through the custom properties it reads rather than by reaching into its tree —
Bitbucket Cloud's Atlassian `--ds-*` tokens, PolyGerrit's `--primary-text-color`
and friends — which is what `themes/gs-tokens.css` maps (`markup: false` is still
available for a source with no hooks at all). Codeberg (Forgejo) and gitea.com
(Gitea) are bundled as GitHub-flavoured, shown with the GitLab UI; Bitbucket is
bundled as its own source, shown with the GitHub UI; Gerrit has no bundled host,
and is added one instance at a time. **More are wanted.** Sourcehut is a genuinely different product that needs its own skin; a
new *source* forge (one people host) also needs classifying. Either way,
`tests/contracts.test.mjs` is the checklist — it fails with the pieces still
missing — and `node tools/new-plugin.mjs source <name>` writes the folder (its
definition, a test, and stubs for its `compare` capabilities and its capture and
style-parity recipes). Classifying a host and adding the vocabulary are the
parts that still need judgement, and `tests/compare/recipes.test.mjs` is the
compare-side checklist. [`PLUGINS.md`](PLUGINS.md) is the generated
author catalog, and `npm run plugins` prints the registry.

### A forge that already speaks one of the two dialects

Forgejo, Gitea and Codeberg are GitHub-flavoured: pull requests, a tab bar, the
same shape of repository page. They do not need a new vocabulary — they need to
be classified as the `github` kind, so the existing GitLab skin applies:

```js
// src/lib/sites.js
const builtin = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
  'codeberg.org': 'github', // Forgejo
  'gitea.com': 'github',    // Gitea
};
```

Add the host to `tests/sites.test.mjs`. If the forge is Gitea-family it does not
use GitHub's Primer tokens, so the classification alone only changes the words —
`src/plugins/skins/gitlab/as-gitlab.css` and `src/plugins/skins/github/as-github.css` each have a
**Gitea / Forgejo** block that re-points its `--color-*` custom properties at that
skin's palette, `src/plugins/sources/gitea.js` adds its markup hooks to
`SELECTORS.gitea` so the canary can watch them, and each skin's plugin file adds
its repo tab list to `navRules` (with the shared `NAV_SCOPE` in `ux.js` covering its
region) so its tabs are relabelled and reordered. The GitLab skin also rebuilds
those tabs as a grouped sidebar:
`content/ux-project.js` `paintGiteaNav` and the `UX.repoNav` model, keyed off Gitea's
`[data-theme]` marker, apply to any Gitea-family instance. Record the host in
`SOURCES` in `src/lib/sites.js` too, so the picker knows
the site is *not* the product it is classified as (making the other UI a real
skin) and the `g`-combo remap is skipped on it. Copy those shapes for another
token system or another tab bar. Only add vocabulary if the forge uses a
different word — Forgejo says "Pull request", so there is nothing to do there.

You can already point GitAlike at any instance without touching the source: the
popup's **Add a site** flow exists for exactly that. A `builtin` entry just means
it works out of the box.

### Adding a skin

Sourcehut is not GitHub with a different logo; it needs its own skin and its own
vocabulary. **Bitbucket is the worked example**: it began as a *target only* —
no host was classified as it, so it could be worn by any source — and is now a
source in its own right as well. Adding a target means:

A skin is a self-contained folder. `node tools/new-plugin.mjs skin <name>` writes
steps 1–4 for you; the rest is the part that needs judgement.

| # | File | What goes there |
| - | ---- | --------------- |
| 1 | `src/plugins/skins/<name>/index.js` | one `defineSkin('<name>', { … })` call: `product`, `badge`, `color` (#rrggbb) and `layout` ('github' or 'gitlab'), every required table (`phrases`, `nav`, `labels`, `chrome`, `unmapped`, `navRules`, `profileMenu`), and whichever optional capabilities (`repoOrder`, `shortcuts`, `topbarHide`, `groups`, `keep`/`hide`, `projectTabs`) it needs. The name is the key, so it joins `THEMES`, the popup and the badge with no other edit |
| 2 | `src/plugins/skins/<name>/as-<name>.css` | the skin — a palette block (light and `.gs-dark`), a token mapping *per source* (Primer, Pajamas, Gitea's `--color-*`), the structural rules, and the `--gs-mark` |
| 3 | `src/plugins/skins/<name>/<name>.test.mjs` | the skin's own tests, beside it. `npm test` discovers them; the cross-skin invariants stay in `tests/ux.test.mjs` |
| 4 | load lists | the entry is added to `PLUGIN_JS` and `CONTENT_CSS` in `src/background.js`, `src/popup/popup.html` and `tools/plugins.mjs`; the Firefox manifest derives its list from the folder. `tools/new-plugin.mjs` does this for you |
| 5 | parity/docs | a reviewed colour entry in `tests/fixtures/target-chrome.json`, the target vocabulary in `tools/compare/style-recipes.mjs` (scaffolded as a `TODO`), and a capture variant on every source in `tools/compare/captures.mjs` plus `npm run screenshots`; `npm run registry` relists it in the site, `plugins.json` and `PLUGINS.md`. `tests/compare/recipes.test.mjs` names anything missing |

The completeness gate is **`tests/contracts.test.mjs`**: it derives the skin and
source lists and fails with the parts a new one is still missing, by name. Run
`npm test` after each edit rather than discovering the gaps at the end.
`src/themes/ux-markers.css` needs no edit — the no-counterpart badge targets any
`gs-theme-*` class — and the popup's UI needs none either: the global radio and
per-site picker are generated from `THEMES`. (The popup's script list is the one
line `tools/new-plugin.mjs` adds; a hand-added skin needs it too.)

A target's `layout` (`github` = top bar + tab row, `gitlab` = left sidebar) is
the shape it is built to. Two skins that share a shape share the structural CSS
(through the `gs-layout-*` class) and the structural passes, so Bitbucket — whose
repo navigation is a left sidebar — reuses GitLab's and only supplies Atlassian's
colours and its own words. The stylesheets
scope by *token name*, which is how one file maps three sources: `--fgColor-*`
(Primer) is inert on GitLab and Gitea, `--gl-*` on the others, and Gitea's
`[data-theme]` block picks up only Gitea.

`SELECTORS` is keyed by **source**, not by the skin applied, and a target skin
usually adds none. If your product is also a site people host (a new forge), see
[Support another Git instance](#support-another-git-instance) and
[A forge that already speaks one of the two dialects](#a-forge-that-already-speaks-one-of-the-two-dialects);
its markup and canary go in a `src/plugins/sources/<name>/` folder, so the canary
watches the hooks the skin uses.

Whichever forge you add, its logo stays out of the bundle. The theme carries a
`--gs-mark` and paints GitAlike's own mark in that forge's palette — the
existing skins are the pattern. Do not paste a forge's logo, or its vector path
data, into a theme: recolouring someone else's mark is still shipping their
mark. This covers Forgejo, Gitea, Codeberg, Bitbucket and Sourcehut alike.

The popup's global radio and the per-site picker are generated from `THEMES`, so
a new skin appears there with no popup change; a `skins` entry is what the badge
and the picker labels read, so a new skin names itself once.

Whatever you add has to hold the same line as the existing two: inert when the
skin is off, no rewriting inside code, inputs or editable regions, and every
change undone on switch-off. `src/themes/` and the `ux.js` tables are the worked
example — copy their shape rather than inventing a new one.

GitAlike is licensed GPL-3.0-or-later and is not monetised — there is no paid
tier and none is planned. By contributing you license your work under the same
terms, and every skin ships its own original mark rather than a vendor's (see
the logo note above).

## Tests

`npm test` runs `node:test` over `src/lib/` only. That is deliberate: the pure
modules are where the logic that can silently break lives (address parsing, host
classification, vocabulary tables), and they need no browser.

**Add a case for every change to `src/lib/`.** The suite is the safety net for
exactly the kind of edge case that is easy to miss — a bare host versus a URL, a
refused `javascript:` string, a host that is unknown rather than merely off.

`node tools/compare/e2e.mjs` is the Playwright end-to-end test: it loads `dist/chromium`
unpacked, turns both skins on through the extension's own storage, and asserts
against the live sites — navigation orientation, relabelling, reference markers,
no-counterpart badges, a keyboard shortcut, the Codeberg (Gitea) sidebar and tab
row, and a clean revert. It needs a build first (`npm run build:chromium`) and, because it
drives live sites, a network hiccup can fail a step; the summary names it and the
exit code is non-zero.

`npm run canary` (`tools/compare/selector-canary.mjs`) is the live selector canary: a
plain `fetch` of the pages the skins are verified against, asserting the anchors
they key on are still in the served HTML. The hooks are not written in the tool:
it reads `SELECTORS` and `CANARY_PAGES` derived from `src/plugins/sources/`, the same table
`src/content/ux-*.js` reads, so a rename is one edit there that both the skin and
the canary pick up. It runs daily on a schedule, not on a pull request, so an
upstream rename is caught without making every PR depend on the forges' markup;
when it fails it also opens (or refreshes) an issue, so the drift is owned rather
than just red. The stylesheets still spell their selectors out — CSS cannot read
the table — so update a theme rule and its `SELECTORS` entry together. The
Gitea source canaries both of its hosts (gitea.com and codeberg.org), so the two
halves of that shared markup family are watched separately.

Each plugin's own tests live in its folder (`src/plugins/<group>/<name>/`) and
are discovered by `npm test`. They load just that plugin through
`tools/plugin-test.mjs` (`loadSkin` / `loadSource`), so run under `npm test` with
no extra wiring; the cross-plugin invariants stay in `tests/*.test.mjs`. The
plugin API's own rejection cases are in `src/plugins/core.test.mjs`.

The **plugin registry** is generated, not hand-maintained: `npm run registry`
rewrites `plugins.json`, the author catalog `PLUGINS.md` and the site's Plugins
chips from the plugin folders, and `npm run registry:check` (run by CI and the
pre-commit hook, beside `npm test`) fails when any is out of date.
`npm run plugins` prints the registry. `tools/new-plugin.mjs` runs the generator
for you after scaffolding (and `--dry-run` says what it would do without
writing). `defineSkin`/`defineSource` validate a plugin's shape at load, and
`lib/skins.js` / `lib/sources.js` validate the cross-references, so a half-added
or mis-wired plugin fails by name; `tests/contracts.test.mjs` is the same
checklist from the outside.

The single most useful habit: after a change, load the extension and check the
site with the skin **off** as well as on. A skin that leaks when disabled is the
easiest bug to ship and the most annoying to live with.

## Verification

Every claim in the README was checked rather than assumed. `dist/chromium` was
loaded unpacked into Chromium and driven with Playwright against the live sites —
`github.com/microsoft/vscode`, the `gitlab.com/gitlab-org/gitlab` project page,
`code.swecha.org` — plus a local mock standing in for an enterprise host. The
repeatable parts are `node tools/compare/e2e.mjs`; the rest were checked by hand.

Covered:

- light **and** dark palettes, on both skins
- each logo repainted in the other palette, including that no ghost logo is left
  behind
- **UX parity, both directions**: copy rewritten (`Pull requests 387` →
  `Merge requests 387`), repo tabs relabelled and reordered, navigation
  orientation flipped, an injected `#42` link becoming `!42`, `g m` navigating to
  the repo's pull requests, and a clean revert of every one of those changes when
  the skin is switched off
- both toolbar badges, and the `Alt`+`Shift`+`G` binding
- **the per-site skin picker**: product off + host told to wear the GitLab UI →
  skinned; product on + host told Off → spared; no choice → follows the product;
  a site told to wear its own UI → left alone; and a choice alone never
  classifies an unknown host
- **Codeberg (Forgejo)**, light and dark, **with either UI**: GitHub-flavoured,
  so both apply — under the GitLab UI the repo tabs become a grouped left sidebar
  (Plan/Code/Build/Deploy, the current page active), and under the GitHub UI a
  GitHub-style underlined tab row. Gitea's `data-theme` drives `gs-dark`.
- re-skinning an already-open tab with no reload, and a clean revert
- the popup, including that it lists every configured host, shows the per-site
  pin for a known host, and opens the prefilled report link
- **classifying a host the extension had never seen**: popup offer → storage →
  live skin → badge → removal → revert
- **adding a host purely by typing it**, without visiting it first, then
  navigating to it and finding it skinned
- address parsing against a table of 18 inputs — bare hosts, full URLs, paths,
  ports, mixed case, trailing dots, whitespace, and `javascript:` / `ftp:` /
  protocol-relative strings that must be refused rather than stored

Testing against a real **project page** rather than a listing page earned its
keep: it is where both of the project-page bugs surfaced. One text colour across
GitLab's top bar left the filled "Sign in" button white-on-white, and an
unscoped `<img>` fallback for the logo blanked out the project avatar. Neither
is visible on `/explore`.

### Signed in

The authenticated UI was exercised against a **copy** of a real Chromium
profile, because both sites serve entirely different chrome once you log in:

| | logged out | signed in |
| --- | --- | --- |
| GitHub header | `header[role="banner"]`, dark slab | `header.GlobalNav`, already light — but grey |
| GitHub repo nav | `.UnderlineNav-item` | `.prc-components-UnderlineItem` |
| GitLab | marketing bar on some pages | `.super-topbar` + `.super-sidebar` |

Two things had to change as a result:

- **GitHub's signed-in header was not matched at all.** It is
  `header.GlobalNav` (`.AppHeader`), which none of the logged-out header
  selectors covered. GitLab has no top menubar, so the GitLab skin now hides it
  rather than tinting it; the logged-out marketing header is still restyled to
  GitLab's light bar.
- **Dark-mode detection had a feedback loop.** With GitHub set to "sync with
  system", `data-color-mode` is `auto`, and detection fell through to the
  *computed* `color-scheme` — a property our own palette sets. It was reading
  back its own answer. `auto` now asks the OS directly, which is what GitHub
  itself does.

Worth knowing: **which mode you get is not the same question as which mode your
OS is in.** Signed in, GitHub uses the theme on your *account*, so a light
account stays light on a dark desktop. The skin mirrors the site's resolved
mode; it does not impose one.

To reproduce: copy `Local State`, `Default/Cookies` and `Default/Local Storage`
out of the profile, patch `session.restore_on_startup` to `1` in the copied
`Preferences` (GitLab's `_gitlab_session` is a *session* cookie, which Chromium
otherwise discards on a fresh start), and launch with that profile plus the
`--password-store` flag it was created with. The original profile is only ever
read.

## Known rough edges

- **Selectors age.** GitHub and GitLab ship new markup constantly. The token
  overrides are stable; the structural selectors need a touch-up now and then.
  Several had to be written defensively:
  - GitHub serves a *marketing* header (`<header role="banner">`) when you are
    logged out and only uses `.AppHeader` once you are signed in, so the header
    rules match both. The header also carries its nav colours on nested
    `<span>`s rather than the link itself, which is why the text rule reaches
    descendants.
  - GitLab's search field is a `<button>` styled to look like a field, not an
    `<input>`.
  - GitLab's top bar mixes ghost buttons (`…-tertiary`, and the search) that sit
    transparently on the dark bar with *filled* `btn-default` buttons that are
    white. One text colour across the whole bar turns the filled ones
    white-on-white, so those get GitHub's translucent treatment instead.
  - The `<img>` fallback for the brand logo has to be scoped to the top bar:
    unscoped, `alt*="gitlab"` also matches **project avatars** named "GitLab"
    and repaints them with the GitAlike mark on a white tile.
- **GitLab's legacy CSS** does not use custom properties everywhere, so the
  GitLab→GitHub skin leans more on structural selectors and will be the first to
  drift. Self-hosted instances make this worse: `code.swecha.org` runs an older
  GitLab than `gitlab.com` and carries fewer Pajamas tokens.
- **GitHub's responsive tab bar fights the sidebar.** Its JS hides the repo tab
  items and clones them into an overflow menu once they stop fitting the bar;
  the skin forces the real rows back on with `visibility: visible`. If a future
  release renames `.UnderlineNav-body`, the sidebar goes empty rather than wrong.
- **GitHub's newer `Button` component** reads its colours from a component-scoped
  variable the token mapping cannot reach, so the primary button is painted
  directly by class (`.Button--primary`). A renamed class means the button
  reverts to GitHub's green.
- **GitHub's `PageLayout` class suffixes are hashed** (e.g.
  `PageLayoutContent-BneH9`), so the selectors that move the About sidebar match
  on the stable prefix (`[class*="PageLayoutContent-"]`). A build that changes
  the prefix breaks the metadata placement, not the whole skin.

## Style

- 2-space indent, single quotes, semicolons, trailing commas in multi-line
  literals. `npm run fmt` (oxfmt) applies exactly this; the pre-commit gate
  checks it with `npm run fmt:check`. Only code is formatted — the hand-wrapped
  Markdown, the YAML, the HTML and the theme CSS are left alone.
- `src/lib/*` and `src/content/*` are **classic scripts, not ES modules** — they
  share one scope, so publish through `globalThis.GITALIKE*` and wrap in an IIFE.
- The background context has to work both ways: Chromium runs `background.js` as
  a service worker with `importScripts()`, Firefox loads the files listed in
  `background.scripts` into one scope. Test `npm run build:firefox` and
  `npm run build:chromium` if you touch it.
- Comment the *why*, not the *what*. The existing comments explain decisions
  (why a selector is written defensively, why a flag is read the way it is) —
  keep that up, it is how the next person avoids re-breaking it.
- CSS: `!important` is expected here, because we are overriding a live site.
  Never write a rule without the `html.gs-theme-*` scope.

## Pull requests

The template at `.github/PULL_REQUEST_TEMPLATE.md` is the checklist below in
short form — it is added to every new pull request, so work through it before
you ask for review.

- One concern per pull request.
- **One branch or `git worktree` per session, and stage only your own paths.**
  This tree has been worked by more than one agent at once, and a bare
  `git add -A` / `git commit -a` swept one session's work into another's commit.
  See [MAINTENANCE.md](MAINTENANCE.md#working-in-a-shared-checkout).
- `npm test && npm run lint && npm run lint:js && npm run fmt:check` must pass,
  and `node tools/compare/e2e.mjs` if you touched what it covers. The pre-commit gate
  enforces these; do not treat
  `--no-verify` as a normal workflow.
- Behaviour changes need a `README.md` update, and an entry under
  `## [Unreleased]` in `CHANGELOG.md`.
- The version lives in `package.json` and nowhere else — `build.mjs` stamps it
  onto both generated manifests, so do not edit the manifests by hand.
- If the change is visible, refresh the screenshots with `npm run screenshots`.
- The `docs/*.png` captures are generated artifacts, not source: refresh them
  with `npm run screenshots:projects` / `npm run screenshots:profiles`
  deliberately, when the skin actually changed, not casually — each recapture
  rewrites ~2 MB of binaries, and a byte-level diff that only moves a star count
  is still permanent history. Regenerate rather than hand-edit. The WebP variants
  `docs/index.html` prefers are generated at deploy time by
  `.github/workflows/pages.yml` from the committed PNGs, so the two formats
  cannot drift and only the PNGs are tracked. `tests/captures.test.mjs` keeps the
  capture table, the files on disk and the page in step.

## Releasing

The submission material lives in `store/`:

- `store/listing-chrome.md` — name, descriptions, category, and the permission
  and privacy answers the Chrome Web Store asks for.
- `store/listing-firefox.md` — the same for addons.mozilla.org, plus reviewer
  notes and the `data_collection_permissions` declaration.
- `store/screenshots/` — regenerated with `npm run screenshots` against the live
  sites.

To cut a release:

```sh
npm test && npm run lint
node tools/compare/e2e.mjs
npm run package              # dist/artifacts/*/*.zip
npm run screenshots          # refresh store/screenshots/
```

Bump `version` in `package.json` (the only place it is written), add a
`CHANGELOG.md` entry, then commit and tag `vX.Y.Z`.

### Publishing to the stores

The stores are optional and off by default; a release that is not published is
still a normal GitHub release with the ZIPs attached.

**Chrome Web Store** — `npm run publish:chromium` uploads and submits the
package using the **v2** API (v1 is deprecated and stops being supported on
15 October 2026). Credentials come from the environment, never the command
line:

```sh
export CWS_CLIENT_ID=...        # OAuth2 client id
export CWS_CLIENT_SECRET=...    # OAuth2 client secret
export CWS_REFRESH_TOKEN=...    # refresh token, scope .../auth/chromewebstore
export CWS_PUBLISHER_ID=...     # publisher id
export CWS_ITEM_ID=...          # extension id
npm run publish:chromium
```

`--dry-run` validates the inputs without contacting the store; `--staged`,
`--deploy-percentage N`, `--skip-review` and `--no-publish` map onto the API's
publish options. The refresh token is minted once: enable the Chrome Web Store
API in a Google Cloud project, create an OAuth client, then use the OAuth
playground with the `https://www.googleapis.com/auth/chromewebstore` scope.

**Firefox / AMO** — `npm run sign:firefox` builds and signs an unlisted package
with `web-ext sign`, reading `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET`.

**Microsoft Edge Add-ons** — `npm run publish:edge` uploads and publishes the
Chromium package with the Add-ons Update REST API (v1.1), reading
`EDGE_CLIENT_ID`, `EDGE_API_KEY` and `EDGE_PRODUCT_ID` from the environment. The
first submission has to be created in Partner Center by hand; the API only
updates an extension that already exists. Edge takes the same MV3 ZIP as Chrome,
so the same artefact goes to both.

**In CI**, both are gated on a repository *variable* so the credentials stay
scoped to the single step that uses them:

- variable `CWS_PUBLISH=true` plus secrets `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`,
  `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID`, `CWS_ITEM_ID`;
- variable `AMO_SIGN=true` plus secrets `AMO_API_KEY`, `AMO_API_SECRET`;
- variable `EDGE_PUBLISH=true` plus secrets `EDGE_CLIENT_ID`, `EDGE_API_KEY`,
  `EDGE_PRODUCT_ID`.

With none set, the release job just builds and attaches the ZIPs.

## Reporting an issue

Two templates guide a report, and both are offered on `issues/new`: a **bug
report** and a **feature request**. Blank issues are deliberately left on, so
anything that fits neither is still welcome; the chooser also links the live
preview, the README and this guide (`.github/ISSUE_TEMPLATE/`).

The popup's **Report a missed spot** link opens the bug form with the host, the
applied skin and the version already filled in — nothing is read from the page.
Fill in the rest; the most useful report includes:

- the host, and whether you were **signed in**;
- the site's theme (light or dark) — they are separate code paths;
- what you expected versus what you saw;
- for a skin miss, the element and the property, e.g. *"`.Box` has
  `background: #fff`, GitLab's would be `#fbfafd`"*.

Screenshots help a lot. "It looks wrong" is hard to act on; "this bar is grey
where GitLab's is white" is not.

A feature request is easier to take if it says which product the change should
match — or why it has no counterpart and should be marked instead — and if it
holds the [ground rules](#ground-rules): inert when the skin is off, nothing
leaving the browser, no new permission, and no vendor artwork.

## License

GPL-3.0-or-later — see [LICENSE](LICENSE) and [NOTICE](NOTICE). By contributing
you agree your work is licensed on the same terms, so the project keeps shipping
as free software. There is no CLA and you keep your copyright.
