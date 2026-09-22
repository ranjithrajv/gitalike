/**
 * The skin and source contracts.
 *
 * GitAlike has two independent axes a contributor can extend:
 *
 *   - a *source* is a forge's markup (github, gitlab, gitea): the DOM a page is
 *     built on. Its home is `src/plugins/sources/<name>.js` (`selectors` and
 *     `canary`), plus the source-keyed scopes in ux.js.
 *   - a *skin* is a target UI (github, gitlab, bitbucket): the product a page is
 *     made to look like. Its home is `src/plugins/skins/<name>.js` (the
 *     vocabulary and order tables) and one stylesheet.
 *
 * This file is the single definition of "complete" for both. A half-added skin
 * or source fails here with the missing pieces named, instead of with a dozen
 * unrelated failures spread across the other suites.
 *
 * It is deliberately mechanical: it checks that the parts exist and are wired,
 * not that the wording or palette is any good. The reviewed fixtures
 * (`tests/fixtures/target-chrome.json`) and the parity gates are what judge
 * quality.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

import '../tools/plugins.mjs';
import { registryObject, registryProblems } from '../tools/registry.mjs';

const SITES = globalThis.GITALIKE;
const UX = globalThis.GITALIKE_UX;
const SKINS = globalThis.GITALIKE_SKINS;
const SOURCE_LIB = globalThis.GITALIKE_SOURCES;

const file = (rel) =>
  readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const hasFile = (rel) => existsSync(new URL(`../${rel}`, import.meta.url));

const THEMES = SITES.THEMES;
// Every source is a plugin; only a *markup* source has `SELECTORS` and a canary.
const ALL_SOURCES = Object.keys(SOURCE_LIB.SOURCES);
const SOURCES = Object.keys(UX.SELECTORS);

/**
 * Tables every skin must key. These are read on every page while the skin is
 * active, so a missing entry is not a rough edge — the pass throws or silently
 * does nothing. Optional tables (`SHORTCUTS`, `TOPBAR_HIDE`, `NAV_GROUPS`,
 * `NAV_KEEP`/`NAV_HIDE`, `PROJECT_TABS`) are per-skin capabilities and are not
 * required; the runtime already falls back when they are absent.
 */
const REQUIRED_SKIN_TABLES = [
  'PHRASES', // copy translation
  'NAV', // navigation labels
  'LABELS', // whole-control labels
  'CHROME', // account/menu chrome
  'UNMAPPED', // features the product has no page for
  'NAV_RULES', // how each source's navigation is reordered
  'PROFILE_MENU', // the profile menu, rebuilt in the product's words
];

