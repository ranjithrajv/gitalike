/**
 * GitAlike — the Gerrit source.
 *
 * PolyGerrit is a client-rendered app: the server serves a shell with
 * `<gr-app id="pg-app">` and the bundle does the rest inside shadow DOM. That
 * shell is what the canary watches.
 *
 * PolyGerrit reads its colours from named custom properties on the root
 * (`--primary-text-color`, `--link-color`, …). Custom properties inherit across
 * the shadow boundary, so `themes/gs-tokens.css` re-points those at the applied
 * skin's palette and recolours the whole app without reaching inside it. Copy
 * and navigation *inside* the shadow roots are not reached yet; they need the
 * app's roots opened at `document_start`, which is a separate step.
 *
 * Declared once, here; the shared shape and the validation live in
 * `plugins/core.js`, and the flat tables the rest of the code reads are
 * derived in `lib/sources.js`.
 */
(() => {
  'use strict';

  globalThis.GITALIKE_PLUGINS.defineSource('gerrit', {
    description:
      'Gerrit’s PolyGerrit app; recoloured through its root custom properties.',
    label: 'Gerrit',
    // Only the palette reaches Gerrit, and only partially (no surfaces/header);
    // the page-wide copy/label passes cannot reach its shadow roots, and its
    // changes carry a Change-Id rather than a `#`/`!` reference marker. Its
    // header navigation is reoriented to the applied layout (`paintGerritNav`),
    // so nav and profile are partial.
    compare: {
      palette: 0.6,
      nav: 0.5,
      page: 0,
      metadata: 0,
      profile: 0.5,
      refs: 0.3,
    },
    selectors: {
      app: 'gr-app#pg-app',
      body: 'body[unresolved]',
    },
    canary: [
      {
        name: 'Gerrit Code Review',
        url: 'https://gerrit-review.googlesource.com/',
        keys: ['app'],
      },
    ],
  });
})();
