# Feature status

A fine-grained inventory of what GitAlike is built for: every capability, whether
it is **complete**, **partial** (built, with named gaps), or **not built**. This
is the detailed companion to [ROADMAP.md](ROADMAP.md) — the roadmap tracks aims
and big moves; this tracks the state of each feature.

Status is read off something checkable, not judged: a skin's declared table, a
source's declared `compare` capability (a fraction in `[0, 1]`, published in
[`plugins.json`](plugins.json)), or the pass gating in `src/content/ux-*.js`. The
full parity matrix and the derived scorecard are in
[docs/UX-PARITY.md](docs/UX-PARITY.md); this page is the per-feature index.

**Legend:** ✅ complete · 🔶 partial · ⬜ not built · ➖ not applicable

---

## 1. Extension platform

| Feature | Status | Notes |
| --- | :--: | --- |
| Manifest V3, Chromium + Firefox | ✅ | One build per engine; `background` declared per engine in `build.mjs` |
| Bundled hosts at install | ✅ | `github.com`, `gitlab.com`, `codeberg.org`, `gitea.com`, `bitbucket.org` |
| Self-hosted / enterprise instances | ✅ | One origin granted at a time from the popup (`optional_host_permissions`) |
| Content-script registration per granted host | ✅ | `scripting.registerContentScripts`, scoped to classified + granted hosts |
| One skin at a time | ✅ | Global radio; a second skin can never be active |
| Per-site skin override | ✅ | `hostSettings`; can spare one host or pin a different skin |
| Reversible (undo ledger) | ✅ | Every change recorded and undone on switch-off |
| Inert when off | ✅ | No `gs-theme-*` class → no styling, no rewriting |
| Storage sync + first-paint cache | ✅ | `chrome.storage.sync` + per-origin `localStorage` |
| Dark-mode mirroring | ✅ | Follows the site's resolved mode, including GitHub `auto` |
| Reference markers (`#42` ⇄ `!42`) | ✅ | By link `href` |
| Keyboard shortcuts | ✅ | `Alt`+`Shift`+`G` toggle, `Alt`+`Shift`+`O` open other host |
| `g`-combo remap | 🔶 | One combo (`g n`) is G→L only — see the source rows in §3 and §5 |
| Toolbar badge | ✅ | `GL` / `GH` / `BB`, follows the effective per-site skin |
| "Open on the other host" | ✅ | Two public forges only (a self-hosted host has no pair to guess) |
| Popup | ✅ | Skin radio, per-site picker, Add-a-site (classify + prefill), remove, report link |
| Build / package / release | ✅ | `npm run build`, `package`, `release.yml` attaches ZIPs |
| Store publishing | 🔶 | Chrome + addons.mozilla.org live; Edge tool ready, Opera manual — see [§6](#6-not-built) |
| Docs, captures, live preview | ✅ | `docs/`, `npm run screenshots`, `npm run preview` |

---

## 2. Skins (target UIs)

Capabilities declared by each skin in `src/plugins/skins/<name>/index.js`.

| Capability | GitLab | GitHub | Bitbucket | Notes |
| --- | :--: | :--: | :--: | --- |
| Palette (light + dark) | ✅ | ✅ | ✅ | `as-<name>.css` |
| Structural CSS | ✅ | ✅ | ✅ | Bitbucket reuses GitLab's layout |
| Own mark in the palette | ✅ | ✅ | ✅ | `--gs-mark`, original artwork |
| Prose copy — `phrases` | ✅ 9 | ✅ 9 | ✅ | |
| Control labels — `labels` | ✅ | ✅ | ✅ | |
| Account chrome — `chrome` | ✅ | ✅ | ✅ | |
| No-counterpart markers — `unmapped` | ✅ 3 | ✅ 15 | ✅ | |
| Nav labels — `nav` | ✅ | ✅ | ✅ | |
| Nav reorder — `navRules` | ✅ | ✅ | ✅ | Bitbucket/ GitHub rules exist for every source |
| Nav orientation | ✅ | ✅ | ✅ | CSS, `themes/ux-nav.css` |
| Nav groups — `groups` | ✅ | ➖ | ➖ | Only GitLab groups; Bitbucket's menu is flat, GitHub's is a flat tab row |
| Keep / hide whitelist | ➖ (hide) | ✅ keep | ✅ keep | GitLab uses `hide`; GitHub/Bitbucket whitelist via `keep` |
| Project tab strip — `projectTabs` | ➖ (groups) | ✅ | ✅ | GitLab gathers; GitHub/Bitbucket rebuild |
| Activity-graph palette | ✅ | ✅ | ✅ | |
| Profile menu — `profileMenu` | ✅ | ✅ | ✅ | Bitbucket's extended with Stars/Followers/Following |
| `g`-combos — `shortcuts` | ✅ 3 | ✅ 3 | ⬜ | Bitbucket defines no combos — see §3 and §5 |
| Shortcut targets — `shortcutTargets` | ✅ | ✅ | ⬜ | |
| Top-bar source words — `topbarHide` | ✅ | ✅ | ⬜ | Only the two public forges have a marketing bar to hide |
| Unavailable target features — `unavailable` | ⬜ | ✅ | ⬜ | Only the GitHub skin synthesises a destination a source lacks (Packages) |

Every declared capability is fully built for that skin. The spatial gaps above are
deliberate (a skin without a marketing bar needs no `topbarHide`), not unfinished.

---

## 3. Sources (forge markup)

Capabilities declared by each source.

| Capability | GitHub | GitLab | Gitea | Bitbucket | Gerrit |
| --- | :--: | :--: | :--: | :--: | :--: |
| Palette / colour tokens | ✅ | ✅ | ✅ | ✅ | 🔶 |
| Markup selectors | ✅ | ✅ | ✅ | ✅ | 🔶 |
| Copy — `phrases` | ✅ | ✅ | ✅ | ✅ | 🔶 |
| Control labels | ✅ | ✅ | ✅ | ✅ | 🔶 |
| Account chrome | ✅ | ✅ | ✅ | ✅ | ⬜ |
| Reference markers | ✅ | ✅ | ✅ | ✅ | 🔶 |
| Nav labels | ✅ | ✅ | ✅ | 🔶 | 🔶 |
| Nav reorder / filter | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| Nav orientation | ✅ | ✅ | ✅ | 🔶 | 🔶 |
| Nav groups | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| Project tab strip | ✅ | ✅ | ✅ | 🔶 | ⬜ |
| Project metadata block | ✅ | ✅ | ⬜ | ⬜ | ⬜ |
| Activity-graph palette | ✅ | ✅ | ✅ | ✅ | 🔶 |
| Profile menu / rail | ✅ | ✅ | 🔶 | 🔶 | 🔶 |
| Page classes (dashboard/settings/sign-in) | ✅ | ✅ | ✅ | ✅ | ⬜ |
| Shortcuts — `g`-combos | ✅ | 🔶 | 🔶 | ⬜ | ⬜ |
| Canary page | ✅ | ✅ | ✅ | 🔶 | 🔶 |

Each source also declares a `compare` capability — the share of the imitated
product's surface it can reach, published in [`plugins.json`](plugins.json) and
read by the scorecard:

| Source | palette | nav | page | metadata | profile | refs |
| --- | :--: | :--: | :--: | :--: | :--: | :--: |
| GitHub | 1 | 1 | 1 | 1 | 1 | 1 |
| GitLab | 1 | 1 | 1 | 1 | 1 | 1 |
| Gitea / Forgejo | 1 | 1 | 1 | **0** | **0.5** | 1 |
| Bitbucket | 1 | **0.9** | 1 | **0** | **0.5** | 1 |
| Gerrit | **0.6** | **0.8** | **0** | **0** | **0.8** | **0.3** |

Bold is a declared gap; the prose below names what each one is.

### 3.1 GitHub / GitLab sources — complete

Both declare `compare: { palette: 1, nav: 1, page: 1, metadata: 1, profile: 1, refs: 1 }`.
Every capability is built and live-canaried. Their non-native directions lose
points only where the *target* lacks something (GitLab has no pinning, GitHub has
no `g n` counterpart) — a ceiling, not a gap.

### 3.2 Gitea / Forgejo source — metadata gap

- ✅ Palette, nav labels, reorder, orientation, groups, tab strip, refs.
- 🔶 **Profile menu / rail (0.5).** Under a sidebar layout the header becomes a
  left rail and the tab menu a row (`paintGiteaProfile`), but the profile menu and
  identity card are *not rebuilt* — the passes are keyed to GitHub's and GitLab's
  profile markup. The rebuilt menu is now marked (`data-gs-profile-menu`) so the
  parity tool finds it, but the card reshape is absent.
- ⬜ **Project metadata block (0).** Gitea's description and topics keep Gitea's
  own placement; they are not moved into a GitLab "Project information" block or
  a GitHub "About" rail.
- 🔶 **Shortcuts.** Gitea implements no combos of its own, so the applied
  product's combos are delivered as clicks on Gitea's own nav links; the linkless
  combo is undelivered.

### 3.3 Bitbucket source — vocabulary + palette only

- ✅ **Palette (1).** Atlassian `--ds-*` tokens re-pointed, header included.
- 🔶 **Nav (0.9).** `paintBitbucketNav` reorients and relabels the repository bar,
  and the workspace profile nav is reoriented to the layout — but there is **no
  `NAV_RULES` entry**, so the nav is not reordered or filtered, and no group
  headings.
- ⬜ **Metadata (0).** No metadata-block shape.
- 🔶 **Profile (0.5).** Workspace navigation is reoriented; the rail/card is not
  rebuilt (classes are hashed — see [docs/LIMITATIONS.md](docs/LIMITATIONS.md)).
- ⬜ **Shortcuts.** No `g`-combo table.
- 🔶 **Canary.** Bitbucket no longer serves public repository pages, so it cannot
  be watched; the skin is pinned to an archived capture
  (`tests/fixtures/bitbucket-repo-tabs.json`).

### 3.4 Gerrit source — partial, shadow-DOM bound

- 🔶 **Palette (0.6).** PolyGerrit reads root custom properties that inherit
  across its shadow boundary, so text, links, borders, feedback and the header
  surface are reached — the remaining app surfaces are not.
- 🔶 **Nav (0.8).** The header nav is laid out like the applied skin (top bar for
  GitHub, fixed left column for the column skins) and its own words relabelled
  ("Changes" → Pull/Merge requests, "Browse" → Code/Repository/Source). It is not
  the target's *full* menu.
- 🔶 **Profile (0.8).** An owner query (`/q/owner:`) and a project query
  (`/q/project:`) are reshaped into the applied product's profile/repository page
  from Gerrit's own REST data. Gerrit has no Pinned/Repositories/Followers data to
  reproduce, so those are marked `≠`.
- 🔶 **Refs (0.3).** Gerrit numbers a change by Change-Id, not a `#`/`!` marker.
- ⬜ **Mark swap.** No skin swaps a Gerrit mark (chrome reached via root props, not
  markup).
- ⬜ **`g`-combos.** Gerrit has neither the keyboard contract nor a marker.
- 🔶 **Copy inside the shadow roots.** The `document_start` opener
  (`src/content/gerrit-shadow-open.js`) now forces open roots so the UX pass can
  reach them; the deeper copy/label passes are still shallow.

---

## 4. Direction matrix (source × skin)

Derived from the tables and source `compare` values, out of 10. Full rubric in
[docs/UX-PARITY.md](docs/UX-PARITY.md#parity-scoring).

**Project pages**

| Source ↓ / Skin → | Bitbucket UI | GitHub UI | GitLab UI |
| --- | :--: | :--: | :--: |
| **Bitbucket** | 10.0 | 6.5 | 5.9 |
| **Gerrit** | 5.3 | 5.4 | 5.1 |
| **Gitea / Forgejo** | 8.0 | 8.6 | 8.5 |
| **GitHub** | 8.4 | 10.0 | 9.7 |
| **GitLab** | 8.4 | 9.7 | 10.0 |

**Profile pages**

| Source ↓ / Skin → | Bitbucket UI | GitHub UI | GitLab UI |
| --- | :--: | :--: | :--: |
| **Bitbucket** | 10.0 | 5.6 | 5.7 |
| **Gerrit** | 2.6 | 4.0 | 4.1 |
| **Gitea / Forgejo** | 4.2 | 6.2 | 6.2 |
| **GitHub** | 6.7 | 10.0 | 9.9 |
| **GitLab** | 6.7 | 9.5 | 10.0 |

Diagonal cells (a source on its own UI) are 10.0 by definition: no skin is painted.

---

## 5. Partially built — the named gaps

Each row is a feature that exists but does not reach a real counterpart.

| Feature | What works | What is missing | Closes with |
| --- | --- | --- | --- |
| **Gitea profile menu/card** | Rail under sidebar layout, tab row under GitHub layout | A rebuilt menu and identity card (keyed to Gitea's own profile markup) | A `SELECTORS.gitea.profileMenu` pass, mirroring `paintGiteaProfile` |
| **Gitea project metadata** | Everything else on the repo page | Moving Gitea's description/topics into the applied product's block | A metadata pass for Gitea's markup |
| **Bitbucket nav reorder** | Reorient + relabel of the repository bar | `NAV_RULES` entry → reorder/filter, group headings | A Bitbucket `NAV_RULES` rule (needs a captured menu model) |
| **Bitbucket metadata** | Palette, copy, labels | A metadata-block shape | A captured Bitbucket metadata model |
| **Bitbucket profile rail/card** | Workspace nav reoriented | Rebuilt rail/card | Its classes are hashed — see docs/LIMITATIONS.md |
| **Gerrit palette** | Text, links, borders, feedback, header | The rest of the app's surfaces | More root custom properties mapped |
| **Gerrit shadow-DOM copy** | Open-root opener lands; header nav shaped | Deeper copy/label passes inside the roots | A dedicated shadow-root copy pass |
| **`g n` shortcut** | All other combos | `g n` (notifications ⇄ todos) has no nav link to click | A trusted way to trigger GitLab's todos |
| **Behaviour behind chrome** | Labels for search, notifications, merge flow | What those controls *do* | Out of scope by design — the skin is cosmetic |

---

## 6. Not built

| Item | Notes |
| --- | --- |
| **Sourcehut** | A genuinely different product needing its own source **and** skin. Named as the next candidate. |
| **Microsoft Edge Add-ons listing** | `npm run publish:edge` is ready; the first submission must be created in Partner Center by hand. |
| **Opera Add-ons listing** | Manual dashboard, no public API. |
| **Scoring for dashboard / settings / sign-in / sign-out** | Routes are declared per source, but `style-parity.mjs` scores `project` and `profile` only. |
| **Enterprise team-wide skin policy** | Centralised config for a mixed environment. Must not break "nothing leaves the browser"; needs its own design. |
| **Funding** | GitHub Sponsors / OpenCollective and an NLnet NGI Zero application. |

---

## 7. Verification status

How each layer is currently held to.

| Evidence | Status | Command / gate |
| --- | :--: | --- |
| Unit suite | ✅ | `npm test` — 372 tests, 100% plugin coverage |
| Contract test (plugin completeness) | ✅ | `tests/contracts.test.mjs` in `npm test` |
| Colour parity, offline | ✅ | `tests/compare/color-parity.test.mjs`; `npm run color-parity` |
| Style parity, live | 🔶 | `node tools/compare/style-parity.mjs --checks` — on-demand, not run in CI |
| Selector canary | ✅ | `npm run canary` — daily, opens an issue on drift |
| End-to-end (live sites) | ✅ | `node tools/compare/e2e.mjs` — nightly |
| Layout parity | ✅ | `npm run layout-parity` — live, gated per pair |
| **Path to 10 plans** | 🔶 | Code landed; a live `--checks` run is still owed (see ROADMAP) |
| Forced-colours mode | 🔶 | Structurally correct; no High Contrast environment to verify against |
| Popup motion | 🔶 | No test asserts popup CSS |
| Bitbucket skin vs live | ⬜ | Pinned to an archived capture; no public repo page to verify |
| Gerrit vs live | 🔶 | Needs a granted `gerrit-review.googlesource.com` instance |
| `npm run plugins:validate` | ⬜ | Fails on a clean checkout (pre-existing registry counterpart error) |

---

## Maintaining this page

Update a row when the feature's reach changes — a new table entry, a new pass, or
a source capability fraction in `plugins.json`. A row moves from 🔶 to ✅ when
every imitated-product surface it names is reproduced, or when the remaining gap
is recorded as a deliberate ceiling in
[docs/UX-PARITY.md](docs/UX-PARITY.md). New work that needs design goes in
`design-plans/`. How to contribute a plugin is in
[CONTRIBUTING.md](CONTRIBUTING.md#contributing-a-plugin).
