# gitalike

See GitHub with a GitLab interface, and GitLab with a GitHub interface.

gitalike is a small browser extension that re-skins the two big forges so they
look — and read — like each other. It repaints the interface from the other
product's design tokens, then matches its *words and habits*: copy is rewritten
("Pull request" becomes "Merge request"), reference markers are swapped, the
repo navigation is relabelled and reordered, and the other product's
`g`-shortcuts work. It never changes what the site *does* — no requests are
intercepted, no data is touched — and every change is reverted the moment you
switch a skin off.

```
 a GitHub-flavoured site  + GitLab UI  ->  octocat logo, purple accents, light bar
 a GitLab-flavoured site  + GitHub UI  ->  tanuki logo, blue accents, dark bar
```

It works on `github.com` and `gitlab.com` out of the box, on the bundled
self-hosted instance `code.swecha.org`, and on any other instance you point it
at — **GitHub Enterprise Server** included.

## Install

The extension is built from `src/` into `dist/<browser>`. There is a build step
because Chromium and Firefox declare their Manifest V3 background context
differently (Chromium wants a service worker, Firefox wants an event page).

```sh
npm run build            # builds dist/chromium and dist/firefox
# or
npm run build:chromium
npm run build:firefox
```

**Chromium** (also loads in Chrome, Edge and Brave, which share the API)

1. `npm run build:chromium`
2. Go to `chrome://extensions` — that is Chromium's own URL scheme, not a typo
3. Turn on **Developer mode**
4. **Load unpacked** → choose `dist/chromium`

**Firefox**

1. `npm run build:firefox`
2. Go to `about:debugging#/runtime/this-firefox`
3. **Load Temporary Add-on…** → choose `dist/firefox/manifest.json`

