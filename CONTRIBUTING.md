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
would like to keep it that way.

**One source of truth per concern.** Hosts, kinds, address parsing and the
storage schema live in `src/lib/sites.js`; the vocabulary, navigation, keyboard
and path-translation tables live in `src/lib/ux.js`. Neither touches the DOM,
which is what makes them unit-testable. The manifest repeats hostnames only
because the manifest format cannot read a JavaScript file.

**Stay conservative on the page.** The UX layer must never rewrite text inside
`<code>`, inputs, editable regions or anything marked `[data-gs-ux-skip]`, and
it should only change a navigation label on an exact whole-label match inside a
known navigation region. Over-eager rewriting breaks search, copy/paste and
screen readers. When markup is unfamiliar, prefer doing nothing.

**Logos keep their shape and take the other palette.** An octocat stays an
octocat; it is repainted in GitLab's colours. Do not swap one product's mark for
the other's. Sources live in `logos/`; see
[Add or change a logo](#add-or-change-a-logo).

**No new permissions.** The extension already asks for access to all sites (see
[Why it matches every site](#why-it-matches-every-site) for the reason). Adding
another permission needs a very good argument.

## Getting set up

```sh
npm install          # dev-only: web-ext, playwright-core
npm run build        # -> dist/chromium and dist/firefox
npm test             # unit tests, no browser needed
node tools/e2e.mjs   # Playwright end-to-end test against the live sites
npm run lint         # web-ext lint over the Firefox build
npm run package      # store-ready zips -> dist/artifacts/
npm run screenshots  # regenerate store/screenshots/
npm run screenshots:profiles  # refresh the docs/ orientation captures
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

## Layout

```
src/
├── manifest.base.json   shared manifest; the build adds `background` + `version`
├── background.js        keyboard shortcuts and per-tab badge
├── lib/
│   ├── sites.js         hosts, kinds, parseHost, schema — pure, no DOM
│   └── ux.js            vocabulary/nav/shortcut/path tables — pure, no DOM
├── content/
│   ├── theme.js         applies the theme classes, tracks light/dark
│   └── ux.js            performs the text and nav rewrites, undoably
├── themes/              ALL colour lives here — two stylesheets + the marker/nav ones
├── popup/               toolbar UI
└── icons/
logos/                   editable logo sources, inlined into the themes
docs/                    the GitHub Pages preview + UX-PARITY.md — the parity matrix
tests/                   node:test, covers src/lib/ only
tools/                   store and docs screenshots, and the Playwright end-to-end test
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
content script (document_start, every http/https page)
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

stylesheet (injected everywhere, inert unless the class is present)
  html.gs-theme-gitlab { ... }   re-skins GitHub-flavoured sites
  html.gs-theme-github { ... }   re-skins GitLab-flavoured sites
  html.gs-dark         { ... }   dark palette for whichever skin is on
```

### Why it matches every site

GitHub Enterprise Server and self-hosted GitLab live on hostnames nobody can
predict: `github.acme.com`, `code.corp.example`, sometimes with no `github.`
prefix at all. A manifest match pattern cannot wildcard a host's middle —
`https://github.*/*` is not valid — so there is no host list to write at build
time.

The alternative would be `optional_host_permissions` plus
`scripting.registerContentScripts`, asking for one origin the first time you
visit it. That keeps the install prompt clean, at the cost of a permission
dialog every time someone points the extension at a new instance. This build
takes the other trade: match the whole web, decide at runtime, and never prompt.

The extension is inert everywhere it has not been set up, because every
stylesheet is scoped to `html.gs-theme-*` classes that only get added on
classified hosts.

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

3. **A logo data URI**, `--gs-tanuki` in the GitLab→GitHub skin and
   `--gs-octocat` in the GitHub→GitLab one, that repaints the site's own mark in
   the other brand's palette.

Hosts, products and the bundled host list live in `src/lib/sites.js` — one
source of truth shared by the content script, the popup and the background.

### Support another Git instance

Usually you should not add it to the source at all — that is what the popup's
**Add a site** flow is for, and it needs no permission prompt. Only add a
*built-in* host for something we want to work out of the box:

1. `src/lib/sites.js` — add it to the `builtin` table.
2. `tests/sites.test.mjs` — cover it.

Nothing in the manifest needs touching. It already matches every `http(s)` page
and decides at runtime — see
[Why it matches every site](#why-it-matches-every-site) — so there is no
per-host entry to keep in sync.

### Add or change a logo

1. Edit the SVG in `logos/` (these are the editable sources).
2. Re-encode it as a data URI into the relevant theme variable — `--gs-octocat`
   in `themes/github-as-gitlab.css`, `--gs-tanuki` in
   `themes/gitlab-as-github.css`. Injected CSS cannot resolve extension-relative
   URLs, which is why it is inlined rather than linked.
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
  body items are forced `visibility: visible`.
- **L→G** makes GitLab's sidebar horizontal, but GitLab's page is a grid
  (`.layout-page.page-with-super-sidebar`), so that grid is collapsed to one
  column first — otherwise the content keeps the narrow column.

## Adding another forge — contributions welcome

gitalike knows two products, GitHub and GitLab, and skins each as the other.
**More forges are wanted.** Forgejo, Gitea, Codeberg, Bitbucket, Sourcehut — none
are supported today, and this is probably the single most useful thing to help
with. There are two levels, and the easy one is real work, not a consolation
prize.

### A forge that already speaks one of the two dialects

Forgejo, Gitea and Codeberg are GitHub-flavoured: pull requests, a tab bar, the
same shape of repository page. They do not need a new skin — they need to be
classified as the `github` kind, so the existing GitLab skin applies:

```js
// src/lib/sites.js
const builtin = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
  'code.swecha.org': 'gitlab',
  'codeberg.org': 'github', // <- new
};
```

Add the host to `tests/sites.test.mjs`. Only add vocabulary if the forge uses a
different word — Forgejo says "Pull request", so there is nothing to do.

You can already point gitalike at any instance without touching the source: the
popup's **Add a site** flow exists for exactly that. A `builtin` entry just means
it works out of the box.

### A genuinely different product

Bitbucket or Sourcehut are not GitHub with a different logo; they need their own
skin and their own vocabulary. That means five files:

| # | File | What goes there |
| - | ---- | --------------- |
| 1 | `src/themes/<a>-as-<b>.css` | the skin — a palette block plus a token mapping |
| 2 | `src/lib/ux.js` | `PHRASES`, `NAV`, `NAV_RULES`, `SHORTCUTS` keyed by the new theme name |
| 3 | `src/lib/sites.js` | a `kinds` entry — `theme`, `badge`, `color`, `other` (its key is the setting name and its `theme` joins `THEMES` automatically) |
| 4 | `src/popup/popup.html` + `popup.css` | a row for the kind, and its accent colour |
| 5 | `tests/` | cases for the kind, the host table and the vocabulary |

**Open an issue about the mapping first.** `kinds` today hardcodes one target per
kind: `github` is always shown as GitLab, `gitlab` always as GitHub. With a third
product the question becomes "shown as *which* other one?", and supporting every
pair is N×(N−1) skins. For most forges the honest answer is probably "one
GitHub-like skin and one GitLab-like skin", not all six — but that is worth
agreeing before anyone writes CSS.

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
no-counterpart badges, a keyboard shortcut, and a clean revert. It needs a build
first (`npm run build:chromium`) and, because it drives live sites, a network
hiccup can fail a step; the summary names it and the exit code is non-zero.

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
- re-skinning an already-open tab with no reload, and a clean revert
- the popup, including that it lists every configured host
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
  - The `<img>` fallback for the tanuki logo has to be scoped to the top bar:
    unscoped, `alt*="gitlab"` also matches **project avatars** named "GitLab"
    and repaints them with a GitHub-coloured tanuki on a white tile.
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
  what it covers.
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

## Reporting an issue

The most useful report includes:

- the host, and whether you were **signed in**;
- the site's theme (light or dark) — they are separate code paths;
- what you expected versus what you saw;
- for a skin miss, the element and the property, e.g. *"`.Box` has
  `background: #fff`, GitLab's would be `#fbfafd`"*.

Screenshots help a lot. "It looks wrong" is hard to act on; "this bar is grey
where GitLab's is white" is not.

## License

MIT — see [LICENSE](LICENSE). By contributing you agree your work is licensed on
the same terms.
