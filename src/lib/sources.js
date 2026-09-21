/**
 * GitAlike — the sources, one object per forge markup family.
 *
 * A *source* is the markup a page is built on (GitHub's Primer, GitLab's
 * Pajamas, Gitea/Forgejo's templates) — not the skin applied to it, because a
 * Gitea site wears either UI but keeps Gitea's markup. A *skin* is the target
 * UI (see skins.js). The two are independent: any source can wear any skin.
 *
 * `selectors` are the DOM hooks the skin reads. The stylesheets spell their
 * selectors out — CSS cannot read this table — so a hook a stylesheet owns is
 * marked `// css`, and `tests/contracts.test.mjs` checks the two agree.
 * `canary` is the live page `tools/compare/selector-canary.mjs` fetches and the
 * keys it must still carry, so a renamed hook is one failing check rather than
 * a literal to hunt through three files.
 *
 * Adding a source is one object here — plus, for a forge people host, a
 * `builtin`/`SOURCES` entry in sites.js and any new vocabulary in the skins.
 * The regions a source's navigation and top bar live in are the shared
 * `NAV_SCOPE`/`TOPBAR_SCOPE` lists in ux.js; add the source's region there.
 *
 * Published on `globalThis.GITALIKE_SOURCES`; loaded before `ux.js` everywhere
 * (see `src/background.js` `CONTENT_JS`, `build.mjs` and `popup.html`).
 */