> **About the permission prompt.** Chromium will warn that gitalike can "read and
> change all your data on all websites". That is accurate, and it is the price of
> the design — see [Why it matches every site](#why-it-matches-every-site). The
> extension adds a class to `<html>` on sites you have explicitly set up, does
> nothing elsewhere, and sends no data anywhere. There are no network requests at
> all: both stylesheets are bundled, and the logos are inline data URIs.

## Use

Open the toolbar popup. There are two switches, one per product:

| Switch                       | Applies to                                      | Result                     |
| ---------------------------- | ----------------------------------------------- | -------------------------- |
| **Show with the GitLab UI**  | `github.com`, your GitHub Enterprise instances   | rendered as GitLab         |
| **Show with the GitHub UI**  | `gitlab.com`, `code.swecha.org`, your GitLab ones | rendered as GitHub        |

Both start off. The switches are **per product, not per host**: turning on the
GitLab UI covers every GitHub-flavoured site you have set up, at once.

The popup highlights the row for the site you are currently on, and lists the
hosts each switch covers.

**Keyboard:** `Alt` + `Shift` + `G` toggles the current site. It can only toggle
a site that is already set up — telling GitHub from GitLab is a choice, so the
first time has to go through the popup. `Alt` + `Shift` + `O` opens the current
page on the other host (the two public forges only). Rebind either at
`chrome://extensions/shortcuts` (Firefox: `about:addons` → gear → *Manage
Extension Shortcuts*).

While a skin is active the toolbar icon shows a small **GL** or **GH** badge.

## Adding GitHub Enterprise (or another GitLab)

Any host the extension has not seen before is left completely alone. There are
two ways in, and they open the same form. One thing to keep straight in both:
the buttons ask **which product the site is**, not which skin you want — a
GitHub Enterprise server is a GitHub site, so choosing **GitHub** is what gives
it the GitLab UI.

**From the page you are on.** Open the popup; when the host in front of you
needs a decision the form is already open and filled in.

1. Open the popup on the instance. It reads *"`github.acme.com` is not set up"*
   and prefills the field.
2. Choose **GitHub** or **GitLab**. It is remembered, and the skin switches on
   immediately on the page you already have open — no reload.

**By typing the address.** You do not have to visit an instance to add it, which
is the point when the address is one you would have to look up:

1. Open the popup and click **Add a site**.
2. Paste the address. A bare host (`github.acme.com`) and a full URL
   (`https://GitHub.Acme.com/pulls?q=1`) both work. Only the hostname is kept,
   because a port or path would never match the host you actually land on.
3. Choose **GitHub** or **GitLab**.

Anything that is not a web address is refused rather than stored, including
`javascript:` and other non-http schemes. Built-in hosts
(`github.com`, `gitlab.com`, `code.swecha.org`) are refused too — they are
already set up and cannot be removed.

To undo, open the popup on that host and choose **Remove**.

## UX parity

The skin is not only colour. While a skin is on, gitalike also matches the other
product's *vocabulary and habits*:

| Surface    | What changes                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| Copy       | "Pull request(s)" ⇄ "Merge request(s)", "Insights" ⇄ "Analytics", "Actions" ⇄ "CI/CD", "Go to file" ⇄ "Find file", "Gists" ⇄ "Snippets", "Codespaces" ⇄ "Workspaces" |
| Navigation | repo tabs are relabelled ("Code" ⇄ "Repository") and reordered into the other product's order — GitLab's repository group included |
| References | a pull/merge-request link shows the other product's marker — `#42` ⇄ `!42`                                        |
| Shortcuts  | the other product's `g`-combos work: on GitHub shown as GitLab, `g m` opens merge requests                        |
| Other host | open the same page on the other forge, from the popup or `Alt` + `Shift` + `O`                                     |
| No counterpart | a feature the other product lacks is marked `≠ GitLab` / `≠ GitHub` instead of pretending it exists             |

It is deliberately conservative. Copy is rewritten only in ordinary page text —
never inside code, inputs or editable regions — control words like the merge
button ("Merge pull request" ⇄ "Merge") change only on an exact whole-label match
on a button, tab, menu item or link, and navigation labels change only on an
exact whole-label match inside a known nav region, so prose and marketing copy are
safe. A reference marker is only touched on a link that is *just* a number. Every
change is recorded, and undone exactly when the skin is switched off.

The full status matrix — what each direction covers, and the few things that are
deliberately one-way — is in [docs/UX-PARITY.md](docs/UX-PARITY.md).

## How it works

Both sites are built on design-token systems, and almost everything on the page
reads its colours from a handful of CSS custom properties:

- GitHub → [Primer](https://primer.style/product/primitives/) (`--fgColor-*`,
  `--bgColor-*`, `--borderColor-*`, plus the legacy `--color-*` names)
- GitLab → [Pajamas](https://design.gitlab.com/) (`--gl-*`)

So gitalike mostly re-points those properties at the other design system's
palette, then fixes up a few structural things the tokens cannot reach (the top
bar, the logo, active-tab accents). Two stylesheets and two classes do the
visual half; a second content script does the copy, reference, navigation and
keyboard half, driven by the tables in `src/lib/ux.js`.

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

The extension is inert everywhere it has not been set up, because both
stylesheets are scoped to `html.gs-theme-*` classes that only get added on
classified hosts.

## Tweaking a theme

Each theme file has three parts:

1. **A palette block** for this extension only: `--gs-canvas`, `--gs-fg`,
   `--gs-accent`, `--gs-purple`, … with a light set and a `html.gs-dark`
   override. Change these to taste.
2. **A mapping block** that points the site's own tokens at the palette, e.g.

   ```css
   html.gs-theme-gitlab {
     --fgColor-default: var(--gs-fg) !important;
     --bgColor-accent-emphasis: var(--gs-accent) !important;
   }
   ```

   Add a line here whenever you find a spot the skin misses.

3. **A logo data URI**, `--gs-tanuki` in the GitLab→GitHub skin and `--gs-octocat`
   in the GitHub→GitLab one, that repaints the site's own mark in the other
   brand's palette. The shape is never swapped between products. The editable
   sources live in `logos/`; they are inlined as data URIs rather than linked,
   because injected CSS cannot resolve extension-relative URLs. Re-encode after
   editing one.

Hosts, products and the bundled host list live in `src/lib/sites.js` — one
source of truth shared by the content script, the popup and the background.

## Known limitations

- **UX parity is conservative, not exhaustive.** Only the vocabulary that maps
  cleanly is rewritten ("Pull request" ⇄ "Merge request"); product-specific
  concepts with no counterpart are left alone. Copy is never touched inside
  code, inputs or editable regions, and nav labels change only on an exact
  whole-label match, so search, copy/paste and screen readers keep working — but
  text the site updates *inside* an already-processed node is not re-translated
  until that node is replaced.
- **The keyboard remap is best-effort.** Where the destination has a navigation
  link the combo is delivered as a click on that link, because GitLab ignores
  synthetic key events. `g n` (notifications) has no link, so it only works on
  GitHub.
- **GitLab's sidebar groups are not restructured.** Its project navigation is a
  nested group tree, so only the repository ("Code") group is reordered to match
  GitHub's tab order; the groups themselves keep GitLab's order, because
  flattening them would change GitLab's information architecture rather than
  match GitHub's.
- **"Open on the other host" covers the two public forges only.** A self-hosted
  instance has no pair to guess, so the action is absent there.
- **A feature with no counterpart is marked, not hidden.** GitLab-only features
  (Epics, Iterations, Requirements, Service Desk, …) get a `≠ GitHub` badge on a
  GitHub-skinned site, and GitHub-only ones (Discussions, Sponsors) get `≠ GitLab`
  on a GitLab-skinned site. The list is curated in `UNMAPPED`; a feature that has
  a real counterpart is never marked.
- **Access to all sites.** The install prompt is the honest one. If that is not
  a trade you want to make, the alternative above is a small change to make.
- **The stylesheets and UX tables load on every page** — about 24 KB of CSS plus
  the vocabulary tables, parsed and unused on sites you have not set up. Inert,
  but not free.
- **Switches are per product, not per host.** You cannot skin your enterprise
  instance without also skinning `github.com`. With two switches and a handful of
  hosts that seems like the right amount of control; it is the thing to change
  first if it turns out not to be.
- **The shortcut cannot set up a new host**, only toggle one already classified,
  because classifying requires choosing which product it is.
- **Selectors age.** GitHub and GitLab ship new markup constantly. The token
  overrides are stable; the structural selectors need a touch-up now and then.
  Several already had to be written defensively:
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
- **Logos keep their shape; only the palette changes.** A GitLab site skinned as
  GitHub still shows the tanuki, repainted white→blue in GitHub's ink and accent;
  a GitHub site skinned as GitLab still shows the octocat, repainted across
  GitLab's red→orange→yellow. The tanuki is a single solid shape rather than
  GitLab's five-colour brand mark. Both are embedded as SVG data URIs so nothing
  depends on extension-relative URL resolution; the editable sources live in
  `logos/`.
- **`gitlab.com/` redirects.** When you are logged out the root bounces to
  `about.gitlab.com`, a different origin, so there is nothing for the skin to do
  there. The GitLab app — `/dashboard`, `/explore`, project pages — is where it
  applies.

## Verification

Every claim above was checked rather than assumed. `dist/chromium` was loaded
unpacked into Chromium 151 and driven with Playwright against the live sites —
`github.com/microsoft/vscode`, the `gitlab.com/gitlab-org/gitlab` project page,
`code.swecha.org` — plus a local mock standing in for an enterprise host.
Covered:

- light **and** dark palettes, on both skins
- each logo repainted in the other palette, including that no ghost logo is left
  behind
- **UX parity, both directions**: copy rewritten (`Pull requests 387` →
  `Merge requests 387`), repo tabs relabelled and reordered (`Code` →
  `Repository`, and `Insights` moved before `Security`), an injected `#42` link
  becoming `!42`, `g m` navigating to the repo's pull requests, and a clean
  revert of every one of those changes when the skin is switched off
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

Then the same again with a **signed-in** session (a copy of a real Chromium
profile — see [Signed in](#signed-in)), in both light and dark.

Testing against a real **project page** rather than a listing page earned its
keep: it is where both of the project-page bugs surfaced. One text colour across
GitLab's top bar left the filled "Sign in" button white-on-white, and an
unscoped `<img>` fallback for the logo blanked out the project avatar. Neither
is visible on `/explore`.

Seven bugs in total were found this way and fixed:

| Bug | Where it showed |
| --- | --- |
| GitHub header text stayed near-white after the bar was flipped light | `github.com` repo page |
| GitLab's search field kept a light background under light placeholder text | `gitlab.com/explore` |
| The popup threw if its shared host list failed to load | code review |
| GitLab's filled "Sign in" button went white-on-white | `gitlab.com` **project page** |
| The project avatar was repainted with a GitHub-coloured tanuki | `gitlab.com` **project page** |
| GitHub's signed-in header was grey — the opposite of GitLab | `github.com` **signed in** |
| Dark detection could read back its own `color-scheme` when GitHub was `auto` | `github.com` **signed in** |

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

## Development

```sh
npm run build          # dist/chromium + dist/firefox
npm test               # unit tests for src/lib/*.js (node:test)
npm run lint           # build:firefox, then validate it with web-ext lint
npm run package        # store-ready zips -> dist/artifacts/
npm run screenshots    # store screenshots -> store/screenshots/
npm run clean          # remove dist/
```

`npm run package` builds both targets and writes upload-ready ZIPs to
`dist/artifacts/chromium/` and `dist/artifacts/firefox/` — the Chromium one for
the Chrome Web Store, the Firefox one for addons.mozilla.org. The version lives
in `package.json` alone: `build.mjs` stamps it onto both generated manifests, so
there is nothing to keep in sync by hand. See [CHANGELOG.md](CHANGELOG.md).

There are no runtime or build dependencies — `build.mjs` uses only Node's
standard library, and the tests use Node's built-in `node:test`. Two dev
dependencies exist: [`web-ext`](https://github.com/mozilla/web-ext) for
`npm run lint` and `npm run package`, and
[`playwright-core`](https://playwright.dev/) for `npm run screenshots`, which
drives the system Chromium and downloads no browser of its own.

## Publishing

The submission material lives in `store/`:

- `store/listing-chrome.md` — name, descriptions, category, and the permission
  and privacy answers the Chrome Web Store asks for.
- `store/listing-firefox.md` — the same for addons.mozilla.org, plus reviewer
  notes and the `data_collection_permissions` declaration.
- `store/screenshots/` — regenerated with `npm run screenshots` against the live
  sites.

To cut a release:

```sh
npm test && npm run lint     # 46 unit tests, 0 lint warnings
npm run package              # dist/artifacts/*/gitalike_github_gitlab_ui-X.Y.Z.zip
npm run screenshots          # refresh store/screenshots/
```

Bump `version` in `package.json` (the only place it is written), add a
`CHANGELOG.md` entry, then commit and tag `vX.Y.Z`.

## License

MIT — see [LICENSE](LICENSE).
