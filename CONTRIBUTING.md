# Contributing to Git Same

Thanks for taking a look. It is a small extension with a few firm rules; the
rest is straightforward. If you only read one section, read
[Ground rules](#ground-rules).

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
[Why it matches every site](README.md#why-it-matches-every-site) for the
reason). Adding another permission needs a very good argument.

## Getting set up

```sh
npm install          # dev-only: web-ext, playwright-core
npm run build        # -> dist/chromium and dist/firefox
npm test             # unit tests, no browser needed
npm run lint         # web-ext lint over the Firefox build
```

To try it, load `dist/chromium` unpacked — see
[Install](README.md#install) for the click-by-click.

```sh
npm run package      # store-ready zips -> dist/artifacts/
npm run screenshots  # regenerate store/screenshots/
```

## Layout

```
src/
├── manifest.base.json   shared manifest; the build adds `background` + `version`
├── background.js        keyboard shortcut and per-tab badge
├── lib/
│   ├── sites.js         hosts, kinds, parseHost, schema — pure, no DOM
│   └── ux.js            vocabulary/nav/shortcut tables — pure, no DOM
├── content/
│   ├── theme.js         applies the theme classes, tracks light/dark
│   └── ux.js            performs the text and nav rewrites, undoably
├── themes/              ALL colour lives here — two stylesheets
├── popup/               toolbar UI
└── icons/
logos/                   editable logo sources, inlined into the themes
tests/                   node:test, covers src/lib/ only
tools/                   store screenshot generation
store/                   submission copy and screenshots
```

`src/lib/*` is pure data and side-effect-free helpers published on
`globalThis.GIT_SAME` / `globalThis.GIT_SAME_UX`, shared by the content scripts,
the popup, the background and the tests. `src/content/*` is the only code that
touches a page.

## Common tasks

### Fix a spot the skin misses

1. In DevTools, find the element and note the property you want to change.
2. **Prefer re-pointing a design token over adding a rule.** Most of the work is
   done by mapping Primer's `--fgColor-*` / `--bgColor-*` and Pajamas' `--gl-*`
   onto our own palette. See
   [Tweaking a theme](README.md#tweaking-a-theme).
3. If a rule really is needed, keep it under `html.gs-theme-*` so it stays inert
   when the skin is off.

### Support another Git instance

Usually you should not add it to the source at all — that is what the popup's
**Add a site** flow is for, and it needs no permission prompt. Only add a
*built-in* host for something we want to work out of the box:

1. `src/lib/sites.js` — add it to the `builtin` table.
2. `tests/sites.test.mjs` — cover it.

Nothing in the manifest needs touching. It already matches every `http(s)` page
and decides at runtime — see
[Why it matches every site](README.md#why-it-matches-every-site) — so there is no
per-host entry to keep in sync.

### Add or change a logo

1. Edit the SVG in `logos/` (these are the editable sources).
2. Re-encode it as a data URI into the relevant theme variable — `--gs-octocat`
   in `themes/github-as-gitlab.css`, `--gs-tanuki` in
   `themes/gitlab-as-github.css`. Injected CSS cannot resolve extension-relative
   URLs, which is why it is inlined rather than linked.
3. Check both light and dark: the two palettes are chosen for their background.

### Add a label translation

1. Add it to the right table in `src/lib/ux.js`. Longest key wins, so add the
   plural before the singular.
2. Add a case to `tests/ux.test.mjs`.
3. Do not translate inside code, inputs or editable regions — the content script
   already skips those, so just avoid adding a rule that would need an exception.

### Add a keyboard shortcut

`SHORTCUTS` in `src/lib/ux.js`, plus a test.

## Adding another forge — contributions welcome

Git Same knows two products, GitHub and GitLab, and skins each as the other.
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

You can already point Git Same at any instance without touching the source: the
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

DOM behaviour is verified against the live sites by hand; there is no browser
harness in CI. [Verification](README.md#verification) in the README describes how
that is done, including the trick for testing while signed in.

The single most useful habit: after a change, load the extension and check the
site with the skin **off** as well as on. A skin that leaks when disabled is the
easiest bug to ship and the most annoying to live with.

## Style

- 2-space indent, single quotes, semicolons, trailing commas in multi-line
  literals.
- `src/lib/*` and `src/content/*` are **classic scripts, not ES modules** — they
  share one scope, so publish through `globalThis.GIT_SAME*` and wrap in an IIFE.
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
- `npm test && npm run lint` must pass.
- Behaviour changes need a `README.md` update, and an entry under
  `## [Unreleased]` in `CHANGELOG.md`.
- The version lives in `package.json` and nowhere else — `build.mjs` stamps it
  onto both generated manifests, so do not edit the manifests by hand.
- If the change is visible, refresh the screenshots with `npm run screenshots`.

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
