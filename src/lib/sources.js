/**
 * GitAlike — the derived source tables.
 *
 * The sources themselves are declared one file per plugin under
 * `src/plugins/sources/`, registering with `defineSource` (`plugins/core.js`).
 * This file derives the shapes the rest of the code reads — `SELECTORS` keyed by
 * source, and a flat `CANARY_PAGES` list with the source named on each page —
 * and publishes `globalThis.GITALIKE_SOURCES`.
 *
 * `SELECTORS` are the DOM hooks a skin reads. The stylesheets spell their
 * selectors out — CSS cannot read this table — so a hook a stylesheet owns is
 * marked `// css` in the plugin file, and `tests/contracts.test.mjs` checks the
 * two agree. `canary` is the live page `tools/compare/selector-canary.mjs`
 * fetches and the keys it must still carry, so a renamed hook is one failing
 * check rather than a literal to hunt through three files.
 *
 * Loaded after every source plugin and before `ux.js`.
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
