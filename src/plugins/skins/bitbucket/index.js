/**
 * GitAlike — the Bitbucket skin.
 *
 * Bitbucket is a target only: its tables map each source product's words onto
 * Bitbucket's. Its palette is `as-bitbucket.css`, beside this file, and it
 * reuses GitLab's left-sidebar layout. The contract names anything it is
 * missing.
 *
 * Declared once, here; the shared shape and the validation live in
 * `plugins/core.js`, and the flat tables the rest of the code reads are
 * derived in `lib/skins.js`.
 */
(() => {
  'use strict';

  globalThis.GITALIKE_PLUGINS.defineSkin('bitbucket', {
    description: 'The Bitbucket UI, worn by any configured site.',
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
  });
})();
