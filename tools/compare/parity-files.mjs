/**
 * The per-plugin compare recipes, loaded from the plugin folders.
 *
 * The capture (a live URL and a readiness selector) and the style-parity
 * selectors are genuinely per-source, and each skin's reviewed target vocabulary
 * is per-skin. They live beside the plugin under test as `parity.mjs`, one file
 * per folder, so adding a plugin is one folder — not an edit to two hand-kept
 * tables in `tools/compare/`. This is the loader `captures.mjs` and
 * `style-recipes.mjs` derive their flat tables from.
 *
 * The sidecars are Node-only: the browser loads a plugin's `index.js` through
 * `plugins/list.js`, never `parity.mjs`, and `build.mjs` drops them from the
 * bundle. Both these tables are imported by the compare tools and the tests, so
 * a missing sidecar fails `npm test` by name.
 */
import { existsSync } from 'node:fs';

const file = (group, name) =>
  new URL(`../../src/plugins/${group}/${name}/parity.mjs`, import.meta.url);

export async function loadParity(group, name) {
  if (!existsSync(file(group, name))) {
    throw new Error(
      `parity: ${group}/${name} has no parity.mjs — a source's capture/selectors ` +
        `and a skin's target vocabulary live beside the plugin`,
    );
  }
  const module = await import(file(group, name));
  return module.default;
}

export const loadSourceParity = (name) => loadParity('sources', name);
export const loadSkinParity = (name) => loadParity('skins', name);
