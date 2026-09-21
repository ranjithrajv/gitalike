# addons.mozilla.org listing

Paste-ready copy for the AMO developer hub. Character limits are noted.

## Name (max 50)

```
GitAlike — any git platform, preferred UX
```

## Summary (max 250)

```
Use any forge, keep your muscle memory. Re-skins GitHub, GitLab™ and Bitbucket as each other — colour, wording, navigation and shortcuts — locally, with no network access and no data collected.
```

## Description

```
GitAlike re-skins the big forges so they look — and read — like each other, in
both directions: GitHub shown as GitLab, and GitLab shown as GitHub. That
two-way swap is what keeps your muscle memory — the words, the navigation, the
shortcuts — working on whichever forge you happen to be using:

    a GitHub-flavoured site + GitLab™ UI  ->  purple accents, light top bar
    a GitLab-flavoured site + GitHub UI  ->  blue accents, dark top bar

Beyond colour, it matches the other product's words and habits: "Pull request"
becomes "Merge request", a #42 reference becomes !42, the repository navigation
is relabelled and reordered, and the other product's g-shortcuts work. It changes
nothing about what the site does — no requests are intercepted and no data is
touched — and every change is reverted the moment you switch a skin off.

A theme changes the colours. GitAlike also changes the words ("Pull request"
becomes "Merge request"), the reference markers (#42 becomes !42), the
navigation's labels and order, and the other product's keyboard shortcuts.

The rewriting is conservative by design. Copy is never touched inside code,
inputs or editable regions; a control label changes only on an exact whole-label
match; and a feature the other product lacks is marked rather than guessed at.
Search, copy/paste and screen readers keep working.

Works on github.com, gitlab.com, Codeberg (Forgejo), gitea.com (Gitea) and
bitbucket.org out of the box, and on any other instance you point it at — GitHub
Enterprise Server, self-hosted GitLab, Bitbucket Data Center and Gerrit
included. Three skins — GitLab, GitHub and Bitbucket — and any site you have set
up can wear any of them. Sourcehut is the next candidate.

Runs in Firefox 142 or newer, and in the forks that track it (LibreWolf,
Floorp, Zen).

Features
- Three skins — GitLab UI, GitHub UI or Bitbucket UI (or Off) — one at a time,
  plus a per-site picker for the site you are on.
- Add any instance by visiting it, or by typing its address. It is remembered.
- Alt+Shift+G toggles the site you are on; the toolbar badge shows GL, GH or BB.
- Light and dark, following the site's own mode.
- No network access at all: no CDN, no remote configuration, no telemetry. The
  stylesheets are bundled and the mark is an inline data URI. Nothing is sent
  anywhere.

Permissions, plainly: GitAlike is granted the five bundled hosts (github.com,
gitlab.com, codeberg.org, gitea.com, bitbucket.org) at install.
GitHub Enterprise Server, self-hosted GitLab, Bitbucket Data Center and Gerrit
live on hostnames that cannot be listed ahead of time, so a self-hosted instance
is granted one origin at a time when you add it in the popup. On every site you
have not set up, it does nothing at all.

GitAlike is free software, licensed GPL-3.0-or-later; the source is at
github.com/ranjithrajv/gitalike.

GitHub is a trademark of GitHub, Inc. GITLAB is a trademark of GitLab Inc. in
the United States and other countries and regions. Not affiliated with GitHub
or GitLab.
```

## Category

`Appearance` (alternatively `Developer Tools`)

## Tags

```
github, gitlab, theme, appearance, user-interface
```

## License

`GPL-3.0-or-later` — AMO's picker has "GNU General Public License v3.0 or
later". See `LICENSE`; the source is <https://github.com/ranjithrajv/gitalike>.

## Privacy policy

```
GitAlike collects no data and makes no network requests. It stores only your
on/off choices and the list of instances you add, in Firefox's own synced
extension storage; that data stays within your browser profile and Mozilla
Sync, and is never sent to the developer or anyone else.

The extension is granted the five bundled forges (github.com, gitlab.com,
codeberg.org, gitea.com, bitbucket.org) at install. Self-hosted instances live
on unpredictable hostnames, so one is granted a single origin when you add it in
the popup. On hosts you have not set up, it does nothing.
```

Hosted at <https://ranjithrajv.github.io/gitalike/privacy.html>.

## Data collection

The manifest declares:

```json
"data_collection_permissions": { "required": ["none"] }
```

## Screenshots

AMO has no fixed screenshot size. Upload, in order:

1. `store/screenshots/01-as-gitlab.png`
2. `store/screenshots/02-as-github.png`
3. `store/screenshots/03-popup.png`

## Describe version (release notes)

Paste into AMO's **Describe Version** field. It appears on the detail page.

```
0.1.3 — the add-on is now GitAlike — any git platform, preferred UX.

New
- A third skin: Bitbucket UI. Any site you have set up — GitHub, GitLab,
  Codeberg/Gitea or Bitbucket — can wear it, beside GitHub UI and GitLab UI.
- Bitbucket and Gerrit can be the site you are on, shown with the GitHub or
  GitLab UI, and are added one instance at a time from the popup.
- Codeberg (Forgejo) and gitea.com (Gitea) are bundled, and can wear any of the
  three skins.
- Add a self-hosted instance by pasting its address: GitAlike reads the link and
  highlights the product it looks like, so one confirmation is enough.
- A per-site picker gives a single self-hosted instance its own skin (or none)
  without touching github.com.

Improved
- Navigation, profile pages and repository metadata now follow the applied
  product's layout and order, not only its colours.
- A parity checker now scores each skin against the real target product's
  interface, so the reskin stays faithful.

Fixed
- The GitLab UI hides GitHub's signed-in app header, since GitLab has none.
- The logged-out top bar hides words only the source product uses.
```

## Notes to reviewer

Paste into AMO's **Notes to Reviewer** field.

```
No account or special setup is needed. Open a public page while logged out —
github.com/git/git or gitlab.com/gitlab-org/gitlab — then use the toolbar popup
to pick a skin under "Show the web with" (GitLab UI, GitHub UI or Bitbucket UI).
On a host you have set up, "Show this site with" switches that one host;
Alt+Shift+G toggles the current site. Choosing Off reverts every change.

The add-on only rewrites the page's own text, labels and CSS custom properties,
locally. It is not a content blocker, intercepts no requests, and makes no
network requests of its own. It reads no page content into storage and sends
nothing anywhere.

Build. There is a build step, but it does not bundle, minify or transpile, and
needs no dependencies: build.mjs uses only Node's standard library.
node build.mjs firefox copies src/ into dist/firefox/ and writes
dist/firefox/manifest.json from src/manifest.base.json plus the Firefox-specific
keys — the event-page background, the Gecko id, strict_min_version, and the
data_collection_permissions declaration. dist/firefox is the add-on; zipping it
produces the package. The JavaScript that ships is byte-for-byte the JavaScript
in src/, so no separate source archive is required.

browser_specific_settings.gecko.id is gitalike@riseup.net.
strict_min_version is 142.0, the first Firefox whose desktop and Android builds
both understand data_collection_permissions.
```
