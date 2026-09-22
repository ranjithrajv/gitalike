/**
 * GitAlike — the derived source tables.
 *
 * The sources themselves are declared one folder per plugin under
 * `src/plugins/sources/`, registering with `defineSource` (`plugins/core.js`).
 * Every source is registered, markup or not; this file derives the shapes the
 * rest of the code reads — `SELECTORS` keyed by *markup* source, a flat
 * `CANARY_PAGES` list with the source named on each page, and `PAGES`, the
 * route each source declares for a page kind (`pages.profile` and friends) —
 * and publishes `globalThis.GITALIKE_SOURCES`.
 *
 * `SELECTORS` are the DOM hooks a skin reads. The stylesheets spell their
 * selectors out — CSS cannot read this table — so a hook a stylesheet owns is
 * marked `// css` in the plugin folder, and `tests/contracts.test.mjs` checks
 * the two agree. `canary` is the live page `tools/compare/selector-canary.mjs`
 * fetches and the keys it must still carry, so a renamed hook is one failing
 * check rather than a literal to hunt through three files.
 *
 * Loaded after every source plugin and before `ux.js`. It validates the source
 * structure at load — a selector that is not a string, a canary pinning a hook
 * the source does not declare — so a typo fails here by name rather than as a
 * canary that silently watches nothing.
 */
(() => {
  'use strict';

  if (!globalThis.GITALIKE_PLUGINS) {
    throw new Error(
      'GitAlike: plugins/core.js must be loaded before lib/sources.js',
    );
  }
  const {
    SOURCE_REQUIRED,
    defineSource,
    sourceProblems,
    sources: SOURCES,
  } = globalThis.GITALIKE_PLUGINS;

  const markupSources = Object.entries(SOURCES).filter(
    ([, source]) => source.markup !== false,
  );

  for (const [name, source] of markupSources) {
    for (const [key, selector] of Object.entries(source.selectors)) {
      if (typeof selector !== 'string' || !selector.trim()) {
        throw new Error(
          `GitAlike: source '${name}' selector '${key}' is not a selector string`,
        );
      }
    }
    for (const page of source.canary) {
      for (const key of page.keys) {
        if (!Object.hasOwn(source.selectors, key)) {
          throw new Error(
            `GitAlike: source '${name}' canary '${page.name}' pins '${key}', ` +
              `which is not one of its selectors`,
          );
        }
      }
    }
  }

  const SELECTORS = Object.fromEntries(
    markupSources.map(([name, source]) => [name, source.selectors]),
  );
  const CANARY_PAGES = markupSources.flatMap(([name, source]) =>
    source.canary.map((page) => ({ ...page, source: name })),
  );
  // The page kinds each source declares (`pages`), keyed by source and kind, so
  // a pass reads the route that serves a page instead of hardcoding it. Every
  // source, markup or not: a vocabulary-only source can still name the route
  // that serves its profile equivalent (Gerrit's owner query).
  const PAGES = Object.fromEntries(
    Object.entries(SOURCES).map(([name, source]) => [name, source.pages ?? {}]),
  );

  globalThis.GITALIKE_SOURCES = {
    SOURCE_REQUIRED,
    defineSource,
    sourceProblems,
    SOURCES,
    SELECTORS,
    CANARY_PAGES,
    PAGES,
  };
})();
