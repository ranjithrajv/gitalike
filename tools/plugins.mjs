/**
 * Loads the whole plugin registry for Node consumers — the tests and
 * `tools/registry.mjs` — in the same order every runtime context uses: the API,
 * every plugin file, then the libraries that derive from them. Importing this
 * for its side effects is all a caller needs; the globals are then exactly what
 * a content script sees.
 *
 * Update it when a plugin file is added; `tests/contracts.test.mjs` checks its
 * imports, and the other load lists, against `src/plugins/`.
 */
import '../src/plugins/core.js';
import '../src/plugins/skins/bitbucket/index.js';
import '../src/plugins/skins/github/index.js';
import '../src/plugins/skins/gitlab/index.js';
import '../src/plugins/sources/gitea/index.js';
import '../src/plugins/sources/github/index.js';
import '../src/plugins/sources/gitlab/index.js';
// plugins:anchor — `node tools/new-plugin.mjs` inserts above.
import '../src/lib/skins.js';
import '../src/lib/sites.js';
import '../src/lib/sources.js';
import '../src/lib/ux.js';
