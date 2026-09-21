#!/usr/bin/env node
/**
 * Per-source recipes for `style-parity.mjs` — where each source's project and
 * profile pages keep their chrome, and the reviewed vocabulary each target
 * product's menu carries.
 *
 * It is pure data with no Playwright import, so a test can check that every
 * registry source has a recipe (and every skin a target vocabulary) without
 * launching a browser. `style-parity.mjs` is the only consumer.
 *
 * A recipe's `url` is the page the tool drives, `ready` is the selector it waits
 * for, and `header` / `nav` / `link` are selector lists resolved in order — a
 * rebuilt element wins over a leftover one. Gerrit's chrome is inside `gr-app`'s
 * open shadow root; `readChrome` in the tool descends into shadow roots to find
 * it, so its selectors are the shadow elements by name.
 */

// Where each source's project page keeps its chrome.
export const PROJECT_SELECTORS = {
  github: {
    url: 'https://github.com/git/git',
    ready: '.UnderlineNav-item, .prc-components-UnderlineItem',
    header: ['header[role="banner"]', '.AppHeader'],
    nav: [
      'nav[aria-label="Repository"] ul.UnderlineNav-body',
      'nav[aria-label="Repository"] ul',
    ],
    link: ['#readme a[href]', '.markdown-body a[href]', 'main a[href]'],
  },
  gitlab: {
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
  gitea: {
    url: 'https://codeberg.org/forgejo/forgejo',
    ready: '.repo-header, overflow-menu, [data-gs-gitea-nav]',
    header: ['#navbar'],
    nav: ['[data-gs-gitea-nav]', 'overflow-menu .overflow-menu-items'],
    link: ['#readme a[href]', '.markdown a[href]', 'main a[href]'],
  },
  // Bitbucket is repainted through its Atlassian `--ds-*` tokens
  // (`themes/gs-tokens.css`) and relabelled/reoriented by `paintBitbucketNav`.
  bitbucket: {
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
  // Gerrit is not a bundled host; the run grants it and registers it as the
  // `gerrit` kind (see `captures.mjs` `instance`).
  gerrit: {
    url: 'https://gerrit-review.googlesource.com/q/status:open',
    ready: 'gr-app#pg-app',
    header: ['gr-main-header'],
    nav: ['gr-main-header nav', 'nav'],
    link: ['main a[href]', 'a[href]'],
  },
  // plugins:project-anchor — tools/new-plugin.mjs inserts above.
};

// A profile page's selectors differ from the project page's, so each source
// overrides url / ready / header / nav / link here.
export const PROFILE_SELECTORS = {
  github: {
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
  gitlab: {
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
  gitea: {
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
  bitbucket: {
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
  // Gerrit has no public profile; its closest list page is a change list scoped
  // to one project.
  gerrit: {
    url: 'https://gerrit-review.googlesource.com/q/project:gerrit+status:open',
    ready: 'gr-app#pg-app',
    header: ['gr-main-header'],
    nav: ['gr-main-header nav', 'nav'],
    link: ['main a[href]', 'a[href]'],
  },
  // plugins:profile-anchor — tools/new-plugin.mjs inserts above.
};

// The words each target product's menu carries, per page type. The navigation
// *shape* is not here — it comes from the skin's own `layout`. Keyed by skin, so
// a test can check every registry skin has one.
export const PROJECT_VOCAB = {
  github: ['Code', 'Pull requests', 'Actions', 'Insights', 'Projects'],
  gitlab: [
    'Repository',
    'Merge requests',
    'CI/CD',
    'Analytics',
    'Issue boards',
  ],
  bitbucket: ['Source', 'Pull requests', 'Pipelines'],
  // plugins:project-vocab-anchor — tools/new-plugin.mjs inserts above.
};
export const PROFILE_VOCAB = {
  github: ['Overview', 'Repositories', 'Projects', 'Packages', 'Stars'],
  gitlab: [
    'Activity',
    'Groups',
    'Contributed projects',
    'Personal projects',
    'Starred projects',
    'Snippets',
    'Followers',
    'Following',
  ],
  bitbucket: ['Overview', 'Repositories', 'Projects', 'Snippets'],
  // plugins:profile-vocab-anchor — tools/new-plugin.mjs inserts above.
};
