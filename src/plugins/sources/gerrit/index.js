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
    // The palette reaches Gerrit through its root custom properties, including
    // the header surface, but not every surface. Its header navigation is
    // reoriented to the applied layout *and* relabelled to the applied
    // product's words (`paintGerritNav`), so it is a real but partial match of
    // the target's nav rather than the target's full menu. An owner query's
    // `gr-user-header` is reshaped into the applied product's profile identity
    // block with a profile navigation built from Gerrit's own owner views
    // (`paintGerritProfile`), so `profile` is a real but partial match too. The
    // page-wide copy/label passes cannot reach its shadow-DOM text, and a change
    // carries a Change-Id rather than a `#`/`!` reference marker.
    compare: {
      palette: 0.6,
      nav: 0.8,
      page: 0,
      metadata: 0,
      profile: 0.8,
      refs: 0.3,
    },
    selectors: {
      app: 'gr-app#pg-app',
      body: 'body[unresolved]',
      // PolyGerrit heads an owner query (`/q/owner:<account>`) with the
      // account's avatar, display name, email and join date. It is the closest
      // thing Gerrit has to a profile page; `paintGerritProfile` reshapes it for
      // the applied skin.
      userHeader: 'gr-user-header',
    },
    pages: {
      project: { route: '/q/project:', from: 'project:' },
      profile: {
        route: '/q/owner:',
        from: 'owner:',
        equivalent: 'owner-query',
        selectors: { header: 'gr-user-header' },
      },
      // Gerrit has no dashboard, settings page or sign-in form of its own; its
      // settings live in the account menu, and auth is external (OpenID/OAuth).
      dashboard: null,
      settings: { route: '/settings/', from: null },
      signIn: null,
      signOut: null,
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
