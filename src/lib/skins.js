/**
 * GitAlike — the skins, one object per target UI.
 *
 * A *skin* is the product a page is made to look like (GitLab, GitHub,
 * Bitbucket); a *source* is the forge markup it is built on (see sources.js).
 * The two are independent: any skin can be worn by any source, and a source can
 * wear any skin.
 *
 * Everything a skin contributes lives in its object below — its name and badge,
 * its vocabulary, its navigation rules and order, its profile menu, its
 * shortcuts. Adding a skin is one object here plus one stylesheet
 * (`themes/as-<name>.css`); `tests/contracts.test.mjs` names anything missing.
 * `ux.js` derives the flat tables the rest of the code reads (`PHRASES`, `NAV`,
 * …) from this registry, so a skin is declared exactly once.
 *
 * The keys are the theme names (`gs-theme-<name>`), which is also the value the
 * popup writes to storage. Every table is keyed by the theme being *applied*:
 *
 *   'gitlab'  a GitHub-flavoured site shown with the GitLab UI
 *   'github'  a GitLab-flavoured site shown with the GitHub UI
 *   'bitbucket'  any site shown with the Bitbucket UI
 *
 * Published on `globalThis.GITALIKE_SKINS`; loaded before `ux.js` everywhere
 * (see `src/background.js` `CONTENT_JS`, `build.mjs` and `popup.html`).
 */
