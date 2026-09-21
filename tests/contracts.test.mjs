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
      if (!file('src/background.js').includes(cssPath)) {
        missing.push(`src/background.js CONTENT_CSS must register ${cssPath}`);
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

describe('the plugin constructors', () => {
  test('a complete skin has no problems', () => {
    for (const skin of Object.values(SKINS.SKINS)) {
      assert.deepEqual(SKINS.skinProblems(skin), []);
    }
  });

  test('a half-added skin is named part by part', () => {
    // The whole list comes back at once, so an author is not chasing one field
    // per run. `product` is present; everything else is the complaint.
    const problems = SKINS.skinProblems({ product: 'Sourcehut' });
    assert.ok(problems.some((p) => p.startsWith('badge')));
    assert.ok(problems.some((p) => p.startsWith('color')));
    assert.ok(problems.some((p) => p.startsWith('phrases')));
    assert.ok(problems.some((p) => p.startsWith('profileMenu')));
    assert.ok(!problems.some((p) => p.startsWith('product')));
  });

  test('a malformed skin field is caught, not just a missing one', () => {
    const { gitlab } = SKINS.SKINS;
    const problems = SKINS.skinProblems({ ...gitlab, color: 'purple' });
    assert.deepEqual(problems, ['color — a #rrggbb string']);
  });

  test('defineSkin fills the optional capabilities and freezes', () => {
    // Bitbucket declares `keep` and `projectTabs` but not `shortcuts`, `hide` or
    // `topbarHide`, so those are the defaults under test.
    const { bitbucket } = SKINS.SKINS;
    assert.deepEqual(bitbucket.shortcuts, {});
    assert.deepEqual(bitbucket.hide, []);
    assert.deepEqual(bitbucket.topbarHide, []);
    assert.ok(bitbucket.keep.length > 0, 'a declared capability is kept');
    assert.equal(Object.isFrozen(bitbucket), true);
  });

  test('defineSkin rejects a half-added skin with the whole list', () => {
    assert.throws(
      () => SKINS.defineSkin('half-added', { product: 'X' }),
      (error) =>
        error.message.includes("'half-added' is incomplete") &&
        error.message.includes('badge') &&
        error.message.includes('profileMenu'),
    );
  });

  test('defineSkin rejects a name that is already declared', () => {
    assert.throws(
      () => SKINS.defineSkin('gitlab', SKINS.SKINS.gitlab),
      /'gitlab' is declared twice/,
    );
  });

  test('a complete source has no problems', () => {
    for (const source of Object.values(SOURCE_LIB.SOURCES)) {
      assert.deepEqual(SOURCE_LIB.sourceProblems(source), []);
    }
  });

  test('a source with no hooks or canary is named', () => {
    assert.deepEqual(SOURCE_LIB.sourceProblems({}), [
      'selectors — an object with at least one DOM hook',
      'canary — an array of pages, each with a name, a url and keys',
    ]);
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
    // Each runtime context loads classic scripts by an explicit list; a folder
    // that is present but missing from one list silently does nothing there. The
    // lists are checked together so the fix is one edit each.
    const paths = [
      'plugins/core.js',
      ...pluginNames('skins').map((name) => `plugins/skins/${name}/index.js`),
      ...pluginNames('sources').map(
        (name) => `plugins/sources/${name}/index.js`,
      ),
    ];
    const lists = {
      'src/background.js': file('src/background.js'),
      'src/popup/popup.html': file('src/popup/popup.html'),
      'tools/plugins.mjs': file('tools/plugins.mjs'),
    };
    const missing = [];
    for (const path of paths) {
      for (const [where, text] of Object.entries(lists)) {
        if (!text.includes(path)) missing.push(`${path} in ${where}`);
      }
    }
    assert.deepEqual(missing, [], `not wired: ${missing.join(', ')}`);
  });

  test('the Firefox manifest list is derived from the folder', () => {
    // build.mjs reads `src/plugins/`, so a new folder needs no edit there; this
    // pins that it stays generated rather than becoming a hand-kept array.
    assert.match(file('build.mjs'), /readdir\(join\(SRC, 'plugins'/);
  });
});

describe('the published registry', () => {
  test('plugins.json and docs/index.html match the registry', () => {
    // One gate for both public faces: a new plugin that is not relisted, or a
    // hand-edit to a generated block, fails here with the fix named.
    const problems = registryProblems(
      file('docs/index.html'),
      file('plugins.json'),
    );
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
      SOURCES,
    );
  });
});
