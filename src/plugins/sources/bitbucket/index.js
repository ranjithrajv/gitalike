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
