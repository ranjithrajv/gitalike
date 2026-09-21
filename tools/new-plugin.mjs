#!/usr/bin/env node
/**
 * GitAlike — scaffold a skin or a source.
 *
 * A plugin is a self-contained folder under `src/plugins/`: its `index.js`, its
 * own test beside it, and — for a skin — its stylesheet. This tool writes all of
 * that and wires the entry into every load list (the background, the popup and
 * the Node loader); the Firefox manifest is generated from the folder, so it
 * needs no edit. What is left is the judgement — the palette and the vocabulary —
 * and `npm test` names that, because the contract test is the checklist.
 *
 *   node tools/new-plugin.mjs skin sourcehut [--product Sourcehut] [--badge SH]
 *   node tools/new-plugin.mjs source forgejo [--label Forgejo]
 *
 * A skin stub is complete (every required table is present, if empty), so it
 * satisfies the contract immediately; the UX tests then name the labels the
 * other skins translate that it does not yet. A source stub names one
 * placeholder hook and canary page to replace, because those cannot be guessed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKINS_DIR = join(root, 'src/plugins/skins');
const SOURCES_DIR = join(root, 'src/plugins/sources');
const BACKGROUND_FILE = join(root, 'src/background.js');
const POPUP_FILE = join(root, 'src/popup/popup.html');
const LOADER_FILE = join(root, 'tools/plugins.mjs');

// Distinct markers, because `background.js` has two lists to insert into.
const ANCHORS = {
  js: '// plugins:js-anchor',
  css: '// plugins:css-anchor',
  html: '<!-- plugins:anchor',
  loader: '// plugins:anchor',
};

// The name is the storage/theme key and the folder name, so it has to be a plain
// lowercase token. Reserving the same shape for a source keeps the two
// consistent even though a source does not reach storage.
const NAME_RE = /^[a-z][a-z0-9-]*$/;

const titleCase = (name) =>
  name
    .replace(/(^|[-_])([a-z0-9])/g, (_, __, c) => ` ${c.toUpperCase()}`)
    .trim();

// Insert `snippet` on its own lines immediately before the anchor line. Text
// before the anchor line is kept, so an existing entry list is preserved.
async function insertBeforeAnchor(path, anchor, snippet) {
  const text = await readFile(path, 'utf8');
  const index = text.indexOf(anchor);
  if (index === -1) {
    throw new Error(`${path} has no "${anchor}" marker`);
  }
  const lineStart = text.lastIndexOf('\n', index) + 1;
  await writeFile(
    path,
    `${text.slice(0, lineStart)}${snippet}\n${text.slice(lineStart)}`,
  );
}

const kindDir = (kind) => (kind === 'skin' ? SKINS_DIR : SOURCES_DIR);
const kindExists = (kind, name) =>
  existsSync(join(kindDir(kind), name, 'index.js'));

function skinContent(name, product, badge, color) {
  return `/**
 * GitAlike — the ${product} skin.
 *
 * A skin is a target UI a page is made to look like. The palette is
 * \`as-${name}.css\`, beside this file; the contract (\`tests/contracts.test.mjs\`)
 * names anything the folder is missing.
 *
 * Declared once, here; the shared shape and the validation live in
 * \`plugins/core.js\`, and the flat tables the rest of the code reads are
 * derived in \`lib/skins.js\`.
 */
(() => {
  'use strict';

  globalThis.GITALIKE_PLUGINS.defineSkin('${name}', {
    product: '${product}',
    badge: '${badge}',
    color: '${color}',
    layout: 'github',

    // TODO: ${product}'s vocabulary. The UX tests name every label the other
    // skins translate that this one does not yet, and \`unmapped\` is where a
    // feature with no counterpart is marked.
    phrases: {},
    nav: {},
    labels: {},
    chrome: {},
    unmapped: {},

    navRules: [],

    profileMenu: () => [],
  });
})();
`;
}

function sourceContent(name, label) {
  return `/**
 * GitAlike — the ${label} source.
 *
 * The \`// css\` markers note the hooks a stylesheet owns, so the contract can
 * check the two agree.
 *
 * Declared once, here; the shared shape and the validation live in
 * \`plugins/core.js\`, and the flat tables the rest of the code reads are
 * derived in \`lib/sources.js\`.
 */
