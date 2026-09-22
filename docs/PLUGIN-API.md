# Plugin API

GitAlike is assembled from two kinds of plugin, each a self-contained folder
under `src/plugins/`:

- a **skin** — a target UI a page is made to look like (GitLab, GitHub,
  Bitbucket);
- a **source** — a forge's markup (GitHub/Primer, GitLab/Pajamas, Gitea/Forgejo,
  Bitbucket, Gerrit).

They are independent: any source can wear any skin. The generated
[PLUGINS.md](../PLUGINS.md) lists what is registered; this file is the contract a
plugin is written against.

Scaffold one with `node tools/new-plugin.mjs skin <name>` (or `source <name>`),
then `npm test` names what is left — it also enforces 100% coverage of
`src/plugins/**`, so a branch the suite does not exercise fails. `npm run
plugins:validate` checks every plugin in isolation and reports all the incomplete
ones at once.

## Loading

Plugins are **bundled, in-tree modules** loaded as classic scripts, in this
order, by every runtime context (the Chromium service worker's `importScripts`,
the Firefox `background.scripts`, the content scripts, the popup). A browser
cannot read the folder, so `npm run registry` generates the order into
`src/plugins/list.js`; Node tools (the tests, `build.mjs`, the compare tools)
read `src/plugins/` directly.

```
plugins/core.js            the API (this contract), loaded first
plugins/skins/<name>/index.js
plugins/sources/<name>/index.js
lib/skins.js               derives GITALIKE_SKINS from the registrations
lib/sites.js               the host/skin map
lib/sources.js             derives GITALIKE_SOURCES
lib/ux.js                  the UX tables
```

A plugin calls `defineSkin(name, {…})` / `defineSource(name, {…})` at load; the
constructor validates it and fills the optional capabilities, so a half-added
plugin throws with the whole list of what is missing rather than failing
silently on a page.

**There is no runtime plugin loading.** Manifest V3 forbids remotely hosted
code, and the stores review the bundled bytes, so a plugin is code that ships in
the package and is reviewed as code. The API version below is a contract for
plugins and for the published registry — not a loader.

## Skin

`defineSkin(name, skin)`. The name is the theme key (`gs-theme-<name>`) and the
value the popup writes to storage; it must match `^[a-z][a-z0-9-]*$` and is also
the folder name.

Required:

| Field | Shape |
| --- | --- |
| `product` | the product name, a string |
| `badge` | the toolbar badge, a string |
| `color` | a `#rrggbb` string |
| `layout` | `'github'` (top bar + tab row) or `'gitlab'` (left sidebar) |
| `phrases` | `{ sourcePhrase: targetPhrase }` — ordinary page copy |
| `nav` | `{ sourceLabel: targetLabel }` — navigation labels |
| `labels` | `{ sourceControl: targetLabel }` — whole control labels |
| `chrome` | `{ sourceChrome: targetChrome }` — account/menu chrome |
| `unmapped` | `{ label: lackingProduct }` — features the product has no page for |
| `navRules` | an array of `{ source, container or scope, contains?, item }` |
| `profileMenu` | `(user, name?) => [[label, href, source]]` |

Optional **capabilities** (absent means "not declared"; the derived tables
publish only what a skin declares):

| Capability | Shape | Effect |
| --- | --- | --- |
| `repoOrder` | `string[]` | the desired navigation order, filled into each `navRules` rule |
| `hide` | `string[]` | menu items the product lacks |
| `keep` | `string[]` | a whitelist; supersedes `hide` |
| `groups` | `{ label: heading }` | sidebar group headings |
| `shortcuts` | `{ seenCombo: siteCombo }` | `g`-combo remap |
| `shortcutTargets` | `{ combo: displayedLabel }` | combos delivered as a click |
| `topbarHide` | `string[]` | source-only top-bar words to hide |
| `projectTabs` | `(base, hrefs) => [[label, href]]` | the rebuilt project tab set |

