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
    // Every parity dimension applies: palette, navigation, page-wide passes,
    // metadata, profile and reference markers.
    compare: { palette: 1, nav: 1, page: 1, metadata: 1, profile: 1, refs: 1 },
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
