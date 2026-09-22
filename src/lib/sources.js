/**
 * GitAlike — the derived source tables.
 *
 * The sources themselves are declared one folder per plugin under
 * `src/plugins/sources/`, registering with `defineSource` (`plugins/core.js`).
 * Every source is registered, markup or not; this file derives the shapes the
 * rest of the code reads from what each source declares:
 *
 *   SELECTORS      the DOM hooks a skin reads, keyed by *markup* source
 *   CANARY_PAGES   a flat list of the live pages the canary watches
 *   PAGES          the route each source declares for a page kind
 *   HOSTS          bundled hostname -> source
 *   HOST_PAIRS     a bundled host -> the counterpart host it maps onto
 *   SOURCE_KINDS   source -> the product kind it is classified as
 *   NAV_SCOPE      every source's navigation regions, one selector list
 *   TOPBAR_SCOPE   every source's top bar, one selector list
 *   NAV_WORDS      source -> the displayed labels its nav bar is found by
 *   METADATA_HIDE  source -> the metadata sections a target UI does not list
 *   ACTIVE_TABS    source -> the page -> tab rules for the applied UI
 *   RESERVED       source -> first path segments that are not an owner/repo
 *   ROUTES         source -> its route segment -> the counterpart's
 *
 * A source's vocabulary lives in its folder, so adding a forge is one folder;
 * this file only composes what the folders declare. `SELECTORS` are the DOM
 * hooks a skin reads; the stylesheets spell their selectors out — CSS cannot
 * read this table — so a hook a stylesheet owns is marked `// css` in the
 * plugin folder, and `tests/contracts.test.mjs` checks the two agree.
 *
 * Loaded after every source plugin and before `ux.js`. It validates the source
 * structure at load — a selector that is not a string, a canary pinning a hook
 * the source does not declare, a host declared twice — so a typo fails here by
 * name rather than as a canary that silently watches nothing.
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

  const names = Object.keys(SOURCES);
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

  // A bundled host belongs to exactly one source; two claiming it is a
  // copy-paste error that would make the picker disagree with itself.
  const HOSTS = {};
  for (const [name, source] of Object.entries(SOURCES)) {
    for (const host of source.hosts) {
      if (Object.hasOwn(HOSTS, host)) {
        throw new Error(
          `GitAlike: host '${host}' is bundled by both '${HOSTS[host]}' and '${name}'`,
        );
      }
      HOSTS[host] = name;
    }
  }

  // A counterpart must be a registered source, and the two route maps must be
  // inverses, so a route added to one side cannot be forgotten on the other.
  for (const [name, source] of Object.entries(SOURCES)) {
    if (!source.counterpart) continue;
    const other = SOURCES[source.counterpart];
    if (!other) {
      throw new Error(
        `GitAlike: source '${name}' names counterpart '${source.counterpart}', which is not registered`,
      );
    }
    for (const [segment, to] of Object.entries(source.routes)) {
      if (other.routes[to] !== segment) {
        throw new Error(
          `GitAlike: source '${name}' route '${segment} -> ${to}' has no inverse in '${source.counterpart}'`,
        );
      }
    }
  }

  // The flat tables the rest of the code reads. `bySource` keeps every source,
  // so a caller can look one up without a guard; a source that declares nothing
  // simply contributes an empty list to the scope union.
  const bySource = (key) =>
    Object.fromEntries(names.map((name) => [name, SOURCES[name][key]]));

  const union = (key) => names.flatMap((name) => SOURCES[name][key]).join(',');

  const HOST_PAIRS = {};
  for (const [name, source] of Object.entries(SOURCES)) {
    const other = source.counterpart && SOURCES[source.counterpart];
    if (!other || !other.hosts.length) continue;
    for (const host of source.hosts) {
      HOST_PAIRS[host] = {
        from: name,
        host: other.hosts[0],
        product: source.product,
      };
    }
  }

  const SELECTORS = Object.fromEntries(
    markupSources.map(([name, source]) => [name, source.selectors]),
  );
  const CANARY_PAGES = markupSources.flatMap(([name, source]) =>
    source.canary.map((page) => ({ ...page, source: name })),
  );
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
    HOSTS,
    HOST_PAIRS,
    SOURCE_KINDS: bySource('kind'),
    NAV_SCOPE: union('navScope'),
    TOPBAR_SCOPE: union('topbarScope'),
    NAV_WORDS: bySource('navWords'),
    METADATA_HIDE: bySource('metadataHide'),
    ACTIVE_TABS: bySource('activeTabs'),
    RESERVED: bySource('reserved'),
    ROUTES: bySource('routes'),
  };
})();
