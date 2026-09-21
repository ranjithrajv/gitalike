# addons.mozilla.org listing

Paste-ready copy for the AMO developer hub. Character limits are noted.

## Name (max 50)

```
gitalike — GitHub ⇄ GitLab UI
```

## Summary (max 250)

```
Use any forge, keep your muscle memory. Re-skins GitHub and GitLab™ so each looks and reads like the other, locally. No data is collected, and there is no network access at all. More forges are on the way.
```

## Description

```
gitalike re-skins the big forges so they look — and read — like each other:

    a GitHub-flavoured site + GitLab™ UI  ->  purple accents, light top bar
    a GitLab-flavoured site + GitHub UI  ->  blue accents, dark top bar

Beyond colour, it matches the other product's words and habits: "Pull request"
becomes "Merge request", a #42 reference becomes !42, the repository navigation
is relabelled and reordered, and the other product's g-shortcuts work. It changes
nothing about what the site does — no requests are intercepted and no data is
touched — and every change is reverted the moment you switch a skin off.

The rewriting is conservative by design. Copy is never touched inside code,
inputs or editable regions; a control label changes only on an exact whole-label
match; and a feature the other product lacks is marked rather than guessed at.
Search, copy/paste and screen readers keep working.

Works on github.com and gitlab.com out of the box, on the bundled self-hosted
instance code.swecha.org, on Codeberg (Forgejo) and gitea.com (Gitea), and on any
other instance you point it at — GitHub Enterprise Server and self-hosted GitLab
included. Bitbucket and Sourcehut are the next candidates.

Features
- Two product switches, plus a per-site picker: choose Off, GitHub UI or GitLab UI
  for the site you are on, without changing the rest.
- Add any instance by visiting it, or by typing its address. It is remembered.
- Alt+Shift+G toggles the site you are on; the toolbar badge shows GL or GH.
- Light and dark, following the site's own mode.
- No network access at all: both stylesheets are bundled and the mark is an
  inline data URI. Nothing is sent anywhere.

Permissions, plainly: gitalike asks for access to all sites because GitHub
Enterprise Server and self-hosted GitLab live on hostnames that cannot be
listed ahead of time. On every site you have not set up, it does nothing at all.

gitalike is free software, licensed GPL-3.0-or-later; the source is at
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
gitalike collects no data and makes no network requests. It stores only your
on/off choices and the list of instances you add, in Firefox's own synced
extension storage; that data stays within your browser profile and Mozilla
Sync, and is never sent to the developer or anyone else.

The extension requests access to all sites so that self-hosted instances on
unpredictable hostnames can work without a per-site permission prompt. On hosts
you have not set up, it does nothing.
```

Hosted at <https://ranjithrajv.github.io/gitalike/privacy.html>.

## Data collection

The manifest declares:

```json
"data_collection_permissions": { "required": ["none"] }
```

## Screenshots

AMO has no fixed screenshot size. Upload, in order:

1. `store/screenshots/01-github-as-gitlab.png`
2. `store/screenshots/02-gitlab-as-github.png`
3. `store/screenshots/03-popup.png`

## Notes for review

- Reviewing needs no account: the skin applies on public pages
  (`github.com/git/git`, `gitlab.com/gitlab-org/gitlab`) while logged out.
  Toggle the switches in the toolbar popup; on a site you have set up, the
  "Show this site with" picker switches that one host between Off, GitHub UI and
  GitLab UI; Alt+Shift+G toggles the current site.
- The extension rewrites the page's own text, labels and CSS tokens locally. It
  is not a content blocker, intercepts no requests and makes no network
  requests; switching both switches off reverts every change.
- This is a listed add-on; `browser_specific_settings.gecko.id` is
  `gitalike@riseup.net`.
- `strict_min_version` is `142.0`, the first Firefox (desktop 140, Android 142)
  that understands `data_collection_permissions`.
- There is a build step (`build.mjs`), but it only copies `src/` and generates
  the two per-browser manifests; no bundling, minification or transpilation is
  involved, so the shipped JavaScript is the source JavaScript.
