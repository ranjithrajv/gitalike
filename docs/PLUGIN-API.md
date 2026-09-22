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
then `npm test` names what is left. `npm run plugins:validate` checks every
plugin in isolation and reports all the incomplete ones at once.

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
palette — never a vendor's logo or path data).

## Source

`defineSource(name, source)`. Required: `label` (a display name).

| Field | Shape |
| --- | --- |
| `markup` | `true` (default) for a forge with a real DOM, `false` for a vocabulary-only, client-rendered product |
| `selectors` | `{ hookName: 'css selector' }` — required for a markup source, forbidden for a vocabulary-only one |
| `canary` | `[{ name, url, keys: [hookName] }]` — required for a markup source, forbidden for a vocabulary-only one |
| `compare` | `{ palette, nav, page, metadata, profile, refs }`, each a fraction in `[0, 1]` |
| `description` | one line for the catalog |

`compare` is the source's own declaration of how much of each parity dimension a
skin can reproduce on it; `tools/compare/parity-score.mjs` reads it instead of a
hardcoded set. A hook a stylesheet owns is marked `// css` in `selectors`, and
the contract test checks the two agree.

A source that is a forge people host also gets a `builtin`/`SOURCES` entry in
`src/lib/sites.js` so it is classified and (optionally) bundled.

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
| `defineSkin` / `defineSource` | a missing or malformed required field, a duplicate name, an unmet `minApiVersion` |
| `lib/skins.js` | a `navRules` rule that names no registered source or has no container/item/order |
| `tests/contracts.test.mjs` | an incomplete folder, a plugin not wired into a load list, a label no skin translates |
| `tests/plugins-schema.test.mjs` | `plugins.json` drifting from `plugins.schema.json` |
| `npm run registry:check` | a plugin not relisted in `plugins.json`, `PLUGINS.md` or the site |
| `npm run canary` | a source's live page dropping a hook a skin reads |
