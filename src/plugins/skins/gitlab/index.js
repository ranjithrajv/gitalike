/**
 * GitAlike — the GitLab skin.
 *
 * A skin is a target UI a page is made to look like. The palette is
 * `as-gitlab.css`, beside this file; the contract (`tests/contracts.test.mjs`)
 * names anything the folder is missing.
 *
 * Declared once, here; the shared shape and the validation live in
 * `plugins/core.js`, and the flat tables the rest of the code reads are
 * derived in `lib/skins.js`.
 */
(() => {
  'use strict';

  globalThis.GITALIKE_PLUGINS.defineSkin('gitlab', {
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
  });
})();
