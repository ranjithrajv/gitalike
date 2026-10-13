# Make the live fidelity check deterministic

Written against: `43920d2a369131b14070d3766357ee7fdaab2d5a`

## Evidence chain

- Surface: `tools/compare/style-parity.mjs` — the tool that grades each skin against the reviewed target chrome in `tests/fixtures/target-chrome.json`.
- Problem: two runs of the same command, twenty minutes apart, with no source change, produced materially different scores for the same cells. The dimension that moved hardest is `header` (weight **2.0**):

  | Cell | Run A (`--checks`) | Run B (`--json`) |
  | --- | :--: | :--: |
  | `gitea → github` project | header **1.00**, score 10.0 | header **0.20**, score 0.84 |
  | `gitlab → github` project | header **1.00**, score 10.0 | header **0.20**, score 0.84 |
  | `bitbucket → github` project | header **1.00**, score 8.4 | header **0.20**, score 0.68 |
  | `bitbucket → gitlab` project | header **1.00**, score 8.7 | header **0.88**, score 0.85 |

  A dimension worth a fifth of the total cannot move between "perfect" and "near-zero" between two runs and still be a usable gate.
- Design evidence — three mechanism-level causes, all visible in the tool's own output and code:
  1. **No cookie/consent handling.** `grep -n "cookie\|consent\|banner\|dismiss" tools/compare/style-parity.mjs` returns nothing. Run B's located nav on Bitbucket pages carried `Atlassian uses cookies to improve your browsing experience…` and `Atlassian cookies and tracking notice` as its first labels — a consent surface was open, which also changes what `first(headerSels)` resolves to and what the body reads.
  2. **Signed-out vs signed-in is not pinned.** The header colour the tool reads is whatever the page renders; `as-gitlab.css:329` records that GitHub's signed-in repo nav is the only variant that moved to `prc-components-*`, so the signed-out page measures a *different nav* from the signed-in one. Run A and Run B were not guaranteed to see the same variant.
  3. **Live sites are a moving target by design.** The tool's own header says so — *"Live sites, so it is a scheduled/on-demand check, not a commit gate"* — and the canary/screenshot recipes in `sources/*/parity.mjs` each pin a specific URL and a `ready` selector, which the style pass does not use the same way.

  The frozen half is stable and honest: `npm run parity` reads `tests/fixtures/target-chrome.json` and `tests/compare/target-chrome.test.mjs` pins the skins to that fixture offline, in `npm test`. Everything above is about the live half.
- Owner: `tools/compare/style-parity.mjs`.
- Scope and affected surfaces: the tool only. No skin, theme or content script changes.
- Uncertainty: whether each variance has one cause or several. The three mechanisms above are all observable; fixing them makes the measurement reproducible, which is the precondition for trusting any number in the "reach 10" programme.

## Design decision

Make one run of the tool produce one answer, by pinning the three things that currently vary — in this order:

1. **Dismiss overlay surfaces before reading.** After the page's `ready` selector resolves, click any accept/reject control of a consent surface (a one-element-by-role/label heuristic scoped to the known hosts, in the tool — not in the product) and wait for it to be detached. Read chrome only after that.
2. **Pin the session state per source.** Record it in the source's own `sources/<name>/parity.mjs` alongside the `url` and `ready` it already carries — `signedOut: true` — and have the tool treat a page that renders a sign-in prompt as expected rather than as noise. Where a source cannot be measured signed-out, say so explicitly instead of averaging both states.
3. **Make a run self-describing.** Print the resolved variant (signed in/out, consent dismissed) in the row, so two runs can be compared without guessing.

Reuse rather than invent: the per-source `parity.mjs` recipe files are already the place a source declares its URLs, `ready` selectors, header/nav/link/canvas selector lists, and (for Gerrit) a granted instance. A session flag belongs beside them, not in a new config.

Do **not** make the live tool a commit gate, and do not snapshot the live output into the fixture to make it green — the fixture is hand-reviewed and its `asOf` provenance is part of its value.

## Reuse

- `sources/<name>/parity.mjs` — the existing per-source recipe: `url`, `ready`, `header`, `nav`, `link`, `canvas`, and for Gerrit `capture.instance` (the pattern for "this run needs a host granted").
- `tests/compare/target-chrome.test.mjs` — the offline pin that already runs in `npm test`; this plan must not disturb it.
- `tests/fixtures/target-chrome.json` — the reviewed target values (`header`, `canvas`, `link`, `accent` per product) and their `provenance` notes.

## Changes

1. `tools/compare/style-parity.mjs` — post-`ready` consent dismissal
   - Change: after each page's `ready` selector resolves, look for a consent surface (a container whose text matches `cookie|consent` carrying an accept/reject button), click the *reject/necessary-only* control if present, wait for the surface to detach, then read chrome.
   - Preserve: the `ready` wait, the shadow-DOM descent (`deepAll`), and every dimension computation.
   - Verify: run twice on a Bitbucket page; the located nav's labels no longer contain cookie text, and the two runs agree on `header`, `body` and `vocab`.

2. `src/plugins/sources/*/parity.mjs` — declare the session state per source
   - Change: add `signedOut: true` (or the explicit exception) beside each `selectors.project`/`selectors.profile` entry.
   - Preserve: `url`, `ready`, and the selector lists.
   - Verify: the tool reports the state it measured, per cell.

3. `tools/compare/style-parity.mjs` — print the variant
   - Change: include the measured variant in the `--checks` and `--json` row.
   - Preserve: the existing column layout and the score computation.
   - Verify: two runs on the same command produce identical rows.

## Scope

- Inherit: every consumer of the tool's output — the `layout`, header/body/vocab plans below are all gated on this one.
- Verify: `npm run style-parity --checks` twice; `npm test` (the offline pin) unchanged; `npm run parity` unchanged.
- Exclude: the gitlab skin's header value, the fixture, the offline test, and any change to a skin.

## Validation

- Product: `node tools/compare/style-parity.mjs --checks`, twice, ten minutes apart.
- Interface: signed-out pages on all five sources, both page families, with consent surfaces present (Bitbucket and Gitea both show one signed-out).
- System: `git diff --stat tools/compare/style-parity.mjs src/plugins/sources/*/parity.mjs` shows only this plan's changes.
- Repository: `npm test` → 349+ pass; `npm run lint:js`, `npm run fmt:check` clean; the two live runs produce byte-identical `--json` rows for every cell.

## Stop conditions

- Stop if a source renders different chrome per session and neither state can be pinned: record the source as "two variants measured" in its recipe and score the one the fixture's provenance names, rather than averaging.
- Stop if making the tool deterministic requires it to log in: that needs a credential the repository should not hold. Pin signed-out explicitly instead.

## Design documentation

- After acceptance and validation: record in the tool's header that the live check pins session state and dismisses consent surfaces, and that a run that cannot pin them is reported as a variant rather than scored.
