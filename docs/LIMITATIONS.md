# Known limitations

GitAlike is deliberately conservative. This is the full accounting of where
it stops short of a perfect reskin — the detail behind the short list in the
[README](../README.md#known-limitations).

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
  install prompt covers the public forges, Codeberg and Bitbucket (`github.com`,
  `gitlab.com`, `codeberg.org`, `gitea.com`, `bitbucket.org`). A self-hosted
  instance is granted when you add it — the popup asks for that one origin, a
  prompt you only see if you asked for that host. There is no all-sites grant.
- **The content scripts and stylesheets load only on hosts you have set up and
  granted.** The background registers them for the configured hosts, so an
  unconfigured page parses neither. This is what the `scripting` permission is
  for.
- **The skin is cosmetic, and the page can influence it.** Everything GitAlike
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
  navigation is a left sidebar, so it reuses GitLab's layout, but its menu is
  flat: it drops GitLab's group headings rather than inheriting them. (The
  Bitbucket *source*'s app shell is canaried; the skin's repo-tab set, taken
  from the capture, is not.)
- **Bitbucket Cloud is canaried and palette-mapped, but it is a client-rendered
  app.** Bitbucket mounts its repository page in `#root`; the server still serves
  `#root` and two `<meta>` tags first, and that shell is what the canary watches.
  The app is light DOM, so `paintBitbucketNav` reorients and relabels the
  repository bar, and `themes/gs-tokens.css` re-points Atlassian's `--ds-*`
  design tokens — which Bitbucket reads from the root — at the applied palette;
  copy, control labels and `/pull-requests/N` markers follow the applied product
  too. A Bitbucket *profile* (the workspace page) keeps its own side navigation,
  which `paintBitbucketNav` reorients to the layout, but it is not rebuilt as a
  GitHub/GitLab-style profile rail: Bitbucket's classes are hashed and
  client-rendered, so there are no stable hooks to build one from. Bitbucket Data
  Center (`/projects/<key>/repos/<slug>`) is classified as the same source but is
  a different, server-rendered markup family, and has no public instance to
  canary.
- **Gerrit is canaried and palette-mapped, but its content lives in shadow DOM.**
  A Gerrit instance is added one origin at a time from the popup and can be shown
  with the GitHub or GitLab UI. PolyGerrit serves a shell (`gr-app#pg-app`) and
  renders inside shadow roots; the canary watches the shell, and because
  PolyGerrit reads its colours from root custom properties
  (`--primary-text-color`, `--link-color`, …), which inherit across the shadow
  boundary, `themes/gs-tokens.css` recolours the whole app, and `paintGerritNav`
  reorients the header and relabels its words: under the GitHub UI it is a 64px
  top bar with a row nav reading Pull requests / Code, and under the
  GitLab/Bitbucket UI the header becomes a fixed left column (a sidebar) reading
  Merge requests / Repository, with the change list beside it. Its copy and
  control-label passes are run into each open shadow root (`paintGerritCopy`),
  and an owner query (`/q/owner:<account>`) — the closest page it has to a
  profile, headed by PolyGerrit's `gr-user-header` with the account's avatar,
  display name, email and join date — is reshaped into the applied skin's profile
  identity block with a tab row built from Gerrit's own owner views
  (`paintGerritProfile`). The content stays Gerrit's change list, though, and
  Gerrit has no pinned repositories, followers or profile README to reproduce.
  Its changes are numbered (`/c/<project>/+/<N>`) with a Change-Id rather than a
  `#`/`!` pull-request marker, so the reference-marker pass does not apply either.
- **Full parity is unreachable for the non-GitHub/GitLab sources, and that is a
  ceiling, not a backlog.** The parity rubric credits a source for the target's
  keyboard combos only when the source is the *other* forge, so Gerrit, Bitbucket
  and Gitea lose that dimension outright (weight 8 — a project ceiling of 9.2
  before any other gap). The independent computed-style read has the same shape:
  its vocabulary dimension is the share of the *target's* nav words present, and a
  source with a shorter menu (Gerrit's Changes/Documentation/Browse) or a
  different one (Gitea's profile tabs) cannot carry all of them. Gerrit's
  shadow-DOM copy/label passes and Bitbucket's hashed profile markup are further
  honest floors. Reaching 10.0 on these pairs would mean inventing destinations
  the source does not have, or tuning the metric — neither of which this project
  does.
- **The Codeberg and gitea.com skin now re-orients the navigation, but not the
  whole page.** They are GitHub-flavoured, so they can wear either UI. Under the
  **GitLab UI** the repo tabs are rebuilt as a grouped left sidebar (GitLab's
  Plan/Code/Build/Deploy headings), and under the **GitHub UI** they are a
  GitHub-style underlined tab row; colours, words, reference markers and the
  active tab follow the applied product either way. Gitea's description and
  topics stay where Gitea puts them (they are not moved into a GitLab "Project
  information" block or a GitHub "About" rail). Its keyboard combos follow the
  applied product instead: Gitea implements no `g`-combos of its own, so the ones
  with a repository-navigation link (pull/merge requests, projects) are delivered
  as a trusted click on that link, and the linkless one is not delivered.
- **The shortcut cannot set up a new host**, only toggle one already classified,
  because classifying requires choosing which product it is.
- **The in-page mark is GitAlike's own, in the other product's palette.** The
  site's brand logo is replaced by GitAlike's two-way swap arrow, painted across
  whichever palette the skin uses — GitLab's red→orange→yellow, or Primer's ink
  and accent blue. The extension ships no vendor artwork and borrows only the
  palette; the mark never pretends to be the other product's logo.
- **`gitlab.com/` redirects.** When you are logged out the root bounces to
  `about.gitlab.com`, a different origin, so there is nothing for the skin to do
  there. The GitLab app — `/dashboard`, `/explore`, project pages — is where it
  applies.