(() => {
  'use strict';

  globalThis.GITALIKE_PLUGINS.defineSource('${name}', {
    label: '${label}',

    // TODO: the DOM hooks the skins read on this forge's pages. Mark a hook a
    // stylesheet owns with \`// css\` so tests/ux.test.mjs can check the two agree.
    selectors: {
      repoNavList: 'TODO',
    },

    // TODO: a live page the daily canary can watch, and the selector keys it
    // pins.
    canary: [
      {
        name: '${label} project page',
        url: 'https://example.com/owner/repo',
        keys: ['repoNavList'],
      },
    ],
  });
})();
`;
}

function skinStylesheet(name, product) {
  return `/**
 * GitAlike — the ${product} skin.
 *
 * Scope every rule to \`html.gs-theme-${name}\` so it is inert when the skin is
 * off. The \`--gs-*\` custom properties are the surface the passes read; the
 * blocks after them re-point each source's own design tokens (Primer's
 * \`--fgColor-*\`, GitLab's \`--gl-*\`, Gitea's \`--color-*\`) at this palette.
 *
 * The mark is GitAlike's own, painted in this product's palette — never the
 * product's logo or its path data. See CONTRIBUTING.md.
 */

html.gs-theme-${name} {
  /* TODO: ${product}'s palette, light. */
  --gs-header: #000000;
  --gs-canvas: #ffffff;
  --gs-link: #0000ee;
  --gs-accent: #000000;
  --gs-mark: none;
}

