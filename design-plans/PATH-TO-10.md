# Path to 10

Every remaining gap between the skins and a perfect fidelity score, in dependency
order. Cell scores are live, off-diagonal, from `tools/compare/style-parity.mjs`
(`--json`/`--checks`); weights are the tool's: theme 1, layout 2, header 2, body 1,
link 2, vocab 2.

## Today

| Skin | Project | Profile | Cell not at 10 |
|---|---|---|---|
| github | 9.3 | 9.4 | 7 of 8 |
| gitlab | 8.6 | 8.4 | 7 of 8 |
| bitbucket | 9.2 | 9.1 | 7 of 8 |

## The programme

| # | Plan | Closes | Weight gained | Depends on |
|---|---|---|---|---|
| 0 | [parity-measurement-determinism](2026-10-13-parity-measurement-determinism.md) | nothing directly — makes every later number trustworthy | 0 | — |
| 1 | [layout-reorient-github-nav](2026-10-13-layout-reorient-github-nav.md) | layout 0.00 on project `github → gitlab`, `github → bitbucket`; likely lifts their `vocab` too (the nav pass finally fires) | 2.0 × 2 cells + up to 2.0 × 2 | 0 |
| 2 | [gerrit-profile-nav-layout](2026-10-13-gerrit-profile-nav-layout.md) | layout 0.00 on profile `gerrit → gitlab`, `gerrit → bitbucket` | 2.0 × 2 | 0 |
| 3 | [header-canvas-reach](2026-10-13-header-canvas-reach.md) | header 0.88 (8 `→ gitlab` cells), body 0.96 (8) / 0.91 (4); github-skin header 0.20 needs plan 0 first | 2.0 × 8 + 1.0 × 12 | 0 (for the 0.20 rows) |
| 4 | [vocabulary-reach](2026-10-13-vocabulary-reach.md) | the eleven cells below 1.00 in `vocab` | 2.0 × up to 11 | 0, 1 |

After 1 + 2 + 3 + 4, every dimension except `link` reaches 1.00 in every cell.
`link` is already 1.00 wherever a link exists and is *unsampled* on Bitbucket and
Gitea profiles (the tool drops the dimension rather than scoring it zero), so it
costs nothing.

## Ceiling, honestly

Not every cell can reach 10, and the plans say so per stop condition:

- A vocabulary word with no counterpart in the applied product does not get
  translated — it gets marked `≠ <product>`. Those cells have a ceiling below 10
  and the plan requires recording it rather than chasing it.
- Gerrit's shadow-DOM text is out of reach (`sources/gerrit/index.js` records that
  copying roots at `document_start` is a separate step), so some Gerrit cells
  cannot score their full vocabulary without that larger change.
- Bitbucket and Gitea profile cells measure no link, so their weighted total is
  over 9 points, not 10 — they can still reach the maximum *available*.

Run `npm run parity` for the frozen rubric and
`node tools/compare/style-parity.mjs --checks` for the live view; they disagree
today, which is plan 0.