describe('skin contract', () => {
  for (const skin of THEMES) {
    test(`skin '${skin}' supplies every required part`, () => {
      const missing = [];

      // `SITES.skins` is projected from the `defineSkin` object in skins.js, so
      // the four meta fields live there; these checks name the field, not the
      // file, because the object is the one place a skin is declared.
      const meta = SITES.skins[skin] ?? {};
      if (!meta.product) missing.push('product — the product name');
      if (!meta.badge) missing.push('badge — the toolbar badge');
      if (!/^#[0-9a-f]{6}$/i.test(meta.color ?? ''))
        missing.push('color — a #rrggbb value');
      if (!['github', 'gitlab'].includes(meta.layout))
        missing.push("layout — 'github' or 'gitlab'");

      for (const table of REQUIRED_SKIN_TABLES) {
        if (!UX[table] || !Object.hasOwn(UX[table], skin)) {
          missing.push(`ux.js ${table}[${skin}]`);
        }
      }

      // A skin is a self-contained folder: its definition, its stylesheet and
      // its test beside each other.
      const css = `src/plugins/skins/${skin}/as-${skin}.css`;
      if (!hasFile(css)) {
        missing.push(`${css} — the palette and structure`);
      } else if (!file(css).includes(`gs-theme-${skin}`)) {
        missing.push(`${css} must scope its rules to html.gs-theme-${skin}`);
      }
      const cssPath = `plugins/skins/${skin}/as-${skin}.css`;
      if (!file('src/plugins/list.js').includes(cssPath)) {
        missing.push(`src/plugins/list.js must register ${cssPath}`);
      }

      assert.deepEqual(
        missing,
        [],
        `skin '${skin}' is incomplete — add:\n  - ${missing.join('\n  - ')}`,
      );
    });
  }

  test('the "no counterpart" marker is not tied to a fixed skin list', () => {
    // It styles any active skin, so a new skin inherits it rather than needing
    // this file edited. (Bitbucket had once been left out of the hard-coded pair.)
    assert.match(
      file('src/themes/ux-markers.css'),
      /\[class\*=["']gs-theme-["']\]/,
      'ux-markers.css should target any gs-theme-* class',
    );
  });
});

describe('source contract', () => {
  for (const source of SOURCES) {
    test(`source '${source}' supplies every required part`, () => {
      const missing = [];

      const hooks = UX.SELECTORS[source];
      if (!hooks || Object.keys(hooks).length === 0) {
        missing.push(`SELECTORS[${source}] with at least one DOM hook`);
      }

      const pages = UX.CANARY_PAGES.filter((page) => page.source === source);
      if (pages.length === 0) {
        missing.push(`a CANARY_PAGES entry with source: '${source}'`);
      }
      for (const page of pages) {
        if (!page.keys?.length) {
          missing.push(
            `CANARY_PAGES '${page.name}' must list the keys it pins`,
          );
        }
      }

      assert.deepEqual(
        missing,
        [],
        `source '${source}' is incomplete — add:\n  - ${missing.join('\n  - ')}`,
      );
    });
  }

  test('a vocabulary-only source declares no hooks and no canary', () => {
    // Bitbucket and Gerrit are client-rendered, so they carry only a label. A
    // stray selector or canary would mean the source was half-classified.
    for (const source of ALL_SOURCES.filter(
      (name) => !SOURCES.includes(name),
    )) {
      const plugin = SOURCE_LIB.SOURCES[source];
      assert.equal(plugin.markup, false, `${source} is vocabulary-only`);
      assert.deepEqual(plugin.selectors, {}, `${source} has no hooks`);
      assert.deepEqual(plugin.canary, [], `${source} has no canary`);
    }
  });

  test('every kind a site can be is a registered source', () => {
    // `sites.js` decides which product a host is; that product must be a source
    // plugin, so the registry and the picker cannot disagree about what exists.
    for (const kind of Object.keys(SITES.kinds)) {
      assert.ok(
        Object.hasOwn(SOURCE_LIB.SOURCES, kind),
        `kind '${kind}' has no source plugin`,
      );
    }
  });

  test('every nav rule names a known markup source', () => {
    // A rule whose `source` is not in SELECTORS could never be selected.
    const known = new Set(SOURCES);
    for (const [skin, rules] of Object.entries(UX.NAV_RULES)) {
      for (const rule of rules ?? []) {
        assert.ok(
          known.has(rule.source),
          `${skin}: NAV_RULES names source '${rule.source}', which is not in SELECTORS`,
        );
      }
    }
  });

  test('the Gitea source watches both bundled hosts', () => {
    // Gitea and Forgejo are one markup family today, but two hosts. Both are
    // canaried, so if the hard fork's UI diverges the daily job says so.
    const urls = UX.CANARY_PAGES.filter((page) => page.source === 'gitea').map(
      (page) => page.url,
    );
    for (const host of ['codeberg.org', 'gitea.com']) {
      assert.ok(
        urls.some((url) => url.includes(host)),
        `no canary page watches ${host}`,
      );
    }
  });
});

describe('the registered plugins', () => {
  // The constructors' own behaviour — what they fill, freeze and reject — is
  // tested beside it in `src/plugins/core.test.mjs`; here every *shipped* plugin
  // is checked against the same definitions, so a half-added folder still fails
  // this suite by name.
  test('every registered skin is complete', () => {
    for (const [name, skin] of Object.entries(SKINS.SKINS)) {
      assert.deepEqual(SKINS.skinProblems(skin), [], name);
    }
  });

  test('every registered source is complete', () => {
    for (const [name, source] of Object.entries(SOURCE_LIB.SOURCES)) {
      assert.deepEqual(SOURCE_LIB.sourceProblems(source), [], name);
    }
  });

  test('a skin declares the capabilities it fills', () => {
    // Bitbucket declares `keep` and `projectTabs` but not `shortcuts` or `hide`,
    // so the filled defaults are present on the object while the derived tables
    // omit them (checked by the derivation tests).
    const { bitbucket } = SKINS.SKINS;
    assert.deepEqual(bitbucket.shortcuts, {});
    assert.deepEqual(bitbucket.hide, []);
    assert.ok(bitbucket.keep.length > 0);
    assert.equal(Object.isFrozen(bitbucket), true);
  });
});

describe('the plugins folder', () => {
  const pluginNames = (group) =>
    readdirSync(new URL(`../src/plugins/${group}`, import.meta.url), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

  test('every plugin folder registers a skin or a source', () => {
    // The folder is the registry: a folder that does not register, or a skin not
    // backed by a folder, is a mismatch in one direction or the other.
    assert.deepEqual(Object.keys(SKINS.SKINS).sort(), pluginNames('skins'));
    assert.deepEqual(
      Object.keys(SOURCE_LIB.SOURCES).sort(),
      pluginNames('sources'),
    );
  });

  test('every plugin folder is self-contained', () => {
    // A plugin is a folder: its entry, a test beside it, and — for a skin — its
    // own stylesheet. A folder without a test is a plugin that ships untested;
    // `index.js` is what every load list names.
    const missing = [];
    for (const group of ['skins', 'sources']) {
      for (const name of pluginNames(group)) {
        const dir = `src/plugins/${group}/${name}/`;
        if (!hasFile(`${dir}index.js`)) missing.push(`${dir}index.js`);
        if (!hasFile(`${dir}${name}.test.mjs`)) {
          missing.push(`${dir}${name}.test.mjs (its tests)`);
        }
      }
    }
    for (const name of pluginNames('skins')) {
      const css = `src/plugins/skins/${name}/as-${name}.css`;
      if (!hasFile(css)) missing.push(`${css} (its palette)`);
    }
    assert.deepEqual(
      missing,
      [],
      `incomplete plugin folders:\n  - ${missing.join('\n  - ')}`,
    );
  });

  test('every plugin entry is wired into every load list', () => {
    // The load lists are derived now: Node tools read the folder, and the
    // browser contexts read the generated `plugins/list.js` (background) or its
    // generated popup block. `registryProblems` pins both generated files to the
    // registry, so this only checks the entries are actually present.
    const paths = [
      'plugins/core.js',
      ...pluginNames('skins').map((name) => `plugins/skins/${name}/index.js`),
      ...pluginNames('sources').map(
        (name) => `plugins/sources/${name}/index.js`,
      ),
    ];
    const list = file('src/plugins/list.js');
    const popup = file('src/popup/popup.html');
    const missing = [];
    for (const path of paths) {
      if (!list.includes(path)) missing.push(`${path} in src/plugins/list.js`);
      if (!popup.includes(path)) {
        missing.push(`${path} in src/popup/popup.html`);
      }
    }
    assert.deepEqual(missing, [], `not wired: ${missing.join(', ')}`);
    // background.js reads the generated list; the Node loader reads the folder.
    assert.match(file('src/background.js'), /plugins\/list\.js/);
    assert.match(file('tools/plugins.mjs'), /readdirSync/);
  });

  test('the Firefox manifest list is derived from the folder', () => {
    // build.mjs reads `src/plugins/`, so a new folder needs no edit there; this
    // pins that it stays generated rather than becoming a hand-kept array.
    assert.match(file('build.mjs'), /readdir\(join\(SRC, 'plugins'/);
  });
});

describe('the published registry', () => {
  test('plugins.json, PLUGINS.md and docs/index.html match the registry', () => {
    // One gate for every public face: a new plugin that is not relisted, or a
    // hand-edit to a generated block, fails here with the fix named.
    const problems = registryProblems({
      docs: file('docs/index.html'),
      json: file('plugins.json'),
      catalog: file('PLUGINS.md'),
      list: file('src/plugins/list.js'),
      popup: file('src/popup/popup.html'),
    });
    assert.deepEqual(problems, [], problems.join('; '));
  });

  test('the registry names every skin and source, and its API version', () => {
    const registry = registryObject();
    assert.equal(registry.apiVersion, SKINS.API_VERSION);
    assert.deepEqual(
      registry.skins.map((skin) => skin.name),
      THEMES,
    );
    assert.deepEqual(
      registry.sources.map((source) => source.name),
      ALL_SOURCES,
    );
  });
});
