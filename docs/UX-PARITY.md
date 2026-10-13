# UX parity

What GitAlike matches between GitHub and GitLab beyond colour, and where the two
directions still differ. The tables themselves live one file per skin under
`src/plugins/skins/` and one per source under `src/plugins/sources/`; this file
is the map and the scorecard.

## Skins

A skin is a *target* UI — its key is the `html.gs-theme-<name>` class and its
stylesheet is `as-<name>.css` in its `src/plugins/skins/<name>/` folder. There are three: **GitLab**, **GitHub** and
**Bitbucket**. Bitbucket is both a target and a source — a Bitbucket host wears
the GitHub or GitLab UI, and any source can be pinned to the Bitbucket UI.
Gerrit is a source only. A skin
names the shape it is built to in `SITES.skins[<name>].layout` (`github` = top
bar + tab row, `gitlab` = left sidebar); Bitbucket's repo nav is a left
sidebar, so it reuses GitLab's layout, but its menu is flat — grouping follows
the skin, so it gets no GitLab group headings — and only its palette, words and
tab set differ. The directional tables below still describe the two-way pair;
Bitbucket's are in `src/plugins/skins/bitbucket.js` and are covered by
`tests/ux.test.mjs`.

## Directions

- **G→L** — a GitHub-flavoured site shown with the GitLab UI
  (`html.gs-theme-gitlab`, `src/plugins/skins/gitlab/`)
- **L→G** — a GitLab-flavoured site shown with the GitHub UI
  (`html.gs-theme-github`, `src/plugins/skins/github/`)
- **→B** — any source shown with the Bitbucket UI
  (`html.gs-theme-bitbucket`, `src/plugins/skins/bitbucket/`, layout `gitlab`)
- **B→G / B→L** — a Bitbucket source shown with the GitHub or GitLab UI. There
  are no Bitbucket selectors or nav rules yet (its page is a client-rendered SPA
  with no capturable public repository page), so the structure stays Bitbucket's;
  the palette is mapped from its Atlassian `--ds-*` tokens, and the
  source-agnostic passes — copy, control labels and reference markers — run on
  top.
- **Ger→G / Ger→L** — a Gerrit source shown with the GitHub or GitLab UI. It
  gets the palette, the header surface and the header orientation (below), but
  not the shadow-DOM page passes; and without the reference-marker support:
  Gerrit identifies a change by number/Change-Id, not a `#`/`!` marker.

## Status

| Surface | G→L | L→G | Lives in |
| --- | :--: | :--: | --- |
| Colour tokens | ✅ | ✅ | `plugins/skins/` |
| Structural CSS | ✅ 22 rules | ✅ 14 rules | `plugins/skins/` + `themes/` |
| Own mark in the other palette | ✅ | ✅ | `--gs-mark` |
| Copy — `PHRASES` | ✅ 9 | ✅ 9 | `plugins/skins/` |
| Control labels — `LABELS` | ✅ 4 | ✅ 4 | `plugins/skins/` |
| Account/menu chrome — `CHROME` | ✅ 4 | ✅ 4 | `plugins/skins/` |
| No-counterpart markers — `UNMAPPED` | ✅ 3 | ✅ 15 | `plugins/skins/` |
| Unavailable target features — `UNAVAILABLE` | — | ✅ 1 source | `plugins/skins/` + `content/ux-*.js` |
| Nav labels — `NAV` | ✅ 5 | ✅ 5 | `plugins/skins/` |
| Top-bar source words | ✅ hidden | ✅ hidden | `plugins/skins/` + `content/ux-nav.js` |
| Nav reorder — `NAV_RULES` | ✅ 1 rule | ✅ 1 rule | `plugins/skins/` |
| Nav orientation | ✅ | ✅ | `themes/ux-nav.css` |
| Project tab strip | ✅ gathered into groups | ✅ rebuilt as GitHub's tabs | `content/ux-*.js` + `themes/ux-nav.css` |
| Project metadata placement | ✅ | ✅ | `plugins/skins/` |
| Metadata heading | ✅ Project information | ✅ About | `content/ux-*.js` |
| Activity graph palette | ✅ GitLab indigo | ✅ GitHub green | `themes/ux-nav.css` |
| Profile metadata rail | ✅ About/Info/Contact | — | `content/ux-*.js` |
| One skin at a time | ✅ | ✅ | `popup/popup.js` |
| References — `refMarker` | ✅ | ✅ | `lib/ux.js` |
| Shortcuts — `SHORTCUTS` | ✅ 3 | ⚠️ 2 of 3 | `plugins/skins/` |
| "Open on the other host" | ✅ | ✅ | `lib/ux.js` + popup |

Legend: ✅ done · ❌ not built

The table above names the two original directions, because that pair is the one
every row describes in detail. Every other direction the plugins implement —
Bitbucket as a target, Gitea/Forgejo and Gerrit as sources — is the same
question asked of different tables, so here it is in one matrix. Twelve non-native
directions, five sources × three skins less the three a source shares with its
own product.

Each cell is read off something checkable rather than judged: a **skin's declared
table** (`navRules`, `groups`, `keep`, `topbarHide`, `shortcuts`, `projectTabs`,
`unavailable` in `src/plugins/skins/<name>/index.js`) or the **source's own
`compare` capability** — `palette`, `nav`, `page`, `metadata`, `profile`, `refs`,
each a fraction in [0, 1], published in `plugins.json`. A skin table the source
cannot reach is ❌; a table the source reaches only partially is ⚠️; the fraction
itself is the share, so `nav: 0.9` for Bitbucket is a near-full match and
`profile: 0.5` is half of one.

