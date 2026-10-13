# NLnet NGI Zero — Restack Fund Application

**Project:** GitAlike — reducing forge lock-in through reciprocal UI portability
**Fund:** Restack (Open Internet Stack)
**Deadline:** November 3, 2026, 12:00 CET
**Requested amount:** €25,000
**Applicant:** Ranjith Raj (individual, India)
**Repository:** https://github.com/ranjithrajv/gitalike
**Project website:** https://gitalike.org

---

## 1. Proposal title

**GitAlike: Reducing forge lock-in through reciprocal UI portability for open internet infrastructure**

---

## 2. Project summary (max 1000 characters)

GitAlike is a browser extension that lets developers use any git hosting forge with the interface they already know — it re-skins GitHub as GitLab and GitLab as GitHub, reciprocally, covering vocabulary, navigation, reference markers, and keyboard shortcuts. It also supports Gitea/Forgejo, Bitbucket, and Gerrit. Everything runs locally: no network requests, no data collection, no remote code. The project directly reduces cognitive lock-in to a single forge, making it easier for developers and teams to migrate, collaborate across platforms, or self-host without re-learning interfaces. This grant would fund deeper skin parity, accessibility compliance, new forge coverage (Sourcehut), and a published interoperability specification for forge-agnostic UI adaptation.

---

## 3. Proposed effort and budget

### Requested amount: €25,000 over 12 months

| Task | Effort | Rate | Cost |
|------|--------|------|------|
| Skin parity completion (GitHub⇄GitLab⇄Bitbucket project + profile pages) | 3 months | €2000/month | €6,000 |
| Sourcehut skin (new forge coverage) | 2 months | €2000/month | €4,000 |
| Accessibility audit and WCAG 2.2 AA compliance (contrast, focus, ARIA, forced-colors) | 1.5 months | €2000/month | €3,000 |
| Interoperability specification: forge-agnostic UI adaptation API | 2 months | €2000/month | €4,000 |
| Automated parity testing infrastructure (visual regression, computed-style parity, semantic judge) | 2 months | €2000/month | €4,000 |
| Documentation: contributor guide, user documentation, migration guides | 1 month | €2000/month | €2,000 |
| Community engagement: Forgejo/Codeberg outreach, ForgeFed alignment, conference talks | 0.5 month | €2000/month | €1,000 |
| Project management, coordination, reporting | 0.5 month | €2000/month | €1,000 |
| **Total** | **12.5 months** | | **€25,000** |

**Rate justification:** €2,000/month is below the typical European freelance rate for senior browser-extension engineers (€5,000–10,000/month). This reflects the project's volunteer ethos and the applicant's location (India), where the cost of living makes this a fair and sustainable rate. NLnet's cost-recovery model is respected — we are not asking for commercial rates.

**No expenses:** All work is done on the applicant's own infrastructure. No travel, hardware, or infrastructure costs are requested.

---

## 4. Comparison with relevant efforts (max 4000 characters)

### Direct competitors and analogues

**GitSkin (gitsk.in):** The closest competitor — a GitHub-only skinning extension with a theme marketplace and CDN-delivered adapters. GitAlike differs fundamentally: (1) it is *reciprocal* (GitHub⇄GitLab), not one-way; (2) it runs entirely locally with no network access, while GitSkin fetches adapters from a CDN; (3) it covers semantic layers (vocabulary, navigation, markers, keyboard shortcuts), not just cosmetics; (4) it supports self-hosted instances (GitHub Enterprise, GitLab self-managed, Gitea, Gerrit). We have considered contributing a GitLab adapter to GitSkin, but their architecture is GitHub-centric and CDN-based, making a clean integration unlikely.

**Refined GitHub:** A 32k-star GitHub enhancer (MIT). It adds features to GitHub but does not change the underlying forge mental model. It is not reciprocal, not a skin, and makes network requests. GitAlike's category — reciprocal cross-forge UI portability — is distinct.