A skin also needs its palette, `as-<name>.css`, beside its `index.js`, scoped to
`html.gs-theme-<name>` and carrying its own `--gs-mark` (GitAlike's mark in that
palette — never a vendor's logo or path data), and a `parity.mjs` with the
reviewed target vocabulary `style-parity` scores against (Node-only; not
shipped).

## Source

`defineSource(name, source)`. Required: `label` (a display name).

| Field | Shape |
| --- | --- |
| `markup` | `true` (default) for a forge with a real DOM, `false` for a vocabulary-only, client-rendered product |
| `selectors` | `{ hookName: 'css selector' }` — required for a markup source, forbidden for a vocabulary-only one |
| `canary` | `[{ name, url, keys: [hookName] }]` — required for a markup source, forbidden for a vocabulary-only one |
| `compare` | `{ palette, nav, page, metadata, profile, refs }`, each a fraction in `[0, 1]` |
| `pages` | the page kinds the source declares: `project`, `profile`, `dashboard`, `settings`, `signIn`, `signOut` — each `{ route, from }`, or `null` for a kind the forge has none of |
| `description` | one line for the catalog |
| `product` | the short product name ("GitHub", "GitLab") the "open on the other host" action uses |
| `hosts` | the hostnames this source ships for, bundled at install; `build.mjs` derives the manifest's `host_permissions` from them and `lib/sites.js` derives the picker's tables |
| `kind` | the product kind a bundled host is classified as (default: the source name). A GitHub-flavoured forge sets `'github'` |
| `counterpart` | the source this one pairs with for "open on the other host", or `null` |
| `routes` | `{ ownSegment: counterpartSegment }` — the route segments the pair spell differently. `lib/sources.js` requires the counterpart's map to be the exact inverse |
| `reserved` | first path segments that name a product-wide page, never an owner/repo |
| `navScope` | selectors for the regions whose nav labels may be rewritten; `lib/sources.js` unions every source's into `NAV_SCOPE` |
| `topbarScope` | the same, for the global top bar (`TOPBAR_SCOPE`) |
| `navWords` | the displayed labels a content-hashed nav bar is found by (Bitbucket Cloud) |
| `metadataHide` | the metadata section labels the target UIs do not list (`METADATA_HIDE[source]`) |
| `activeTabs` | `[[pattern, label], …]` — the source's page key → the tab label the applied UI marks active |

`compare` is the source's own declaration of how much of each parity dimension a
skin can reproduce on it; `tools/compare/parity-score.mjs` reads it instead of a
hardcoded set. A hook a stylesheet owns is marked `// css` in `selectors`, and
the contract test checks the two agree.

The vocabulary fields are optional and default to empty; a source whose UI is
client-rendered still declares `kind` and names the product it is
(`bitbucket`, `gerrit`). Everything a *bundled* forge needs — its hosts, the
host's kind, its pairs and routes, the regions its nav lives in — is declared in
its folder, so `src/lib/sites.js` and the manifest derive from it rather than
repeating a hand-kept list.

A source folder may also carry two Node-only sidecars:

- `tokens.css` — the source forge's own design tokens (`--ds-*`, `--color-*`,
  PolyGerrit's root properties) mapped to `--gs-*`, loaded before the skin
  palettes so a skin's own rule still wins where it diverges. A source with no
  token layer has none.
- `parity.mjs` — its capture (a live URL and a readiness selector) and its
  `style-parity` selectors. `tools/compare/captures.mjs` and `style-recipes.mjs`
  derive their tables by reading the folders; the capture skins and file names
  are derived from `prefix`, the source's own skin and the registry.

Neither ships: the browser loads `index.js` through `plugins/list.js`, and
`build.mjs` drops them from the bundle.

### Pages

`pages` declares, for each page kind, the route that serves it and how a pass
reads the page's subject from the URL — or `null` for a kind the forge has none
of. Every source declares all six kinds, so "not specified" can never be
mistaken for "has none":

```js
pages: {
  project:   { route: '/<group>/<project>', from: 'path' },
  profile:   { route: '/<user>',            from: 'pathname' },
  dashboard: { route: '/dashboard',         from: null },
  settings:  { route: '/-/profile',         from: null },
  signIn:    { route: '/users/sign_in',     from: null },
  signOut:   { route: '/users/sign_out',    from: null },
}
```

A page that is a forge's *nearest equivalent* rather than the kind itself says so
with `equivalent`, so nothing claims a page the forge does not have:

```js
// Gerrit has no account page; an owner query is its equivalent.
profile: {
  route: '/q/owner:',
  from: 'owner:',
  equivalent: 'owner-query',
  selectors: { header: 'gr-user-header' },
}
```

This is what a page pass, the parity rubric and the docs read instead of each
assuming a forge has a profile, a dashboard or a sign-in form. `PAGE_KINDS` in
`plugins/core.js` is the list; `tests/contracts.test.mjs` fails a source that
omits a kind or declares one without a `route`/`from`.

## Versioning

`plugins/core.js` carries `API_VERSION`, published as `apiVersion` in
`plugins.json`. **Bump it when a plugin object changes shape in a way a plugin
or a downstream consumer could notice** — a new required field, a renamed or
removed capability, a changed default, or a change to a derived table's shape.
A plugin may pin the API it was written against with `minApiVersion`;
`assertCompatible` fails when this GitAlike is older.

## What enforces this

| Gate | Catches |
| --- | --- |
| `defineSkin` / `defineSource` | a missing or malformed required field, a duplicate name, an unmet `minApiVersion`, a per-source field (`hosts`, `routes`, `navScope`, …) with the wrong shape |
| `lib/skins.js` | a `navRules` rule that names no registered source or has no container/item/order |
| `lib/sources.js` | a host bundled by two sources, a `counterpart` that is not registered, a route with no inverse on the counterpart |
| `tests/contracts.test.mjs` | an incomplete folder, a plugin not wired into a load list, a plugin folder without its own test, a label no skin translates |
| `npm test` | a line, branch or function under `src/plugins/` the suite does not exercise (the plugin coverage gate, `tools/plugin-coverage.mjs`) |
| `tests/plugins-schema.test.mjs` | `plugins.json` drifting from `plugins.schema.json` |
| `tests/compare/recipes.test.mjs` | a plugin folder without a `parity.mjs`, or a derived capture/selectors/vocabulary table that misses a registry plugin |
| `npm run registry:check` | a plugin not relisted in `plugins.json`, `PLUGINS.md` or the site |
| `npm run canary` | a source's live page dropping a hook a skin reads |
