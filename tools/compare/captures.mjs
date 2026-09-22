#!/usr/bin/env node
/**
 * What `screenshots.mjs` captures — the tables alone, with no Playwright import,
 * so the unit tests and the page can be checked against the same source of truth.
 *
 * A *job* is one URL: the base frame with every skin off, plus one frame per skin
 * with that skin on. Two skins is two entries in `skins`; the base is captured
 * once and shared, so adding a skin costs one capture, not two.
 *
 * There is one `SOURCES` table, and each source carries *both* its project-page
 * and its profile-page job. `PROJECT_JOBS` and `PROFILE_JOBS` are derived from
 * it, so the two page types can never cover a different set of sources — which
 * is how Codeberg was missing from profiles while present in projects.
 *
 * The file names are a contract between three things: this table, the PNGs on
 * disk, and the `<picture>` blocks in `docs/index.html`. `tests/captures.test.mjs`
 * holds them together, the way `SELECTORS`'s `// css` markers are held to the
 * stylesheets.
 *
 * A source's `skins` lists the UIs it can wear: it is never painted as itself,
 * so the GitHub pages list GitLab and Bitbucket, the GitLab pages list GitHub
 * and Bitbucket, and Codeberg (GitHub-flavoured markup) and Gerrit (which has no
 * skin of its own) list all three.
 */

import '../plugins.mjs';

/**
 * The skin a capture entry wears. `setting` is the single source of truth: the
 * html class the content script adds and the theme name parity-visual.mjs groups
 * by are both derived from it, so a skin is described once.
 */
export const themeOf = (entry) => Object.values(entry.setting)[0];

/**
 * One entry per source product, with its project-page and profile-page job.
 * `key` is the markup family (`github`, `gitlab`, `gitea`, `bitbucket`), which
 * is what the capture tools group by — not the host's kind.
 */
export const SOURCES = [
  {
    key: 'github',
    prefix: 'github',
    host: 'github.com',
    project: {
      name: 'GitHub project',
      url: 'https://github.com/microsoft/vscode',
      ready: '.UnderlineNav-item, .prc-components-UnderlineItem',
      base: 'github-default.png',
      skins: [
        { setting: { github: 'gitlab' }, over: 'github-gitlab.png' },
        { setting: { github: 'bitbucket' }, over: 'github-bitbucket.png' },
      ],
    },
    profile: {
      name: 'GitHub profile',
      url: 'https://github.com/torvalds',
      ready: 'nav[aria-label="User profile"]',
      base: 'github-profile-default.png',
      skins: [
        { setting: { github: 'gitlab' }, over: 'github-profile-gitlab.png' },
        {
          setting: { github: 'bitbucket' },
          over: 'github-profile-bitbucket.png',
        },
      ],
    },
  },
  {
    key: 'gitlab',
    prefix: 'gitlab',
    host: 'gitlab.com',
    project: {
      name: 'GitLab project',
      url: 'https://gitlab.com/gitlab-org/gitlab',
      ready:
        '.super-sidebar:not(.super-sidebar-loading), [data-testid="project-header"]',
      base: 'gitlab-default.png',
      skins: [
        { setting: { gitlab: 'github' }, over: 'gitlab-github.png' },
        { setting: { gitlab: 'bitbucket' }, over: 'gitlab-bitbucket.png' },
      ],
    },
    profile: {
      name: 'GitLab profile',
      // A profile with bio, location and contact links set, so the card has more
      // than the name to show — sytses (the example in the docs) has neither.
      url: 'https://gitlab.com/dzaporozhets',
      ready:
        '.super-sidebar:not(.super-sidebar-loading) .user-profile-header, .user-profile-header',
      base: 'gitlab-profile-default.png',
      skins: [
        { setting: { gitlab: 'github' }, over: 'gitlab-profile-github.png' },
        {
          setting: { gitlab: 'bitbucket' },
          over: 'gitlab-profile-bitbucket.png',
        },
      ],
    },
  },
  // Codeberg is GitHub-flavoured, so any of the three skins can be captured from
  // the same base. The Gitea nav is an `overflow-menu`; the GitLab and Bitbucket
  // skins rebuild it as `[data-gs-gitea-nav]`, so `ready` accepts either.
  {
    key: 'gitea',
    prefix: 'codeberg',
    host: 'codeberg.org',
    project: {
      name: 'Codeberg (Gitea) project',
      url: 'https://codeberg.org/forgejo/forgejo',
      ready: '.repo-header, overflow-menu, [data-gs-gitea-nav]',
      base: 'codeberg-default.png',
      skins: [
        { setting: { github: 'gitlab' }, over: 'codeberg-gitlab.png' },
        { setting: { github: 'github' }, over: 'codeberg-github.png' },
        { setting: { github: 'bitbucket' }, over: 'codeberg-bitbucket.png' },
      ],
    },
    profile: {
      name: 'Codeberg (Gitea) profile',
      url: 'https://codeberg.org/forgejo',
      ready: '.user.profile, .profile-header, .ui.container',
      base: 'codeberg-profile-default.png',
      skins: [
        {
          setting: { github: 'gitlab' },
          over: 'codeberg-profile-gitlab.png',
        },
        {
          setting: { github: 'github' },
          over: 'codeberg-profile-github.png',
        },
        {
          setting: { github: 'bitbucket' },
          over: 'codeberg-profile-bitbucket.png',
        },
      ],
    },
  },
  // Bitbucket as a source. Its markup is its own; the GitHub and GitLab skins
  // repaint it through its Atlassian `--ds-*` tokens and relabel/reorient its
  // navigation. The page is client-rendered, so `ready` waits for the ref
  // selector, not a shell.
  {
    key: 'bitbucket',
    prefix: 'bitbucket',
    host: 'bitbucket.org',
    project: {
      name: 'Bitbucket project',
      url: 'https://bitbucket.org/atlassian/atlassian-connect-express/src/master/',
      ready: '[data-testid="ref-selector-trigger"]',
      base: 'bitbucket-default.png',
      skins: [
        { setting: { bitbucket: 'github' }, over: 'bitbucket-github.png' },
        { setting: { bitbucket: 'gitlab' }, over: 'bitbucket-gitlab.png' },
      ],
    },
    // Bitbucket has no public user profile, so its account reference is the
    // workspace repositories page — the closest thing it serves.
    profile: {
      name: 'Bitbucket profile',
      url: 'https://bitbucket.org/tutorials/workspace/repositories/',
      ready: '[data-testid="profile-repository-row"]',
      base: 'bitbucket-profile-default.png',
      skins: [
        {
          setting: { bitbucket: 'github' },
          over: 'bitbucket-profile-github.png',
        },
        {
          setting: { bitbucket: 'gitlab' },
          over: 'bitbucket-profile-gitlab.png',
        },
      ],
    },
  },
  // Gerrit. It is not a bundled host, so the capture run grants
  // `gerrit-review.googlesource.com` and registers it as the `gerrit` kind for
  // that run only (`instance` below). PolyGerrit renders inside shadow DOM and
  // the Gerrit support is palette-only, so a skinned frame differs from the base
  // mainly in colour.
  {
    key: 'gerrit',
    prefix: 'gerrit',
    host: 'gerrit-review.googlesource.com',
    instance: { host: 'gerrit-review.googlesource.com', kind: 'gerrit' },
    project: {
      name: 'Gerrit change list',
      url: 'https://gerrit-review.googlesource.com/q/status:open',
      ready: 'gr-app#pg-app',
      base: 'gerrit-default.png',
      skins: [
        { setting: { gerrit: 'github' }, over: 'gerrit-github.png' },
        { setting: { gerrit: 'gitlab' }, over: 'gerrit-gitlab.png' },
        { setting: { gerrit: 'bitbucket' }, over: 'gerrit-bitbucket.png' },
      ],
    },
    // Gerrit has no public profile. Like Bitbucket's workspace page, its closest
    // page is an owner query, which PolyGerrit heads with `gr-user-header` — the
    // account's avatar, name, email and join date, which the skins reshape.
    profile: {
      name: 'Gerrit owner changes',
      url: 'https://gerrit-review.googlesource.com/q/owner:david.ostrovsky@gmail.com',
      ready: 'gr-user-header',
      base: 'gerrit-profile-default.png',
      skins: [
        { setting: { gerrit: 'github' }, over: 'gerrit-profile-github.png' },
        { setting: { gerrit: 'gitlab' }, over: 'gerrit-profile-gitlab.png' },
        {
          setting: { gerrit: 'bitbucket' },
          over: 'gerrit-profile-bitbucket.png',
        },
      ],
    },
  },
  // plugins:capture-anchor — tools/new-plugin.mjs inserts a source recipe above.
];

