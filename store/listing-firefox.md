# addons.mozilla.org listing

Paste-ready copy for the AMO developer hub. Character limits are noted.

## Name (max 50)

```
Git Same — GitHub ⇄ GitLab UI
```

## Summary (max 250)

```
See GitHub with a GitLab UI, and GitLab with a GitHub UI. Appearance only — it never rewrites the page or changes what the site does. No data is collected, and there is no network access at all.
```

## Description

```
Git Same re-skins the two big forges so they look like each other:

    a GitHub-flavoured site + GitLab UI  ->  purple accents, light top bar
    a GitLab-flavoured site + GitHub UI  ->  blue accents, dark top bar

It changes appearance only. It never rewrites the page, renames buttons or
changes what the site does — labels still say "Pull request" on GitHub and
"Merge request" on GitLab, and search, copy/paste and screen readers are
untouched.

Works on github.com and gitlab.com out of the box, on the bundled self-hosted
instance code.swecha.org, and on any other instance you point it at — GitHub
Enterprise Server and self-hosted GitLab included.

Features
- Two independent switches, one per product.
- Add any instance by visiting it, or by typing its address. It is remembered.
- Alt+Shift+G toggles the site you are on; the toolbar badge shows GL or GH.
- Light and dark, following the site's own mode.
- No network access at all: both stylesheets are bundled and both logos are
  inline data URIs. Nothing is sent anywhere.

Permissions, plainly: Git Same asks for access to all sites because GitHub
Enterprise Server and self-hosted GitLab live on hostnames that cannot be
listed ahead of time. On every site you have not set up, it does nothing at all.

Not affiliated with GitHub or GitLab.
```

## Category

`Appearance` (alternatively `Developer Tools`)

## Tags

```
github, gitlab, theme, appearance, user-interface
```

## License

`MIT` — see `LICENSE`.

## Privacy policy

```
Git Same collects no data and makes no network requests. It stores only your
on/off choices and the list of instances you add, in Firefox's own synced
extension storage; that data stays within your browser profile and Mozilla
Sync, and is never sent to the developer or anyone else.

The extension requests access to all sites so that self-hosted instances on
unpredictable hostnames can work without a per-site permission prompt. On hosts
you have not set up, it does nothing.
```

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

- This is a listed add-on; `browser_specific_settings.gecko.id` is
  `git-same@riseup.net`.
- `strict_min_version` is `142.0`, the first Firefox (desktop 140, Android 142)
  that understands `data_collection_permissions`.
- There is a build step (`build.mjs`), but it only copies `src/` and generates
  the two per-browser manifests; no bundling, minification or transpilation is
  involved, so the shipped JavaScript is the source JavaScript.
