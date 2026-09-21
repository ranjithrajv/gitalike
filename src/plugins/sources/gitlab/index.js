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
    compare: { palette: 1, nav: 1, page: 1, metadata: 1, profile: 1, refs: 1 },
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