Three cells are stated as ❌ on the repo's own evidence rather than by fraction:
Bitbucket's menu is flat, so it gets no GitLab group headings under any skin
(`docs/UX-PARITY.md`, "Skins"); no skin swaps a Gerrit mark, because Gerrit's
chrome is reached through root custom properties rather than markup; and Gerrit
takes no `g`-combo shortcuts, since it has neither the keyboard contract nor a
`#`/`!` reference marker.

| Source → | GitHub | GitHub | GitLab | GitLab | Bitbucket | Bitbucket | Gitea / Forgejo | Gitea / Forgejo | Gitea / Forgejo | Gerrit | Gerrit | Gerrit | |
| | Bitbucket UI | GitLab UI | Bitbucket UI | GitHub UI | GitHub UI | GitLab UI | Bitbucket UI | GitHub UI | GitLab UI | Bitbucket UI | GitHub UI | GitLab UI | |
| --- | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | --- |
| Colour tokens | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | |
| Own mark in the palette | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Copy — `PHRASES` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Control labels — `LABELS` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Account/menu chrome | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | |
| No-counterpart markers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Nav labels — `NAV` | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | |
| Nav reorder — `NAV_RULES` | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | |
| Nav groups — `GROUPS` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | |
| Repo-tab whitelist — `KEEP` | ✅ | ❌ | ✅ | ✅ | ⚠️ | ❌ | ✅ | ✅ | ❌ | ⚠️ | ⚠️ | ❌ | |
| Nav orientation | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | |
| Top-bar source words | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | |
| Project tab strip | ✅ | ❌ | ✅ | ✅ | ⚠️ | ❌ | ✅ | ✅ | ❌ | ⚠️ | ⚠️ | ❌ | |
| Project metadata block | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | |
| Activity graph palette | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | |
| Profile menu / rail | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | |
| Unavailable features — `UNAVAILABLE` | ❌ | ❌ | ❌ | ✅ | ⚠️ | ❌ | ❌ | ⚠️ | ❌ | ❌ | ⚠️ | ❌ | |
| References — `refMarker` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | |
| Shortcuts — `SHORTCUTS` | ❌ | ✅ | ❌ | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | |
| One skin at a time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |

A source shown with its own UI is the native pair and is not a column here, for
the same reason as above: no skin is painted, so every row is satisfied.


**Codeberg (Forgejo)** and **gitea.com (Gitea)** are a third source product,
`gitea`. They are GitHub-flavoured, so they can wear either UI: under the GitLab
UI the repo tabs are rebuilt as a grouped sidebar, and under the GitHub UI as
GitHub's tab row. See [Codeberg / Gitea](#codeberg--gitea).

## Parity scoring

The status matrix above says *what exists*. This scores how much of the imitated
product's own surface a given source actually reproduces under each skin: the
weighted share of the target product's page that the skin matches, out of 10.
It is a coverage estimate, not a quality judgement, and it says nothing about
the source's own features — only how closely the applied UI reads as the product
it is pretending to be.

