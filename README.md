# gitalike

Use any forge, keep your muscle memory.

gitalike is a small browser extension that re-skins the big forges so they look —
and read — like each other. It repaints the interface from the target product's
design tokens, then matches its *words and habits*: copy is rewritten ("Pull
request" becomes "Merge request"), reference markers are swapped, the repo
navigation is relabelled and reordered, and the other product's `g`-shortcuts
work. It never changes what the site *does* — no requests are intercepted, no
data is touched — and every change is reverted the moment you switch a skin off.

Three skins — **GitLab**, **GitHub** and **Bitbucket** — and any host you have
set up can wear any of them from the popup.

```
 a GitHub-flavoured site  + GitLab UI     ->  gitalike mark, purple accents, light bar
 a GitLab-flavoured site  + GitHub UI     ->  gitalike mark, blue accents, dark bar
 any site                 + Bitbucket UI  ->  gitalike mark, Atlassian blue bar
```

It works on `github.com`, `gitlab.com`, `codeberg.org` and `gitea.com` out of
the box. Any other instance — a self-hosted GitLab, **GitHub Enterprise Server**
— is added from the popup, which asks for that one site's access.

gitalike starts with the two big forges, GitHub and GitLab, and grows from
there. The GitHub-flavoured **Codeberg** (Forgejo) and **gitea.com** (Gitea) are
bundled too — they speak GitHub's dialect, so by default they are shown with the
GitLab UI, and the per-site picker can show them with the GitHub or Bitbucket UI
instead. Sourcehut is the next candidate. A forge that already speaks one of the
two dialects needs only to be classified as that kind of site; until then, any
instance works today through the popup's **Add a site** flow. If you would like
to help add one, see
[CONTRIBUTING.md](CONTRIBUTING.md#adding-another-forge--contributions-welcome).

gitalike is an independent project. It is not affiliated with, endorsed by or
sponsored by GitHub, Inc. or GitLab Inc., and it ships none of their artwork:
the mark it paints on a skinned page is its own. GitHub is a trademark of
GitHub, Inc. GITLAB is a trademark of GitLab Inc. in the United States and other
countries and regions.

**Live preview:** <https://ranjithrajv.github.io/gitalike/> — swipe between each
site and its skin.

## Install

<a href="https://github.com/ranjithrajv/gitalike/releases/latest/download/gitalike-chromium.zip"><img alt="Download gitalike for Chromium" src="https://img.shields.io/badge/Download-Chromium-4285F4?logo=googlechrome&amp;logoColor=white"></a>
<a href="https://github.com/ranjithrajv/gitalike/releases/latest/download/gitalike-firefox.zip"><img alt="Download gitalike for Firefox" src="https://img.shields.io/badge/Download-Firefox-FF7139?logo=firefoxbrowser&amp;logoColor=white"></a>

Both links follow the newest release. The asset names deliberately carry no
version number, so `/releases/latest/download/...` keeps working as releases
pile up.

**Chromium** (also loads in Chrome, Edge, Brave, Opera, Vivaldi and the other
Chromium-based browsers, which share the API)

1. Unzip `gitalike-chromium.zip`
2. Go to `chrome://extensions` — that is Chromium's own URL scheme, not a typo
3. Turn on **Developer mode**
4. **Load unpacked** → choose the unzipped folder

Load unpacked takes a **folder**, not the ZIP, and it loads the extension from
wherever that folder lives — so do not move or delete it afterwards.

**Firefox**

`gitalike-firefox.zip` needs Firefox **142 or newer**, and works in the forks
that track it (LibreWolf, Floorp, Zen, …). It is unsigned, so Firefox will only
load it **temporarily** — it is gone when the browser restarts. A permanent
install comes from addons.mozilla.org.

1. Go to `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → choose `gitalike-firefox.zip` itself; it does not
   need unzipping

### From source

Build it yourself instead. (The build step exists because Chromium and Firefox
declare their Manifest V3 background context differently — Chromium wants a
service worker, Firefox wants an event page.)

```sh
npm run build            # builds dist/chromium and dist/firefox
# or
npm run build:chromium
npm run build:firefox
```

Then load `dist/chromium` as an unpacked extension, or `dist/firefox/manifest.json`
through `about:debugging`.

> **About the permission prompt.** The install prompt covers the public forges
> and Codeberg; a self-hosted instance is granted one origin at a time when you
> add it. The extension adds a class to `<html>` on sites you have explicitly set
> up, does nothing elsewhere, and sends no data anywhere: there are no network
> requests at all, both stylesheets are bundled, and the logos are inline data
> URIs. The one thing that does leave the machine is `chrome.storage.sync` — the
> settings and the hostnames you add are synced by your browser to your account,
> and nothing read from a page is ever put there. The reasoning is in
> [CONTRIBUTING.md](CONTRIBUTING.md#why-it-matches-every-site).

## Use

Open the toolbar popup. **Show the web with** is one radio group — **GitLab UI**,
**GitHub UI**, **Bitbucket UI** or **Off** — so exactly one skin is active at a
time. Each option lists the hosts it covers:

| Choice            | Normally covers                                                             | Result               |
| ----------------- | --------------------------------------------------------------------------- | -------------------- |
| **GitLab UI**     | `github.com`, `codeberg.org`, `gitea.com`, your GitHub Enterprise instances  | rendered as GitLab   |
| **GitHub UI**     | `gitlab.com`, `codeberg.org`, `gitea.com`, your GitLab ones                  | rendered as GitHub   |
| **Bitbucket UI**  | every host you have set up                                                   | rendered as Bitbucket |
| **Off**           | —                                                                           | each site's own UI   |

It starts on **Off**. A choice applies to every host it covers at once, and the
option covering the site you are on is highlighted.

When you are on a site gitalike knows, a **Show *this site* with** picker below
lets you choose the skin for that one host — **Off**, **GitHub UI**,
**GitLab UI** or **Bitbucket UI** — so one enterprise instance can wear a
different skin (or none) without changing `github.com`. Choosing a site's own UI
(`github.com` shown as GitHub, `gitlab.com` shown as GitLab) is the same as
**Off**, because gitalike does not repaint a site as itself. Bitbucket is never
a site's own UI — no forge is Bitbucket's markup — so it always paints.
**Follow the global skin** clears the per-site choice.

**Keyboard:** `Alt` + `Shift` + `G` toggles the current site (the same per-site
choice). It can only toggle a site that is already set up — telling GitHub from
GitLab is a choice, so the first time has to go through the popup.
`Alt` + `Shift` + `O` opens the current page on the other host (the two public
forges only). Rebind either at `chrome://extensions/shortcuts` (Firefox:
`about:addons` → gear → *Manage Extension Shortcuts*).

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
   because a port or path would never match the host you actually land on. An
   `http://` address is accepted but flagged — the skin still applies, though the
   connection is not encrypted.
3. Choose **GitHub** or **GitLab**.

Anything that is not a web address is refused rather than stored, including
`javascript:` and other non-http schemes. Built-in hosts
(`github.com`, `gitlab.com`, `codeberg.org`, `gitea.com`) are
refused too — they are already set up and cannot be removed.

To undo, open the popup on that host and choose **Remove**. That also clears any
per-site skin choice on it.

## UX parity

The skin is not only colour. While a skin is on, gitalike also matches the other
product's *vocabulary and habits*:

| Surface    | What changes                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| Copy       | "Pull request(s)" ⇄ "Merge request(s)", "Insights" ⇄ "Analytics", "Actions" ⇄ "CI/CD", "Go to file" ⇄ "Find file", "Gists" ⇄ "Snippets", "Codespaces" ⇄ "Workspaces" |
| Navigation | repo tabs are relabelled ("Code" ⇄ "Repository") and given the other product's tab set and order — GitLab's are rebuilt as GitHub's tabs, GitHub's are gathered under GitLab's group headings |
| Orientation | GitHub's top bar is restyled as GitLab's light bar, and its repo/profile tabs become a GitLab-style left sidebar/rail with GitLab group headings; GitLab's scattered sidebar is rebuilt as GitHub's flat tab row, under the repository header |
| Metadata | GitHub's right-hand "About" becomes a full-width block on top (GitLab style); GitLab's "Project information" becomes a right sidebar (GitHub style) |
| References | a pull/merge-request link shows the other product's marker — `#42` ⇄ `!42`                                        |
| Shortcuts  | the other product's `g`-combos work: on GitHub shown as GitLab, `g m` opens merge requests                        |
| Other host | open the same page on the other forge, from the popup or `Alt` + `Shift` + `O`                                     |
| No counterpart | a feature the other product lacks is marked `≠ GitLab` / `≠ GitHub` instead of pretending it exists             |
| Account chrome | "Your repositories" ⇄ "Your projects", "Your gists" ⇄ "Your snippets", "Your stars" ⇄ "Starred projects", "Your organizations" ⇄ "Your groups" |

It is deliberately conservative. Copy is rewritten only in ordinary page text —
never inside code, inputs or editable regions — control words like the merge
button ("Merge pull request" ⇄ "Merge") change only on an exact whole-label match
on a button, tab, menu item or link, and navigation labels change only on an
exact whole-label match inside a known nav region, so prose and marketing copy are
safe. A reference marker is only touched on a link that is *just* a number. Every
change is recorded, and undone exactly when the skin is switched off.

The full status matrix — what each direction covers, and the few things that are
deliberately one-way — is in [docs/UX-PARITY.md](docs/UX-PARITY.md).

## Known limitations

- **UX parity is conservative, not exhaustive.** Only the vocabulary that maps
  cleanly is rewritten ("Pull request" ⇄ "Merge request"); product-specific
  concepts with no counterpart are marked rather than guessed at. Copy is never
  touched inside code, inputs or editable regions, and nav labels change only on
  an exact whole-label match, so search, copy/paste and screen readers keep
  working — but text the site updates *inside* an already-processed node is not
  re-translated until that node is replaced.
- **The keyboard remap is best-effort.** Where the destination has a navigation
  link the combo is delivered as a click on that link, because GitLab ignores
  synthetic key events. `g n` (notifications) has no link, so it only works on
  GitHub.
- **A feature with no counterpart is marked, not hidden.** GitLab-only features
  (Epics, Iterations, Requirements, Service Desk, …) get a `≠ GitHub` badge on a
  GitHub-skinned site, and GitHub-only ones (Discussions, Sponsors) get `≠ GitLab`
  on a GitLab-skinned site.
- **The GitHub-skin strip is rebuilt, not just reordered.** GitLab scatters the
  same project destinations across a pinned block and collapsible groups, some of
  which (Wiki, Security) it may not render at all, so the tab row is rebuilt from
  GitHub's own tabs, in GitHub's order, and hosted under the repository header
  where GitHub puts it. Under the GitLab skin, GitHub's flat tabs are gathered
  under GitLab's group headings instead.
- **"Open on the other host" covers the two public forges only.** A self-hosted
  instance has no pair to guess, so the action is absent there.
- **Access is bundled hosts at install, one origin at a time after that.** The
  install prompt covers the public forges and Codeberg (`github.com`,
  `gitlab.com`, `codeberg.org`, `gitea.com`). A self-hosted instance is granted
  when you add it — the popup asks for that one origin, a prompt you only see if
  you asked for that host. There is no all-sites grant.
- **The content scripts and stylesheets load only on hosts you have set up and
  granted.** The background registers them for the configured hosts, so an
  unconfigured page parses neither. This is what the `scripting` permission is
  for.
- **The skin is cosmetic, and the page can influence it.** Everything gitalike
  does hangs off `html.gs-theme-*` classes and `data-gs-*` markers on the page
  itself, so the page can add, remove or spoof them, and it can mark its own
  content `[data-gs-ux-skip]` to opt out of translation. That is fine for a
  reskin, but the skin is not a security boundary: do not treat it as a trust
  signal.
- **The first-paint cache lives in the page's `localStorage`.** The per-host
  decision is cached under `gitSame.theme` so a repeat visit does not flash the
  original theme; it is the only store readable synchronously at
  `document_start`. Being origin storage, the page can read or overwrite it, but
  `storage.sync` is reconciled immediately afterwards and wins.
- **The global skin covers every host it applies to at once, unless you choose a
  skin per host.** The **Show the web with** radio sets one skin for the whole
  extension. The popup's **Show *this site* with** picker (and
  `Alt` + `Shift` + `G`) chooses the skin for a single host, which is how an
  enterprise instance is skinned without `github.com`; there is no bulk per-host
  list beyond that.
