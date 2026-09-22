/**
 * Bitbucket's compare recipes, beside the source they describe.
 *
 * `capture` is what `screenshots.mjs` drives for the docs frames; the page is
 * client-rendered, so `ready` waits for the ref selector, not a shell. The skins
 * and base file names are derived from `prefix` and the registry. `selectors` is
 * what `style-parity.mjs` reads a page's chrome with — Bitbucket is repainted
 * through its Atlassian `--ds-*` tokens and relabelled/reoriented by
 * `paintBitbucketNav`. Both are Node-only.
 */
export default {
  capture: {
    prefix: 'bitbucket',
    host: 'bitbucket.org',
    project: {
      name: 'Bitbucket project',
      url: 'https://bitbucket.org/atlassian/atlassian-connect-express/src/master/',
      ready: '[data-testid="ref-selector-trigger"]',
    },
    // Bitbucket has no public user profile, so its account reference is the
    // workspace repositories page — the closest thing it serves.
    profile: {
      name: 'Bitbucket profile',
      url: 'https://bitbucket.org/tutorials/workspace/repositories/',
      ready: '[data-testid="profile-repository-row"]',
    },
  },
  selectors: {
    project: {
      url: 'https://bitbucket.org/atlassian/atlassian-connect-express/src/master/',
      ready: '[data-testid="ref-selector-trigger"]',
      header: ['header[data-layout-slot="true"]', 'header'],
      nav: [
        '[data-gs-bb-nav]',
        '[data-testid="bb-sidebar"]',
        '[data-testid="sidebar"]',
        'nav',
      ],
      link: ['main a[href]', 'a[href]'],
    },
    profile: {
      url: 'https://bitbucket.org/tutorials/workspace/repositories/',
      ready: '[data-testid="profile-repository-row"]',
      header: ['header[data-layout-slot="true"]', 'header'],
      nav: [
        '[data-gs-bb-nav]',
        '[data-testid="bb-sidebar"]',
        '[data-testid="sidebar"]',
        'nav',
      ],
      link: ['main a[href]'],
    },
  },
};
