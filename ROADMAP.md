# Roadmap

Where GitAlike is aimed, what has landed, and what is still open. This is a
status page, not a plan — each pending item that needs design work points at its
own plan instead of being specified here.

For a capability-by-capability inventory — which features are complete, which are
partial and what the missing part is — see
[FEATURE-STATUS.md](FEATURE-STATUS.md).

**Aim.** One extension that makes every forge read like the one you already know
— reciprocally (GitHub ⇄ GitLab, plus Bitbucket and Gitea/Forgejo), semantically
(words, navigation, reference markers, `g`-shortcuts, not just colour), locally
(no network, no telemetry, no remote code) and reversibly (every change undone
when the skin goes off). See [README.md](README.md) for the product and
[CONTRIBUTING.md](CONTRIBUTING.md) for how to help.

Legend: ✅ landed · 🔶 partial · ⏳ open

---

## Completed

### The reskin itself

- ✅ **Three skins, reciprocal.** GitHub ⇄ GitLab both directions, plus Bitbucket
  and Gitea/Forgejo as targets; any configured host can wear any non-own skin.
- ✅ **Semantic, not only cosmetic.** Copy, navigation labels and order, `#42` ⇄
  `!42` reference markers, and the other product's `g`-combo shortcuts.
- ✅ **Reversible.** Every change recorded and undone exactly when a skin is
  switched off; inert when no `gs-theme-*` class is present.
- ✅ **Local by construction.** No network requests, no telemetry, no remote code;
  both stylesheets bundled, every mark an inline data URI.
- ✅ **Self-hosted and enterprise instances.** Bundled hosts at install, any
  other origin granted one at a time from the popup.

### Source coverage

- ✅ **GitHub, GitLab, Gitea/Forgejo** (Codeberg, gitea.com) — full colour,
  words, navigation, canary.
- ✅ **Bitbucket** — a source and a target; palette re-pointed through Atlassian
  `--ds-*` tokens, repository bar handled and rebuilt nav marked.
- ✅ **Gerrit** — added by instance; palette through PolyGerrit's root custom
  properties, header nav reoriented and relabelled, and an owner/project query
  reshaped into the applied product's profile/repository page from Gerrit's own
  REST data.

### UX parity — the Path to 10 programme

All five plans in [`design-plans/PATH-TO-10.md`](design-plans/PATH-TO-10.md) are
implemented:

- ✅ **Plan 0 — deterministic live check.** Consent surfaces dismissed before
  reading chrome, session state pinned per source (`parity.mjs`), and the measured
  variant printed in the tool's output.
- ✅ **Plan 1 — GitHub repo nav.** The repo-nav selector covers both generations
  of GitHub markup, so the tab bar becomes a sidebar under the column layouts.
- ✅ **Plan 2 — Gerrit profile nav.** The rebuilt profile nav follows the applied
  layout: a strip for GitHub, a vertical list for the column skins.
- ✅ **Plan 3 — header and canvas reach.** Each source's token bridge maps its
  header and content canvas to the skin's `--gs-header-bg` / `--gs-canvas`, so
  the colours no longer stop at the source each skin was written for.
- ✅ **Plan 4 — vocabulary reach.** Skin tables carry the surviving missing words,
  rebuilt profile menus are marked so the tool finds them, and no-op entries are
  rejected by the test suite.

The six earlier UI/UX audit plans (contrast, token tiers, forced colours, popup
motion, comment drift) are executed too — see
[`design-plans/README.md`](design-plans/README.md).

### Quality infrastructure

- ✅ **Three-layer parity gate** — contract tests (completeness), colour parity
  (offline palette pin), style parity (live computed-style fidelity score).
- ✅ **Daily selector canary** that opens an issue when an upstream hook is
  renamed.
- ✅ **100%-plugin-coverage** policy and generated plugin registry.

### Distribution and strategy

- ✅ **Chrome Web Store and addons.mozilla.org** — both listings live.
- ✅ **Firefox build** with the MV3 `data_collection_permissions` declaration and
  a touch-friendly popup for Firefox Android.
- ✅ **Privacy-first and terms-of-service safety** documented as market
  differentiators, and **cognitive-accessibility positioning** added.
- ✅ **Plugin contributions documented** — quick-start, good-first-issue paths and
  plugin-maintainer guidance in [CONTRIBUTING.md](CONTRIBUTING.md#contributing-a-plugin).

---

## Pending

### Reach more forges

- ⏳ **Sourcehut** — a genuinely different product that needs its own source *and*
  its own skin. Named as the next candidate in the README.
- ⏳ **Further self-hosted families** — any forge that already speaks one of the
  two dialects needs only classification; contributions welcome.

### Distribution

- ⏳ **Microsoft Edge Add-ons** — the publish tool (`npm run publish:edge`) is
  ready; the first submission has to be created in Partner Center by hand.
- ⏳ **Opera Add-ons** — manual dashboard submission, no public API.
- ⏳ **GitHub Sponsors / OpenCollective**, and an **NLnet NGI Zero** application
  framed as reducing forge lock-in (draft in
  [`market/NLNET-APPLICATION.md`](market/NLNET-APPLICATION.md)), so the project is
  funded like infrastructure.

### Enterprise (WO4)

- ⏳ **Team-wide skin policy / centralised configuration** — let an organisation
  standardise on one UI across a mixed environment. This does not exist yet and
  needs its own design; it must not break the "nothing leaves the browser" rule.

### Deeper source coverage

- 🔶 **Gerrit inside the shadow roots.** The `document_start` opener lands, so the
  UX pass can reach open roots. Page copy and labels *inside* PolyGerrit's
  deeper roots are still shallow and need a dedicated pass.
- ⏳ **Score the remaining page kinds.** `style-parity.mjs` scores `project` and
  `profile` only; explore/dashboard, settings, sign-in and sign-out are
  unmeasured.
- ⏳ **Live-verify the Path to 10 plans.** The code is in; a run of
  `node tools/compare/style-parity.mjs --checks`, twice, on a networked machine
  confirms the cell scores moved as the plans predict.

### Verification debt (recorded so it is not lost)

- ⏳ **Forced-colours blocks** are structurally correct but visually unverified —
  no High Contrast environment was available.
- ⏳ **Popup motion** is unverified by a suite.
- ⏳ **`npm run plugins:validate` fails on a clean checkout** — a pre-existing
  registry counterpart error unrelated to recent work; `npm test` and
  `npm run registry:check` pass.
- ⏳ **Bitbucket skin** is pinned to an archived capture, not verified against
  live Bitbucket (which no longer serves public repository pages).

---

## Maintaining this page

Move an item up to **Completed** when its change has landed on `main` and the
relevant gate passes; note any live verification still owed in **Verification
debt** rather than marking it fully done. New work that needs a design goes in
`design-plans/` first, then links from here. This page tracks status only — the
rules for contributing are in [CONTRIBUTING.md](CONTRIBUTING.md).
