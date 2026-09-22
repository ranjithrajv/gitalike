/**
 * GitAlike — the plugin API.
 *
 * A *skin* (a target UI: GitLab, GitHub, Bitbucket) and a *source* (a forge's
 * markup: GitHub/Primer, GitLab/Pajamas, Gitea/Forgejo, or a vocabulary-only
 * product such as Bitbucket or Gerrit) are each one folder under
 * `src/plugins/`. A plugin registers itself here, once:
 *
 *   plugins/skins/<name>/index.js     defineSkin('<name>', { … })
 *   plugins/sources/<name>/index.js   defineSource('<name>', { … })
 *
 * The constructor validates the object at load and fills its optional
 * capabilities, so a half-added plugin fails with the whole list of what is
 * missing rather than as a silent no-op on a page. The name is the theme key
 * (`gs-theme-<name>`) and the value the popup writes to storage.
 *
 * A source has a `label`; a *markup* source (`markup: true`, the default) also
 * carries `selectors` and `canary`, because its pages are keyed on. A
 * vocabulary-only source (`markup: false`) has neither — its product is
 * client-rendered, so there is nothing to key a hook on, and only the
 * copy/label passes reach it.
 *
 * A source also owns its forge's vocabulary: the bundled `hosts` and the `kind`
 * they are classified as, the `counterpart` and `routes` used to open the same
 * page on the other host, the `reserved` product paths, and the `navScope` /
 * `topbarScope` / `navWords` / `metadataHide` / `activeTabs` its passes read.
 * `lib/sources.js` composes those, so a new forge is one folder.
 *
 * A plugin may name the API it was written against with `minApiVersion`;
 * `assertCompatible` fails when this GitAlike is older.
 *
 * Loaded first, before any plugin folder and before `lib/skins.js` /
 * `lib/sources.js`, which derive the flat tables the rest of the code reads:
 *
 *   plugins/core.js
 *   plugins/skins/<name>/index.js
 *   plugins/sources/<name>/index.js
 *   lib/skins.js              GITALIKE_SKINS
 *   lib/sites.js
 *   lib/sources.js            GITALIKE_SOURCES
 *   lib/ux.js
 *
 * Published on `globalThis.GITALIKE_PLUGINS`.
 */
