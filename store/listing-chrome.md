# Chrome Web Store listing

Paste-ready copy for the Chrome Web Store developer console. Character limits
are noted; each draft fits.

## Product name (max 45)

```
gitalike — GitHub ⇄ GitLab UI
```

## Short description (max 132)

```
See GitHub with a GitLab™ UI, and GitLab with a GitHub UI. Re-skins the page and its words, locally: nothing collected.
```

## Category

`Developer Tools`

## Language

`English (United States)`

## Detailed description

```
gitalike re-skins the two big forges so they look — and read — like each other:

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
instance code.swecha.org, and on any other instance you point it at — GitHub
Enterprise Server included.

• Two independent switches, one per product.
• Add any instance by visiting it, or by typing its address. It is remembered.
• Alt+Shift+G toggles the site you are on; the toolbar badge shows GL or GH.
• Light and dark, following the site's own mode.
• No network access at all: both stylesheets are bundled and the mark is an
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

## Privacy practices tab

**Single purpose description**

```
gitalike re-skins GitHub and GitLab pages to look and read like the other
product. It re-points each site's own CSS design tokens, paints its own mark in
the other product's palette, and relabels ordinary interface text and navigation
to the other product's vocabulary, so that a GitHub site reads like GitLab, or a
GitLab site reads like GitHub. It does not alter what the sites do: no requests
are intercepted and no data is touched.
```

**Permission justifications**

```
storage — Saves your on/off choices and the instances you add, using the
browser's own synced storage. Nothing leaves your browser profile.

Host permission (http://*/*, https://*/*) — GitHub Enterprise Server and
self-hosted GitLab can live on any hostname, so no manifest host list can cover
them. The extension therefore matches all pages and decides at runtime whether a
host is a forge you have set up. On any host you have not set up, it does 
nothing.
```

**Data usage** — answer "no" to collecting any category of user data. No remote
code. No data sold or shared. No use of data for purposes unrelated to the
single purpose.

**Privacy policy URL**

```
https://ranjithrajv.github.io/gitalike/privacy.html
```

## Graphic assets

| Asset | Requirement | File |
| --- | --- | --- |
| Store icon | 128×128 PNG | `src/icons/icon-128.png` |
| Screenshots | 1280×720 (or 640×400), 1–5 | `store/screenshots/01-github-as-gitlab.png`, `02-gitlab-as-github.png`, `04-popup-1280x720.png` |

`03-popup.png` is the true 322px-wide popup and does **not** meet the 1280×720
requirement, so it is not uploaded to Chrome — it is there for AMO and the
README.
