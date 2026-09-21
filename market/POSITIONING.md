# gitalike — positioning and competitive landscape

Internal strategy note. Not shipped with the extension, not served by GitHub
Pages (`docs/` is the Pages root; this lives in `market/` on purpose).

Last researched: September 2026. Install counts and stars move; treat them as
magnitudes, and re-check before quoting in public copy.

---

## 1. The one-liner

> **gitalike is the only extension that re-skins GitHub and GitLab as each
> other — colour, words, navigation, reference markers and shortcuts — locally,
> with no network access.**

The claim to own is **reciprocal reskinning**: not "a theme", not "an enhancer",
but *"use any forge, keep your muscle memory."* My research could not find any
established product doing this in either direction, let alone both. That is the
category to name before someone else names it.

## 2. Where it sits

Two independent axes define the field:

- **Surface**: cosmetic (colour) → semantic (words, nav, markers, keys) →
  behavioural/API → data migration.
- **Direction**: one-way (make a site look like itself) vs **reciprocal**
  (GitHub ⇄ GitLab).

```
                        one-way                       reciprocal
 cosmetic        GitHub-Dark, GitSkin,            ── gitalike ──
                 Old School GitHub, Dark-GitLab,   (GitHub ⇄ GitLab)
                 Forgejo themes
 ─────────────────────────────────────────────────────────────────────
 semantic/       Refined GitHub, UX Enhancer,              (nobody)
 UX              Refined GitLab
 ─────────────────────────────────────────────────────────────────────
 behaviour/      Refined GitHub, Octotree,                (nobody)
 API             OctoLinker, gh/glab,
                 git-pkgs/forge, magit/forge
 ─────────────────────────────────────────────────────────────────────
 data            GitLab GitHub importer,
 migration       GitHub Enterprise Importer (gh gl2gh)
```

gitalike is alone in the reciprocal column. The nearest neighbours are the
one-way cosmetic tools (GitSkin), the one-way UX enhancers (Refined GitHub) and
the API-side multi-forge tools (`git-pkgs/forge`).

## 3. Feature-parity matrix

Legend: ✅ full · ➖ partial / adjacent · ❌ none

| Capability | **gitalike** | GitSkin | Refined GitHub | Octotree | Userstyles (Stylus) | Multi-forge CLI¹ | Official importers² |
| --- | :--: | :--: | :--: | :--: | :--: | :--: | :--: |
| Reciprocal reskin (GH→GL **and** GL→GH) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Third-forge skins (Gitea/Forgejo, Bitbucket) | ✅ | ❌ | ❌ | ➖ | ➖ | ✅ | ➖ |
| Copy / vocabulary translation | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Navigation relabel + reorder + relayout | ✅ | ❌ | ➖ | ➖ | ❌ | ❌ | ❌ |
| Reference-marker swap (`#42` ⇄ `!42`) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Keyboard-shortcut parity (`g`-combos) | ✅ | ❌ | ➖ | ➖ | ❌ | ❌ | ❌ |
| Dark mode follows the site | ✅ | ✅ | ➖ | ✅ | ✅ | ❌ | ❌ |
| Self-hosted / GitHub Enterprise / GL self-managed | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ➖ |
| No network requests, no data, no remote code | ✅ | ❌ (CDN adapters) | ❌ | ❌ | ✅ | ✅ | ❌ |
| Open source licence | ✅ GPL-3.0 | ? | ✅ MIT | ❌ ToS | ✅ | ✅ MIT | ❌ |
| Upstream-drift resilience | ✅ SELECTORS + daily canary | ✅ semantic adapters | ✅ active team | ➖ | ❌ community | ➖ | n/a |
| Theme marketplace / user themes | ❌ (built-in skins) | ✅ | ❌ | ➖ | ✅ | ❌ | ❌ |
| API/behaviour unification across forges | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Data migration between forges | ❌ | ❌ | ❌ | ❌ | ❌ | ➖ | ✅ |

¹ `git-pkgs/forge` (Go, MIT, GitHub/GitLab/Gitea/Forgejo/Bitbucket/Gerrit/Tangled), `Leleat/git-forge`, `gh`, `glab`, Emacs `magit/forge`.
² GitLab's GitHub importer; GitHub Enterprise Importer's `gh gl2gh` (GA Aug 2026).

**Read:** gitalike wins the semantic reciprocal cell outright and is the only
tool that combines *no network* with *self-hosted coverage* and *third-forge
skins*. It loses on marketplace/community theming (GitSkin, Stylus) and on
API-level interop and migration (CLIs/importers) — neither of which it should
try to win.

## 4. Teardowns

### GitSkin (`gitsk.in`) — the competitor to watch, and the peer to partner with
GitHub-only skinning with a theme marketplace and — importantly — a **semantic
component model** where themes target abstract components, resolved to GitHub's
DOM by **adapters served from a CDN**. It solves the same hard problem gitalike
does (surviving upstream DOM churn), but by the opposite strategy: dynamic,
network-delivered adapters. Its five-level scale (0 = Primer tokens, 4 = global
CSS) is a good onboarding ramp.

- **Threat**: if GitSkin adds GitLab, it owns "skinnable forge UI" with a
  marketplace flywheel and brand.
- **Weakness gitalike exploits**: GitHub-only; CDN adapters mean network
  requests (a privacy contrast gitalike can press); not about cross-product
  muscle memory.
- **Alliance**: gitalike's `SELECTORS` + canary is a static cousin of their
  adapter spec. Contributing a GitLab adapter, or publishing an interop note,
  converts the nearest rival into a peer before a rivalry forms.

