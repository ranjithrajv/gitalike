/**
 * Loads the whole plugin registry for Node consumers — the tests and
 * `tools/registry.mjs` — in the same order every runtime context uses: the API,
 * every plugin folder, then the libraries that derive from them. Importing this
 * for its side effects is all a caller needs; the globals are then exactly what
 * a content script sees.
 *
 * The folders are read here, not a hand-kept list, so adding a plugin is adding
 * a folder. (A browser context cannot read a directory, so *it* loads the
 * generated `src/plugins/list.js` instead; `npm run registry` keeps that in
 * step with these folders.)
 */
import { readdirSync } from 'node:fs';

const pluginNames = (group) =>
  readdirSync(new URL(`../src/plugins/${group}/`, import.meta.url), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

await import('../src/plugins/core.js');
for (const name of pluginNames('skins')) {
  await import(`../src/plugins/skins/${name}/index.js`);
}
for (const name of pluginNames('sources')) {
  await import(`../src/plugins/sources/${name}/index.js`);
}
await import('../src/lib/skins.js');
await import('../src/lib/sites.js');
await import('../src/lib/sources.js');
await import('../src/lib/ux.js');