(() => {
  'use strict';

  const SKINS = {
    gitlab: {
      product: 'GitLab',
      badge: 'GL',
      color: '#7759c2',
      // GitLab is a left sidebar: a top bar above a grouped side navigation.
      layout: 'gitlab',

      // Multi-word copy, safe to fix up wherever it appears in normal page text
      // (outside code, inputs and editable regions). Longest key wins, so
      // "Pull requests" is rewritten before "Pull request".
      phrases: {
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

      // Short app-navigation labels. Only replaced when an element's *whole*
      // trimmed label matches, and only inside a navigation region.
      nav: {
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

      // Exact labels on *controls* — buttons, menu items, tabs, links — that
      // name a GitHub/GitLab feature differently but must never be rewritten in
      // prose. Kept apart from `phrases` because "Merge" and "Rebase" are
      // ordinary words; scoping to a control's whole label is what makes them
      // safe. Every entry round-trips with its counterpart.
      labels: {
        'Merge pull request': 'Merge',
        'Squash and merge': 'Squash commits',
        'Rebase and merge': 'Rebase',
        'Security and quality': 'Security',
      },

      // Account/menu chrome, where the products name the same thing differently
      // but the wording is too generic to translate in prose.
      chrome: {
        'Your repositories': 'Your projects',
        'Your gists': 'Your snippets',
        'Your stars': 'Starred projects',
        'Your organizations': 'Your groups',
      },

      // Features that exist in one product but have no counterpart in the
      // other, with the product that *lacks* it as the value, so the UI can say
      // so instead of pretending it exists. Deliberately absent from
      // phrases/nav/labels — there is nothing to translate them to.
      unmapped: {
        Discussions: 'GitLab',
        Sponsors: 'GitLab',
        Marketplace: 'GitLab',
      },

      // Desired order of the app navigation, using the *displayed* labels after
      // translation. Items that are not present are skipped; unrecognised items
      // keep their relative order at the end. Shared by the GitHub tab bar and
      // Gitea's `overflow-menu`, so the two sources cannot drift.
      repoOrder: [
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
      ],

      // How each source's navigation is reordered. `order` is filled in from
      // `repoOrder` below, so a rule and its order cannot drift.
      navRules: [
        {
          source: 'github',
          container: 'nav[aria-label="Repository"] ul.UnderlineNav-body',
          item: 'li',
        },
        {
          // Gitea/Forgejo (Codeberg, gitea.com) repo tabs: a flat `overflow-menu`
          // list of `a.item`s, so they take GitLab's order the same way.
          source: 'gitea',
          container: 'overflow-menu .overflow-menu-items',
          item: 'a.item',
        },
      ],

      // The GitLab project sidebar groups its items (Plan, Code, Build, …).
      // GitHub's repo tabs are flat, so on the GitLab skin they are gathered
      // under the same group headings, using the *displayed* label. An item not
      // listed here stands alone, with no heading. Only GitLab groups.
      groups: {
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

      // Menu items the applied product has no page for, by displayed label.
      // Hidden rather than marked, so the navigation is the applied product's
      // menu and not a mix of both.
      hide: ['Discussions', 'Sponsors', 'Marketplace'],

      // GitLab's profile destinations, in the applied product's order. The
      // third element names the item already on the page to reuse — `@first` is
      // its first anchor, a label is matched by `labelMatches`, null synthesises.
      profileMenu: (u, name) => [
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

      // Two-key `g` combos: the combo the user *sees* (the applied product) to
      // the combo the underlying site implements. Only unambiguous pairs.
      shortcuts: { gm: 'gp', gp: 'gb', gt: 'gn' },
      // Where the destination has a real navigation link, deliver the shortcut
      // as a click on it (some sites ignore synthetic key events).
      shortcutTargets: {},

      // Source-only words in the global top bar with no counterpart in the
      // applied product: hidden rather than relabelled. The words both products
      // share ("Platform", "Solutions", "Resources", "Pricing") are left alone.
      topbarHide: ['Open Source', 'Enterprise', 'Sign up'],
    },

    github: {
      product: 'GitHub',
      badge: 'GH',
      color: '#24292f',
      // GitHub is a top bar plus a horizontal tab row.
      layout: 'github',

      phrases: {
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

      nav: {
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

      labels: {
        Merge: 'Merge pull request',
        'Squash commits': 'Squash and merge',
        Rebase: 'Rebase and merge',
        Security: 'Security and quality',
      },

      chrome: {
        'Your projects': 'Your repositories',
        'Your snippets': 'Your gists',
        'Starred projects': 'Your stars',
        'Your groups': 'Your organizations',
      },

      unmapped: {
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

      // GitHub's repo tab order, shared by GitLab's sidebar (shown as GitHub)
      // and Gitea's tab bar (shown as GitHub), so the two cannot drift.
      repoOrder: [
        'Code',
        'Issues',
        'Pull requests',
        'Actions',
        'Projects',
        'Wiki',
        'Security',
        'Insights',
      ],

      navRules: [
        {
          source: 'gitlab',
          scope: '.super-sidebar',
          contains: 'Code',
          item: 'li',
        },
        {
          // Gitea/Forgejo repo tabs, shown with the GitHub UI. Its labels
          // already read GitHub's, so the order does most of the work; unknown
          // labels rank after the known ones.
          source: 'gitea',
          container: 'overflow-menu .overflow-menu-items',
          item: 'a.item',
        },
      ],

      // GitLab's sidebar items with no GitHub counterpart.
      hide: [
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

      // A whitelist: only the applied product's own project-page options are
      // shown, so the navigation is that product's menu exactly. Supersedes
      // `hide` for this skin — `paintNavHide` reads one or the other, never both.
      keep: [
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

      // The repo tabs GitHub shows on a *GitLab* project page, emitted as
      // [label, href]. `hrefs` carries the links GitLab actually renders; a tab
      // GitLab omits is synthesised from `base`. Pure, so the tab set is
      // testable without a page.
      projectTabs: (base, hrefs) => [
        ['Code', hrefs.code || base],
        ['Issues', hrefs.issues || `${base}/-/work_items`],
        ['Pull requests', hrefs.pullRequests || `${base}/-/merge_requests`],
        ['Actions', hrefs.actions || `${base}/-/pipelines`],
        ['Projects', hrefs.projects || `${base}/-/boards`],
        ['Wiki', `${base}/-/wikis/home`],
        ['Security and quality', `${base}/-/security/dashboard`],
        ['Insights', hrefs.insights || `${base}/-/analytics`],
      ],

      // GitHub's profile tabs (source: GitLab).
      profileMenu: (u) => [
        ['Overview', `/${u}`, '@first'],
        ['Repositories', `/users/${u}/projects`, 'Personal projects'],
        ['Projects', `/users/${u}/contributed`, 'Contributed projects'],
        ['Packages', `/users/${u}/packages`, null],
        ['Stars', `/users/${u}/starred`, 'Starred projects'],
      ],

      shortcuts: { gp: 'gm', gb: 'gp', gn: 'gt' },
      shortcutTargets: { gp: 'Pull requests', gb: 'Projects' },

      topbarHide: ['Why GitLab', 'Explore', 'Get free trial'],
    },

    bitbucket: {
      product: 'Bitbucket',
      badge: 'BB',
      color: '#0052cc',
      // Bitbucket's repo navigation is a left sidebar, so it reuses GitLab's
      // layout rather than GitHub's.
      layout: 'gitlab',

      // Bitbucket is a target only: its table maps each source product's words
      // onto Bitbucket's. GitHub and Gitea say "Pull request"/"Actions"; GitLab
      // says "Merge request"/"CI/CD". Both read Bitbucket's way after this.
      phrases: {
        'Merge requests': 'Pull requests',
        'Merge request': 'Pull request',
        'merge requests': 'pull requests',
        'merge request': 'pull request',
        'GitHub Actions': 'Pipelines',
        'CI/CD': 'Pipelines',
        Gists: 'Snippets',
        Gist: 'Snippet',
      },

      // Bitbucket's repo tabs. GitHub/Gitea say "Code"/"Actions"; GitLab says
      // "Repository"/"CI/CD"; all become "Source"/"Pipelines". Issues live in
      // Jira in Bitbucket's model, so they read "Jira issues".
      nav: {
        Code: 'Source',
        Repository: 'Source',
        Actions: 'Pipelines',
        'CI/CD': 'Pipelines',
        'Merge requests': 'Pull requests',
        Issues: 'Jira issues',
        'Work items': 'Jira issues',
      },

      // Bitbucket's merge controls. Every source word maps to Bitbucket's own.
      labels: {
        'Merge pull request': 'Merge',
        'Squash and merge': 'Squash',
        'Squash commits': 'Squash',
        'Rebase and merge': 'Rebase',
        'Security and quality': 'Security',
      },

      // Bitbucket's account chrome. Its account menu is "Your work"; groups are
      // Atlassian "Workspaces"; gists live under Snippets.
      chrome: {
        'Your repositories': 'Your work',
        'Your projects': 'Your work',
        'Your gists': 'Snippets',
        'Your snippets': 'Snippets',
        'Your stars': 'Your starred',
        'Starred projects': 'Your starred',
        'Your organizations': 'Your workspaces',
        'Your groups': 'Your workspaces',
      },

      // Features Bitbucket has no page for, from either source. Bitbucket's own
      // vocabulary ("Source", "Pipelines") is mapped above, so only the
      // genuinely absent ones are marked.
      unmapped: {
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

      // Verified against an archived Bitbucket repository page's own menu model
      // (Source, Commits, Branches, Pull requests, Pipelines, Deployments, Jira
      // issues, Security, Downloads) — there is no repo Wiki or Settings tab.
      repoOrder: [
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

      navRules: [
        {
          // GitLab's project sidebar, shown as Bitbucket. Its repository group
          // is resolved by the *displayed* label: `nav` renames Repository/Code
          // to Source first, so the container is the group that holds "Source".
          source: 'gitlab',
          scope: '.super-sidebar',
          contains: 'Source',
          item: 'li',
        },
        {
          source: 'github',
          container: 'nav[aria-label="Repository"] ul.UnderlineNav-body',
          item: 'li',
        },
        {
          source: 'gitea',
          container: 'overflow-menu .overflow-menu-items',
          item: 'a.item',
        },
      ],

      // Bitbucket's own repo tabs; anything else the source shows (Projects,
      // Insights, Wiki, Releases, Activity, …) is hidden rather than relabelled.
      keep: [
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

      // The repo tabs Bitbucket shows on a project page, emitted as
      // [label, href] in Bitbucket's order. GitLab's routes are the target
      // because this rebuilds a *GitLab* project page, whichever skin is applied.
      projectTabs: (base, hrefs) => [
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

      // Bitbucket has no public user profile of its own, so its menu is built
      // from the destinations it does have (repositories, projects, snippets)
      // rather than from either forge's tab set.
      profileMenu: (u) => [
        ['Overview', `/${u}`, '@first'],
        ['Repositories', `/users/${u}/projects`, 'Personal projects'],
        ['Projects', `/users/${u}/contributed`, 'Contributed projects'],
        ['Snippets', `/${u}?tab=snippets`, 'Snippets'],
      ],
    },
  };

  // Every nav rule ranks by its skin's `repoOrder`, filled in here so the rule
  // and the order cannot drift apart.
  for (const skin of Object.values(SKINS)) {
    for (const rule of skin.navRules ?? []) rule.order = skin.repoOrder;
  }

  // The flat tables the rest of the code and the tests read, derived from the
  // registry. Only the skins that declare a part appear in its table, so a skin
  // with no `groups` is simply absent from `NAV_GROUPS`, exactly as when each
  // table was written by hand.
  const bySkin = (part) =>
    Object.fromEntries(
      Object.entries(SKINS)
        .filter(([, skin]) => skin[part] !== undefined)
        .map(([name, skin]) => [name, skin[part]]),
    );

  globalThis.GITALIKE_SKINS = {
    SKINS,
    PHRASES: bySkin('phrases'),
    NAV: bySkin('nav'),
    LABELS: bySkin('labels'),
    CHROME: bySkin('chrome'),
    UNMAPPED: bySkin('unmapped'),
    TOPBAR_HIDE: bySkin('topbarHide'),
    SHORTCUTS: bySkin('shortcuts'),
    SHORTCUT_TARGETS: bySkin('shortcutTargets'),
    NAV_HIDE: bySkin('hide'),
    NAV_KEEP: bySkin('keep'),
    NAV_GROUPS: bySkin('groups'),
    NAV_RULES: bySkin('navRules'),
    PROJECT_TABS: bySkin('projectTabs'),
    PROFILE_MENU: bySkin('profileMenu'),
  };
})();
