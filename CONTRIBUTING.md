# Contributing to gitalike

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
storage schema live in `src/lib/sites.js`; the vocabulary, navigation, keyboard,
path-translation and forge-selector tables live in `src/lib/ux.js`. Neither
touches the DOM, which is what makes them unit-testable. The manifest repeats
hostnames only because the manifest format cannot read a JavaScript file.

**Stay conservative on the page.** The UX layer must never rewrite text inside
`<code>`, inputs, editable regions or anything marked `[data-gs-ux-skip]`, and
it should only change a navigation label on an exact whole-label match inside a
known navigation region. Over-eager rewriting breaks search, copy/paste and
screen readers. When markup is unfamiliar, prefer doing nothing.

**Logos are original; never bundle a vendor's mark.** The mark painted on a
skinned page is gitalike's own two-way swap arrow (`src/icons/icon.svg`), only
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
node tools/e2e.mjs   # Playwright end-to-end test against the live sites
npm run lint         # web-ext lint over the Firefox build
npm run package      # store-ready zips -> dist/artifacts/
npm run screenshots  # regenerate store/screenshots/
npm run screenshots:profiles  # refresh the docs/ profile-page captures
node tools/project-screenshots.mjs  # refresh the docs/ project-page captures
npm run clean        # remove dist/
```

To try it, load `dist/chromium` unpacked — see
[Install](README.md#install) for the click-by-click.

There are no runtime or build dependencies: `build.mjs` uses only Node's
standard library, and the tests use Node's built-in `node:test`. Two dev
dependencies exist: [`web-ext`](https://github.com/mozilla/web-ext) for
`npm run lint` and `npm run package`, and
[`playwright-core`](https://playwright.dev/) for `npm run screenshots` and
`node tools/e2e.mjs`, both of which drive the system Chromium and download no
browser of their own.

### The pre-commit gate

Every commit runs a gate first. It reads the *staged* blobs — not the working
tree — and rejects merge conflict markers, CRLF line endings, missing final
newlines, invalid JSON, JavaScript that fails `node --check`, oversized files
and leaked credentials. It then checks that `package.json` and
`package-lock.json` are in lockstep, and runs `npm test` and `npm run lint`, the
same two commands CI runs.

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
├── lib/
│   ├── sites.js         hosts, kinds, parseHost, schema — pure, no DOM
│   └── ux.js            vocabulary/nav/shortcut/path/selector tables — pure, no DOM
├── content/
│   ├── theme.js         applies the theme classes, tracks light/dark
│   └── ux.js            performs the text and nav rewrites, undoably
├── themes/              ONE AXIS: as-gitlab.css and as-github.css are keyed by
│                        the applied skin (not the source forge), plus
│                        ux-markers.css and ux-nav.css for shared structure
├── popup/               toolbar UI
└── icons/
logos/                   editable logo sources, inlined into the themes
docs/                    the GitHub Pages preview + UX-PARITY.md — the parity matrix
tests/                   node:test, covers src/lib/ only
tools/                   store and docs screenshots, the Playwright end-to-end
                         test, and the live selector canary
store/                   submission copy and screenshots
```

`src/lib/*` is pure data and side-effect-free helpers published on
`globalThis.GITALIKE` / `globalThis.GITALIKE_UX`, shared by the content scripts,
the popup, the background and the tests. `src/content/*` is the only code that
touches a page.

## How it works

Both sites are built on design-token systems, and almost everything on the page
reads its colours from a handful of CSS custom properties:

- GitHub → [Primer](https://primer.style/product/primitives/) (`--fgColor-*`,
  `--bgColor-*`, `--borderColor-*`, plus the legacy `--color-*` names)