**Userstyles (Stylus, GitHub-Dark, Dark-GitLab):** The DIY substitute. These recolor but cannot change vocabulary, navigation, reference markers, or keyboard shortcuts. They also lack drift detection. GitAlike's daily selector canary and parity measurement system address a fundamentally harder problem.

**Multi-forge CLIs (git-pkgs/forge, gh/glab, magit/forge):** These unify forge *behavior* via API. GitAlike unifies *UI/muscle memory* via CSS and content scripts. They are complementary, not competing. A natural collaboration: "the CLI for the terminal, GitAlike for the browser."

**Official importers (GitLab GitHub importer, gh gl2gh):** These move *data* between forges. GitAlike moves *muscle memory*. The migration funnel is: importer moves the data, GitAlike keeps the team productive during and after migration.

**ForgeFed / F3:** A CC0 federation protocol, also NLnet NGI Zero-funded. ForgeFed addresses federation between forges. GitAlike addresses the UI layer that makes any forge feel like any other. Both attack forge lock-in at different layers.

**Old School GitHub:** A CSS-only reskin (238 stars, abandoned since 2024). Demonstrates the failure mode GitAlike is built against: brittle CSS with no drift detection decays quickly. GitAlike's daily canary and plugin architecture are the explicit countermeasure.

### What is new

No existing tool provides *reciprocal* cross-forge UI portability at the *semantic* layer (vocabulary, navigation, markers, shortcuts) with *no network access* and *self-hosted coverage*. The interoperability specification we propose — a documented API for forge-agnostic UI adaptation — would be the first of its kind, enabling other tools to build on the same foundation.

---

## 5. Technical challenges (max 4000 characters)

### 1. Upstream DOM churn
The hardest ongoing challenge. GitHub, GitLab, Bitbucket, Gitea, and Gerrit all change their markup frequently. GitAlike mitigates this with:
- A daily selector canary that fetches live pages and asserts CSS selectors still exist
- A plugin architecture where each skin/source is self-contained and independently testable
- A parity measurement system (3-layer: tokens, pixels, reference) that quantifies drift

The remaining challenge is *structural* changes (e.g., GitHub rebuilding its nav as a web component). The Sourcehut skin will face this acutely, as Sourcehut has a unique UI that maps poorly to either GitHub or GitLab.

