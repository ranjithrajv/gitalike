# Submission kit

Paste-ready copy for discovery channels, plus the positioning hooks to fold
into the existing store listings. Pairs with `POSITIONING.md`.

---

## 1. awesome-browser-extensions-for-github

The list takes **codeless submissions** via its issue form
(`.github/ISSUE_TEMPLATE/submit-extension.yml`). Fields, in order, with the
values to use:

- **Name of the browser extension**: `gitalike — GitHub ⇄ GitLab UI`
- **A short description**: Re-skins GitHub and GitLab (plus Codeberg/Gitea and
  Bitbucket) as each other — colour, wording, navigation, reference markers and
  keyboard shortcuts — entirely locally, with no network access.
- **Source code repository**: `https://github.com/ranjithrajv/gitalike`
- **Categories**: `Theme`, `Navigation`
- **Chrome web store url**: *(leave blank until published)*
- **Firefox Addons url**: *(leave blank until published)*
- Other stores: *(blank)*

Issue title:

```
Submit new extension: gitalike — GitHub ⇄ GitLab UI
```

Issue body (fields rendered as the form would; add `submit` label):

```markdown
**Name of the browser extension**
gitalike — GitHub ⇄ GitLab UI

**A short description**
Re-skins GitHub and GitLab (plus Codeberg/Gitea and Bitbucket) as each other —
colour, wording, navigation, reference markers and keyboard shortcuts — entirely
locally, with no network access.

**Source code repository**
https://github.com/ranjithrajv/gitalike

**Categories**
- Theme
- Navigation

**Chrome web store url**
_(not yet published)_

**Firefox Addons url**
_(not yet published)_
```

Command (if filing with `gh`):

```sh
gh issue create \
  --repo stefanbuck/awesome-browser-extensions-for-github \
  --label submit \
  --title 'Submit new extension: gitalike — GitHub ⇄ GitLab UI' \
  --body-file market/awesome-submission.md
```

> **Caveat.** The list's web version shows install buttons from the store URLs.
> Submitting before the stores are live is allowed (the source repo is enough),
> but the entry will have no install button until you go back and add them. If
> store publication is imminent, submitting after is cleaner.

## 2. Store-listing positioning hooks

The listings in `store/listing-chrome.md` and `store/listing-firefox.md` are
already accurate (three skins, Bitbucket, Gitea/Forgejo). Fold in the category
ownership and the trust differentiator with these three small edits — do not
rewrite the listings.

1. **Lead sentence — name the category.** Today both open with "re-skins the big
   forges so they look — and read — like each other". Add the owned claim:

   > gitalike is the extension that re-skins **GitHub and GitLab as each
   > other** — and it is the only one that does it in both directions, so the
   > muscle memory you built on one forge keeps working on the other.

2. **Add a "why not a theme?" line** to separate from userstyles and GitSkin:

   > A theme changes the colours. gitalike also changes the words ("Pull
   > request" ⇄ "Merge request"), the reference markers (`#42` ⇄ `!42`), the
   > navigation's labels and order, and the other product's keyboard shortcuts.

3. **Sharpen the privacy contrast** (no CDN adapters, no remote code):

   > No network access at all: no CDN, no remote configuration, no telemetry.
   > The simulation ships in the bundle and the source is GPL-3.0.

Chrome keywords to keep: `github`, `gitlab`, `theme`, `ui`, `skin`,
`muscle memory`. AMO tags: `github, gitlab, theme, appearance, user-interface`.

## 3. Launch checklist

- [ ] Publish to the Chrome Web Store and AMO (`npm run publish:chromium`,
      `web-ext sign`) — this is the single biggest TRL step.
- [ ] Then file the awesome-list submission, **with** the store URLs.
- [ ] Post to Hacker News (Show HN), r/github, r/gitlab, r/selfhosted,
      r/opensource — lead with the reciprocal-reskin demo/preview GIF.
- [ ] Announce in the Forgejo/Codeberg community (Forgejo's own theming docs
      warn it is fragile — gitalike is the client-side alternative).
- [ ] Cross-link with a multi-forge CLI (`git-pkgs/forge`, `git-forge`) and,
      where welcome, an interop note with GitSkin.
- [ ] Add the live store links to the README install section and `docs/index.html`.
- [ ] Reference the migration funnel in the docs: GitLab's GitHub importer /
      `gh gl2gh` move the data; gitalike keeps the muscle memory.
- [ ] Consider a GitHub Sponsors / OpenCollective page, and an NLnet NGI Zero
      application framed as lowering the cost of switching forges.

## 4. Facts worth keeping straight in public copy

- **Do not claim** "first" or "only" without the qualifier *reciprocal* — GitSkin
  and the theme ecosystem are legitimate neighbours.
- **Do not claim** it is a security boundary; the README already says the skin
  can be influenced by the page.
- **Do** keep the "no network / no data / reversible" line — it is verifiable
  against the source and is the sharpest contrast with CDN-based rivals.
- Store reviewers test claims: keep the Bitbucket/three-skin claim true at the
  revision you submit (it is true as of `4597538`, all 172 tests passing).
