/**
 * GitAlike — the Bitbucket source.
 *
 * Bitbucket Cloud's repository page is a React app mounted in `#root`. The
 * server still serves `#root` and two `<meta>` tags before the bundle runs —
 * that shell is what the canary watches — and the app renders in the light DOM,
 * so the passes reach it: `paintBitbucketNav` reorients and relabels the
 * repository bar, and `themes/gs-tokens.css` re-points Atlassian's `--ds-*`
 * design tokens (which Bitbucket reads) at the applied skin's palette.
 *
 * Bitbucket Data Center (`/projects/<key>/repos/<slug>`) is classified as this
 * source too, but it is a different, server-rendered markup family with no
 * public instance to canary, so the hooks below are Cloud's.
 *
 * Declared once, here; the shared shape and the validation live in
 * `plugins/core.js`, and the flat tables the rest of the code reads are
 * derived in `lib/sources.js`.
 */
(() => {
  'use strict';

  globalThis.GITALIKE_PLUGINS.defineSource('bitbucket', {
    description: 'Bitbucket Cloud’s repository app, mounted in #root.',
    label: 'Bitbucket',
    hosts: ['bitbucket.org'],
    // Bitbucket Cloud's repository bar, by its displayed labels. Its classes are
    // hashed, so `paintBitbucketNav` finds the bar by content — the ancestor
    // holding the most of these — rather than by a selector that would rot. Both
    // the source's own words and the applied product's are listed: the copy pass
    // relabels some of them before the bar is found.
    navWords: [
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
    ],
    // Palette and the page-wide passes land, and `paintBitbucketNav` reorients
    // the bar (0.9: relabelled and reoriented, not reordered or filtered); it
    // keeps its own metadata, and its workspace navigation is reoriented to the
    // layout (`themes/ux-nav.css`) but its profile menu/card are not rebuilt.
    compare: {
      palette: 1,
      nav: 0.9,
      page: 1,
      metadata: 0,
      profile: 0.5,
      refs: 1,
    },
    pages: {
      project: {
        route: { path: '/<workspace>/<repo>/src', namespace: 'workspace' },
        from: 'path',
      },
      profile: {
        route: {
          path: '/<workspace>/workspace/repositories/',
          namespace: 'workspace',
        },
        from: 'pathname',
        equivalent: 'workspace',
      },
      dashboard: { route: '/dashboard', from: null },
      settings: { route: '/account/settings', from: null },
      signIn: { route: '/account/signin', from: null },
      signOut: { route: '/account/signout', from: null },
    },
    selectors: {
      app: '#root',
      bootstrap: 'meta#bb-bootstrap',
      viewName: 'meta[name="bb-view-name"]',
    },
    canary: [
      {
        name: 'Bitbucket Cloud repository page',
        url: 'https://bitbucket.org/tutorials/markdowndemo',
        keys: ['app', 'bootstrap', 'viewName'],
      },
    ],
  });
})();
