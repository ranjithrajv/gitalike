#!/usr/bin/env node
/**
 * What `screenshots.mjs` captures — derived from each source's `parity.mjs`, with
 * no Playwright import, so the unit tests and the page can be checked against the
 * same source of truth.
 *
 * A *job* is one URL: the base frame with every skin off, plus one frame per skin
 * with that skin on. A source declares its two pages (project and profile) beside
 * itself; the skins it can wear and the file names are derived here, so the two
 * page types can never cover a different set of sources and a skin cannot be
 * missing from one source's table.
 *
 * The file names are a contract between three things: this table, the PNGs on
 * disk, and the `<picture>` blocks in `docs/index.html`. `tests/compare/captures.test.mjs`
 * holds them together, the way `SELECTORS`'s `// css` markers are held to the
 * stylesheets.
 *
 * A source is never painted as itself, so the GitHub pages list GitLab and
 * Bitbucket, the GitLab pages list GitHub and Bitbucket, and Codeberg
 * (GitHub-flavoured markup) and Gerrit (which has no skin of its own) list all
 * three.
 */

import '../plugins.mjs';
import { loadSourceParity } from './parity-files.mjs';

/**
 * The skin a capture entry wears. `setting` is the single source of truth: the
 * html class the content script adds and the theme name parity-visual.mjs groups
 * by are both derived from it, so a skin is described once.
 */
export const themeOf = (entry) => Object.values(entry.setting)[0];

const SKINS = Object.keys(globalThis.GITALIKE_PLUGINS.skins);
const SOURCE_NAMES = Object.keys(globalThis.GITALIKE_PLUGINS.sources);
const KINDS = globalThis.GITALIKE_SOURCES.SOURCE_KINDS;

/**
 * The skins a source can wear, with the file each frame is written to. The kind
 * is the product button the capture harness presses (a GitHub-flavoured forge
 * uses the `github` kind); the source's own skin is skipped. The profile suffix
 * is `-profile`, so a source's frames are `<prefix>-<skin>.png` and
 * `<prefix>-profile-<skin>.png`.
 */
function skinsFor(key, prefix, suffix) {
  const own = SKINS.includes(key) ? key : null;
  return SKINS.filter((skin) => skin !== own).map((skin) => ({
    setting: { [KINDS[key]]: skin },
    over: `${prefix}${suffix}-${skin}.png`,
  }));
}

function pagesFor(key, prefix, project, profile) {
  const job = (page, suffix) => ({
    ...page,
    base: `${prefix}${suffix}-default.png`,
    skins: skinsFor(key, prefix, suffix),
  });
  return { project: job(project, ''), profile: job(profile, '-profile') };
}

/**
 * One entry per source, in the registry's order, with its project-page and
 * profile-page job. `key` is the markup family, which is what the capture tools
 * group by — not the host's kind.
 */
export const SOURCES = [];
for (const key of SOURCE_NAMES) {
  const { capture } = await loadSourceParity(key);
  const { prefix, host, instance, project, profile } = capture;
  SOURCES.push({
    key,
    prefix,
    host,
    // A source the extension does not bundle (Gerrit) registers its host for the
    // capture run only; `screenshots.mjs` reads this to grant it.
    ...(instance ? { instance } : {}),
    ...pagesFor(key, prefix, project, profile),
  });
}

/** Project-page jobs, one per source, in the registry's order. */
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