(() => {
  'use strict';

  const isString = (value) => typeof value === 'string' && value.length > 0;
  const isObject = (value) =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

  /**
   * What a source must carry: the DOM hooks a skin reads, and the live page the
   * canary watches so a rename upstream fails a scheduled check instead of a
   * user. A source with neither is not a plugin yet; the checks run once at load
   * so a contributor sees everything missing at once.
   * @type {[string, string, (value: unknown) => boolean][]}
   */
  const SOURCE_REQUIRED = [
    [
      'selectors',
      'an object with at least one DOM hook',
      (v) => isObject(v) && Object.keys(v).length > 0,
    ],
    [
      'canary',
      'an array of pages, each with a name, a url and keys',
      (v) =>
        Array.isArray(v) &&
        v.length > 0 &&
        v.every(
          (page) =>
            isString(page?.name) &&
            isString(page?.url) &&
            Array.isArray(page?.keys) &&
            page.keys.length > 0,
        ),
    ],
  ];

  // A source is data, so wrapping it is only the place the shape is documented;
  // validation happens once every name is known, in the loop below.
  const defineSource = (partial) => Object.freeze({ ...partial });

  const SOURCES = {
    github: defineSource({
      // A display name for the registry, the site's chip and the docs.
      label: 'GitHub — Primer',
      // GitHub's markup (Primer).
      selectors: {
        repoNavList: 'nav[aria-label="Repository"] ul.UnderlineNav-body', // css
        appHeader: 'header[role="banner"], .AppHeader', // css
        metadataSidebar: '[class*="CodeViewSidebar-"]',
        metadataPane: '[class*="PageLayoutContent-"]', // css
        profileNav: 'nav[aria-label="User profile"]', // css
        profileMenu: 'nav[aria-label="User profile"]',
        profileFrame: 'div[data-turbo-frame="user-profile-frame"]', // css
        profileEditable: '.js-profile-editable-replace',
        profileDetail: '.vcard-detail',
        profileOrg: '[itemprop="worksFor"], .p-org',
        profileLocation: '[itemprop="homeLocation"], .p-label',
        profileName: '.h-card .p-name',
      },
      canary: [
        {
          name: 'GitHub repository page',
          url: 'https://github.com/git/git',
          keys: ['repoNavList', 'metadataSidebar', 'metadataPane', 'appHeader'],
        },
        {
          name: 'GitHub profile page',
          url: 'https://github.com/torvalds',
          keys: ['profileNav', 'profileFrame'],
        },
      ],
    }),

    gitlab: defineSource({
      label: 'GitLab — Pajamas',
      // GitLab's markup (Pajamas, plus its older CSS).
      selectors: {
        superSidebar: '.super-sidebar', // css
        navContainer: '[data-testid="nav-container"]',
        projectFiles: '.project-show-files',
        projectSidebarBlock: '.project-page-sidebar-block',
        projectLayoutSidebar: '.project-page-layout-sidebar',
        profileHeader: '.user-profile-header', // css
        profileIdentity: '.user-profile-header > div:last-child',
        profileSidebar: '.user-profile-sidebar', // css
        profileName: '.user-profile-header h1',
        profileMenu: '.super-sidebar .gl-scroll-scrim ul',
        followersLink: '.super-sidebar a[data-track-label="followers_menu"]',
        followingLink: '.super-sidebar a[data-track-label="following_menu"]',
      },
      canary: [
        {
          name: 'GitLab project page',
          url: 'https://gitlab.com/gitlab-org/gitlab',
          keys: ['superSidebar', 'projectSidebarBlock'],
        },
        {
          name: 'GitLab profile page',
          url: 'https://gitlab.com/dzaporozhets',
          keys: ['superSidebar', 'profileHeader', 'profileSidebar'],
        },
      ],
    }),

    gitea: defineSource({
      label: 'Gitea / Forgejo',
      // Gitea and Forgejo share one markup family, so one source covers both
      // hosts: gitea.com (Gitea) and codeberg.org (Forgejo). Each host has its
      // own canary page below, so if the 2024 hard fork's UI ever diverges the
      // daily job says so — and the two can then be split into separate sources.
      // Its navigation hooks also live in the skins' `navRules`; a test asserts
      // the two stay equal.
      selectors: {
        repoNavList: 'overflow-menu .overflow-menu-items',
        repoMenu: '.page-content.repository > .secondary-nav > overflow-menu',
        themeMarker: '[data-theme]', // css
        topBar: '#navbar', // css
        repoHeader: '.repo-header', // css
        pullLink: 'a[href*="/pulls/"]',
      },
      canary: [
        {
          name: 'Codeberg (Forgejo) project page',
          url: 'https://codeberg.org/forgejo/forgejo',
          keys: [
            'themeMarker',
            'topBar',
            'repoHeader',
            'repoNavList',
            'repoMenu',
          ],
        },
        {
          name: 'Codeberg (Forgejo) pull requests',
          url: 'https://codeberg.org/forgejo/forgejo/pulls',
          keys: ['themeMarker', 'pullLink'],
        },
        {
          // gitea.com puts a repository's pull-request list behind sign-in, so
          // the project page is canaried instead — it carries the pull link too.
          name: 'gitea.com (Gitea) project page',
          url: 'https://gitea.com/gitea/act',
          keys: [
            'themeMarker',
            'topBar',
            'repoHeader',
            'repoNavList',
            'repoMenu',
            'pullLink',
          ],
        },
      ],
    }),

    // plugins:anchor — `node tools/new-plugin.mjs source <name>` inserts above.
  };

  /**
   * The required parts a source is missing or has malformed, named. Empty when
   * the source is complete; shared with the contract test.
   */
  function sourceProblems(source) {
    return SOURCE_REQUIRED.filter(([key, , ok]) => !ok(source[key])).map(
      ([key, want]) => `${key} — ${want}`,
    );
  }

  // Validate every source once its name is known, so a half-added one fails with
  // its whole missing list rather than as a canary that silently watches nothing.
  for (const [name, source] of Object.entries(SOURCES)) {
    const problems = sourceProblems(source);
    if (problems.length) {
      throw new Error(
        `GitAlike: source '${name}' is incomplete:\n  - ${problems.join('\n  - ')}`,
      );
    }
  }

  // The shapes the rest of the code reads: `SELECTORS` keyed by source, and a
  // flat `CANARY_PAGES` list with the source named on each page.
  const SELECTORS = Object.fromEntries(
    Object.entries(SOURCES).map(([name, source]) => [name, source.selectors]),
  );
  const CANARY_PAGES = Object.entries(SOURCES).flatMap(([name, source]) =>
    source.canary.map((page) => ({ ...page, source: name })),
  );

  globalThis.GITALIKE_SOURCES = {
    SOURCE_REQUIRED,
    defineSource,
    sourceProblems,
    SOURCES,
    SELECTORS,
    CANARY_PAGES,
  };
})();
