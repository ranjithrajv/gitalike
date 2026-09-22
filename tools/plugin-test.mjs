/**
 * A tiny loader for a plugin's own test, so each `src/plugins/<group>/<name>/`
 * test names only the plugin under test.
 *
 * `loadSkin` / `loadSource` load the API, the plugin folders and the
 * derivations, in the same order a runtime context uses, and return the plugin
 * under test together with the derived tables. Both load *every* source: a
 * skin's `navRules` name sources, and a source's `hosts` / `counterpart` /
 * route maps cross-reference the others, so the registry has to be complete for
 * the validation to run. The returned tables are scoped to the named plugin
 * where a test expects a single plugin's view (`CANARY_PAGES`); the
 * cross-plugin invariants stay in `tests/*.test.mjs`.
 *
 *   const { skin, NAV, NAV_RULES } = await loadSkin('gitlab');
 *   const { source, SELECTORS } = await loadSource('github');
 */
import { readdirSync } from 'node:fs';

const pluginNames = (group) =>
  readdirSync(new URL(`../src/plugins/${group}/`, import.meta.url), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

export async function loadSkin(name) {
  await import('../src/plugins/core.js');
  for (const source of pluginNames('sources')) {
    await import(`../src/plugins/sources/${source}/index.js`);
  }
  await import(`../src/plugins/skins/${name}/index.js`);
  await import('../src/lib/skins.js');
  await import('../src/lib/sources.js');
  await import('../src/lib/ux.js');
  return {
    skin: globalThis.GITALIKE_PLUGINS.skins[name],
    plugins: globalThis.GITALIKE_PLUGINS,
    ...globalThis.GITALIKE_SKINS,
    ...globalThis.GITALIKE_SOURCES,
    ...globalThis.GITALIKE_UX,
  };
}

export async function loadSource(name) {
  await import('../src/plugins/core.js');
  // Every source is registered, as in `loadSkin`: `hosts`, `counterpart` and
  // the route maps cross-reference the other sources, so validating one folder
  // needs the registry complete. Only the named source is returned.
  for (const source of pluginNames('sources')) {
    await import(`../src/plugins/sources/${source}/index.js`);
  }
  await import('../src/lib/sources.js');
  return {
    source: globalThis.GITALIKE_PLUGINS.sources[name],
    plugins: globalThis.GITALIKE_PLUGINS,
    ...globalThis.GITALIKE_SOURCES,
    // The canary pages of the source under test, as when the folder was loaded
    // alone; `SELECTORS` stays complete because a test indexes it by source.
    CANARY_PAGES: globalThis.GITALIKE_SOURCES.CANARY_PAGES.filter(
      (page) => page.source === name,
    ),
  };
}
