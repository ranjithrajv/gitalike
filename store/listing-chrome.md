# Chrome Web Store listing

Paste-ready copy for the Chrome Web Store developer console. Character limits
are noted; each draft fits.

## Product name (max 45)

```
GitAlike — any git platform, preferred UX
```

## Short description (max 132)

```
Use any forge, keep your muscle memory. Re-skins GitHub, GitLab™ and Bitbucket as each other, locally: nothing collected.
```

## Category

`Developer Tools`

## Language

`English (United States)`

## Detailed description

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

Runs in Chrome, Edge, Brave, Opera, Vivaldi and the other Chromium browsers,
which share the extension API.

• Three skins — GitLab UI, GitHub UI or Bitbucket UI (or Off) — one at a time,
  plus a per-site picker for the site you are on.
• Add any instance by visiting it, or by typing its address. It is remembered.
• Alt+Shift+G toggles the site you are on; the toolbar badge shows GL, GH or BB.
• Light and dark, following the site's own mode.
• No network access at all: no CDN, no remote configuration, no telemetry. The
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

## Privacy practices tab

**Single purpose description**

```
GitAlike re-skins a forge's pages to look and read like one of the other
forges — GitHub, GitLab or Bitbucket. It re-points each site's own CSS design
tokens, paints its own mark in the imitated product's palette, and relabels
ordinary interface text and navigation to that product's vocabulary, so that a
GitHub site reads like GitLab, or a GitLab site reads like GitHub. It does not
alter what the sites do: no requests are intercepted and no data is touched.
```

**Permission justifications**

```
storage — Saves your on/off choices and the instances you add, using the
browser's own synced storage. Nothing leaves your browser profile.

Host permission (*://github.com/*, *://gitlab.com/*, *://codeberg.org/*,
*://gitea.com/*, *://bitbucket.org/*) — the five bundled forges, granted at
install.

Optional host permission (*://*/*) — GitHub Enterprise Server, self-hosted
GitLab, Bitbucket Data Center and Gerrit can live on any hostname, so no fixed
list can cover them. When you add an instance in the popup, the extension asks
for that one origin; until you do, it has no access to it. On any host you have
not set up, it does nothing.
```

**Data usage** — answer "no" to collecting any category of user data. No remote
code. No data sold or shared. No use of data for purposes unrelated to the
single purpose.

**Privacy policy URL**

```
https://ranjithrajv.github.io/gitalike/privacy.html
```

## Test instructions

```
No account, credentials or special setup are needed.

1. Install the extension, then open the toolbar popup.
2. Pick a skin under "Show the web with": "GitLab UI" repaints the
   GitHub-flavoured sites, "GitHub UI" the GitLab-flavoured ones, "Bitbucket UI"
   repaints every site you have set up (or leave it Off).
3. Open https://github.com/git/git or https://gitlab.com/gitlab-org/gitlab —
   the page is re-skinned immediately, with no reload. On a site you have set
   up, the popup's "Show this site with" picker switches that one host between
   Off, GitHub UI, GitLab UI and Bitbucket UI.
4. Alt+Shift+G toggles the site you are on; choosing Off reverts every change.

Access is granted per host: the bundled forges at install, a self-hosted
instance when you add it (one origin, one prompt). The extension decides at
runtime and is inert on any host you have not set up — its scripts are not even
loaded there. It makes no network requests and runs no remote code; it rewrites
the page's own text, labels and CSS tokens locally.
```

## Graphic assets

| Asset | Requirement | File |
| --- | --- | --- |
| Store icon | 128×128 PNG | `src/icons/icon-128.png` |
| Screenshots | 1280×800 (or 640×400), JPEG or 24-bit PNG (no alpha), 1–5 | `store/screenshots/01-as-gitlab.png`, `02-as-github.png`, `04-popup-1280x800.png` |

`03-popup.png` is the true 322px-wide popup and does **not** meet the 1280×800
requirement, so it is not uploaded to Chrome — it is there for AMO and the
README.
