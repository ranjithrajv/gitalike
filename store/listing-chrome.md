# Chrome Web Store listing

Paste-ready copy for the Chrome Web Store developer console. Character limits
are noted; each draft fits.

## Product name (max 45)

```
gitalike — GitHub ⇄ GitLab UI
```

## Short description (max 132)

```
See GitHub with a GitLab UI, and GitLab with a GitHub UI. Appearance only: no page rewriting, nothing collected.
```

## Category

`Developer Tools`

## Language

`English (United States)`

## Detailed description

```
gitalike re-skins the two big forges so they look like each other:

    a GitHub-flavoured site + GitLab UI  ->  purple accents, light top bar
    a GitLab-flavoured site + GitHub UI  ->  blue accents, dark top bar

It changes appearance only. It never rewrites the page, renames buttons or
changes what the site does — labels still say "Pull request" on GitHub and
"Merge request" on GitLab, and search, copy/paste and screen readers are
untouched.

Works on github.com and gitlab.com out of the box, on the bundled self-hosted
instance code.swecha.org, and on any other instance you point it at — GitHub
Enterprise Server included.

• Two independent switches, one per product.
• Add any instance by visiting it, or by typing its address. It is remembered.
• Alt+Shift+G toggles the site you are on; the toolbar badge shows GL or GH.
• Light and dark, following the site's own mode.
• No network access at all: both stylesheets are bundled and both logos are
  inline data URIs. Nothing is sent anywhere.

Permissions, plainly: gitalike asks for access to all sites because GitHub
Enterprise Server and self-hosted GitLab live on hostnames that cannot be
listed ahead of time. On every site you have not set up, it does nothing at all.

Not affiliated with GitHub or GitLab.
```

## Privacy practices tab

**Single purpose description**

```
gitalike changes only the visual appearance of GitHub and GitLab pages. It
re-points each site's own CSS design tokens and repaints the logos, so that a
GitHub site looks like GitLab, or a GitLab site looks like GitHub. It does not
alter page content or behaviour.
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

## Graphic assets

| Asset | Requirement | File |
| --- | --- | --- |
| Store icon | 128×128 PNG | `src/icons/icon-128.png` |
| Screenshots | 1280×720 (or 640×400), 1–5 | `store/screenshots/01-github-as-gitlab.png`, `02-gitlab-as-github.png`, `04-popup-1280x720.png` |

`03-popup.png` is the true 322px-wide popup and does **not** meet the 1280×720
requirement, so it is not uploaded to Chrome — it is there for AMO and the
README.