/**
 * Sources with no live capture, and why. The registry is the list of sources
 * that exist; this table is the subset a browser can drive. Every source the
 * registry ships has a recipe below today, so the set is empty; a new source
 * without one fails loudly in `parity-visual`, `parity-style` and `style-parity`
 * rather than silently going unmeasured.
 */
export const NO_CAPTURE = new Set();

{
  const captured = new Set(SOURCES.map((source) => source.key));
  const missing = Object.keys(globalThis.GITALIKE_PLUGINS.sources).filter(
    (key) => !captured.has(key) && !NO_CAPTURE.has(key),
  );
  if (missing.length) {
    throw new Error(
      `captures: no capture recipe for ${missing.join(', ')} — add one to ` +
        'SOURCES, or a NO_CAPTURE reason',
    );
  }
}

// The skins a source can wear are the registry's: every skin except the one it
// already is (a source is never painted as itself). The authored order and file
// names stay, but a set that drifts from the registry fails here rather than
// silently measuring the wrong skins.
{
  const skinKeys = Object.keys(globalThis.GITALIKE_PLUGINS.skins);
  for (const source of SOURCES) {
    const own = skinKeys.includes(source.key) ? source.key : null;
    const expected = skinKeys
      .filter((skin) => skin !== own)
      .sort()
      .join(',');
    for (const page of ['project', 'profile']) {
      const got = source[page].skins
        .map((skin) => themeOf(skin))
        .sort()
        .join(',');
      if (got !== expected) {
        throw new Error(
          `captures: ${source.key} ${page} skins are [${got}] but the ` +
            `registry expects [${expected}]`,
        );
      }
    }
  }
}

/** Project-page jobs, one per source, in the table's order. */
export const PROJECT_JOBS = SOURCES.map((source) => source.project);

/** Profile-page jobs, one per source, so the two page types always match. */
export const PROFILE_JOBS = SOURCES.map((source) => source.profile);

// Store-listing shots: one frame each, with the named skin on. The base shot is
// per source, so the setting is per shot too — one skin is active at a time.
export const STORE_SHOTS = [
  {
    name: 'GitHub project as GitLab',
    url: 'https://github.com/microsoft/vscode',
    setting: { github: 'gitlab' },
    ready: '.UnderlineNav-item, .prc-components-UnderlineItem',
    file: '01-as-gitlab.png',
  },
  {
    name: 'GitLab project as GitHub',
    url: 'https://gitlab.com/gitlab-org/gitlab',
    setting: { gitlab: 'github' },
    ready:
      '.super-sidebar:not(.super-sidebar-loading), [data-testid="project-header"]',
    file: '02-as-github.png',
  },
];
