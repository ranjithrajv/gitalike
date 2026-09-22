/**
 * Gitea / Forgejo's compare recipes, beside the source they describe.
 *
 * Codeberg is the capture host (Forgejo), the instance the daily canary also
 * watches. `capture` is what `screenshots.mjs` drives; the skins and base file
 * names are derived from `prefix` and the registry. `selectors` is what
 * `style-parity.mjs` reads a page's chrome with. Both are Node-only.
 */
export default {
  capture: {
    prefix: 'codeberg',
    host: 'codeberg.org',
    project: {
      name: 'Codeberg (Gitea) project',
      url: 'https://codeberg.org/forgejo/forgejo',
      ready: '.repo-header, overflow-menu, [data-gs-gitea-nav]',
    },
    profile: {
      name: 'Codeberg (Gitea) profile',
      url: 'https://codeberg.org/forgejo',
      ready: '.user.profile, .profile-header, .ui.container',
    },
  },
  selectors: {
    project: {
      url: 'https://codeberg.org/forgejo/forgejo',
      ready: '.repo-header, overflow-menu, [data-gs-gitea-nav]',
      header: ['#navbar'],
      nav: ['[data-gs-gitea-nav]', 'overflow-menu .overflow-menu-items'],
      link: ['#readme a[href]', '.markdown a[href]', 'main a[href]'],
    },
    profile: {
      url: 'https://codeberg.org/forgejo',
      ready: '.user.profile, .profile-header, .ui.container',
      header: ['#navbar'],
      nav: [
        '.ui.tabular.menu',
        '.ui.secondary.pointing.menu',
        'nav',
        '.ui.container',
      ],
      link: ['#readme a[href]', '.markdown a[href]', 'main a[href]'],
    },
  },
};