### 2. Client-side reskinning limits
A browser extension can only change what the browser renders. It cannot:
- Rebuild a SPA's client-side routing
- Change the behavior of dynamic web components (e.g., GitLab's Vue-based dropdowns)
- Access closed shadow DOM without polyfills (Gerrit uses PolyGerrit with shadow roots)

We mitigate with shadow-DOM piercing scripts (gerrit-shadow-open.js), token re-pointing (overriding CSS custom properties), and progressive enhancement. The accessibility audit will push us to find workarounds for cases where current CSS-only approaches fall short.

### 3. Parity measurement subjectivity
Current parity scoring uses a combination of computed-style comparison and an independent semantic judge (LLM-based). The semantic judge introduces non-determinism. We plan to make this more rigorous by:
- Defining explicit per-page parity checklists
- Separating objective (computed styles, DOM structure) from subjective (semantic equivalence) scoring
- Publishing the rubric so reviewers can reproduce scores

### 4. Cross-browser consistency
The extension ships for Chrome, Firefox, Edge, and mobile (Firefox for Android, Kiwi for Android). Each browser has subtle differences in CSS custom property support, shadow DOM behavior, and extension API surface. The MV3/Firefox event-page split already handles the major differences, but visual parity across browsers remains a testing burden.

### 5. Balancing completeness vs. maintainability
Each new forge source or skin adds surface area that must be maintained against upstream changes. Sourcehut, for example, has a minimalist UI that may not benefit from a full skin — but even a partial skin requires ongoing selector maintenance. We need a principled framework for deciding when a skin is "good enough" vs. when it should be removed.

---

## 6. Ecosystem and engagement (max 2000 characters)

### Dependencies

GitAlike has **zero runtime dependencies**. The shipped extension uses only vanilla JavaScript and CSS. Build-time dependencies are Node.js stdlib only. Dev dependencies (oxlint, playwright-core, web-ext) are for testing and linting. This is a deliberate design choice: fewer supply-chain risks, easier auditing, and no dependency on external packages that could break or be compromised.

### Ecosystem relationships

- **Forgejo / Codeberg:** GitAlike already supports Gitea/Forgejo as a source. We plan to engage with the Forgejo community to offer our extension in their community lists and to align our Gitea token block with Forgejo's markup. Both are non-profit, FOSS-aligned organizations.
- **ForgeFed / F3:** We cite ForgeFed as ecosystem context and plan to align our interoperability specification with any emerging ForgeFed standards for forge metadata.
- **Multi-forge CLIs (git-pkgs/forge, git-forge):** Cross-linking and documentation collaboration. "CLI for the terminal, GitAlike for the browser."
- **GitSkin:** Potential adapter interop note. We share the same hard problem (upstream DOM churn) but solve it differently (static local vs. dynamic CDN).
- **Migrators (GitLab GitHub importer, gh gl2gh):** Documentation pairing — "the importer moves the data, GitAlike moves the muscle memory."
- **awesome-browser-extensions-for-github:** Discovery channel submission planned.

### Target users

1. **Cross-forge developers** who use both GitHub and GitLab (or more) and want one mental model
2. **Development teams** standardizing on one UI regardless of where each project lives
3. **Accessibility users** — developers with ADHD, autism, or other cognitive differences who benefit from predictable interfaces
4. **Self-hosters** — users of GitHub Enterprise Server, self-hosted GitLab, Bitbucket Data Center, or Gerrit
5. **Forge migrants** — teams moving between forges who want to preserve muscle memory during/after migration

---

## 7. Background and qualifications (max 2000 characters)

Ranjith Raj is a software engineer and open-source developer with deep experience in browser extension development, CSS architecture, and design systems. He built GitAlike from idea to a published, tested, documented browser extension (v0.1.3) with 172+ tests, 100% plugin coverage, CI/CD pipelines, nightly E2E tests, and daily selector canaries — all while maintaining zero runtime dependencies.

Prior work includes contributions to accessibility-focused tooling and design-token systems. The project's daily canary and parity measurement system demonstrates a rigorous, engineering-driven approach to the problem of upstream drift — a problem that has killed similar projects (Old School GitHub).

The project is licensed GPL-3.0-or-later, published on Chrome Web Store and addons.mozilla.org, and has a mature release/publishing pipeline with automated tests, lint, and store deployment.

---

## 8. Other funding sources (max 1000 characters)

GitAlike has **no other funding sources**. It is not monetized — no paid tiers, no sponsorships, no donations. The project is entirely self-funded through the applicant's personal time and resources. There are no plans for monetization; the GPL-3.0 license and the "no network, no data" design are core to the project's identity as a privacy-respecting accessibility tool.

NLnet NGI Zero / Restack would be the project's first external funding, enabling the applicant to dedicate sustained effort to completion rather than working on it in spare time.

---

## 9. European dimension

The applicant is based in India, which is not a Horizon Europe-eligible country. However, the project has a clear European dimension through:

1. **European users and beneficiaries:** GitAlike serves the European developer community, which is heavily affected by forge lock-in. European public administrations, SMEs, and research institutions increasingly rely on self-hosted forge infrastructure (GitLab self-managed, Gitea/Forgejo, Gerrit) and need tools that reduce switching costs.

2. **Alignment with European digital sovereignty goals:** The Restack fund explicitly targets "digital autonomy," "self-sustainability," and "permissionless innovation." GitAlike directly serves these goals by reducing cognitive lock-in to US-based proprietary forges (GitHub/Microsoft, GitLab Inc., Atlassian/Bitbucket). The interoperability specification we propose would be a public good that any European project can build upon.

3. **Ecosystem alignment with European-funded projects:** GitAlike complements ForgeFed (CC0, NLnet NGI Zero-funded) and supports Forgejo/Codeberg (European non-profit forges). The project's "no network, no data" design aligns with European privacy values (GDPR, Digital Markets Act).

4. **Open standards contribution:** The proposed interoperability specification would be published as an open standard, contributing to European and global interoperability norms — a stated goal of the NGI program.

5. **Willingness to collaborate with European partners:** The applicant is open to partnering with European developers or organizations who could serve as co-contributors, ensuring at least 60% of funds flow to European participants if required.

---

## 10. AI disclosure

**Did you use generative AI in writing this proposal?** Yes, partially.

The applicant used an AI assistant (OpenCode / LongCat 2.5) to help structure and draft this proposal. The AI was used for:
- Organizing the proposal according to the Restack application form structure
- Drafting initial text for each section based on project documentation
- Researching the NLnet NGI Zero program requirements

All technical claims, project details, and strategic assessments were verified and approved by the applicant. The AI-generated text was edited and refined by the applicant. The core ideas, project vision, and technical approach are entirely the applicant's own.

The applicant did **not** use AI to generate code, fabricate test results, or misrepresent the project's capabilities. All claims in this proposal are verifiable against the public repository at https://github.com/ranjithrajv/gitalike.

---

## 11. Sustainability plan

After the grant period, GitAlike will continue as a community-maintained open-source project:

- **The codebase is self-hosting-ready:** The plugin architecture and parity measurement system are designed for community contributors to add new forges or improve existing skins.
- **The interoperability specification** will be published as an open standard, enabling other projects to build on our work even if GitAlike itself is not maintained.
- **The daily canary and CI/CD pipeline** ensure that the project remains healthy with minimal manual intervention.
- **The project's zero-dependency, no-network design** means there are no hosting costs, no server infrastructure, and no ongoing maintenance burden beyond selector updates.
- **Community engagement** through Forgejo/Codeberg, conference talks, and cross-linking with complementary projects will build a contributor base that can sustain the project beyond the grant period.

The applicant is committed to maintaining the project for the foreseeable future, with or without additional funding. This grant would accelerate development and enable a higher level of polish and completeness, but the project will not cease to exist if no further funding is obtained.

---

## 12. Deliverables and timeline

| Milestone | Deliverable | Target date |
|-----------|-------------|-------------|
| M1 | Skin parity completion: GitHub⇄GitLab⇄Bitbucket project + profile pages reach 9.5+ parity | Month 3 |
| M2 | Sourcehut skin beta: functional skin for Sourcehut project pages | Month 5 |
| M3 | Accessibility audit report: WCAG 2.2 AA compliance, contrast fixes, ARIA labels, forced-colors support | Month 6 |
| M4 | Interoperability specification v1.0: documented API for forge-agnostic UI adaptation, published as open standard | Month 8 |
| M5 | Automated parity testing: visual regression suite, computed-style parity, deterministic semantic judge | Month 10 |
| M6 | Documentation: contributor guide, user documentation, migration guides, API reference | Month 11 |
| M7 | Community launch: Forgejo/Codeberg outreach, conference talks, cross-project documentation | Month 12 |

All deliverables will be published under GPL-3.0-or-later (code) and CC-BY-SA-4.0 (documentation/specification) at https://github.com/ranjithrajv/gitalike.

---

## 13. Contact information

- **Name:** Ranjith Raj
- **Email:** ranjithraj@riseup.net
- **Type of applicant:** Individual
- **Country:** India
- **Repository:** https://github.com/ranjithrajv/gitalike
- **Project website:** https://gitalike.org
