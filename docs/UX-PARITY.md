# UX parity

What gitalike matches between GitHub and GitLab beyond colour, and where the two
directions still differ. The tables themselves live in `src/lib/ux.js`; this file
is the map and the scorecard.

## Directions

- **G→L** — a GitHub-flavoured site shown with the GitLab UI
  (`html.gs-theme-gitlab`, `themes/gitlab-as-github.css`)
- **L→G** — a GitLab-flavoured site shown with the GitHub UI
  (`html.gs-theme-github`, `themes/github-as-gitlab.css`)

## Status

| Surface | G→L | L→G | Lives in |
| --- | :--: | :--: | --- |
| Colour tokens | ✅ | ✅ | `themes/*.css` |
| Structural CSS | ✅ 22 rules | ✅ 14 rules | `themes/*.css` |
| Logo palette (shape kept) | ✅ | ✅ | `--gs-tanuki` / `--gs-octocat` |
| Copy — `PHRASES` | ✅ 9 | ✅ 9 | `lib/ux.js` |
| Control labels — `LABELS` | ✅ 4 | ✅ 4 | `lib/ux.js` |
| Nav labels — `NAV` | ✅ 5 | ✅ 5 | `lib/ux.js` |
| Nav reorder — `NAV_RULES` | ✅ 1 rule | ❌ 0 rules | `lib/ux.js` |
| References — `refMarker` | ✅ | ✅ | `lib/ux.js` |
| Shortcuts — `SHORTCUTS` | ✅ 3 | ⚠️ 2 of 3 | `lib/ux.js` |
| "Open on the other host" | ❌ | ❌ | not built |

Legend: ✅ done · ❌ not built

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

## Navigation

Labels are matched in both directions. **Order is only reordered G→L.** GitHub's
repo tabs are a flat `ul.UnderlineNav-body`, so the items can be moved among the
slots they already occupy. GitLab's project navigation is a nested group tree
with no flat parent, so it is relabelled only; reordering it would mean
flattening GitLab's groups — changing its information architecture rather than
matching GitHub's.

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

Deliberately unmapped, in both directions: `g c`, `g i`, `g a`, `g w`, `g s`,
`g d`, `g g`, and every single key (`t`, `/`, `.`, `?`, `s`). The single keys
mostly already agree between the products, and the `g`-combos above are the only
pairs with an unambiguous counterpart.

## Not built

- **"Open on the other host"** and cross-product URL translation — the one whole
  surface still at ❌ in both directions.
- **Behaviour** behind search, notifications and the merge flow: only their
  labels change, not what they do.

## Extending

Add to `PHRASES` for prose, `LABELS` for a control label, `NAV` for a nav label,
`SHORTCUTS` for a `g`-combo. Keep control words in `LABELS`, not `PHRASES` — the
control scope is what makes an ordinary word safe. The tests enforce that every
`LABELS` entry round-trips and that `PHRASES` stays the same size in both
directions.

## Verification

- **Live**, in Chromium with `dist/chromium` loaded: G→L copy, nav relabel and
  reorder, `#42 → !42`, `g m` navigating to the repo's pull requests, and a clean
  revert of all of it; L→G copy, nav relabel, `!42 → #42` (and back on revert),
  and `g p` navigating to the project's merge requests.
- **Unit**, `tests/ux.test.mjs`: every table and helper, including the `LABELS`
  round-trip, `PHRASES` symmetry and `labelMatches`.
