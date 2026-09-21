/**
 * A tiny loader for a plugin's own test, so each `src/plugins/<group>/<name>/`
 * test names only the plugin under test.
 *
 * `loadSkin` / `loadSource` load the API, the plugin folder(s) and the
 * derivations, in the same order a runtime context uses, and return the
 * registered plugin together with the derived tables. A skin test also loads
 * every source, because a skin's `navRules` name sources and `lib/skins.js`
 * validates that they are registered. Only the named skin is registered, which
 * is what keeps a per-plugin test isolated — the cross-plugin invariants stay
 * in `tests/*.test.mjs`.
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
  await import(`../src/plugins/sources/${name}/index.js`);
  await import('../src/lib/sources.js');
  return {
    source: globalThis.GITALIKE_PLUGINS.sources[name],
    plugins: globalThis.GITALIKE_PLUGINS,
    ...globalThis.GITALIKE_SOURCES,
  };
}
