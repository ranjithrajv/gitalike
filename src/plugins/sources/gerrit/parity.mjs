/**
 * Gerrit's compare recipes, beside the source they describe.
 *
 * Gerrit is not a bundled host, so its `capture.instance` has the capture run
 * grant `gerrit-review.googlesource.com` and register it as the `gerrit` kind
 * for that run only. PolyGerrit renders inside shadow DOM and the Gerrit support
 * is palette-only, so a skinned frame differs from the base mainly in colour.
 * `selectors` is what `style-parity.mjs` reads a page's chrome with; the tool
 * descends into PolyGerrit's open shadow root, so its selectors are the shadow
 * elements by name. Both are Node-only.
 */
export default {
  capture: {
    prefix: 'gerrit',
    host: 'gerrit-review.googlesource.com',
    instance: { host: 'gerrit-review.googlesource.com', kind: 'gerrit' },
    project: {
      name: 'Gerrit change list',
      url: 'https://gerrit-review.googlesource.com/q/status:open',
      ready: 'gr-app#pg-app',
    },
    // Gerrit has no public profile. Like Bitbucket's workspace page, its closest
    // page is an owner query, which PolyGerrit heads with `gr-user-header` — the
    // account's avatar, name, email and join date, which the skins reshape.
    profile: {
      name: 'Gerrit owner changes',
      url: 'https://gerrit-review.googlesource.com/q/owner:david.ostrovsky@gmail.com',
      ready: 'gr-user-header',
    },
  },
  selectors: {
    project: {
      url: 'https://gerrit-review.googlesource.com/q/status:open',
      ready: 'gr-app#pg-app',
      header: ['gr-main-header'],
      nav: ['gr-main-header nav', 'nav'],
      link: ['main a[href]', 'a[href]'],
      // PolyGerrit paints inside its app; <body> stays transparent, so the canvas
      // is read from the app element (through any transparent wrapper).
      canvas: ['gr-app#pg-app', 'body'],
    },
    profile: {
      url: 'https://gerrit-review.googlesource.com/q/owner:david.ostrovsky@gmail.com',
      ready: 'gr-user-header',
      header: ['gr-main-header'],
      nav: ['gr-main-header nav', 'nav'],
      link: ['main a[href]', 'a[href]'],
      canvas: ['gr-app#pg-app', 'body'],
    },
  },
};
