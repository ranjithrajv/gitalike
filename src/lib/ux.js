/**
 * gitalike — the UX tables.
 *
 * The skin is not only colour: the point of gitalike is that a GitHub site
 * *reads* like GitLab (and the other way round), so this file carries the
 * vocabulary, reference and keyboard differences between the two products.
 *
 * It is pure data plus side-effect-free helpers, published on
 * `globalThis.GITALIKE_UX` so the content script and the unit tests share one
 * source of truth. No DOM is touched here; `content/ux.js` does that.
 *
 * Every table is keyed by the theme being *applied*:
 *
 *   'gitlab'  a GitHub-flavoured site shown with the GitLab UI
 *               -> GitHub's words become GitLab's
 *   'github'  a GitLab-flavoured site shown with the GitHub UI
 *               -> GitLab's words become GitHub's
 */
(() => {
  'use strict';

  /* ------------------------------------------------------- terminology -- */

  // Multi-word copy, safe to fix up wherever it appears in normal page text
  // (outside code, inputs and editable regions). Longest key wins, so
  // "Pull requests" is rewritten before "Pull request".
  const PHRASES = {
    gitlab: {
      'Pull requests': 'Merge requests',
      'Pull request': 'Merge request',
      'pull requests': 'merge requests',
      'pull request': 'merge request',
      'Go to file': 'Find file',
      Gists: 'Snippets',
      Gist: 'Snippet',
      Insights: 'Analytics',
      Codespaces: 'Workspaces',
      'GitHub Actions': 'CI/CD',
      Dependabot: 'Dependency scanning',
    },
    github: {
      'Merge requests': 'Pull requests',
      'Merge request': 'Pull request',
      'merge requests': 'pull requests',
      'merge request': 'pull request',
      'Find file': 'Go to file',
      Snippets: 'Gists',
      Snippet: 'Gist',
      Analytics: 'Insights',
      Workspaces: 'Codespaces',
      'CI/CD': 'Actions',
      'Dependency scanning': 'Dependabot',
    },
    // Bitbucket is a target only: its table maps each source product's words onto
    // Bitbucket's. GitHub and Gitea say "Pull request"/"Actions"; GitLab says
    // "Merge request"/"CI/CD". Both read Bitbucket's way after this.
    bitbucket: {
      'Merge requests': 'Pull requests',
      'Merge request': 'Pull request',
      'merge requests': 'pull requests',
      'merge request': 'pull request',
      'GitHub Actions': 'Pipelines',
      'CI/CD': 'Pipelines',
      Gists: 'Snippets',
      Gist: 'Snippet',
    },
  };

  // Short app-navigation labels. These are only replaced when an element's
  // *whole* trimmed label matches, and only inside a navigation region — so a
  // bare "Actions" in a marketing menu can never be rewritten to "CI/CD".
  const NAV = {
    gitlab: {
      Code: 'Repository',
      Actions: 'CI/CD',
      Issues: 'Work items',
      'Pull requests': 'Merge requests',
      Insights: 'Analytics',
      Projects: 'Issue boards',
      // A Bitbucket source's repository bar.
      Source: 'Repository',
      Pipelines: 'CI/CD',
      'Jira issues': 'Work items',
    },
    github: {
      Repository: 'Code',
      'CI/CD': 'Actions',
      'Work items': 'Issues',
      Pipelines: 'Actions',
      'Merge requests': 'Pull requests',
      Analytics: 'Insights',
      'Issue boards': 'Projects',
      // A Bitbucket source's repository bar.
      Source: 'Code',
      'Jira issues': 'Issues',
    },
    // Bitbucket's repo tabs. GitHub/Gitea say "Code"/"Actions"; GitLab says
    // "Repository"/"CI/CD"; all become "Source"/"Pipelines". Issues live in Jira
    // in Bitbucket's model, so they read "Jira issues".
    bitbucket: {
      Code: 'Source',
      Repository: 'Source',
      Actions: 'Pipelines',
      'CI/CD': 'Pipelines',
      'Merge requests': 'Pull requests',
      Issues: 'Jira issues',
      'Work items': 'Jira issues',
    },
  };

  // Bitbucket Cloud's repository bar, by its displayed labels. Its classes are
  // hashed, so a pass finds the bar by content — the ancestor holding the most
  // of these — rather than by a selector that would rot. Both the source's own
  // words and the applied product's are listed: the copy pass relabels some of
  // them before this runs.
  const BITBUCKET_NAV_WORDS = [
    'Source',
    'Repository',
    'Code',
    'Commits',
    'Branches',
    'Pull requests',
    'Merge requests',
    'Pipelines',
    'CI/CD',
    'Actions',
    'Deployments',
    'Jira issues',
    'Issues',
    'Work items',
    'Security',
    'Downloads',
  ];

  // Exact labels on *controls* — buttons, menu items, tabs, links — that name a
  // GitHub/GitLab feature differently but should never be rewritten in prose.
  // Kept apart from PHRASES because "Merge" and "Rebase" are ordinary words:
  // scoping to a control's whole label is what makes them safe. Every entry
  // round-trips with its counterpart in the other direction.
  const LABELS = {
    gitlab: {
      'Merge pull request': 'Merge',
      'Squash and merge': 'Squash commits',
      'Rebase and merge': 'Rebase',
      'Security and quality': 'Security',
    },
    github: {
      Merge: 'Merge pull request',
      'Squash commits': 'Squash and merge',
      Rebase: 'Rebase and merge',
      Security: 'Security and quality',
    },
    // Bitbucket's merge controls. Every source word maps to Bitbucket's own.
    bitbucket: {
      'Merge pull request': 'Merge',
      'Squash and merge': 'Squash',
      'Squash commits': 'Squash',
      'Rebase and merge': 'Rebase',
      'Security and quality': 'Security',
    },
  };

  // Elements whose whole label the LABELS table may replace.
  const LABEL_SCOPE = [
    'a',
    'button',
    'summary',
    'label',
    '[role="button"]',
    '[role="tab"]',
    '[role="menuitem"]',
  ].join(',');

  // Account/menu chrome, where the two products name the same thing differently
  // but the wording is too generic to translate in prose (a bare "Settings"
  // means the repo tab, not preferences). Like LABELS, whole control labels
  // only, and every pair round-trips.
  const CHROME = {
    gitlab: {
      'Your repositories': 'Your projects',
      'Your gists': 'Your snippets',
      'Your stars': 'Starred projects',
      'Your organizations': 'Your groups',
    },
    github: {
      'Your projects': 'Your repositories',
      'Your snippets': 'Your gists',
      'Starred projects': 'Your stars',
      'Your groups': 'Your organizations',
    },
    // Bitbucket's account chrome. Its account menu is "Your work"; groups are
    // Atlassian "Workspaces"; gists live under Snippets.
    bitbucket: {
      'Your repositories': 'Your work',
      'Your projects': 'Your work',
      'Your gists': 'Snippets',
      'Your snippets': 'Snippets',
      'Your stars': 'Your starred',
      'Starred projects': 'Your starred',
      'Your organizations': 'Your workspaces',
      'Your groups': 'Your workspaces',
    },
  };

  // Regions whose labels the NAV table is allowed to touch. Verified against
  // the live sites: GitHub's repo tabs live in `nav[aria-label="Repository"]`;
  // GitLab's project navigation is the `.super-sidebar`; Gitea/Forgejo (Codeberg,
  // gitea.com) put their repo tabs in an `overflow-menu` custom element.
  const NAV_SCOPE = [
    'nav[aria-label="Repository"]',
    '.js-repo-nav',
    '.super-sidebar',
    '[data-testid="super-sidebar"]',
    '.nav-sidebar',
    'nav[aria-label="Project navigation"]',
    'overflow-menu',
  ].join(',');

  // The global top bar, both products' logged-out marketing header and the
  // signed-in app bars. A separate scope from NAV_SCOPE because the top bar's
  // words are handled differently (see TOPBAR_HIDE).
  const TOPBAR_SCOPE = [
    'header[role="banner"]',
    '.js-header-wrapper',
    'header.navigation',
    'header.super-topbar',
    'header.GlobalNav',
    'header[aria-label="Global navigation menu"]',
    '.navbar-gitlab',
    '.header-content',
    '.super-topbar',
    '.AppHeader',
  ].join(',');

  // The source-only words in the global top bar, keyed by the skin being
  // applied. The applied product's own bar carries the same top-level words
  // both products now use — "Platform", "Solutions", "Resources", "Pricing" —
  // so only the words it does *not* carry are listed. There is no counterpart
  // to translate a marketing link to, so these are hidden rather than relabelled
  // (whole-label match inside TOPBAR_SCOPE, so an "Enterprise" in page prose is
  // untouched). GitLab's older logged-out bar showed more source-only words;
  // the shared ones are deliberately not hidden, or the applied product's own
  // wording would go with them.
  const TOPBAR_HIDE = {
    // A GitHub source shown as GitLab: GitHub's "Open Source" and "Enterprise"
    // links and its "Sign up" CTA have no GitLab counterpart.
    gitlab: ['Open Source', 'Enterprise', 'Sign up'],
    // A GitLab source shown as GitHub: GitLab's "Why GitLab" and "Explore"
    // links and its "Get free trial" CTA have no GitHub counterpart.
    github: ['Why GitLab', 'Explore', 'Get free trial'],
  };

  // Desired left-to-right / top-to-bottom order of the app navigation, using
  // the *displayed* labels after translation. Items that are not present are
  // skipped; unrecognised items keep their relative order at the end. Only the
  // items are moved, into the slots they already occupy, so children we do not
  // understand stay put.
  //
  // GitHub's repo tabs are a flat `ul.UnderlineNav-body`, so they can be
  // reordered. GitLab's project navigation is a nested group tree — each group
  // is its own `ul` — so there is no single flat list to reorder; the one group
  // that maps onto GitHub's repo tabs, the repository ("Code") group, is
  // reordered in place. A rule with `scope` + `contains` resolves its container
  // at runtime (the group whose children include that exact label).
  // GitLab's sidebar order: Manage, Plan, Code, Build, Deploy, Monitor, Analyze,
  // then Settings. Shared by the GitHub tab bar and Gitea's `overflow-menu`, so
  // the two sources cannot drift. Labels a source does not have simply rank
  // after the known ones, so one list fits both.
  const GITLAB_REPO_ORDER = [
    'Members',
    'Work items',
    'Issue boards',
    'Wiki',
    'Milestones',
    'Labels',
    'Merge requests',
    'Repository',
    'Branches',
    'Commits',
    'Tags',
    'CI/CD',
    'Releases',
    'Packages',
    'Environments',
    'Incidents',
    'Analytics',
    'Security',
    'Settings',
  ];

  // GitHub's repo tab order, shared by GitLab's sidebar (shown as GitHub) and
  // Gitea's tab bar (shown as GitHub), so the two cannot drift.
  const GITHUB_REPO_ORDER = [
    'Code',
    'Issues',
    'Pull requests',
    'Actions',
    'Projects',
    'Wiki',
    'Security',
    'Insights',
  ];

  // Bitbucket's repo tab order, in Bitbucket's displayed labels. Verified
  // against an archived Bitbucket repository page's own menu model (Source,
  // Commits, Branches, Pull requests, Pipelines, Deployments, Jira issues,
  // Security, Downloads) — there is no repo Wiki or Settings tab.
  const BITBUCKET_REPO_ORDER = [
    'Source',
    'Commits',
    'Branches',
    'Pull requests',
    'Pipelines',
    'Deployments',
    'Jira issues',
    'Security',
    'Downloads',
  ];

  const NAV_RULES = {
    gitlab: [
      {
        source: 'github',
        container: 'nav[aria-label="Repository"] ul.UnderlineNav-body',
        item: 'li',
        order: GITLAB_REPO_ORDER,
      },
      {
        // Gitea/Forgejo (Codeberg, gitea.com) repo tabs: a flat `overflow-menu`
        // list of `a.item`s, so they take GitLab's order the same way.
        source: 'gitea',
        container: 'overflow-menu .overflow-menu-items',
        item: 'a.item',
        order: GITLAB_REPO_ORDER,
      },
    ],
    github: [
      {
        source: 'gitlab',
        scope: '.super-sidebar',
        contains: 'Code',
        item: 'li',
        order: GITHUB_REPO_ORDER,
      },
      {
        // Gitea/Forgejo repo tabs, shown with the GitHub UI. Its labels already
        // read GitHub's ("Code", "Issues", "Pull requests"), so the order does
        // most of the work; unknown labels rank after the known ones.
        source: 'gitea',
        container: 'overflow-menu .overflow-menu-items',
        item: 'a.item',
        order: GITHUB_REPO_ORDER,
      },
    ],
    bitbucket: [
      {
        // GitLab's project sidebar, shown as Bitbucket. Its repository group is
        // resolved by the *displayed* label: NAV renames Repository/Code to
        // Source first, so the container is the group that holds "Source", and
        // it is reordered to Bitbucket's tabs in place.
        source: 'gitlab',
        scope: '.super-sidebar',
        contains: 'Source',
        item: 'li',
        order: BITBUCKET_REPO_ORDER,
      },
      {
        source: 'github',
        container: 'nav[aria-label="Repository"] ul.UnderlineNav-body',
        item: 'li',
        order: BITBUCKET_REPO_ORDER,
      },
      {
        source: 'gitea',
        container: 'overflow-menu .overflow-menu-items',
        item: 'a.item',
        order: BITBUCKET_REPO_ORDER,
      },
    ],
  };

  // The GitLab project sidebar groups its items (Plan, Code, Build, …). GitHub's
  // repo tabs are flat, so on the GitLab skin they are gathered under the same
  // group headings, using the *displayed* label (after translation). An item not
  // listed here stands alone, with no heading.
  //
  // Keyed by *skin*: only GitLab groups its sidebar. GitHub and Bitbucket are
  // flat, so a skin that shares GitLab's layout (Bitbucket) does not inherit its
  // headings. `paintNavGroups` and `repoNav` both look this up by skin.
  const NAV_GROUPS = {
    gitlab: {
      Members: 'Manage',
      'Work items': 'Plan',
      'Issue boards': 'Plan',
      Wiki: 'Plan',
      Milestones: 'Plan',
      Labels: 'Plan',
      'Merge requests': 'Code',
      Repository: 'Code',
      Branches: 'Code',
      Commits: 'Code',
      Tags: 'Code',
      'CI/CD': 'Build',
      Releases: 'Deploy',
      Packages: 'Deploy',
      Environments: 'Deploy',
      Incidents: 'Monitor',
      Analytics: 'Analyze',
      Security: 'Secure',
    },
  };

  // Menu items the *applied* product has no page for, by their displayed label
  // (after translation). They are hidden rather than marked, so the navigation
  // is the applied product's menu and not a mix of both.
  //
  // Superseded by NAV_KEEP: where a skin has a keep-list, `paintNavHide` uses it
  // *instead of* this hide-list, so a hide-list entry for a kept skin would do
  // nothing. Add to the keep-list, not here, for a skin that has one.
  const NAV_HIDE = {
    // GitLab's sidebar items with no GitHub counterpart.
    github: [
      'Feature catalog',
      'Activity',
      'Epics',
      'Iterations',
      'Requirements',
      'Test cases',
      'Artifacts',
      'Terraform modules',
      'Model registry',
      'Model experiments',
      'Service Desk',
      'Incidents',
      'Error tracking',
      'On-call schedules',
      'Alert management',
      'Value stream analytics',
      'Pipeline schedules',
      'Locked files',
      'Repository graph',
      'Compare revisions',
    ],
    // GitHub's items with no GitLab counterpart.
    gitlab: ['Discussions', 'Sponsors', 'Marketplace'],
  };

  // On some skins the menu is a *whitelist*: only the applied product's own
  // project-page options are shown, so the navigation is that product's menu
  // exactly rather than the source product's menu with a few items hidden.
  // These are GitHub's repo tabs, after translation.
  //
  // A keep-list supersedes NAV_HIDE for its skin: `paintNavHide` reads one or
  // the other, never both, so a skin with a keep-list must list everything it
  // wants shown here (anything unlisted is hidden, NAV_HIDE notwithstanding).
  const NAV_KEEP = {
    github: [
      'Code',
      'Issues',
      'Pull requests',
      'Actions',
      'Projects',
      'Wiki',
      'Security',
      'Insights',
      'Settings',
    ],
    // Bitbucket's own repo tabs; anything else the source shows (Projects,
    // Insights, Wiki, Releases, Activity, …) is hidden rather than relabelled.
    bitbucket: [
      'Source',
      'Commits',
      'Branches',
      'Pull requests',
      'Pipelines',
      'Deployments',
      'Jira issues',
      'Security',
      'Downloads',
    ],
  };

  /* ---------------------------------------------------------- selectors -- */

  // Every forge-specific DOM hook the skin relies on, in one home keyed by the
  // markup a site is built on (its `source`, see sites.js `sourceFor`) — not by
  // the skin applied to it, because a Gitea site wears either UI but keeps
  // Gitea's markup. `src/content/ux.js` reads these instead of carrying
  // literals, and `tools/compare/selector-canary.mjs` probes the same entries against
  // the live forges, so a renamed hook is one edit and one failing check,
  // rather than a literal to hunt through three files.
  //
  // The stylesheets still spell their selectors out — CSS cannot read this
  // table — so an entry a stylesheet owns is marked `// css`; when a rule moves,
  // update the theme file and the entry together. An entry a stylesheet or the
  // canary owns but content/ux.js does not is still listed, so the canary has
  // one table to probe.
  const SELECTORS = {
    // GitHub's markup (Primer).
    github: {
      repoNavList: 'nav[aria-label="Repository"] ul.UnderlineNav-body', // css
      appHeader: 'header[role="banner"], .AppHeader', // css
      metadataSidebar: '[class*="CodeViewSidebar-"]',
      metadataPane: '[class*="PageLayoutContent-"]', // css
      profileNav: 'nav[aria-label="User profile"]', // css
      profileMenu: 'nav[aria-label="User profile"]',
      profileFrame: 'div[data-turbo-frame="user-profile-frame"]', // css
      profileEditable: '.js-profile-editable-replace',
      profileDetail: '.vcard-detail',
      profileOrg: '[itemprop="worksFor"], .p-org',
      profileLocation: '[itemprop="homeLocation"], .p-label',
      profileName: '.h-card .p-name',
    },
    // GitLab's markup (Pajamas, plus its older CSS).
    gitlab: {
      superSidebar: '.super-sidebar', // css
      navContainer: '[data-testid="nav-container"]',
      projectFiles: '.project-show-files',
      projectSidebarBlock: '.project-page-sidebar-block',
      projectLayoutSidebar: '.project-page-layout-sidebar',
      profileHeader: '.user-profile-header', // css
      profileIdentity: '.user-profile-header > div:last-child',
      profileSidebar: '.user-profile-sidebar', // css
      profileName: '.user-profile-header h1',
      profileMenu: '.super-sidebar .gl-scroll-scrim ul',
      followersLink: '.super-sidebar a[data-track-label="followers_menu"]',
      followingLink: '.super-sidebar a[data-track-label="following_menu"]',
    },
    // Gitea / Forgejo's markup (Codeberg, gitea.com). Its navigation hooks also
    // live in NAV_RULES; a test asserts the two stay equal.
    gitea: {
      repoNavList: 'overflow-menu .overflow-menu-items',
      repoMenu: '.page-content.repository > .secondary-nav > overflow-menu',
      themeMarker: '[data-theme]', // css
      topBar: '#navbar', // css
      repoHeader: '.repo-header', // css
      pullLink: 'a[href*="/pulls/"]',
    },
  };

  // The live pages `tools/compare/selector-canary.mjs` fetches and the landmarks each
  // must still carry. A key names a `SELECTORS[source]` entry; the canary turns
  // that selector into a loose token match, so the hooks it checks and the
  // hooks the skin uses can never drift. A page that cannot be fetched is a
  // warning, never a failure — an outage should not look like a rename.
  const CANARY_PAGES = [
    {
      name: 'GitHub repository page',
      url: 'https://github.com/git/git',
      source: 'github',
      keys: ['repoNavList', 'metadataSidebar', 'metadataPane', 'appHeader'],
    },
    {
      name: 'GitHub profile page',
      url: 'https://github.com/torvalds',
      source: 'github',
      keys: ['profileNav', 'profileFrame'],
    },
    {
      name: 'GitLab project page',
      url: 'https://gitlab.com/gitlab-org/gitlab',
      source: 'gitlab',
      keys: ['superSidebar', 'projectSidebarBlock'],
    },
    {
      name: 'GitLab profile page',
      url: 'https://gitlab.com/dzaporozhets',
      source: 'gitlab',
      keys: ['superSidebar', 'profileHeader', 'profileSidebar'],
    },
    {
      name: 'Codeberg (Forgejo) project page',
      url: 'https://codeberg.org/forgejo/forgejo',
      source: 'gitea',
      keys: ['themeMarker', 'topBar', 'repoHeader', 'repoNavList', 'repoMenu'],
    },
    {
      name: 'Codeberg (Forgejo) pull requests',
      url: 'https://codeberg.org/forgejo/forgejo/pulls',
      source: 'gitea',
      keys: ['themeMarker', 'pullLink'],
    },
  ];

  /* ---------------------------------------------------------- shortcuts -- */

  // Two-key `g` combos. Keyed by the theme being applied; each entry maps the
  // combo a user *sees* (the product on screen) to the combo the underlying
  // site actually implements. Only unambiguous pairs are listed — anything
  // else is left to the site.
  //
  //   on a GitHub site shown as GitLab:  g m (merge requests) -> GitHub g p
  //   on a GitLab site shown as GitHub:  g p (pull requests)  -> GitLab g m
  const SHORTCUTS = {
    gitlab: { gm: 'gp', gp: 'gb', gt: 'gn' },
    github: { gp: 'gm', gb: 'gp', gn: 'gt' },
  };

  // Some sites ignore synthetic key events (`event.isTrusted` is false), so the
  // combo cannot be replayed into them. Where the destination has a real
  // navigation link, deliver the shortcut as a click on that link instead —
  // a trusted navigation the site always honours. Keyed by theme + combo, with
  // the *displayed* label (after translation) to look for.
  const SHORTCUT_TARGETS = {
    gitlab: {},
    github: { gp: 'Pull requests', gb: 'Projects' },
  };

  /* ------------------------------------------------------- no counterpart -- */

  // Features that exist in one product but have no counterpart in the other.
  // Keyed by the theme being applied, with the product that *lacks* the feature
  // as the value, so the UI can say so instead of pretending it exists. These
  // are deliberately absent from PHRASES/NAV/LABELS — there is nothing to
  // translate them to.
  const UNMAPPED = {
    gitlab: {
      Discussions: 'GitLab',
      Sponsors: 'GitLab',
      Marketplace: 'GitLab',
    },
    github: {
      'Feature catalog': 'GitHub',
      Activity: 'GitHub',
      Epics: 'GitHub',
      Iterations: 'GitHub',
      Requirements: 'GitHub',
      'Service Desk': 'GitHub',
      'Merge trains': 'GitHub',
      'Feature flags': 'GitHub',
      'Terraform modules': 'GitHub',
      'Model registry': 'GitHub',
      'Model experiments': 'GitHub',
      'Test cases': 'GitHub',
      Incidents: 'GitHub',
      'Error tracking': 'GitHub',
      'On-call schedules': 'GitHub',
      'Alert management': 'GitHub',
      'Value stream analytics': 'GitHub',
    },
    // Features Bitbucket has no page for, from either source. Bitbucket's own
    // vocabulary ("Source", "Pipelines") is mapped in NAV/PHRASES, so only the
    // genuinely absent ones are marked.
    bitbucket: {
      // GitHub-only
      Discussions: 'Bitbucket',
      Sponsors: 'Bitbucket',
      Codespaces: 'Bitbucket',
      Marketplace: 'Bitbucket',
      // GitLab-only
      Epics: 'Bitbucket',
      Iterations: 'Bitbucket',
      Requirements: 'Bitbucket',
      'Service Desk': 'Bitbucket',
      'Merge trains': 'Bitbucket',
      'Feature flags': 'Bitbucket',
      'Terraform modules': 'Bitbucket',
      'Model registry': 'Bitbucket',
      'Model experiments': 'Bitbucket',
      'Test cases': 'Bitbucket',
      Incidents: 'Bitbucket',
      'Error tracking': 'Bitbucket',
      'On-call schedules': 'Bitbucket',
      'Alert management': 'Bitbucket',
      'Value stream analytics': 'Bitbucket',
      'Issue boards': 'Bitbucket',
      Analytics: 'Bitbucket',
    },
  };

  /* ------------------------------------------------------ pure helpers -- */

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Compile each theme's phrases into one alternation, longest key first. JS
  // tries the alternatives left to right at a given position, so the longest
  // phrase still wins; the whole string is scanned once rather than once per
  // phrase. The replacement is looked up in the map, so a rewritten phrase is
  // never fed back through another rule.
  const compiled = {};
  function rulesFor(theme) {
    if (!compiled[theme]) {
      const map = PHRASES[theme] || {};
      const keys = Object.keys(map).sort((a, b) => b.length - a.length);
      compiled[theme] = keys.length
        ? [
            new RegExp(
              `(?<![\\p{L}\\p{N}])(?:${keys.map(escapeRe).join('|')})(?![\\p{L}\\p{N}])`,
              'gu',
            ),
            map,
          ]
        : [null, map];
    }
    return compiled[theme];
  }

  /** Rewrite one string of page copy for the given theme. Never partial-word. */
  function translate(text, theme) {
    if (!text) return text;
    const [re, map] = rulesFor(theme);
    if (!re) return text;
    return text.replace(re, (match) => map[match]);
  }

  // An own-property lookup that treats a prototype key ("constructor") as a
  // miss, so a label can never match inherited state. Shared by every exact
  // table so the guard is written once.
  function lookup(map, label) {
    return map && Object.prototype.hasOwnProperty.call(map, label)
      ? map[label]
      : null;
  }

  /**
   * The exact replacement for a control's whole label — the LABELS/CHROME word
   * for it — or null when no whole label matches.
   *
   * Callers must test the *original* label with this before falling back to
   * `translate`: if phrase translation runs first, a label that contains a
   * phrase ("Merge pull request") is mangled to "Merge merge request" and the
   * exact entry can no longer be found.
   */
  function controlLabel(label, theme) {
    return lookup(LABELS[theme], label) ?? lookup(CHROME[theme], label);
  }

  /** Translate a control's whole label: exact words first, then copy. */
  function translateControl(label, theme) {
    return controlLabel(label, theme) ?? translate(label, theme);
  }

  /** The product that lacks this feature, or null if it has a counterpart. */
  function noEquivalentFor(label, theme) {
    return lookup(UNMAPPED[theme], label);
  }

  /**
   * The reference marker a link should show for the given theme. A GitHub
   * `/pull/N` or GitLab `/-/merge_requests/N` link becomes `!N` under the
   * GitLab UI and `#N` under the GitHub UI. Gitea/Forgejo use `/pulls/N` and
   * Bitbucket `/pull-requests/N`, so both are matched too. Anything else
   * (issues, files) returns null and is left alone.
   */
  function refMarker(href, theme) {
    if (!href) return null;
    const match = String(href).match(
      /\/(?:pulls?|pull-requests|merge_requests)\/(\d+)(?:[/?#]|$)/,
    );
    if (!match) return null;
    return (theme === 'gitlab' ? '!' : '#') + match[1];
  }

  /**
   * A nav label with its counter removed. Each forge renders the count its own
   * way: GitLab "Pull requests 387" (and "-" when the count is empty), GitHub
   * "Issues 5k+", Gitea "Issues1.5k" with no separator between the two at all.
   * Only a trailing counter goes — extra *words* stay, so "Actions analytics"
   * keeps them and is still not "Actions".
   */
  function withoutCounter(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s*(?:[\d,.]+[kKmM]?\+?|-)$/, '');
  }

  /** Does a control's text match a whole label, counter and all? */
  function labelMatches(text, label) {
    return withoutCounter(text) === label;
  }

  /** The group heading a nav item belongs under for a layout, or null. */
  function navGroupFor(label, layout) {
    const map = NAV_GROUPS[layout];
    if (!map) return null;
    for (const [key, group] of Object.entries(map)) {
      if (labelMatches(label, key)) return group;
    }
    return null;
  }

  /** Does the applied product have no page for this nav item? */
  function navHidden(label, theme) {
    const list = NAV_HIDE[theme];
    if (!list) return false;
    return list.some((key) => labelMatches(label, key));
  }

  /**
   * Is this nav item one the applied product's own project menu shows? True when
   * the theme has no whitelist (then everything is kept). The counter is taken
   * off by `withoutCounter`, so every forge's spelling of it is kept — including
   * Gitea's "Issues1.5k", which has no separator — while extra *words* are not a
   * counter, so "Actions analytics" still does not count as "Actions".
   */
  function navKeep(label, theme) {
    const list = NAV_KEEP[theme];
    if (!list) return true;
    return list.includes(withoutCounter(label));
  }

  /**
   * Indices of `labels`, arranged by their position in `order` (stable for
   * equal ranks). Prefix matching means a label carrying a counter
   * ("Pull requests 387") still ranks. Unknown labels sort after the known
   * ones, in their original relative order.
   */
  function orderIndexes(labels, order) {
    const rank = (label) => {
      for (let i = 0; i < order.length; i += 1) {
        if (label.startsWith(order[i])) return i;
      }
      return order.length;
    };
    return labels
      .map((label, index) => ({ index, rank: rank(label) }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map((entry) => entry.index);
  }

  /* ---------------------------------------------- pure view decisions -- */

  // The GitLab pages that map onto a GitHub repo tab, keyed by GitLab's
  // `body[data-page]`, so the tab the applied UI would underline can be picked
  // without a page. Pure, so it is unit-tested rather than only seen live.
  const ACTIVE_TABS = [
    [
      /^projects:(show|tree|blob|commits|compare|branches|tags|forks|network)\b/,
      'Code',
    ],
    [/^projects:work_items\b/, 'Issues'],
    [/^projects:merge_requests\b/, 'Pull requests'],
    [/^projects:(pipelines|jobs|builds|ci)\b/, 'Actions'],
    [/^projects:boards\b/, 'Projects'],
    [/^projects:(security|vulnerabilities)\b/, 'Security and quality'],
    [/^projects:wikis\b/, 'Wiki'],
    [/^projects:(insights|analytics)\b/, 'Insights'],
  ];

  /**
   * The repo tab a GitLab page should mark active, in the *applied* product's
   * words: the table maps to GitHub's label, then `NAV` renames it for the skin
   * (Code → Source, Actions → Pipelines for Bitbucket).
   */
  function activeTabFor(page, target = 'github') {
    const rule = ACTIVE_TABS.find(([re]) => re.test(String(page || '')));
    if (!rule) return null;
    const label = rule[1];
    return (NAV[target] && NAV[target][label]) || label;
  }

  // GitHub puts a counter inside a metadata section heading ("Releases240
  // (240)"), so the digits and their brackets are stripped before the label is
  // compared.
  const sectionLabelText = (text) =>
    String(text || '')
      .replace(/[\d,()]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // GitHub's About sections that GitLab's "Project information" block does not
  // list, matched by `sectionLabelText`.
  const METADATA_HIDE = [
    'Releases',
    'Packages',
    'Used by',
    'Contributors',
    'Languages',
  ];

  // GitHub's repo tabs for a GitLab project, in GitHub's order. `hrefs` carries
  // the links GitLab actually renders (found by label); a tab GitLab omits is
  // synthesised from `base`. Pure, so the tab set is testable without a page.
  // The repo tabs an applied product shows on a project page, emitted as
  // [label, href] in that product's order. `hrefs` carries the links the source
  // actually renders (found by label); a tab the source omits is synthesised
  // from `base`. GitLab's routes are the target because this rebuilds a *GitLab*
  // project page, whichever skin is applied.
  const PROJECT_TABS = {
    github: (base, hrefs) => [
      ['Code', hrefs.code || base],
      ['Issues', hrefs.issues || `${base}/-/work_items`],
      ['Pull requests', hrefs.pullRequests || `${base}/-/merge_requests`],
      ['Actions', hrefs.actions || `${base}/-/pipelines`],
      ['Projects', hrefs.projects || `${base}/-/boards`],
      ['Wiki', `${base}/-/wikis/home`],
      ['Security and quality', `${base}/-/security/dashboard`],
      ['Insights', hrefs.insights || `${base}/-/analytics`],
    ],
    bitbucket: (base, hrefs) => [
      ['Source', hrefs.code || base],
      ['Commits', `${base}/-/commits`],
      ['Branches', `${base}/-/branches`],
      ['Pull requests', hrefs.pullRequests || `${base}/-/merge_requests`],
      ['Pipelines', hrefs.actions || `${base}/-/pipelines`],
      ['Deployments', `${base}/-/environments`],
      ['Jira issues', hrefs.issues || `${base}/-/issues`],
      ['Security', `${base}/-/security/dashboard`],
      ['Downloads', `${base}/-/tags`],
    ],
  };

  /** The repo tabs `target` shows on a GitLab project page. */
  function projectTabs(base, hrefs = {}, target = 'github') {
    const build = PROJECT_TABS[target] || PROJECT_TABS.github;
    return build(base, hrefs);
  }

  // GitHub's profile tabs (source: GitLab) and GitLab's profile destinations
  // (source: GitHub), each in the applied product's order. The third element
  // names the item already on the page to reuse — `@first` is its first anchor,
  // a label is matched by `labelMatches`, null synthesises one. Pure, so both
  // menus are pinned by tests instead of only by a live profile.
  const PROFILE_MENU = {
    github: (u) => [
      ['Overview', `/${u}`, '@first'],
      ['Repositories', `/users/${u}/projects`, 'Personal projects'],
      ['Projects', `/users/${u}/contributed`, 'Contributed projects'],
      ['Packages', `/users/${u}/packages`, null],
      ['Stars', `/users/${u}/starred`, 'Starred projects'],
    ],
    // Bitbucket has no public user profile of its own, so its menu is built from
    // the destinations it does have (repositories, projects, snippets) rather
    // than from either forge's tab set.
    bitbucket: (u) => [
      ['Overview', `/${u}`, '@first'],
      ['Repositories', `/users/${u}/projects`, 'Personal projects'],
      ['Projects', `/users/${u}/contributed`, 'Contributed projects'],
      ['Snippets', `/${u}?tab=snippets`, 'Snippets'],
    ],
    gitlab: (u, name) => [
      [name, `/${u}`, 'Overview'],
      ['Activity', `/${u}?tab=overview`, null],
      ['Groups', `/${u}?tab=organizations`, null],
      ['Contributed projects', `/${u}?tab=overview`, 'Projects'],
      ['Personal projects', `/${u}?tab=repositories`, 'Repositories'],
      ['Starred projects', `/${u}?tab=stars`, 'Stars'],
      ['Snippets', `https://gist.github.com/${u}`, null],
      ['Followers', `/${u}?tab=followers`, null],
      ['Following', `/${u}?tab=following`, null],
    ],
  };

  // Gitea/Forgejo's repo navigation, arranged as the applied skin's menu: the
  // items the page renders, relabelled to the applied product, ordered by the
  // same rule the live reorder uses, filtered to the skin's own tabs, and
  // gathered under that skin's group headings. `items` is
  // `{ href, label, active }` read from the page (label without its counter);
  // the result mixes `{ group }` headings with `{ href, label, raw, active }`
  // rows, so the DOM builder and the unit tests share one decision.
  //
  // Grouping and filtering follow the *skin*, not the layout. Two skins can share
  // a shape (GitLab and Bitbucket are both left sidebars) while differing on both
  // counts: GitLab groups its sidebar and shows extra items, Bitbucket is a flat
  // list of its own tabs. Keying on the layout put GitLab's groups and items on
  // Bitbucket's sidebar.
  function repoNav(items, theme, order) {
    const nav = NAV[theme] || {};
    const labels = items.map(
      (item) => nav[item.label] ?? translate(item.label, theme),
    );
    const keep = NAV_KEEP[theme];
    const visible = (label) =>
      keep ? navKeep(label, theme) : !navHidden(label, theme);
    const entries = [];
    let last = null;
    for (const index of orderIndexes(labels, order || [])) {
      const label = labels[index];
      if (!visible(label)) continue;
      const group = navGroupFor(label, theme);
      if (group && group !== last) {
        entries.push({ group });
        last = group;
      }
      entries.push({
        href: items[index].href,
        label,
        raw: items[index].label,
        active: Boolean(items[index].active),
      });
    }
    return entries;
  }

  /* ------------------------------------------------------ other host -- */

  // Only the two public forges have a known counterpart. A self-hosted instance
  // gives no way to guess its pair, so there the action is simply absent. Each
  // entry carries everything that is known about the host in one place: which
  // product it is (`from`), its counterpart (`host`) and how to name it.
  const HOST_PAIRS = {
    'github.com': { from: 'github', host: 'gitlab.com', product: 'GitHub' },
    'gitlab.com': { from: 'gitlab', host: 'github.com', product: 'GitLab' },
  };

  /** Parse a URL, or null when the string is not one. */
  function parseUrl(raw) {
    try {
      return new URL(raw);
    } catch {
      return null;
    }
  }

  // First path segments that name a product-wide page, not a repository, so
  // they are never mistaken for an owner/repo pair.
  const GITHUB_RESERVED = new Set([
    'settings',
    'notifications',
    'explore',
    'marketplace',
    'orgs',
    'users',
    'login',
    'logout',
    'signup',
    'features',
    'about',
    'pricing',
    'topics',
    'collections',
    'sponsors',
    'apps',
    'codespaces',
    'issues',
    'pulls',
    'search',
    'new',
    'dashboard',
    'account',
    'organizations',
    'enterprise',
    'security',
    'customer-stories',
    'readme',
    'sponsors',
  ]);
  const GITLAB_RESERVED = new Set([
    'dashboard',
    'explore',
    'users',
    'admin',
    'projects',
    'groups',
    'help',
    'search',
    'profile',
    'public',
    'sign_in',
    'oauth',
    'import',
    'invites',
  ]);

  // The route segment each forge uses for the same page. Only the GitHub side
  // is written down; the GitLab side is derived as its inverse, so a route can
  // never be added to one direction and forgotten in the other.
  const GITHUB_ROUTES = {
    pull: 'merge_requests',
    issues: 'issues',
    tree: 'tree',
    blob: 'blob',
    commits: 'commits',
    releases: 'releases',
    wiki: 'wikis',
    actions: 'pipelines',
  };
  const GITLAB_ROUTES = Object.fromEntries(
    Object.entries(GITHUB_ROUTES).map(([github, gitlab]) => [gitlab, github]),
  );

  // Map one product's path onto the other's. Returns null when the path is not
  // a repository (or is a GitLab group nested too deep for GitHub's owner/repo).
  function translatePath(pathname, from) {
    const seg = String(pathname || '')
      .split('/')
      .filter(Boolean);
    const gitlab = from !== 'github';

    // GitLab marks the project path off from the route with `/-/`; GitHub has
    // no marker, so the route begins at the third segment.
    let base;
    let route;
    if (gitlab) {
      const marker = seg.indexOf('-');
      const project = marker > 0 ? seg.slice(0, marker) : seg.slice(0, 2);
      if (project.length !== 2 || GITLAB_RESERVED.has(project[0])) return null;
      base = `/${project[0]}/${project[1]}`;
      route = marker > 0 ? seg.slice(marker + 1) : seg.slice(2);
    } else {
      if (seg.length < 2 || GITHUB_RESERVED.has(seg[0])) return null;
      base = `/${seg[0]}/${seg[1]}`;
      route = seg.slice(2);
    }

    const [head, ...tail] = route;
    if (!head) return base;

    // The merge-request list and detail pages name different segments on each
    // side (`pulls` vs `pull`), so those two forms are resolved first.
    if (!gitlab && head === 'pulls') return `${base}/-/merge_requests`;
    if (gitlab && head === 'merge_requests' && !tail.length)
      return `${base}/pulls`;

    const to = gitlab ? GITLAB_ROUTES[head] : GITHUB_ROUTES[head];
    if (!to) return base;
    const rest = tail.length ? `/${tail.join('/')}` : '';
    return gitlab ? `${base}/${to}${rest}` : `${base}/-/${to}${rest}`;
  }

  /** The same page on the other forge, or null if there is no known pair. */
  function otherHostUrl(raw) {
    const url = parseUrl(raw);
    const pair = url && HOST_PAIRS[url.hostname];
    if (!pair) return null;
    const path = translatePath(url.pathname, pair.from);
    if (!path) return null;
    return `https://${pair.host}${path}${url.search}${url.hash}`;
  }

  /**
   * The product a forge URL belongs to — 'GitHub', 'GitLab' — or null when the
   * host is not one of the two known forges. Lets the popup label the "open on
   * the other host" action without hardcoding which host is which.
   */
  function hostProduct(raw) {
    const url = parseUrl(raw);
    return (url && HOST_PAIRS[url.hostname]?.product) ?? null;
  }

  /* --------------------------------------------------- forge discovery -- */

  // Which forge a link belongs to, guessed from the link alone, so the popup can
  // pre-select the product for a site it has not been told about instead of
  // always asking. Nothing is fetched — a hostname and a path are all it reads —
  // so this stays inside gitalike's no-network promise. A deep link is the
  // reliable signal: the two big forges spell the same page differently, and a
  // host we have never seen still reveals itself in its routes.

  // Bundled hosts are known outright, and which markup family each belongs to
  // lives in sites.js (`builtin` and `SOURCES`). Read it there rather than
  // repeat the table, so a new bundled forge is one edit. `sites.js` is loaded
  // alongside this file by every context; when this module is imported on its
  // own it is absent, and a bundled host simply falls through to the path and
  // host hints below.
  function bundledSource(host) {
    const sites = globalThis.GITALIKE;
    if (!sites?.isBuiltin?.(host)) return null;
    return sites.sourceFor(host, null);
  }

  // A self-hosted instance often names its product in the host, which is worth a
  // low-confidence guess when the path says nothing (a bare repository root).
  const HOST_HINTS = [
    [/(?:^|\.)github\./, 'github'],
    [/(?:^|\.)gitlab\./, 'gitlab'],
    [/(?:^|\.)(?:codeberg|gitea|forgejo)\./, 'gitea'],
    [/(?:^|\.)bitbucket\./, 'bitbucket'],
    [/gerrit/, 'gerrit'],
  ];

  // Distinctive routes, checked in order against `pathname + hash`. GitLab's
  // `/-/` separator must be tested before GitHub's bare `/blob/`, and Gitea's
  // `/pulls/` before GitHub's `/pull/`.
  const PATH_FORGE = [
    // Gerrit: /c/<project>/+/<change>, and the legacy /#/c/<change> form. A
    // Gerrit project can be nested (`/c/foo/bar/+/1`), so the middle is `.+`.
    [/(?:^|\/)c\/.+\/\+/, 'gerrit'],
    [/#\/c\/\d+/, 'gerrit'],
    // Bitbucket Server / Data Center: /projects/<KEY>/repos/<slug>/…
    [/^\/projects\/[^/]+\/repos\//, 'bitbucket'],
    // Bitbucket Cloud: /<workspace>/<repo>/pull-requests/<n>
    [/(?:^|\/)pull-requests\/\d+/, 'bitbucket'],
    // GitLab: the /-/ route separator.
    [/(?:^|\/)-(\/|$)/, 'gitlab'],
    // Gitea / Forgejo: /<owner>/<repo>/pulls/<n> and /src/branch/<b>.
    [/(?:^|\/)pulls\/\d+/, 'gitea'],
    [/(?:^|\/)src\/branch\//, 'gitea'],
    // GitHub: /pull/<n> (Gitea is /pulls/), /blob/<ref>/, /tree/<ref>/.
    [/(?:^|\/)pull\/\d+/, 'github'],
    [/(?:^|\/)blob\/[^/]+/, 'github'],
    [/(?:^|\/)tree\/[^/]+/, 'github'],
  ];

  // A Gitea/Forgejo instance is classified as the GitHub-flavoured kind, so its
  // *product* button is GitHub even though its markup is its own.
  const kindForSource = (source) => (source === 'gitea' ? 'github' : source);

  /**
   * The forge a link looks like, or null when it says nothing useful. Returns
   * `{ source, kind, confidence, reason }`; `kind` is the product button the
   * popup would press. Accepts a full URL or a bare host, and never throws.
   */
  function guessForge(raw) {
    if (!raw) return null;
    const text = String(raw).trim();
    const url = parseUrl(text) || parseUrl(`https://${text}`);
    if (!url) return null;
    const host = url.hostname.toLowerCase();

    const known = bundledSource(host);
    if (known) {
      return {
        source: known,
        kind: kindForSource(known),
        confidence: 'high',
        reason: 'host',
      };
    }

    const where = `${url.pathname}${url.hash}`;
    for (const [re, source] of PATH_FORGE) {
      if (re.test(where)) {
        return {
          source,
          kind: kindForSource(source),
          confidence: 'high',
          reason: 'path',
        };
      }
    }

    for (const [re, source] of HOST_HINTS) {
      if (re.test(host)) {
        return {
          source,
          kind: kindForSource(source),
          confidence: 'low',
          reason: 'host',
        };
      }
    }
    return null;
  }

  globalThis.GITALIKE_UX = {
    PHRASES,
    NAV,
    NAV_GROUPS,
    NAV_HIDE,
    NAV_KEEP,
    BITBUCKET_NAV_WORDS,
    LABELS,
    CHROME,
    UNMAPPED,
    NAV_SCOPE,
    TOPBAR_SCOPE,
    TOPBAR_HIDE,
    LABEL_SCOPE,
    NAV_RULES,
    SELECTORS,
    CANARY_PAGES,
    SHORTCUTS,
    SHORTCUT_TARGETS,
    translate,
    translateControl,
    controlLabel,
    noEquivalentFor,
    refMarker,
    labelMatches,
    navGroupFor,
    navHidden,
    navKeep,
    orderIndexes,
    activeTabFor,
    sectionLabelText,
    METADATA_HIDE,
    projectTabs,
    PROFILE_MENU,
    repoNav,
    otherHostUrl,
    hostProduct,
    guessForge,
  };
})();
