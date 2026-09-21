#!/usr/bin/env node
/**
 * What `screenshots.mjs` captures — the tables alone, with no Playwright import,
 * so the unit tests and the page can be checked against the same source of truth.
 *
 * A *job* is one URL: the base frame with every skin off, plus one frame per skin
 * with that skin on. Two skins is two entries in `skins`; the base is captured
 * once and shared, so adding a skin costs one capture, not two.
 *
 * The file names are a contract between three things: this table, the PNGs on
 * disk, and the `<picture>` blocks in `docs/index.html`. `tests/captures.test.mjs`
 * holds them together, the way `SELECTORS`'s `// css` markers are held to the
 * stylesheets.
 *
 * `layout` decides which skins a source can wear and which is a no-op: a source
 * is never painted as itself, so the GitHub pages list GitLab and Bitbucket, the
 * GitLab pages list GitHub and Bitbucket, and Codeberg (GitHub-flavoured markup)
 * lists all three.
 */

// Project-page jobs. Both pages are public and carry the real chrome (header,
// token colours, logo) the skins repaint. `ready` waits for the page's own
// marker, so the shot is not on a skeleton.
export const PROJECT_JOBS = [
  {
    name: 'GitHub project',
    url: 'https://github.com/microsoft/vscode',
    ready: '.UnderlineNav-item, .prc-components-UnderlineItem',
    base: 'github-default.png',
    skins: [
      {
        setting: { github: 'gitlab' },
        cls: 'gs-theme-gitlab',
        over: 'github-gitlab.png',
      },
      {
        setting: { github: 'bitbucket' },
        cls: 'gs-theme-bitbucket',
        over: 'github-bitbucket.png',
      },
    ],
  },
  {
    name: 'GitLab project',
    url: 'https://gitlab.com/gitlab-org/gitlab',
    ready:
      '.super-sidebar:not(.super-sidebar-loading), [data-testid="project-header"]',
    base: 'gitlab-default.png',
    skins: [
      {
        setting: { gitlab: 'github' },
        cls: 'gs-theme-github',
        over: 'gitlab-github.png',
      },
      {
        setting: { gitlab: 'bitbucket' },
        cls: 'gs-theme-bitbucket',
        over: 'gitlab-bitbucket.png',
      },
    ],
  },
  // Codeberg is GitHub-flavoured, so any of the three skins can be captured from
  // the same base. The Gitea project nav is an `overflow-menu`; the GitLab and
  // Bitbucket skins rebuild it as `[data-gs-gitea-nav]`, so `ready` accepts
  // either.
  {
    name: 'Codeberg (Gitea) project',
    url: 'https://codeberg.org/forgejo/forgejo',
    ready: '.repo-header, overflow-menu, [data-gs-gitea-nav]',
    base: 'codeberg-default.png',
    skins: [
      {
        setting: { github: 'gitlab' },
        cls: 'gs-theme-gitlab',
        over: 'codeberg-gitlab.png',
      },
      {
        setting: { github: 'github' },
        cls: 'gs-theme-github',
        over: 'codeberg-github.png',
      },
      {
        setting: { github: 'bitbucket' },
        cls: 'gs-theme-bitbucket',
        over: 'codeberg-bitbucket.png',
      },
    ],
  },
];

// Profile-page jobs. The profiles are public and rich enough to show both the
// navigation and the metadata the skin repaints.
export const PROFILE_JOBS = [
  {
    name: 'GitHub profile',
    url: 'https://github.com/torvalds',
    ready: 'nav[aria-label="User profile"]',
    base: 'github-profile-default.png',
    skins: [
      {
        setting: { github: 'gitlab' },
        cls: 'gs-theme-gitlab',
        over: 'github-profile-gitlab.png',
      },
      {
        setting: { github: 'bitbucket' },
        cls: 'gs-theme-bitbucket',
        over: 'github-profile-bitbucket.png',
      },
    ],
  },
  {
    name: 'GitLab profile',
    // A profile with bio, location and contact links set, so the card has more
    // than the name to show — sytses (the example in the docs) has neither.
    url: 'https://gitlab.com/dzaporozhets',
    ready:
      '.super-sidebar:not(.super-sidebar-loading) .user-profile-header, .user-profile-header',
    base: 'gitlab-profile-default.png',
    skins: [
      {
        setting: { gitlab: 'github' },
        cls: 'gs-theme-github',
        over: 'gitlab-profile-github.png',
      },
      {
        setting: { gitlab: 'bitbucket' },
        cls: 'gs-theme-bitbucket',
        over: 'gitlab-profile-bitbucket.png',
      },
    ],
  },
];

// Store-listing shots: one frame each, with the named skin on. The base shot is
// per source, so the setting is per shot too — one skin is active at a time.
export const STORE_SHOTS = [
  {
    name: 'GitHub project as GitLab',
    url: 'https://github.com/microsoft/vscode',
    setting: { github: 'gitlab' },
    cls: 'gs-theme-gitlab',
    ready: '.UnderlineNav-item, .prc-components-UnderlineItem',
    file: '01-as-gitlab.png',
  },
  {
    name: 'GitLab project as GitHub',
    url: 'https://gitlab.com/gitlab-org/gitlab',
    setting: { gitlab: 'github' },
    cls: 'gs-theme-github',
    ready:
      '.super-sidebar:not(.super-sidebar-loading), [data-testid="project-header"]',
    file: '02-as-github.png',
  },
];