- **The Bitbucket skin is verified from a capture, not live.** Bitbucket no
  longer serves public repository pages, so its palette and repo-tab set were
  taken from an archived Bitbucket repository page (Atlassian's `#0049B0` bar,
  `#0052CC` accent, and the Source/Commits/Branches/Pull requests/Pipelines/
  Deployments/Jira issues/Security/Downloads menu) rather than a live page. Its
  navigation is a left sidebar, so it reuses GitLab's layout. It cannot be
  watched by the selector canary for the same reason.
- **The Codeberg and gitea.com skin now re-orients the navigation, but not the
  whole page.** They are GitHub-flavoured, so they can wear either UI. Under the
  **GitLab UI** the repo tabs are rebuilt as a grouped left sidebar (GitLab's
  Plan/Code/Build/Deploy headings), and under the **GitHub UI** they are a
  GitHub-style underlined tab row; colours, words, reference markers and the
  active tab follow the applied product either way. Gitea's description and
  topics stay where Gitea puts them (they are not moved into a GitLab "Project
  information" block or a GitHub "About" rail), and Gitea's own keyboard
  shortcuts are left alone (the GitHub/GitLab `g`-combo remap does not run on it).
- **The shortcut cannot set up a new host**, only toggle one already classified,
  because classifying requires choosing which product it is.
- **The in-page mark is gitalike's own, in the other product's palette.** The
  site's brand logo is replaced by gitalike's two-way swap arrow, painted across
  whichever palette the skin uses — GitLab's red→orange→yellow, or Primer's ink
  and accent blue. The extension ships no vendor artwork and borrows only the
  palette; the mark never pretends to be the other product's logo.
- **`gitlab.com/` redirects.** When you are logged out the root bounces to
  `about.gitlab.com`, a different origin, so there is nothing for the skin to do
  there. The GitLab app — `/dashboard`, `/explore`, project pages — is where it
  applies.

## Privacy

gitalike collects no data and makes no network requests. It stores only your
on/off choices — including any per-site skin choices — and the list of instances
you add, in the browser's own synced extension storage, and caches the per-site
decision in the page's `localStorage` so a repeat visit does not flash the
original theme.
Nothing read from a page is stored or sent anywhere. The full policy is at
<https://ranjithrajv.github.io/gitalike/privacy.html>.

## Contributing

Bug reports and pull requests are welcome. The popup's **Report a missed spot**
link opens a prefilled issue with the host and skin already filled in. The
developer guide — build, test, the ground rules, and how to add a forge or a
translation — is in [CONTRIBUTING.md](CONTRIBUTING.md).

## Trademarks

GitHub and the Octocat are trademarks of GitHub, Inc. GITLAB is a trademark of
GitLab Inc. in the United States and other countries and regions, and GitLab's
Tanuki logo is a GitLab Inc. trademark. gitalike is not affiliated with,
endorsed by or sponsored by either company. It names those products only to
describe what it is compatible with, and it redistributes none of their logos
or other brand artwork — the mark it paints on a page is gitalike's own.

## License

GPL-3.0-or-later — see [LICENSE](LICENSE) for the full text and
[NOTICE](NOTICE) for the copyright and the name/mark term.

gitalike is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. It comes with no warranty. A fork that is distributed to others has to
stay free software too; the source is at
<https://github.com/ranjithrajv/gitalike>.
