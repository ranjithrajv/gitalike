/**
 * GitAlike — the plugin API.
 *
 * A *skin* (a target UI: GitLab, GitHub, Bitbucket) and a *source* (a forge's
 * markup: GitHub/Primer, GitLab/Pajamas, Gitea/Forgejo) are each one file under
 * `src/plugins/`. A plugin registers itself here, once:
 *
 *   plugins/skins/<name>.js     defineSkin('<name>', { … })
 *   plugins/sources/<name>.js   defineSource('<name>', { … })
 *
 * The constructor validates the object at load and fills its optional
 * capabilities, so a half-added plugin fails with the whole list of what is
 * missing rather than as a silent no-op on a page. The name is the theme key
 * (`gs-theme-<name>`) and the value the popup writes to storage.
 *
 * Loaded first, before any plugin file and before `lib/skins.js` /
 * `lib/sources.js`, which derive the flat tables the rest of the code reads:
 *
 *   plugins/core.js
 *   plugins/skins/*.js        defineSkin(...)
 *   plugins/sources/*.js      defineSource(...)
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
   * `tools/registry.mjs` carries it into `plugins.json` so a consumer can pin it.
   */
  const API_VERSION = 1;

  const isString = (value) => typeof value === 'string' && value.length > 0;
  const isObject = (value) =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const isHex = (value) => /^#[0-9a-f]{6}$/i.test(value ?? '');

  /**
   * Every table a skin must carry, with the shape it must take. A missing or
   * malformed one means the skin is half-added; the whole list is checked once
   * so a contributor sees everything that is missing rather than the first
   * symptom. `tests/contracts.test.mjs` is the same checklist from the outside.
   * @type {[string, string, (value: unknown) => boolean][]}
   */
  const SKIN_REQUIRED = [
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
   * What a source must carry: the DOM hooks a skin reads, and the live page the
   * canary watches so a rename upstream fails a scheduled check instead of a
   * user.
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

  /**
   * The capabilities a skin opts into, with the value each takes when it does
   * not. Filling them keeps a skin's shape total, but the derived tables publish
   * only the ones a skin *declared*: an empty `keep` must not reach `navKeep`,
   * where it would read as a whitelist of nothing rather than no whitelist at
   * all. A `projectTabs` of null is the absent capability, so the runtime's
   * `PROJECT_TABS[target] || PROJECT_TABS.github` fallback keeps working.
   */
  const skinDefaults = () => ({
    repoOrder: [],
    hide: [],
    keep: [],
    groups: {},
    shortcuts: {},
    shortcutTargets: {},
    topbarHide: [],
    projectTabs: null,
  });

  /** The required parts `object` is missing or has malformed, named. */
  function problemsFor(required, object) {
    return required
      .filter(([key, , ok]) => !ok(object?.[key]))
      .map(([key, want]) => `${key} — ${want}`);
  }

  /** The required parts a skin is missing, named. Empty when complete. */
  const skinProblems = (skin) => problemsFor(SKIN_REQUIRED, skin);
  /** The required parts a source is missing, named. Empty when complete. */
  const sourceProblems = (source) => problemsFor(SOURCE_REQUIRED, source);

  // The registries, keyed by name; every plugin file fills one entry.
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

  function assertComplete(kind, name, required, object) {
    const problems = problemsFor(required, object);
    if (problems.length) {
      throw new Error(
        `GitAlike: the ${kind} '${name}' is incomplete:\n  - ${problems.join('\n  - ')}`,
      );
    }
  }

  /**
   * Register a skin. Fills the optional capabilities, records which ones were
   * declared (non-enumerably, so it never leaks into iteration or JSON), freezes
   * the object and returns it. Throws with the whole missing list if the skin is
   * incomplete, and for a duplicate name.
   */
  function defineSkin(name, partial) {
    assertNew('skin', skins, name);
    assertComplete('skin', name, SKIN_REQUIRED, partial);
    const skin = { ...skinDefaults(), ...partial };
    Object.defineProperty(skin, 'declared', {
      value: new Set(Object.keys(partial)),
      enumerable: false,
    });
    skins[name] = Object.freeze(skin);
    return skins[name];
  }

  /**
   * Register a source: its DOM hooks and its canary pages. Throws with the whole
   * missing list if it is incomplete, and for a duplicate name.
   */
  function defineSource(name, partial) {
    assertNew('source', sources, name);
    assertComplete('source', name, SOURCE_REQUIRED, partial);
    sources[name] = Object.freeze({ ...partial });
    return sources[name];
  }

  globalThis.GITALIKE_PLUGINS = {
    API_VERSION,
    SKIN_REQUIRED,
    SOURCE_REQUIRED,
    defineSkin,
    defineSource,
    skinProblems,
    sourceProblems,
    skins,
    sources,
  };
})();
