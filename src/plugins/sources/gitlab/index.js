/**
 * GitAlike — the GitLab (Pajamas) source.
 *
 * The `// css` markers note the hooks a stylesheet owns, so the contract can
 * check the two agree.
 *
 * Declared once, here; the shared shape and the validation live in
 * `plugins/core.js`, and the flat tables the rest of the code reads are
 * derived in `lib/sources.js`.
 */
(() => {
  'use strict';

  globalThis.GITALIKE_PLUGINS.defineSource('gitlab', {
    description: 'GitLab’s Pajamas markup.',
    label: 'GitLab — Pajamas',
    // The short product name the "open on the other host" action uses.
    product: 'GitLab',
    // The bundled host, the forge it pairs with, and the route segments the two
    // spell differently (the inverse of GitHub's map, checked by `lib/sources.js`).
    hosts: ['gitlab.com'],
    counterpart: 'github',
    routes: {
      merge_requests: 'pull',
      issues: 'issues',
      tree: 'tree',
      blob: 'blob',
      commits: 'commits',
      releases: 'releases',
      wikis: 'wiki',
      pipelines: 'actions',
    },
    // First path segments that name a product-wide page, not an owner/repo pair.
    reserved: [
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
    ],
    // GitLab's project navigation (the current super sidebar and its older
    // `.nav-sidebar`) and its top bars. `lib/sources.js` unions these into
    // `NAV_SCOPE` / `TOPBAR_SCOPE`.
    navScope: [
      '.super-sidebar',
      '[data-testid="super-sidebar"]',
      '.nav-sidebar',
      'nav[aria-label="Project navigation"]',
    ],
    topbarScope: [
      'header.super-topbar',
      '.navbar-gitlab',
      '.header-content',
      '.super-topbar',
    ],
    // GitLab's own profile activity heading, so the pass can relabel it to the
    // applied product's. (Its "Show more" is too generic to match safely.)
    activity: { headings: ['Activity'], more: [] },
    // The GitLab page kind (its `body[data-page]`) the applied UI should mark
    // active, mapped to GitHub's tab label and then renamed by the skin's `NAV`.
    activeTabs: [
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
    ],
    compare: { palette: 1, nav: 1, page: 1, metadata: 1, profile: 1, refs: 1 },
    pages: {
      // GitLab serves a project under a user namespace (`/dzaporozhets/x`) *or*
      // a group, which may itself be **nested** (`/gitlab-org/security/x`) — the
      // `/-/` marker is what separates the project path from the route, so the
      // namespace can be any number of segments.
      project: {
        route: [
          { path: '/<owner>/<project>', namespace: 'user' },
          { path: '/<group>/<project>', namespace: 'group' },
          { path: '/<group>/<subgroup>/<project>', namespace: 'subgroup' },
        ],
        from: 'path',
      },
      profile: { route: '/<user>', from: 'pathname' },
      dashboard: { route: '/dashboard', from: null },
      settings: { route: '/-/profile', from: null },
      signIn: { route: '/users/sign_in', from: null },
      signOut: { route: '/users/sign_out', from: null },
    },
    // GitLab's markup (Pajamas, plus its older CSS).
    selectors: {
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
    canary: [
      {
        name: 'GitLab project page',
        url: 'https://gitlab.com/gitlab-org/gitlab',
        keys: ['superSidebar', 'projectSidebarBlock'],
      },
      {
        name: 'GitLab profile page',
        url: 'https://gitlab.com/dzaporozhets',
        keys: ['superSidebar', 'profileHeader', 'profileSidebar'],
      },
    ],
  });
})();