**Colour is scored separately**, by `npm run color-parity`, because it is the
one dimension the coverage rubric above cannot see. See
[Colour match](#colour-match) below.

The score is derived from the tables in `src/plugins/skins/` and the pass gating in
`src/content/ux-*.js`, not measured. Each page type has its own rubric, a set of
weighted dimensions; a cell is the sum of (weight × share reproduced), rounded
to one decimal.

How much of each dimension a *source* can be credited is declared by the source
itself (`compare` in `src/plugins/sources/<name>/index.js`, published in
`plugins.json`): `palette`, `nav`, `page`, `metadata`, `profile` and `refs`, each
a fraction in [0, 1]. The rubric reads those, so a new source declares its
comparable surface instead of the model assuming one.

**Project pages** — palette & tokens 12; navigation orientation 18; nav labels
10; nav order 8; nav groups 6; nav keep/hide 10; metadata block & heading 12;
control labels 6; reference markers 5; no-counterpart markers 5; shortcuts 8.

**Profile pages** — palette & activity-graph palette 12; orientation 16; rebuilt
profile menu 20; identity/card reshape 12; pinned/landing heading 5; account
chrome 8; copy & control labels 8; no-counterpart markers 6; reference markers
5; shortcuts 8.

A source shown with its own UI is the native pair: no skin is painted, so every
dimension is satisfied and the score is 10.0. There is no `—`.
"Open on the other host" is left out of the score in both rubrics: it is
theme-independent, and it is absent on profiles by design.

`Codeberg` and `gitea.com` are the Gitea/Forgejo sources; `bitbucket.org` is the
Bitbucket source; Gerrit has no bundled host (its instances are added one origin
at a time from the popup).

### Project pages, sources × skins

| Source ↓ / Skin → | Bitbucket UI | GitHub UI | GitLab UI |
| --- | :--: | :--: | :--: |
| **Bitbucket** | 10.0 | 6.5 | 5.9 |
| **Gerrit** | 5.3 | 5.4 | 5.1 |
| **Gitea / Forgejo** | 8.0 | 8.6 | 8.5 |
| **GitHub** | 8.4 | 10.0 | 9.7 |
| **GitLab** | 8.4 | 9.7 | 10.0 |

### Profile pages, sources × skins

| Source ↓ / Skin → | Bitbucket UI | GitHub UI | GitLab UI |
| --- | :--: | :--: | :--: |
| **Bitbucket** | 10.0 | 5.6 | 5.7 |
| **Gerrit** | 2.6 | 4.0 | 4.1 |
| **Gitea / Forgejo** | 4.2 | 6.2 | 6.2 |
| **GitHub** | 6.7 | 10.0 | 9.9 |
| **GitLab** | 6.7 | 9.5 | 10.0 |

These two tables are the rubric, over **every source**. The capture-based reads —
`parity-visual.mjs`, `parity-style.mjs` and `style-parity.mjs` — measure the
committed screenshots and cover every source too: Gerrit's frames are captured
against `gerrit-review.googlesource.com`, which the capture run grants and
registers as the `gerrit` kind for that run only (it is not a bundled host).
`captures.mjs` fails loudly if a future source is neither captured nor explicitly
excused.

Layout is a gated read of its own: `tools/compare/layout-parity.mjs`
(`npm run layout-parity`) drives the live pages and fails unless every skinned
page carries its skin's `gs-layout-*` class and its navigation is oriented the
way that layout is — row for `github`, column for `gitlab`. Every source now
declares a navigation and profile capability, so every pair is gated; a future
source that declares none is reported `n/a` rather than failed, since there is
nothing to reorient. It prints a pass rate (`24/24 pairs passing — layout parity
100%`) and exits non-zero on any failure.

## Colour match

`npm run color-parity` scores the *colours*, which the coverage rubric above
cannot see. It runs offline against the skins' stylesheets and the committed
screenshots, and it is a gate: `tests/compare/color-parity.test.mjs` fails the
build on a colour that is out of tolerance, and so does the command.

Three layers, each independent, so a mistake in one is visible in the others:

| Layer | Compares | Catches |
| --- | :--: | --- |
| `tokens` | each skin's declared `--gs-*` palette against `tests/fixtures/target-chrome.json`, **both modes** | a token that is not the product's value |
| `pixels` | the skinned screenshot against the real product's own screenshot, region by region | a skin that *declares* a right colour and never paints it |
| `reference` | the fixture against the real product's screenshot | a fixture that has gone stale |

The `pixels` layer is the one that earns its keep. `tokens` alone scores the
GitLab skin's rail 10/10: `--gs-canvas-inset` is `#ececef`, GitLab's real rail
grey, and it is correct. But the skin binds it only to Primer tokens, which do
not exist on a GitHub page, so the rail renders `#fbfafd` — and only measuring
the pixels finds it. It compares only the source a skin *rebuilds* the
product's chrome on (GitLab for the GitHub skin, GitHub for the GitLab skin),
declared as `compareOn` in the fixture, because comparing a source the skin only
restyles would be measuring that source's layout — Gitea's own light header, a
Bitbucket cookie banner over the app bar, PolyGerrit's shadow-DOM shell.
`compareOn: []` is allowed, and has to say why.

**The scale is ΔE in OKLab, per axis, not one combined cutoff.** Uniformity is
why OKLab rather than sRGB; the per-axis split is because a single threshold
cannot tell a wrong surface from a wrong brand hue. On the combined distance,
GitHub's accent blue against GitLab's (0.0431) lands within 0.0003 of the wrong
rail grey (0.0428) — so one cutoff either passes a visibly wrong surface or fails
two entirely different brand blues. So the three axes are held apart
(`TOLERANCE` in the tool, and in the fixture so a reader of the fixture can see
what a match means):

| Axis | Tolerance | Forgives | Catches |
| --- | :--: | --- | --- |
| lightness | 0.030 | a step in a neutral ramp | a header a shade of grey instead of black |
| chroma | 0.015 | a one-unit border difference | one brand hue swapped for another |
| hue | 5° | — (only judged where both colours are chromatic) | a red for a green |

A colour over any axis fails. Grades are reported on the **worst** token or
region, not the mean: these are published hex values on named surfaces, so one
wrong token is one visibly wrong surface, and a mean would let a correct ramp
average away a black header painted `#25292e`.

One known over-sensitivity, documented rather than smoothed over: OKLab lightness
is not uniform at the dark end, so `#000000` against `#010409` — a one-step
difference nobody can see — scores ΔL 0.104 and fails. It cannot fire in
practice, because the reference is read per mode and no two tokens in one mode
are that close; GitHub's `#000000` light header and its `#010409` dark header are
never compared to each other.

`style-parity.mjs` imports the fixture and the tolerances from this tool, so the
live browser measurement and the offline gate cannot drift apart.

### Open colour failures

None. The three defects this gate was built to expose are fixed:

- **The GitHub skin's header** was `#25292e`, a stale Primer token, while github.com
  serves `#000000` across the application bar. ΔL 0.279 — the largest colour error
  any of the skins carried, and invisible to the old gate, which compared the skin
  against a fixture that said the same stale value. Now `#000000`.
- **The GitLab skin's header** was `#fbfafd`; the real super-topbar is `#ececef`,
  the same gray GitLab uses for its rail. Now `#ececef`.
- **The GitLab skin never painted GitLab's rail**, which is its most recognisable
  layout cue. `--gs-canvas-inset` was declared correctly but bound to the wrong
  token where the rebuilt sidebar is painted, so the rail rendered `#fbfafd`. Now
  bound to `--gs-canvas-inset`.

The reference values were confirmed against live pages rather than inferred from
the stored captures, which are up to three weeks old: github.com's bar, GitLab's
bar *and* rail, and all three canvases matched at ΔE 0.0000 on a live run.

## Live preview

`npm run preview` renders the built extension in a Chromium window against the
live sites, so a change can be watched rather than inferred from committed
screenshots. It shows the two reference directions, each with the extension off
beside it; `--shots` captures to a scratch directory instead of holding a window,
and `--only=<name>` narrows it to one frame. It never writes to `docs/` — those
are `color-parity`'s evidence, and `npm run screenshots:projects` is what
refreshes them.

This is what found the GitHub nav regression below. Both of its failures were
invisible to every test in the repo, because each test compared the extension
against itself: the capture that looked fine was three weeks old, and
`layout-parity` — which drives live pages and would have caught it — needs
network, so it does not run in CI.

### The GitHub nav regression, and the lesson in the selector

github.com moved its repo tab bar to Primer's `prc-*` components, which deleted
`ul.UnderlineNav-body`, `li.UnderlineNav-item` and `.UnderlineNav` outright —
verified against a live page, zero matches in the document — and re-nested the
nav from `main > div > nav` to `main > react-partial > div > header > nav`.

Two selectors were keyed on both, so both stopped matching, silently:

- `NAV_RULES` named the dead class as its reorder container, so the repo tab
  order stopped being rebuilt for the GitLab and Bitbucket skins on a GitHub
  source.
- `ux-nav.css` gated the whole sidebar grid on `main:has(> div > nav[...])`,
  which no longer matched. The grid was never applied, the tab bar collapsed to
  0x0 under GitHub's own `max-height: 48px; overflow: hidden`, and nothing took
  its place — so the GitLab and Bitbucket skins served a GitHub page with *no
  navigation at all*.

The test that pinned the container asserted `/UnderlineNav-body/`, so it stayed
green throughout. It was not wrong about the selector; it was wrong to assert on
a class name. The selectors now select on shape and on the nav's accessible name,
which is a contract GitHub keeps:

    nav[aria-label="Repository"] ul:has(> li)      the list, by shape
    main:has(nav[aria-label="Repository"])        the grid, by presence

and the tests assert the shape rather than a class, with a comment on why. The
lesson is worth stating plainly, because it is the failure mode this repo is most
exposed to: **keying on a target site's class name is a test that passes while
the product is broken.** An attribute that names a thing outlives a class that
styles it.

One more thing the live render surfaced: GitHub sizes the horizontal bar to one
line, so the wrapper carries `max-height: 48px; overflow: hidden`. In a vertical
sidebar that clips the list to a single row — which reads as a skin that dropped
the navigation rather than one that moved it. The re-orientation resets both.

### Where the points are lost

- **GitHub → GitLab, project (9.7)** — the reference direction. It loses only on
  nav keep/hide, which is GitLab's hide-list rather than GitLab's full menu: a
  GitHub DOM cannot grow the destinations GitLab has and GitHub does not.
- **GitHub → Bitbucket, project (8.4)** — palette, nav words, order and the
  keep-list map, with Bitbucket's flat sidebar. The metadata is GitLab's block
  rather than a captured Bitbucket shape, no shortcut table exists for Bitbucket,
  and the issue-reference marker is partial.
- **GitLab → GitHub, project (9.7)** — a full rebuild; the only loss is `g n`
  (notifications ⇄ todos), which has no navigation link to click and so is
  G→L only.
- **GitLab → Bitbucket, project (8.4)** — the sidebar, tab words, order and
  keep-list map, with Bitbucket's flat menu. The metadata, reference and shortcut
  dimensions are partial for Bitbucket.
- **Gitea → GitHub (8.6) / GitLab (8.5)** — the repo nav is rebuilt or restyled
  and reordered, and the applied product's shortcuts work: Gitea implements no
  combos of its own, so the combos with a repository-navigation link (pull/merge
  requests, projects) are delivered as a trusted click, and the one without a
  link is left undelivered. Gitea's description and topics keep Gitea's
  placement, which costs the metadata dimension. The GitHub UI edges it because
  Gitea is GitHub-flavoured and GitHub's whitelist matches its menu more closely
  than GitLab's hide-list.
- **Gitea → Bitbucket, project (8.0)** — Bitbucket's flat sidebar is the closest
  fit to Gitea's rebuilt nav, so the structure tracks the target best of the
  three; metadata, references and shortcuts are again the losses.
- **GitHub → GitLab (9.9) / GitLab → GitHub (9.5), profile** — the rail, the
  re-shaped card and the rebuilt menu all land. The deductions are the one thing
  neither source can supply: GitLab has no pinning, so "Personal projects" is
  still GitHub's pinned selection, and GitHub's Pinned section has no GitLab
  data. `g n` is the other deduction in the L→G direction.
- **GitHub / GitLab → Bitbucket, profile (6.7)** — the menu is rebuilt from
  Bitbucket's own destinations, but Bitbucket has no public profile of its own,
  so the identity card is not re-shaped (the rail and stats passes are
  GitLab/GitHub only) and shortcuts are unmapped.
- **Gitea → any skin, profile (4.2–6.2)** — the profile passes are keyed to
  GitHub's and GitLab's profile markup (`SELECTORS.github.profile*`,
  `SELECTORS.gitlab.profile*`), so a Gitea/Forgejo profile gets the shared
  palette, copy, account-chrome and reference-marker work, and its profile
  layout follows the skin: under a sidebar layout the header (avatar, name, bio,
  website) becomes a **left rail** with the tabs and content beside it
  (`paintGiteaProfile` + `themes/ux-nav.css`), and under the GitHub layout the
  tab menu is a row. Its menu and card are still not rebuilt, so the dimensions
  that need a container (`SELECTORS.gitea.profileMenu`) stay partial; the
  `codeberg-profile-*.png` captures show the rail. Bitbucket's workspace profile
  is the one that keeps its own side navigation without a rebuilt rail — its
  classes are hashed (see `docs/LIMITATIONS.md`).
- **Bitbucket as a source (6.5 / 5.9 project, 5.6 / 5.7 profile)** — it gains
  three passes. Its palette: Bitbucket Cloud exposes Atlassian's `--ds-*` design
  tokens on <html>, so the skins re-point them at their own palette, header
  included (the Bitbucket source's `tokens.css`). Its navigation: `paintBitbucketNav`
  reorients and relabels the repository bar, found inside the declared `#root`
  hook, its bar is grouped into the applied skin's headings where that skin
  groups (`paintBitbucketNav`; GitLab's Plan/Code/Build/…), and the workspace
  profile navigation is reoriented to the layout (`themes/ux-nav.css`). It still
  loses the dimensions that need a rule or a captured shape: there is no
  `NAV_RULES` entry, so the nav is not reordered or filtered, no metadata shape,
  and no shortcut table. The diagonal is 10.0
  because a source on its own UI needs no transformation.
- **Gerrit as a source (5.1–5.4 project, 2.6–4.1 profile)** — its palette is
  partial: PolyGerrit reads its colours from root custom properties that inherit
  across its shadow boundary, so the skins re-point text, links, borders and
  feedback, and the header surface and text
  (`--header-background`/`--header-text-color`, which PolyGerrit reads), but not
  the rest of its surfaces (the Gerrit source's `tokens.css`). Its header navigation *is*
  laid out like the applied skin, though — PolyGerrit's roots are open, so
  `paintGerritNav` reaches the header and injects a style into its shadow root:
  under the GitHub layout the header is a top bar re-proportioned to GitHub's
  app header (64px tall, GitHub's nav type, a rounded light-on-dark search
  field), and under the GitLab/Bitbucket layout it becomes a fixed **left
  column** (a sidebar) with the change list beside it. Its own nav words are
  relabelled to the applied product's too — "Changes" reads Pull/Merge requests
  and "Browse" reads Code/Repository/Source, with the originals restored on
  revert (`GERRIT_NAV_WORDS`) — so the nav is a partial match of the target's
  menu rather than the target's full menu. Its copy and control-label passes are
  run into each open shadow root now (`paintGerritCopy`), and its closest page to
  a profile — an owner query (`/q/owner:<account>`), which PolyGerrit heads with
  `gr-user-header` (avatar, display name, email, join date), and a project query
  (`/q/project:<project>`), headed with `gr-repo-header` — is reshaped into the
  applied skin's profile identity block with a tab row built from Gerrit's own
  queries, All / Open / Merged / Abandoned (`paintGerritProfile`), so every tab
  is a real Gerrit query (a project gets a monogram where an account has an
  avatar). The change list below stays a change list,
  and Gerrit has no Pinned, Repositories or Followers data to reproduce, so
  `profile` stays partial. Gerrit numbers a change
  (`/c/<project>/+/<N>`) by Change-Id rather than a `#`/`!` marker, so `refs` is
  partial too. It has no repository tab row or About rail to rebuild, so those
  GitHub surfaces stay unreproduced.

The scores are computed by `tools/compare/parity-score.mjs` (`npm run parity`, or
`npm run parity -- --detail` for the per-dimension breakdown) and
`tests/compare/parity-score.test.mjs` fails if this section and the module
disagree.

### Independent judge (jev)

The scorecard above is derived from the tables. It is cross-checked against an
independent semantic judge — TypeSafe's Jev model — which is given each capture's
measured design language and a description of its chrome, plus the target
products' own chrome, and asked to identify and score the page. The judge reads
text, not pixels, so the state is curated and lives in
`tests/fixtures/parity-judge.json`; `npm run parity:judge` re-runs it against the
API (needs `TYPESAFE_API_KEY`, so it is on-demand, not a commit gate). The two
headline directions:

| Direction | Reads as | Fidelity /10 | Recognisable | Weakest surface |
| --- | :--: | :--: | :--: | --- |
| GitLab skin on GitHub (`docs/github-gitlab.png`) | GitLab (0.95) | 7.3 | 0.77 | top-bar words |
| GitHub skin on GitLab (`docs/gitlab-github.png`) | GitHub (0.94) | 6.4 | 0.72 | top-bar words |

The judge agrees with the rubric on the shape of the result: the two directions
are level pegging, and each reads as its target (both ~0.95). It scores lower in
absolute terms because it also weighs the **global top bar**, which the rubric
does not — the logged-out bar keeps the source's marketing words. The words the
two products share ("Platform", "Solutions", "Resources", "Pricing") are kept;
the source-only ones are hidden rather than translated, since a marketing link
has no counterpart to translate to (`TOPBAR_HIDE`, `src/content/ux-nav.js`). The
recorded run is pinned by `tests/compare/parity-judge.test.mjs`.

## Copy

`PHRASES` rewrites ordinary page text. Both directions carry the same nine
pairs and every GitHub key is produced by a GitLab value:

| GitHub | GitLab |
| --- | --- |
| Pull request / Pull requests | Merge request / Merge requests |
| Go to file | Find file |
| Gist / Gists | Snippet / Snippets |
| Insights | Analytics |
| Codespaces | Workspaces |
| Dependabot | Dependency scanning |
| GitHub Actions | CI/CD |

One wording note, and the only asymmetry that is not a gap: GitHub calls the
feature "Actions" in its navigation and "GitHub Actions" in prose, while GitLab
calls it "CI/CD". The forward direction maps the prose name
(`GitHub Actions → CI/CD`) and the nav name is handled by `NAV`
(`Actions → CI/CD`); the reverse maps `CI/CD → Actions`, the word GitHub
actually shows in that position.

`LABELS` rewrites a *whole control label* only — a button, tab, menu item or
link — never prose. It is the reason ordinary words like "Merge" and "Rebase"
are safe to translate. Every entry round-trips:

| GitHub | GitLab |
| --- | --- |
| Merge pull request | Merge |
| Squash and merge | Squash commits |
| Rebase and merge | Rebase |
| Security and quality | Security |

`NAV` relabels app navigation on an exact whole-label match inside a known nav
region: `Code ⇄ Repository`, `Actions ⇄ CI/CD`, `Pull requests ⇄ Merge requests`,
`Insights ⇄ Analytics`, `Projects ⇄ Issue boards`.

`CHROME` covers the account and menu chrome the two products name differently —
`Your repositories ⇄ Your projects`, `Your gists ⇄ Your snippets`,
`Your stars ⇄ Starred projects`, `Your organizations ⇄ Your groups` — again as
whole control labels only, so a bare "Settings" (the repo tab) is never touched.

## No counterpart

Some features have no equivalent in the other product. Rather than leave them
looking native, `UNMAPPED` marks them: `content/ux-*.js` appends a small
`≠ GitLab` / `≠ GitHub` badge (and a `data-gs-no-equiv` attribute) to a nav item
or control whose whole label names such a feature. Examples: GitLab's Epics,
Iterations, Requirements, Service Desk, Merge trains, Feature flags, Terraform
modules, Model registry, Model experiments, Test cases, Incidents, Error
tracking, On-call schedules, Alert management and Value stream analytics;
GitHub's Discussions and Sponsors. The marker takes precedence over the hide
list and the `keep` whitelist — `paintNavHide` never hides a label
`noEquivalentFor` names — so a labelled feature is *shown with the badge*, not
silently dropped. A label carrying the site's counter (`Iterations 3`) matches
too.

The reverse is marked as well. Where a skin synthesises one of the applied
product's own destinations and the source site has no page for it, the item is
shown as unavailable rather than linked: `UNAVAILABLE` names the source product,
and `paintProfileMenu` / `paintProjectTabs` render the item inert with a
`≠ <source>` badge and a `data-gs-unavailable` attribute. A GitLab profile has
no user-level Packages page, so GitHub's Packages reads `≠ GitLab`; and a GitLab
project that has Wiki or Security disabled gets GitHub's Wiki and "Security and
quality" tabs marked `≠ GitLab` instead of links to a 404.

A feature with a real counterpart is never marked — the two tables are disjoint,
and a test enforces it — and every badge is removed when the skin is switched
off.

## Navigation

Labels are matched in both directions, and both directions reorder. GitHub's repo
tabs are a flat `ul.UnderlineNav-body`, so the whole set is reordered. GitLab's
project navigation is a nested group tree — one `ul` per group — so there is no
single flat list; the one group that maps onto GitHub's repo tabs, the repository
("Code") group, is reordered in place (Code before Pull requests). GitLab's
groups themselves keep GitLab's order: flattening them would change GitLab's
information architecture rather than match GitHub's.

Both reorders move items only among the slots they already occupy and leave
unrecognised children where they are, so an unfamiliar markup change degrades to
"no reorder". A reorder is applied once and then left alone for a moment, so a
framework that re-renders its list cannot make the two of us thrash.

## Navigation orientation

GitHub's app navigation is a horizontal tab row; GitLab's is a vertical sidebar,
and each skin flips the orientation so the skinned site navigates the way the
product it imitates does.

- **G→L** — GitHub's repo tabs become a real left sidebar, beside the repo header
  and content. The tab bar and the repo header share one wrapper
  (`main > div.tmp-pt-3`), so the wrapper is made `display: contents` and `main`
  becomes a grid; without that the tabs can only sit above the content. GitHub's
  responsive tab bar also hides its items and clones them into an overflow menu
  once they stop fitting the bar, so the real rows are forced back on. The
  sidebar sticks while the (very long) content scrolls, and its items are
  gathered under GitLab's group headings (Code, Build, Secure, Analyze), which
  GitHub's flat tab bar has no notion of. The logged-out GitHub top bar is
  restyled to GitLab's light bar with a hairline bottom border; the signed-in
  app header is hidden instead, since GitLab has no top menubar.
- **L→G** — GitLab's sidebar is replaced by GitHub's tab row. GitLab's page is a
  grid (`.layout-page.page-with-super-sidebar` is `232px 1032px …`, with the
  sidebar in column one), so the grid is collapsed to a single column. GitLab
  scatters the same destinations across a pinned block and collapsible groups —
  duplicating some and not rendering others (Wiki, Security) at all — and its
  group tree gives no single list to reorder, so the row is *rebuilt* rather
  than reordered: `paintProjectTabs` reuses the link GitLab renders for each
  destination and synthesises the two it omits, in GitHub's order. The row is
  hosted under the repository header, where GitHub puts it, and GitLab's own
  sidebar shell is hidden on the repository root; a project page without that
  header keeps the strip at the top.

## Description & metadata

GitHub keeps the repository description and metadata in a right-hand "About"
sidebar; GitLab shows the same information in a full-width "Project information"
block above the content. Each skin moves it to match the product being imitated:

- **G→L** — GitHub's About sidebar becomes a full-width block above the content
  (GitHub's `PageLayout` is flex, so its content is made a column and the
  sidebar pane ordered first) and its heading is renamed "Project information".
  GitHub-only sections — Releases, Packages, Used by, Contributors, Languages —
  are hidden, since GitLab's block lists a fixed, smaller set.
- **L→G** — GitLab's "Project information" block becomes a right column beside
  the file list and its heading is renamed "About", the way GitHub's reads.
  GitLab-only rows — the coverage bar, project badges and "Created on" — are
  dropped, since GitHub's About has no counterpart.

Profile pages get the same treatment, shaped like the target product's profile
rather than just re-oriented. G→L targets GitHub's profile navigation
(`nav[aria-label="User profile"]`) separately: the sticky horizontal tab strip
becomes a full-height super-sidebar in the left rail, headed "Profile", and the
profile card moves into the content as GitLab's header — a 96px avatar beside
the name. The organization, location and contact links are cloned into a
right-hand About/Info/Contact rail (`paintProfileRail`), and GitHub's pinned
section is relabelled GitLab's "Personal projects". GitHub splits the profile
across two `container-xl` wrappers, so both
are dissolved to a page grid (the profile equivalent of the repository
header/tab wrapper trick above). L→G turns GitLab's `.super-sidebar` into a
horizontal strip as usual, and because a profile's sidebar is a single flat
group it is flattened to one row of tabs: the "Profile" heading and the Help
menu are hidden. The GitLab profile is also re-shaped into GitHub's card: the
identity (avatar over the name) and the Info/Contact rail move into a left
column, with the README/activity beside them, and the follower/following counts
are copied out of the navigation to sit under the photo. The profile menu itself
is rebuilt as the applied product's — same labels, same order, same options.
Under the GitHub skin it is exactly GitHub's profile menu (`Overview`,
`Repositories`, `Projects`, `Packages`, `Stars`), mapping Repositories ⇄
Personal projects and Stars ⇄ Starred projects and pointing Packages at GitLab's
user packages route; GitLab's Activity, Groups, Snippets, Followers and
Following have no GitHub profile tab and are dropped. Under the GitLab skin it is
exactly GitLab's destinations (the account name, `Activity`, `Groups`,
`Contributed projects`, `Personal projects`, `Starred projects`, `Snippets`,
`Followers`, `Following`), with GitHub's Activity, Groups and Snippets landing
on GitLab's Activity, Groups and Snippets. GitHub's public Achievements block is
hidden under the GitLab UI, since GitLab shows achievements to the owner rather
than on a public profile. (GitLab publishes no organisation on a profile, so
that line cannot be shown.) The contribution graph is repainted to the imitated
product's palette in both directions — GitHub's greens for the GitHub skin,
GitLab's indigos for the GitLab skin (`themes/ux-nav.css`).

## Skin selection

The popup chooses **one skin for the whole extension**: a single **Show the web
with** radio group — **GitLab UI**, **GitHub UI** or **Off** — so the two skins
can never both be active. The choice is mapped onto the per-kind settings the
background, badge and content scripts already read (only one kind is ever on),
and a state stored with both skins on is reduced to one when the popup opens. A
per-site picker can still override a single host with **Off**, **GitHub UI** or
**GitLab UI**, stored in the `gitSameHostSettings` map; choosing a site's own UI
is treated as off (`popup/`, `lib/sites.js`).

## References

`refMarker` reads the link's `href`: a `/pull/N` or `/-/merge_requests/N` link
shows `!N` under the GitLab UI and `#N` under the GitHub UI. Issue links are
left as `#N`, which is correct in both products.

## Shortcuts

| On screen | press | destination | delivered by |
| --- | --- | --- | --- |
| G→L | `g m` | GitHub pull requests | synthetic key (`g p`) |
| G→L | `g p` | GitHub projects | synthetic key (`g b`) |
| G→L | `g t` | GitHub notifications | synthetic key (`g n`) |
| L→G | `g p` | GitLab merge requests | click on the "Pull requests" nav link |
| L→G | `g b` | GitLab projects | click on the "Projects" nav link |
| L→G | `g n` | GitLab todos | synthetic key (`g t`) — **not delivered** |

GitHub honours synthetic key events, so the G→L combos replay the site's own
combo. GitLab rejects them (`event.isTrusted` is false), so the L→G combos that
have a navigation link are delivered as a **trusted click** on that link
instead. The one combo with no link — `g n` (notifications ⇄ todos) — still
falls back to a synthetic key and therefore does not work on GitLab; it is the
one shortcut that is G→L only.

A GitHub-flavoured third source (Gitea / Forgejo) implements **no combos of its
own**. Since only a trusted click lands, for a Gitea source *every* delivered
combo is a click on a repository-navigation link: the applied product's pull/merge
requests and projects work (`g p` / `g m`, `g b` / `g p`), and the linkless one
does not. The Bitbucket skin defines no `g`-combos at all, so a Gitea source under
it gets none.

Deliberately unmapped, in both directions: `g c`, `g i`, `g a`, `g w`, `g s`,
`g d`, `g g`, and every single key (`t`, `/`, `.`, `?`, `s`). The single keys
mostly already agree between the products, and the `g`-combos above are the only
pairs with an unambiguous counterpart.

## Open on the other host

The popup shows **Open this page on GitLab / GitHub** when the current page is on
one of the two public forges, and the same action is bound to `Alt`+`Shift`+`O`.
`otherHostUrl` maps the path between the products — repo root,
`pull` ⇄ `-/merge_requests`, `issues` ⇄ `-/issues`, `tree` / `blob` / `commits`,
`releases`, `wiki` ⇄ `-/wikis`, `actions` ⇄ `-/pipelines` — and preserves the
query and fragment. It returns nothing for a self-hosted host (there is no pair
to guess) or a path that is not a repository, so the button is simply absent
there.

## Codeberg / Gitea

Codeberg (Forgejo) and gitea.com (Gitea) are a third source product, `gitea`.
They are GitHub-flavoured, so they can wear either UI, and each skin re-orients
their navigation:

- **Gitea → GitLab** — the horizontal repo tab row (`overflow-menu`) is rebuilt
  as GitLab's left sidebar, with GitLab's Plan/Code/Build/Deploy group headings,
  the active row tinted, and counts as trailing figures. The `overflow-menu` web
  component collapses its own tabs into a "more" popup once they stop fitting, so
  it is kept off-screen at a width where its tabs stay in the DOM for the rebuild
  (`content/ux-project.js` `paintGiteaNav`, `UX.repoNav`), and the stylesheet hides it.
- **Gitea → GitHub** — the tab row is restyled in place as GitHub's underlined
  UnderlineNav: muted inactive tabs, an orange active underline, GitHub's rounded
  counter pills, and a single hairline under the row. It is not rebuilt.

Gitea's description and topics keep Gitea's own placement — they are not moved
into a GitLab "Project information" block or a GitHub "About" rail — and the
applied product's `g`-combos are delivered as clicks on Gitea's own navigation
links (see [Shortcuts](#shortcuts)).

## Not built

- **Behaviour** behind search, notifications and the merge flow: only their
  labels change, not what they do.

## Extending

Add to `PHRASES` for prose, `LABELS` for a control label, `CHROME` for account
chrome, `NAV` for a nav label, `SELECTORS` for a DOM hook, `SHORTCUTS` for a
`g`-combo, `UNMAPPED` for a feature the applied product lacks, `UNAVAILABLE` for
one the source lacks, and `PROJECT_TABS`/`PROFILE_MENU` for a synthesised
destination. Keep control words in `LABELS`/`CHROME`, not `PHRASES` — the control
scope is what makes an ordinary word safe. The tests enforce that every `LABELS`
and `CHROME` entry round-trips and that `PHRASES` stays the same size in both
directions.

A selector a pass keys on goes in `SELECTORS`, under the *source* product whose
markup it matches — `src/content/ux-*.js` reads it from there rather than carrying
a literal. Name the hook in a `CANARY_PAGES` entry too, and
`npm run canary` will assert the live forge still serves it.

## Verification

- **Live**, in Chromium with `dist/chromium` loaded: G→L copy, nav relabel and
  reorder, `#42 → !42`, `g m` navigating to the repo's pull requests, and a clean
  revert of all of it; L→G copy, nav relabel, the repository group reordered
  (`Code` before `Pull requests`), `!42 → #42` (and back on revert), and `g p`
  navigating to the project's merge requests. The popup's "Open this page on
  GitLab" button resolved `github.com/git/git/pull/1875` to
  `gitlab.com/git/git/-/merge_requests/1875`, and `open-other-host` was
  registered alongside `toggle-site`. Nine `≠ GitHub` badges appeared on
  GitLab-only features, a mapped item carried none, an injected `Discussions`
  tab was marked `≠ GitLab`, and every badge was removed on switch-off. Both
  orientations rendered correctly: GitHub's repo tabs as a vertical column, and
  GitLab's sidebar as a horizontal strip with the project content still full
  width (1231px). A GitHub profile (`github.com/torvalds`) was checked too: its
  profile tabs became a vertical panel in the left rail, the profile card below
  it, and the pinned content kept the full right column.
- **Unit**, `tests/ux.test.mjs`: every table and helper, including the `LABELS`
  and `CHROME` round-trips, `PHRASES` symmetry, `labelMatches`, `otherHostUrl`,
  and that `UNMAPPED` never overlaps a translated label.