(() => {
  'use strict';

  /**
   * The plugin API version. Bumped when a skin or source object changes shape in
   * a way an out-of-tree plugin (or the published registry) could notice;
   * `tools/registry.mjs` carries it into `plugins.json` and each plugin may pin
   * the version it needs with `minApiVersion`.
   */
  const API_VERSION = 2;

  const isString = (value) => typeof value === 'string' && value.length > 0;
  const isObject = (value) =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const isHex = (value) => /^#[0-9a-f]{6}$/i.test(value ?? '');
  const isStringArray = (value) =>
    Array.isArray(value) && value.every((item) => isString(item));

  /**
   * Every table a skin must carry, with the shape it must take. A missing or
   * malformed one means the skin is half-added; the whole list is checked once
   * so a contributor sees everything that is missing rather than the first
   * symptom. `tests/contracts.test.mjs` is the same checklist from the outside.
   * @type {[string, string, (value: unknown) => boolean][]}
   */ const SKIN_REQUIRED = [
    ['product', 'the product name, a string', isString],
    ['badge', 'the toolbar badge, a string', isString],
    ['color', 'a #rrggbb string', isHex],
    ['layout', "'github' or 'gitlab'", (v) => ['github', 'gitlab'].includes(v)],
    ['phrases', 'an object of phrase -> phrase', isObject],
    ['nav', 'an object of label -> label', isObject],
    ['labels', 'an object of label -> label', isObject],
    ['chrome', 'an object of label -> label', isObject],
    ['unmapped', 'an object of label -> product', isObject],
    ['navRules', 'an array of source rules', Array.isArray],
    [
      'profileMenu',
      'a function building the menu',
      (v) => typeof v === 'function',
    ],
  ];

  /**
   * How much of each comparison dimension a source can be credited by the parity
   * model — the source's own declaration, so the rubric reads it instead of a
   * hardcoded set. Each is a fraction in [0, 1]:
   *
   *   palette   the skins re-point the design tokens the source reads
   *   nav       a skin pass reorients/relabels the source's navigation
   *   page      the page-wide passes (copy, control labels, markers) reach it
   *   metadata  the description/metadata placement passes apply
   *   profile   the profile passes apply
   *   refs      a `#`/`!` reference marker carries over
   *
   * `tools/compare/parity-score.mjs` reads these from the registry.
   * @type {string[]}
   */
  const COMPARE_KEYS = [
    'palette',
    'nav',
    'page',
    'metadata',
    'profile',
    'refs',
  ];
  const compareDefaults = () =>
    Object.fromEntries(COMPARE_KEYS.map((key) => [key, 0]));

  /**
   * The capabilities a skin opts into, with the value each takes when it does
   * not. Filling them keeps a skin's shape total, but the derived tables publish
   * only the ones a skin *declared*: an empty `keep` must not reach `navKeep`,
   * where it would read as a whitelist of nothing rather than no whitelist at
   * all. A `projectTabs` of null is the absent capability, so the runtime's
   * `PROJECT_TABS[target] || PROJECT_TABS.github` fallback keeps working.
   * Published in the registry so a plugin's powers are visible without reading
   * its file.
   * @type {Record<string, unknown>}
   */
  const SKIN_CAPABILITIES = {
    repoOrder: [],
    hide: [],
    keep: [],
    groups: {},
    shortcuts: {},
    shortcutTargets: {},
    topbarHide: [],
    projectTabs: null,
    // `{ heading, more }` — the applied product's words for a profile's activity
    // section, used to relabel the source's own framing on a profile page.
    activity: null,
  };

  // Fresh values, so two skins never share a default array or object.
  const skinDefaults = () =>
    Object.fromEntries(
      Object.entries(SKIN_CAPABILITIES).map(([key, value]) => [
        key,
        Array.isArray(value) ? [] : isObject(value) ? {} : value,
      ]),
    );

  function canaryProblems(canary) {
    const pages = Array.isArray(canary) ? canary : [];
    if (!pages.length) {
      return 'canary — an array of pages, each with a name, a url and keys';
    }
    const bad = pages.some(
      (page) =>
        !isString(page?.name) ||
        !isString(page?.url) ||
        !Array.isArray(page?.keys) ||
        !page.keys.length,
    );
    return bad
      ? 'canary — every page needs a name, a url and a non-empty keys list'
      : null;
  }

  /** The required parts a skin is missing, named. Empty when complete. */
  function skinProblems(skin) {
    return SKIN_REQUIRED.filter(([key, , ok]) => !ok(skin?.[key])).map(
      ([key, want]) => `${key} — ${want}`,
    );
  }

  /**
   * The page kinds a source can declare, with what each means. A source's
   * `pages` map names, for each kind it *has*, the route that serves it and how
   * a pass reads the page's subject from the URL — or `null` for "this forge has
   * no such page". This is the contract the page-type passes and the parity
   * rubric read, instead of each assuming every forge has a profile, a
   * dashboard, a sign-in form, and so on.
   *
   *   project    a repository's landing page
   *   profile    a user/account page (Gerrit: an owner *query*; Bitbucket: a workspace)
   *   dashboard  the signed-in landing / activity feed
   *   settings   account or repository settings
   *   signIn     the sign-in form
   *   signOut    the sign-out action
   *
   * A kind absent from `pages` means the source says nothing about it (a pass
   * must treat it as unknown); `null` means it declares the forge has none.
   * @type {Record<string, string>}
   */
  const PAGE_KINDS = {
    project: 'a repository’s landing page',
    profile:
      'a user/account page (its nearest equivalent if it has no profile)',
    dashboard: 'the signed-in landing / activity feed',
    settings: 'account or repository settings',
    signIn: 'the sign-in form',
    signOut: 'the sign-out action',
  };

  /**
   * A route is one path shape, or a list of them when a page is served at more
   * than one — a project lives under a user *or* an organisation/group
   * namespace. A shape may be a plain string, or `{ path, namespace }` when the
   * owner segment has a name worth recording.
   */
  function routeProblems(where, route) {
    const routes = Array.isArray(route) ? route : [route];
    if (!routes.length) return [`${where}.route — one path shape, or a list`];
    const problems = [];
    routes.forEach((entry, index) => {
      const at = `${where}.route${Array.isArray(route) ? `[${index}]` : ''}`;
      const path = typeof entry === 'string' ? entry : entry?.path;
      if (!isString(path) || !path.startsWith('/')) {
        problems.push(`${at} — a path shape starting with '/'`);
      }
    });
    return problems;
  }

  function pagesProblems(source) {
    const pages = source.pages;
    if (pages === undefined) return [];
    if (!isObject(pages)) return ['pages — an object keyed by page kind'];
    const problems = [];
    for (const [kind, page] of Object.entries(pages)) {
      if (!Object.hasOwn(PAGE_KINDS, kind)) {
        problems.push(
          `pages.${kind} — not a page kind (${Object.keys(PAGE_KINDS).join(', ')})`,
        );
        continue;
      }
      if (page === null) continue;
      if (!isObject(page)) {
        problems.push(`pages.${kind} — an object, or null for “has none”`);
        continue;
      }
      problems.push(...routeProblems(`pages.${kind}`, page.route));
      if (page.from === undefined) {
        problems.push(
          `pages.${kind}.from — how the subject is read from the URL`,
        );
      }
      // `namespace` names the owner segment when a page has more than one shape
      // (a user namespace vs a group/organisation one), so a consumer can tell
      // the forms apart without re-parsing the pattern.
      if (
        page.namespace !== undefined &&
        !['path', 'pathname'].includes(page.from)
      ) {
        problems.push(
          `pages.${kind}.namespace — only meaningful when \`from\` reads the path`,
        );
      }
    }
    return problems;
  }

  /**
   * The per-forge vocabulary a source may declare beyond its DOM hooks: the
   * bundled hosts it is, the routes and scopes its navigation lives in, and the
   * labels its own markup uses. These are optional, so a fixture that omits them
   * is not judged incomplete; `defineSource` fills the defaults, and a field
   * that *is* present must have the right shape.
   */
  const SOURCE_LIST_FIELDS = {
    hosts: 'an array of hostnames',
    reserved: 'an array of path segments',
    navScope: 'an array of selector strings',
    topbarScope: 'an array of selector strings',
    navWords: 'an array of displayed labels',
    metadataHide: 'an array of section labels',
  };

  const isActiveTabs = (value) =>
    Array.isArray(value) &&
    value.every(
      (entry) =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        entry[0] instanceof RegExp &&
        isString(entry[1]),
    );

  function sourceFieldProblems(source) {
    const problems = [];
    for (const [key, want] of Object.entries(SOURCE_LIST_FIELDS)) {
      if (source[key] !== undefined && !isStringArray(source[key])) {
        problems.push(`${key} — ${want}`);
      }
    }
    if (source.kind !== undefined && !isString(source.kind)) {
      problems.push('kind — a non-empty string');
    }
    if (source.product !== undefined && !isString(source.product)) {
      problems.push('product — a display name, a string');
    }
    if (
      source.counterpart !== undefined &&
      source.counterpart !== null &&
      !isString(source.counterpart)
    ) {
      problems.push('counterpart — a source name, or null');
    }
    if (
      source.routes !== undefined &&
      (!isObject(source.routes) ||
        Object.values(source.routes).some((to) => !isString(to)))
    ) {
      problems.push('routes — an object of segment -> segment');
    }
    if (source.activeTabs !== undefined && !isActiveTabs(source.activeTabs)) {
      problems.push('activeTabs — an array of [pattern, label]');
    }
    return problems;
  }

  /**
   * The required parts a source is missing, named. A markup source needs its
   * hooks and a canary page; a vocabulary-only source must not carry either, so
   * a half-declared one is caught rather than silently skipped.
   */
  function sourceProblems(source) {
    if (!isString(source?.label)) return ['label — a display name, a string'];
    const problems = [];
    for (const [key, value] of Object.entries(source.compare ?? {})) {
      if (typeof value !== 'number' || value < 0 || value > 1) {
        problems.push(`compare.${key} — a number in [0, 1]`);
      }
    }
    problems.push(...pagesProblems(source));
    problems.push(...sourceFieldProblems(source));
    if (source.markup === false) {
      if (isObject(source.selectors) && Object.keys(source.selectors).length) {
        problems.push('selectors — a vocabulary-only source has none');
      }
      if (Array.isArray(source.canary) && source.canary.length) {
        problems.push('canary — a vocabulary-only source has none');
      }
      return problems;
    }
    if (!isObject(source.selectors) || !Object.keys(source.selectors).length) {
      problems.push('selectors — an object with at least one DOM hook');
    }
    const canary = canaryProblems(source.canary);
    if (canary) problems.push(canary);
    return problems;
  }

  /**
   * Fail when this GitAlike is older than the API `minApiVersion` a plugin was
   * written against. `name` only shapes the message. Called by the constructors
   * for a plugin's own `minApiVersion`, and exported for a caller that reads one
   * from elsewhere (the registry, a future out-of-tree loader).
   */
  function assertCompatible(minApiVersion, name) {
    if (minApiVersion === undefined) return;
    if (typeof minApiVersion !== 'number' || minApiVersion > API_VERSION) {
      throw new Error(
        `GitAlike: '${name ?? 'this plugin'}' needs plugin API ${minApiVersion}, ` +
          `but this GitAlike provides ${API_VERSION}`,
      );
    }
  }

  // The registries, keyed by name; every plugin folder fills one entry.
  const skins = {};
  const sources = {};

  function assertNew(kind, into, name) {
    if (typeof name !== 'string' || !name) {
      throw new Error(`GitAlike: a ${kind} needs a name`);
    }
    if (Object.hasOwn(into, name)) {
      throw new Error(`GitAlike: the ${kind} '${name}' is declared twice`);
    }
  }

  /**
   * Register a skin. Fills the optional capabilities, records which ones were
   * declared (non-enumerably, so it never leaks into iteration or JSON), freezes
   * the object and returns it. Throws with the whole missing list if the skin is
   * incomplete, and for a duplicate name or an unmet `minApiVersion`.
   */
  function defineSkin(name, partial) {
    assertNew('skin', skins, name);
    assertCompatible(partial?.minApiVersion, name);
    const skin = { ...skinDefaults(), ...partial };
    const problems = skinProblems(skin);
    if (problems.length) {
      throw new Error(
        `GitAlike: the skin '${name}' is incomplete:\n  - ${problems.join('\n  - ')}`,
      );
    }
    Object.defineProperty(skin, 'declared', {
      value: new Set(Object.keys(partial)),
      enumerable: false,
    });
    skins[name] = Object.freeze(skin);
    return skins[name];
  }

  /**
   * Register a source: its display label, the forge vocabulary it owns (its
   * bundled hosts and kind, its counterpart and routes, its scopes), and, for a
   * markup source, its DOM hooks and canary pages. Throws with the whole missing
   * list if it is incomplete, and for a duplicate name or an unmet
   * `minApiVersion`.
   */
  function defineSource(name, partial) {
    assertNew('source', sources, name);
    assertCompatible(partial?.minApiVersion, name);
    const source = {
      markup: true,
      selectors: {},
      canary: [],
      hosts: [],
      counterpart: null,
      routes: {},
      reserved: [],
      navScope: [],
      topbarScope: [],
      navWords: [],
      metadataHide: [],
      activeTabs: [],
      activity: null,
      ...partial,
      kind: partial?.kind ?? name,
      product: partial?.product ?? partial?.label,
      compare: { ...compareDefaults(), ...partial?.compare },
    };
    const problems = sourceProblems(source);
    if (problems.length) {
      throw new Error(
        `GitAlike: the source '${name}' is incomplete:\n  - ${problems.join('\n  - ')}`,
      );
    }
    sources[name] = Object.freeze(source);
    return sources[name];
  }

  globalThis.GITALIKE_PLUGINS = {
    API_VERSION,
    SKIN_REQUIRED,
    SKIN_CAPABILITIES,
    COMPARE_KEYS,
    PAGE_KINDS,
    defineSkin,
    defineSource,
    skinProblems,
    sourceProblems,
    assertCompatible,
    skins,
    sources,
  };
})();