- GitLab → [Pajamas](https://design.gitlab.com/) (`--gl-*`)

So gitalike mostly re-points those properties at the other design system's
palette, then fixes up a few structural things the tokens cannot reach (the top
bar, the logo, active-tab accents, navigation orientation). The stylesheets and
two classes do the visual half; a second content script does the copy,
reference, navigation and keyboard half, driven by the tables in
`src/lib/ux.js`.

```
content script (document_start, registered for the configured hosts only)
  ├─ reads the cached decision from this origin's localStorage -> applies it now
  ├─ reconciles with chrome.storage.sync                       -> keeps the cache warm
  ├─ mirrors the site's dark mode                              -> html.gs-dark
  └─ reacts to storage + DOM changes

ux content script (inert unless a theme class is present)
  ├─ rewrites page copy and nav labels        -> src/lib/ux.js tables
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
`codeberg.org`, `gitea.com`), and declares
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
   `SELECTORS` in `src/lib/ux.js` — keyed by the *source* product (the site's
   markup), not the skin applied to it — and read it from `src/content/ux.js`.
   A literal there cannot be checked by `npm run canary`; a `SELECTORS` entry
   can, and the canary probes every entry a `CANARY_PAGES` page names.

3. **A logo data URI**, `--gs-mark`, that paints gitalike's own mark in the
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

The mark is gitalike's own — the same two-way swap arrow as the toolbar icon —
so there is no vendor artwork in the tree. Keep it that way: draw an original
mark rather than copying a forge's.

1. Edit the SVG in `logos/` (these are the editable sources).
2. Re-encode it as a data URI into the relevant theme variable — `--gs-mark` in
   both `themes/as-gitlab.css` and `themes/as-github.css`.
   Injected CSS cannot resolve extension-relative URLs, which is why it is
   inlined rather than linked.
3. Check both light and dark: the two palettes are chosen for their background.

### Add a label translation

1. Add it to the right table in `src/lib/ux.js`. `PHRASES` is ordinary page copy,
   `NAV` is navigation labels, `LABELS`/`CHROME` are whole control and account
   labels, `UNMAPPED` is features the other product lacks. Longest key wins, so
   add the plural before the singular.
2. Add a case to `tests/ux.test.mjs`.
3. Do not translate inside code, inputs or editable regions — the content script
   already skips those, so just avoid adding a rule that would need an exception.

### Add a keyboard shortcut

`SHORTCUTS` in `src/lib/ux.js`, plus a test. A combo that has a navigation link
is delivered as a click (`SHORTCUT_TARGETS`); the rest fall back to synthetic key
events.

### Change the navigation order or orientation

`NAV_RULES` in `src/lib/ux.js` holds the desired item order; orientation is CSS
in `themes/ux-nav.css`.

- **G→L** turns GitHub's repo tab bar into a left sidebar by making `main` a grid
  and the tab bar's wrapper `display: contents`, so the repo header and the tabs
  can be placed independently. GitHub's responsive tab bar hides the real items
  and clones them into an overflow menu when they stop fitting the bar, so the
  body items are forced `visibility: visible`. `NAV_GROUPS` gathers the items
  under GitLab's group headings, which the content script inserts after the
  reorder (`paintNavGroups`), and the CSS styles them. GitHub's top bar
  (`header[role="banner"]`, `.AppHeader`, `.js-header-wrapper`) is restyled to
  GitLab's light bar, since GitLab has a light top bar above its sidebar too.
- **L→G** makes GitLab's sidebar horizontal, but GitLab's page is a grid
  (`.layout-page.page-with-super-sidebar`), so that grid is collapsed to one
  column first — otherwise the content keeps the narrow column.

## Adding another forge — contributions welcome

gitalike knows two source products, GitHub and GitLab, and paints three skins —
GitLab, GitHub and Bitbucket. Codeberg (Forgejo) and gitea.com (Gitea) are
bundled as GitHub-flavoured sources, shown with the GitLab UI. **More are
wanted.** Sourcehut is a genuinely different product that needs its own skin; a
new *source* forge (one people host) also needs classifying. There are two
levels, and the easy one is real work, not a consolation prize.

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
`themes/as-gitlab.css` and `themes/as-github.css` each have a
**Gitea / Forgejo** block that re-points its `--color-*` custom properties at that
skin's palette, and `src/lib/ux.js` adds its repo tab list to
`NAV_SCOPE`/`NAV_RULES` (for both themes) and its markup hooks to
`SELECTORS.gitea` so its tabs are relabelled and reordered and the canary can
watch them. The GitLab skin also rebuilds those tabs as a grouped sidebar:
`content/ux.js` `paintGiteaNav` and the `UX.repoNav` model, keyed off Gitea's
`[data-theme]` marker, apply to any Gitea-family instance. Record the host in
`SOURCES` in `src/lib/sites.js` too, so the picker knows
the site is *not* the product it is classified as (making the other UI a real
skin) and the `g`-combo remap is skipped on it. Copy those shapes for another
token system or another tab bar. Only add vocabulary if the forge uses a
different word — Forgejo says "Pull request", so there is nothing to do there.

You can already point gitalike at any instance without touching the source: the
popup's **Add a site** flow exists for exactly that. A `builtin` entry just means
it works out of the box.

### A genuinely different product

Sourcehut is not GitHub with a different logo; it needs its own skin and its own
vocabulary. **Bitbucket is the worked example**: it is a *target only* — no host
is classified as Bitbucket — so it can be worn by any source. Adding a target
means:

| # | File | What goes there |
| - | ---- | --------------- |
| 1 | `src/themes/as-<target>.css` | the skin — a palette block, a token mapping *per source* (Primer, Pajamas, Gitea's `--color-*`), and the structural rules |
| 2 | `src/lib/sites.js` | a `skins` entry — `product`, `badge`, `color`, `layout` — which joins `THEMES` automatically |
| 3 | `src/lib/ux.js` | the target's `PHRASES`, `NAV`, `LABELS`, `CHROME`, `UNMAPPED`, `NAV_RULES`, `NAV_KEEP`, and its tab set in `PROJECT_TABS` (and `PROFILE_MENU` if the layout rebuilds profiles) |
| 4 | `src/background.js` | add the stylesheet to `CONTENT_CSS` |
| 5 | `tests/` | cases for the tables, `projectTabs`, `activeTabFor` and the vocabulary |

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
its markup goes in `SELECTORS` and a `CANARY_PAGES` entry, so the canary watches
the hooks the skin uses.

Whichever forge you add, its logo stays out of the bundle. The theme carries a
`--gs-mark` and paints gitalike's own mark in that forge's palette — the
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

## Tests

`npm test` runs `node:test` over `src/lib/` only. That is deliberate: the pure
modules are where the logic that can silently break lives (address parsing, host
classification, vocabulary tables), and they need no browser.

**Add a case for every change to `src/lib/`.** The suite is the safety net for
exactly the kind of edge case that is easy to miss — a bare host versus a URL, a
refused `javascript:` string, a host that is unknown rather than merely off.

`node tools/e2e.mjs` is the Playwright end-to-end test: it loads `dist/chromium`
unpacked, turns both skins on through the extension's own storage, and asserts
against the live sites — navigation orientation, relabelling, reference markers,
no-counterpart badges, a keyboard shortcut, the Codeberg (Gitea) sidebar and tab
row, and a clean revert. It needs a build first (`npm run build:chromium`) and, because it
drives live sites, a network hiccup can fail a step; the summary names it and the
exit code is non-zero.

`npm run canary` (`tools/selector-canary.mjs`) is the live selector canary: a
plain `fetch` of the pages the skins are verified against, asserting the anchors
they key on are still in the served HTML. The hooks are not written in the tool:
it reads `SELECTORS` and `CANARY_PAGES` from `src/lib/ux.js`, the same table
`src/content/ux.js` reads, so a rename is one edit there that both the skin and
the canary pick up. It runs daily on a schedule, not on a pull request, so an
upstream rename is caught without making every PR depend on the forges' markup;
when it fails it also opens (or refreshes) an issue, so the drift is owned rather
than just red. The stylesheets still spell their selectors out — CSS cannot read
the table — so update a theme rule and its `SELECTORS` entry together.

The single most useful habit: after a change, load the extension and check the
site with the skin **off** as well as on. A skin that leaks when disabled is the
easiest bug to ship and the most annoying to live with.

## Verification

Every claim in the README was checked rather than assumed. `dist/chromium` was
loaded unpacked into Chromium and driven with Playwright against the live sites —
`github.com/microsoft/vscode`, the `gitlab.com/gitlab-org/gitlab` project page,
`code.swecha.org` — plus a local mock standing in for an enterprise host. The
repeatable parts are `node tools/e2e.mjs`; the rest were checked by hand.

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
  `header.GlobalNav`, which none of the header selectors covered, so it was only
  tinted incidentally through `--bgColor-inset` — ending up *greyer* than the
  page, the opposite of GitLab. Matching it gives the bar GitLab's colour and
  hairline border.
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
    and repaints them with the gitalike mark on a white tile.
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
  literals.
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

- One concern per pull request.
- `npm test && npm run lint` must pass, and `node tools/e2e.mjs` if you touched
  what it covers. The pre-commit gate enforces the first two; do not treat
  `--no-verify` as a normal workflow.
- Behaviour changes need a `README.md` update, and an entry under
  `## [Unreleased]` in `CHANGELOG.md`.
- The version lives in `package.json` and nowhere else — `build.mjs` stamps it
  onto both generated manifests, so do not edit the manifests by hand.
- If the change is visible, refresh the screenshots with `npm run screenshots`.

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
node tools/e2e.mjs
npm run package              # dist/artifacts/*/gitalike_github_gitlab_ui-X.Y.Z.zip
npm run screenshots          # refresh store/screenshots/
```

Bump `version` in `package.json` (the only place it is written), add a
`CHANGELOG.md` entry, then commit and tag `vX.Y.Z`.

### Publishing to the stores

Both stores are optional and off by default; a release that is not published is
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

**In CI**, both are gated on a repository *variable* so the credentials stay
scoped to the single step that uses them:

- variable `CWS_PUBLISH=true` plus secrets `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`,
  `CWS_REFRESH_TOKEN`, `CWS_PUBLISHER_ID`, `CWS_ITEM_ID`;
- variable `AMO_SIGN=true` plus secrets `AMO_API_KEY`, `AMO_API_SECRET`.

With neither set, the release job just builds and attaches the ZIPs.

## Reporting an issue

The popup's **Report a missed spot** link opens a prefilled issue with the host
and the applied skin already filled in — nothing is read from the page. Fill in
the rest; the most useful report includes:

- the host, and whether you were **signed in**;
- the site's theme (light or dark) — they are separate code paths;
- what you expected versus what you saw;
- for a skin miss, the element and the property, e.g. *"`.Box` has
  `background: #fff`, GitLab's would be `#fbfafd`"*.

Screenshots help a lot. "It looks wrong" is hard to act on; "this bar is grey
where GitLab's is white" is not.

## License

GPL-3.0-or-later — see [LICENSE](LICENSE) and [NOTICE](NOTICE). By contributing
you agree your work is licensed on the same terms, so the project keeps shipping
as free software. There is no CLA and you keep your copyright.
