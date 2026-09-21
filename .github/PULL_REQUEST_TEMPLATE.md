<!--
Thanks for the pull request. Keep it to one concern, and read the pull request
section of CONTRIBUTING.md if anything below is unfamiliar:
https://github.com/ranjithrajv/gitalike/blob/main/CONTRIBUTING.md#pull-requests
-->

## What and why

<!-- One paragraph. If it closes an issue, "Closes #N". -->

## Checks

- [ ] **One concern.** Unrelated refactors or renames are their own PR.
- [ ] `npm test && npm run lint && npm run lint:js && npm run fmt:check` pass.
      The pre-commit gate runs the same commands; do not rely on `--no-verify`.
- [ ] `node tools/compare/e2e.mjs` was run if this touches the CSS or DOM layer (it
      drives the live sites, so it is network-flaky by nature).
- [ ] A behaviour change updates `README.md`, with a `CHANGELOG.md` entry under
      `## [Unreleased]`.
- [ ] The version still lives only in `package.json` — the generated manifests
      were not edited by hand.
- [ ] The skin is inert with the theme class off, and every change reverts when
      the skin is switched off.
- [ ] The extension still makes no network request and needs no new permission.
- [ ] `npm run screenshots` was run if the look changed. `docs/*.png` captures
      were regenerated with the matching `screenshots:*` script only if the skin
      actually changed, not casually.

## Adding a forge or a skin

<!-- Delete this section unless it applies. -->

- [ ] `src/lib/sites.js` and `src/manifest.base.json` are in step (the
      manifest-permissions test covers a built-in host).
- [ ] Tables in `src/lib/ux.js` have matching cases in `tests/`.
- [ ] Any structural selector added to a theme has a `SELECTORS` entry (and a
      `CANARY_PAGES` page) so `npm run canary` can watch it.
- [ ] No vendor logo or vector path data is bundled; the skin paints gitalike's
      own mark in the other product's palette.
