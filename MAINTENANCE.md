# Maintenance

gitalike is a small, single-maintainer, best-effort project. This page records
what "supported" means, how a release is cut, where the boundaries are, and how
to work in the shared checkout without stepping on another session.

## Support

- **Browsers.** Chromium (Chrome, Edge, Brave, Opera, Vivaldi and the other
  Chromium builds, which share the extension API) and Firefox **142 or newer**,
  including the forks that track it (LibreWolf, Floorp, Zen). Manifest V3 only;
  there is no MV2 build.
- **Forge sources.** GitHub (`github.com`, GitHub Enterprise Server) and GitLab
  (`gitlab.com`, self-hosted) out of the box; Gitea/Forgejo (`codeberg.org`,
  `gitea.com`) bundled. A self-hosted instance is added from the popup, which
  requests that one origin (`optional_host_permissions`).
- **Skins.** GitLab UI, GitHub UI and Bitbucket UI. Any configured host can wear
  any of them; one skin is active at a time, with a per-site override.
- **Response.** Best effort — bug reports and pull requests are welcome, but
  there is no SLA. Security-relevant reports are prioritised.

## Release process

Cut from `main`, on a green suite:

1. `npm test && npm run lint && npm run lint:js && npm run fmt:check`, and
   `node tools/e2e.mjs` when the CSS or DOM layer changed (it drives the live
   sites, so it is network-flaky by nature and runs on a schedule too).
2. Bump `version` in `package.json` — the only place it is written — and add a
   `CHANGELOG.md` entry under `## [Unreleased]`.
3. `npm run package` and, when the skin changed, `npm run screenshots`.
4. Commit, tag `vX.Y.Z`; `.github/workflows/release.yml` attaches the ZIPs.
   Publishing to the stores is opt-in through repository variables — the details
   are in [CONTRIBUTING.md](CONTRIBUTING.md#releasing).

Scheduled workflows: `canary.yml` (daily selector canary; files or refreshes an
issue when an upstream hook is renamed), `e2e.yml` (nightly live suite),
`ci.yml` (every push and pull request), `pages.yml` (the preview).

## What it is not

- **The skin is cosmetic, not a security boundary.** Everything hangs off
  `html.gs-theme-*` classes and `data-gs-*` markers that live on the page, so the
  page can add, remove or spoof them, and it can mark its own content
  `[data-gs-ux-skip]` to opt out of translation. Do not treat the skinned look as
  a trust signal.
- **No network, no collection.** The extension makes no network requests; nothing
  read from a page is stored or sent. The privacy policy is the source of truth.
- **Verified targets.** The e2e suite and the selector canary cover GitHub,
  GitLab and Gitea/Codeberg. The **Bitbucket skin is built to Atlassian's design
  and pinned to an archived capture**, not verified against live Bitbucket — it
  no longer serves public repository pages, and the canary cannot watch it. Treat
  it as best effort; `tests/fixtures/bitbucket-repo-tabs.json` is the reference
  it is held to.

## Working in a shared checkout

More than one agent or session can share this working tree. To keep history
clean and runs meaningful:

- Work on a **branch or a `git worktree`** per session, rather than every session
  on `main` in the same directory.
- **Never** `git add -A` or `git commit -a` in the shared tree. Stage the paths
  you actually changed; a sweep-commit has already mixed two sessions' work once.
- Point a build at a per-session output where you can (`GS_EXT=...`), so
  rebuilding `dist/` under one session does not invalidate another's run.
- Prefer committing your own hunk with the index when a file is co-edited, rather
  than rewriting the whole file.
