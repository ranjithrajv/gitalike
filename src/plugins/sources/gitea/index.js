/**
 * GitAlike — the Gitea / Forgejo source.
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

  globalThis.GITALIKE_PLUGINS.defineSource('gitea', {
    label: 'Gitea / Forgejo',
    // Gitea and Forgejo share one markup family, so one source covers both
    // hosts: gitea.com (Gitea) and codeberg.org (Forgejo). Each host has its
    // own canary page below, so if the 2024 hard fork's UI ever diverges the
    // daily job says so — and the two can then be split into separate sources.
    // Its navigation hooks also live in the skins' `navRules`; a test asserts
    // the two stay equal.
    selectors: {
      repoNavList: 'overflow-menu .overflow-menu-items',
      repoMenu: '.page-content.repository > .secondary-nav > overflow-menu',
      themeMarker: '[data-theme]', // css
      topBar: '#navbar', // css
      repoHeader: '.repo-header', // css
      pullLink: 'a[href*="/pulls/"]',
    },
    canary: [
      {
        name: 'Codeberg (Forgejo) project page',
        url: 'https://codeberg.org/forgejo/forgejo',
        keys: [
          'themeMarker',
          'topBar',
          'repoHeader',
          'repoNavList',
          'repoMenu',
        ],
      },
      {
        name: 'Codeberg (Forgejo) pull requests',
        url: 'https://codeberg.org/forgejo/forgejo/pulls',
        keys: ['themeMarker', 'pullLink'],
      },
      {
        // gitea.com puts a repository's pull-request list behind sign-in, so
        // the project page is canaried instead — it carries the pull link too.
        name: 'gitea.com (Gitea) project page',
        url: 'https://gitea.com/gitea/act',
        keys: [
          'themeMarker',
          'topBar',
          'repoHeader',
          'repoNavList',
          'repoMenu',
          'pullLink',
        ],
      },
    ],
  });
})();
