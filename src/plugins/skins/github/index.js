/**
 * GitAlike — the GitHub skin.
 *
 * A skin is a target UI a page is made to look like. The palette is
 * `as-github.css`, beside this file; the contract (`tests/contracts.test.mjs`)
 * names anything the folder is missing.
 *
 * Declared once, here; the shared shape and the validation live in
 * `plugins/core.js`, and the flat tables the rest of the code reads are
 * derived in `lib/skins.js`.
 */
(() => {
  'use strict';

  globalThis.GITALIKE_PLUGINS.defineSkin('github', {
    description: 'The GitHub UI, worn by a GitLab-flavoured site.',
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
      // Gerrit's own nav words (see GERRIT_NAV_WORDS in content/ux-project.js).
      Changes: 'Pull requests',
      Browse: 'Code',
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

    // The applied product's own destinations a *source* has no page for. A
    // GitLab profile has no user-level Packages page, so the synthesised
    // GitHub profile item is shown as unavailable for GitLab rather than
    // linked into nothing. (GitLab-only features are the mirror image, below
    // in `unmapped`.)
    unavailable: {
      gitlab: { Packages: 'GitLab' },
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

    // The applied product's words for a profile's activity section: GitHub's own
    // timeline heading and its "Show more" control. `paintProfileActivity` swaps
    // a source's framing for this on a profile page.
    activity: { heading: 'Contribution activity', more: 'Show more activity' },

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
    // GitLab omits is synthesised from `base`, or — for Wiki and Security,
    // which GitLab only serves when the project has them enabled — emitted as
    // `null`, so `paintProjectTabs` marks it "not available" instead of
    // linking to a 404. Pure, so the tab set is testable without a page.
    projectTabs: (base, hrefs) => [
      ['Code', hrefs.code || base],
      ['Issues', hrefs.issues || `${base}/-/work_items`],
      ['Pull requests', hrefs.pullRequests || `${base}/-/merge_requests`],
      ['Actions', hrefs.actions || `${base}/-/pipelines`],
      ['Projects', hrefs.projects || `${base}/-/boards`],
      ['Wiki', hrefs.wiki || null],
      ['Security and quality', hrefs.security || null],
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
  });
})();