html.gs-theme-${name}.gs-dark {
  /* TODO: ${product}'s palette, dark. */
}
`;
}

function skinTest(name, product, badge) {
  return `/**
 * The ${product} skin's own tests, beside its definition and palette.
 *
 * Node's test runner discovers it. Fill it in as the skin grows: the shared
 * invariants live in \`tests/ux.test.mjs\`, and ${product}'s own vocabulary and
 * ordering belong here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../../core.js';
import './index.js';
import '../../../lib/skins.js';

const SKIN = globalThis.GITALIKE_PLUGINS.skins['${name}'];

test('${name} registers a complete skin', () => {
  assert.ok(SKIN, 'the skin registered');
  assert.equal(SKIN.product, '${product}');
  assert.equal(SKIN.badge, '${badge}');
  assert.match(SKIN.color, /^#[0-9a-f]{6}$/i);
  assert.ok(['github', 'gitlab'].includes(SKIN.layout));
});

test('${name}’s stylesheet is beside it and scoped to the skin', () => {
  const css = readFileSync(new URL('./as-${name}.css', import.meta.url), 'utf8');
  assert.match(css, /html\\.gs-theme-${name}\\s*\\{/);
});
`;
}

function sourceTest(name, label) {
  return `/**
 * The ${label} source's own tests, beside its definition.
 *
 * Node's test runner discovers it. Fill it in as the source grows: the shared
 * invariants live in \`tests/ux.test.mjs\`, and ${label}'s own hooks and canary
 * belong here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import '../../core.js';
import './index.js';
import '../../../lib/sources.js';

const SOURCE = globalThis.GITALIKE_PLUGINS.sources['${name}'];

test('${name} registers a complete source', () => {
  assert.ok(SOURCE, 'the source registered');
  assert.ok(Object.keys(SOURCE.selectors).length > 0);
  assert.ok(SOURCE.canary.length > 0);
  for (const page of SOURCE.canary) {
    assert.ok(page.name);
    assert.match(page.url, /^https?:\\/\\//);
    for (const key of page.keys) {
      assert.equal(typeof SOURCE.selectors[key], 'string', key);
    }
  }
});
`;
}

// Add the entry to the two background lists, the popup and the Node loader, so a
// new folder needs no hand edit there.
async function wire(pluginPath, loaderImport) {
  await insertBeforeAnchor(BACKGROUND_FILE, ANCHORS.js, `  '${pluginPath}',`);
  await insertBeforeAnchor(
    POPUP_FILE,
    ANCHORS.html,
    `    <script src="../${pluginPath}"></script>`,
  );
  await insertBeforeAnchor(LOADER_FILE, ANCHORS.loader, loaderImport);
}

async function scaffoldSkin(name, flags) {
  const product = flags.product ?? titleCase(name);
  const badge = (
    flags.badge ?? product.replace(/\W/g, '').slice(0, 2)
  ).toUpperCase();
  const color = flags.color ?? '#000000';

  const dir = `src/plugins/skins/${name}`;
  await mkdir(join(root, dir), { recursive: true });
  await writeFile(
    join(root, dir, 'index.js'),
    skinContent(name, product, badge, color),
  );
  await writeFile(
    join(root, dir, `as-${name}.css`),
    skinStylesheet(name, product),
  );
  await writeFile(
    join(root, dir, `${name}.test.mjs`),
    skinTest(name, product, badge),
  );

  await insertBeforeAnchor(
    BACKGROUND_FILE,
    ANCHORS.css,
    `  'plugins/skins/${name}/as-${name}.css',`,
  );
  await wire(
    `plugins/skins/${name}/index.js`,
    `import '../src/plugins/skins/${name}/index.js';`,
  );

  return {
    what: `the ${product} skin (${dir}/)`,
    notes: [
      `palette: fill in ${dir}/as-${name}.css (light and .gs-dark) and its --gs-mark`,
      'vocabulary: the UX tests name the labels this skin does not translate yet',
      `tests: ${dir}/${name}.test.mjs runs with \`npm test\``,
      'parity: add a reviewed tests/fixtures/target-chrome.json entry and list the skin in tools/compare',
    ],
  };
}

async function scaffoldSource(name, flags) {
  const label = flags.label ?? titleCase(name);
  const dir = `src/plugins/sources/${name}`;
  await mkdir(join(root, dir), { recursive: true });
  await writeFile(join(root, dir, 'index.js'), sourceContent(name, label));
  await writeFile(join(root, dir, `${name}.test.mjs`), sourceTest(name, label));

  await wire(
    `plugins/sources/${name}/index.js`,
    `import '../src/plugins/sources/${name}/index.js';`,
  );

  return {
    what: `the ${label} source (${dir}/)`,
    notes: [
      `hooks: replace the TODO selectors in ${dir}/index.js`,
      `canary: point the ${label} canary page at a real instance`,
      `tests: ${dir}/${name}.test.mjs runs with \`npm test\``,
      'nav: add a navRules entry to each skin that should reorder this source',
      'host: for a forge people host, add a builtin/SOURCES entry in src/lib/sites.js',
    ],
  };
}

const [kind, name, ...rest] = process.argv.slice(2);

if (!['skin', 'source'].includes(kind) || !name) {
  console.error(
    'usage: node tools/new-plugin.mjs <skin|source> <name> [--product P] [--badge BG] [--color #rrggbb] [--label L]',
  );
  process.exitCode = 1;
} else if (!NAME_RE.test(name)) {
  console.error(
    `"${name}" is not a valid name — use lowercase letters, digits and dashes`,
  );
  process.exitCode = 1;
} else if (kindExists(kind, name)) {
  console.error(`the ${kind} "${name}" already exists`);
  process.exitCode = 1;
} else {
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i].startsWith('--')) flags[rest[i].slice(2)] = rest[i + 1];
  }

  const result =
    kind === 'skin'
      ? await scaffoldSkin(name, flags)
      : await scaffoldSource(name, flags);

  // Relist it on the site and in plugins.json, now that the registry loads.
  const registry = spawnSync(
    'node',
    [join(root, 'tools/registry.mjs'), '--write'],
    { cwd: root, stdio: 'inherit' },
  );
  if (registry.status !== 0) process.exitCode = registry.status;

  console.log(`\nscaffolded ${result.what}`);
  console.log('\nnext:');
  for (const note of result.notes) console.log(`  - ${note}`);
  console.log(
    '  - run `npm test` — the contract and UX tests name what is left',
  );
}
