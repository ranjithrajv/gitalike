/**
 * GitHub's compare recipes, beside the source they describe.
 *
 * `capture` is what `screenshots.mjs` drives for the docs frames; the skins and
 * base file names are derived from `prefix` and the registry. `selectors` is
 * what `style-parity.mjs` reads a page's chrome with. Both are Node-only.
 */
export default {
  capture: {
    prefix: 'github',
    host: 'github.com',
    project: {
      name: 'GitHub project',
      url: 'https://github.com/microsoft/vscode',
      ready: '.UnderlineNav-item, .prc-components-UnderlineItem',
    },
    profile: {
      name: 'GitHub profile',
      url: 'https://github.com/torvalds',
      ready: 'nav[aria-label="User profile"]',
    },
  },
  selectors: {
    project: {
      url: 'https://github.com/git/git',
      ready: '.UnderlineNav-item, .prc-components-UnderlineItem',
      header: ['header[role="banner"]', '.AppHeader'],
      nav: [
        'nav[aria-label="Repository"] ul.UnderlineNav-body',
        'nav[aria-label="Repository"] ul',
      ],
      link: ['#readme a[href]', '.markdown-body a[href]', 'main a[href]'],
    },
    profile: {
      url: 'https://github.com/torvalds',
      ready: 'nav[aria-label="User profile"]',
      header: ['header[role="banner"]', '.AppHeader'],
      nav: [
        'main [data-turbo-frame="user-profile-frame"] nav[aria-label="User profile"]',
        'nav[aria-label="User profile"]',
      ],
      link: [
        '.js-pinned-items-reorder-container a[href]',
        '.p-note a[href]',
        '.js-profile-editable-area a[href]',
        'main article a[href]',
      ],
    },
  },
};