### Refined GitHub — the mindshare benchmark and a precedent risk
32k stars, org-backed, MIT, Chrome/Firefox/Safari. Not a reskin, but it is *the*
GitHub-improvement brand, and its README notes **GitHub natively absorbed dozens
of its features**. Two lessons: (1) a polished, documented, tested extension can
own a large audience; (2) platforms absorb good ideas. GitHub absorbing "look
like GitLab" is unlikely (brand), which makes gitalike's niche *more* defensible
than a generic enhancer — but the precedent is worth stating in strategy.

### Octotree — the monetization precedent
22k stars, freemium at ~$35/yr, "Terms of Use" (closed). Proves developers pay
for GitHub workflow tooling. gitalike's GPL + no-backend model forecloses paid
tiers, so it should not chase this; the realistic analogue is sponsorship/grants.

### Old School GitHub — the cautionary tale
A CSS-only "make GitHub look different" reskin, 238 stars, ~dozens of installs,
last updated 2024, effectively abandoned. It shows the failure mode gitalike is
built against: brittle structural CSS with no drift detection decays. gitalike's
daily selector canary is the explicit countermeasure.

### Userstyles (Stylus / GitHub-Dark / Dark-GitLab) — the DIY substitute
Large, free ecosystem. Recolours but cannot do words, nav, markers or keys.
Also a trust narrative to borrow: the community migrated off **Stylish** after
its spyware scandal to **Stylus**. "No network, no data" lands well with exactly
this audience.

### Multi-forge CLIs and official importers — collaborators, not rivals
`git-pkgs/forge`, `gh`/`glab`, `magit/forge` unify forge **behaviour**; the
GitLab importer and `gh gl2gh` move **data**. gitalike unifies **UI/muscle
memory**. Same user pain (forge fragmentation), no overlap — ideal cross-linking
partners and a natural migration funnel: *the importer moves the data, gitalike
moves the muscle memory.*

## 5. Collaborative ecosystem

| Ally | Why | How to engage |
| --- | --- | --- |
| **Forgejo / Codeberg** | gitalike already bundles them; Forgejo warns its own UI customisation is fragile/unsupported, so a client-side skin is complementary; both non-profit, FOSS-aligned | Offer it in Forgejo/Codeberg community lists; note the Gitea token block already matches their markup |
| **GitSkin** | Same upstream-churn problem, opposite solution | Adapter interop note; contribute a GitLab adapter; list each other as "different axis" |
| **ForgeFed / F3** | CC0, **NLnet NGI Zero-funded**; Forgejo implementing federation; the standards answer to forge lock-in | Cite as ecosystem context; **NLnet/NGI Zero Entrust is a credible grant funder** for "lower the cost of switching forges" |
| **Multi-forge CLIs** | Complementary surface | Cross-links, "CLI for the terminal, gitalike for the browser" |
| **Migrators** | Data → then familiarity | Docs/blog: migrate, then keep muscle memory |
| **awesome-browser-extensions-for-github** (3.3k★) | Curated discovery; **codeless submission via an Issue** | File the submission (see `SUBMISSION-KIT.md`) |
| **Stylus / userstyles.world** | Same audience, adjacent mechanism | Offer a lite userstyle or an interop note |

## 6. Strategic recommendations (priority order)

1. **Name the category.** Lead with reciprocal reskinning in the README, store
   copy and the awesome-list entry: *the only extension that makes GitHub read
   like GitLab — and back.*
2. **Neutralise GitSkin before it moves.** Publish an adapter/interop note and
   offer a GitLab adapter; make gitalike the reference for *cross*-product skins.
3. **Submit to `awesome-browser-extensions-for-github` and the stores.** The
   awesome entry is near-zero effort and permanent discovery; store listings are
   the gate to TRL 8–9 (see `store/listing-*.md`).
4. **Build the migration funnel.** Pair "open on the other host" and the docs
   with the official importers — be the muscle-memory half of every migration.
5. **Press the trust differentiator.** "No network, no remote code, GPL" is
   verifiable and contrasts directly with GitSkin's CDN adapters.
6. **Re-examine all-sites access.** `optional_host_permissions` trades one
   install prompt for a cleaner store/privacy story; the current design is
   defensible, but it is the most likely review objection.
7. **Keep the drift moat.** The daily canary and the `src/lib/ux.js` parity
   tables are the durable asset; keep them the focus as forges grow.
8. **Fund it like infrastructure.** GitHub Sponsors / OpenCollective, and a
   ForgeFed-adjacent NLnet NGI Zero application framed as reducing forge lock-in.

## 7. Sources

- GitSkin — <https://gitsk.in/>, theme authoring guide, adapter spec, marketplace.
- Refined GitHub — <https://github.com/refined-github/refined-github> (32k★, MIT).
- Octotree — <https://www.octotree.io/>, Firefox/Chrome listings (freemium, ~22k★ repo).
- Old School GitHub — <https://github.com/daattali/oldschool-github-extension>.
- GitHub-Dark — <https://github.com/StylishThemes/GitHub-Dark>; Dark-GitLab — <https://github.com/vednoc/dark-gitlab>.
- Forgejo interface customisation — <https://forgejo.org/docs/latest/admin/advanced/customization/>.
- ForgeFed — <https://forgefed.org/>; F3; NLnet NGI Zero Entrust.
- `git-pkgs/forge` — <https://github.com/git-pkgs/forge> (MIT, 214★); `Leleat/git-forge`.
- GitLab GitHub importer — <https://docs.gitlab.com/ee/user/project/import/github>; `gh gl2gh` GA — github.blog changelog, 2026-08-03.
- awesome-browser-extensions-for-github — <https://github.com/stefanbuck/awesome-browser-extensions-for-github>.
