/**
 * GitAlike — the GitHub (Primer) source.
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

  globalThis.GITALIKE_PLUGINS.defineSource('github', {
    description: 'GitHub’s Primer markup.',
    // A display name for the registry, the site's chip and the docs.
    label: 'GitHub — Primer',
    // The short product name the "open on the other host" action uses.
    product: 'GitHub',
    // The bundled host, the forge it pairs with, and the route segments the two
    // spell differently. `lib/sources.js` checks GitLab's map is its inverse.
    hosts: ['github.com'],
    counterpart: 'gitlab',
    routes: {
      pull: 'merge_requests',
      issues: 'issues',
      tree: 'tree',
      blob: 'blob',
      commits: 'commits',
      releases: 'releases',
      wiki: 'wikis',
      actions: 'pipelines',
    },
    // First path segments that name a product-wide page, not an owner/repo pair.
    reserved: [
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
    ],
    // Regions whose labels the nav/copy passes may touch: GitHub's repo tabs and
    // its global top bar (the logged-out marketing header and the signed-in app
    // bars). `lib/sources.js` unions every source's list into `NAV_SCOPE` /
    // `TOPBAR_SCOPE`.
    navScope: ['nav[aria-label="Repository"]', '.js-repo-nav'],
    topbarScope: [
      'header[role="banner"]',
      '.js-header-wrapper',
      'header.navigation',
      'header.GlobalNav',
      'header[aria-label="Global navigation menu"]',
      '.AppHeader',
    ],
    // GitHub's About sections the target UIs do not list (see `paintMetadata`).
    metadataHide: [
      'Releases',
      'Packages',
      'Used by',
      'Contributors',
      'Languages',
    ],
    // The words GitHub's own profile activity section uses, so the profile pass
    // (`paintProfileActivity`) can find it and relabel it to the applied
    // product's. "Activity overview" is the summary GitHub serves today;
    // "Contribution activity" is the timeline heading this pass is for.
    activity: {
      headings: ['Contribution activity', 'Activity overview'],
      more: ['Show more activity'],
    },
    // Every parity dimension applies: palette, navigation, page-wide passes,
    // metadata, profile and reference markers.
    compare: { palette: 1, nav: 1, page: 1, metadata: 1, profile: 1, refs: 1 }, // GitHub's own pages, so a pass or the rubric reads the map rather than
    // assuming. `from` names how the page's subject is read from the URL.
    pages: {
      // A repository lives under a user (`/torvalds/linux`) *or* an
      // organisation (`/microsoft/vscode`) — the same shape, a different owner
      // kind. GitHub does not nest namespaces (no `/a/b/c` repository).
      project: {
        route: [
          { path: '/<owner>/<repo>', namespace: 'user' },
          { path: '/<org>/<repo>', namespace: 'organization' },
        ],
        from: 'path',
      },
      profile: { route: '/<user>', from: 'pathname' },
      dashboard: { route: '/dashboard', from: null },
      settings: { route: '/settings', from: null },
      signIn: { route: '/login', from: null },
      signOut: { route: '/logout', from: null },
    },
    // GitHub's markup (Primer).
    selectors: {
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
    canary: [
      {
        name: 'GitHub repository page',
        url: 'https://github.com/git/git',
        keys: ['repoNavList', 'metadataSidebar', 'metadataPane', 'appHeader'],
      },
      {
        name: 'GitHub profile page',
        url: 'https://github.com/torvalds',
        keys: ['profileNav', 'profileFrame'],
      },
    ],
  });
})();
