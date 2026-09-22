/**
 * GitLab's compare recipes, beside the source they describe.
 *
 * `capture` is what `screenshots.mjs` drives for the docs frames; the skins and
 * base file names are derived from `prefix` and the registry. `selectors` is
 * what `style-parity.mjs` reads a page's chrome with. Both are Node-only.
 */
export default {
  capture: {
    prefix: 'gitlab',
    host: 'gitlab.com',
    project: {
      name: 'GitLab project',
      url: 'https://gitlab.com/gitlab-org/gitlab',
      ready:
        '.super-sidebar:not(.super-sidebar-loading), [data-testid="project-header"]',
    },
    profile: {
      name: 'GitLab profile',
      // A profile with bio, location and contact links set, so the card has more
      // than the name to show — sytses (the example in the docs) has neither.
      url: 'https://gitlab.com/dzaporozhets',
      ready:
        '.super-sidebar:not(.super-sidebar-loading) .user-profile-header, .user-profile-header',
    },
  },
  selectors: {
    project: {
      url: 'https://gitlab.com/gitlab-org/gitlab',
      ready: '.super-sidebar, [data-testid="project-header"]',
      header: ['header', '.header-content'],
      nav: [
        '[data-gs-project-tabs]',
        '.super-sidebar [data-testid="nav-container"] ul',
        '.super-sidebar ul',
      ],
      link: ['#readme a[href]', '.md a[href]', 'main a[href]'],
    },
    profile: {
      url: 'https://gitlab.com/dzaporozhets',
      ready: '.super-sidebar, .user-profile-header',
      header: ['header', '.header-content'],
      nav: ['.super-sidebar .gl-scroll-scrim ul', '.super-sidebar ul'],
      link: [
        '.user-profile a[href]',
        '.profile-readme a[href]',
        'main article a[href]',
      ],
    },
  },
};
