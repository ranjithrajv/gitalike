#!/usr/bin/env node
/**
 * GitAlike — scaffold a skin or a source.
 *
 * A plugin is a self-contained folder under `src/plugins/`: its `index.js`, its
 * own test and its `parity.mjs` compare recipes beside it, and — for a skin —
 * its stylesheet. This tool writes all of that; every load list is derived from
 * the folder, so there is nothing to wire
 * — `npm run registry` regenerates the browser list (`plugins/list.js`), the
 * popup's script block and the published registry. What is left is the
 * judgement — the palette and the vocabulary — and `npm test` names that,
 * because the contract test is the checklist.
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
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import './plugins.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKINS_DIR = join(root, 'src/plugins/skins');
const SOURCES_DIR = join(root, 'src/plugins/sources');

const SITES = globalThis.GITALIKE;

// The name is the storage/theme key and the folder name, so it has to be a plain
// lowercase token. Reserving the same shape for a source keeps the two
// consistent even though a source does not reach storage.
const NAME_RE = /^[a-z][a-z0-9-]*$/;

const titleCase = (name) =>
  name
    .replace(/(^|[-_])([a-z0-9])/g, (_, __, c) => ` ${c.toUpperCase()}`)
    .trim();

const DRY_RUN = process.argv.includes('--dry-run');

// Write a file, creating its folder, or in `--dry-run` say what would happen.
// One code path for both, so a dry run cannot describe something different.
async function write(path, content) {
  if (DRY_RUN) {
    console.log(`would write ${relative(root, path)}`);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

// Insert `snippet` on its own lines immediately before the anchor line. Text
// before the anchor line is kept, so an existing entry list is preserved.
// The compare recipes a plugin must have (tools/compare): a capture to
// screenshot, style-parity selectors, and — for a skin — the target vocabulary.
// `tools/compare/captures.mjs` and `style-recipes.mjs` derive their tables by
// reading the folder, so this is the only file a new plugin writes for them.
function sourceParity(name, label, host) {
  const instance = SITES.isBuiltin(host)
    ? ''
    : `\n    instance: { host: '${host}', kind: '${name}' },`;
  return `/**
 * The ${label} source's compare recipes, beside the source.
 *
 * Node-only: the browser loads \`index.js\`, never this file. Replace the TODO
 * urls and ready selectors as the source is captured; the skins and base file
 * names are derived from \`prefix\` and the registry.
 */
export default {
  capture: {
    prefix: '${name}',
    host: '${host}',${instance}
    project: {
      name: '${label} project page',
      url: 'https://${host}/TODO',
      ready: 'TODO',
    },
    profile: {
      name: '${label} profile page',
      url: 'https://${host}/TODO',
      ready: 'TODO',
    },
  },
  selectors: {
    project: {
      url: 'https://${host}/TODO',
      ready: 'TODO',
      header: [],
      nav: [],
      link: ['a[href]'],
      canvas: ['body'],
    },
    profile: {
      url: 'https://${host}/TODO',
      ready: 'TODO',
      header: [],
      nav: [],
      link: ['a[href]'],
      canvas: ['body'],
    },
  },
};
`;
}

function skinParity(product) {
  return `/**
 * The ${product} skin's reviewed target vocabulary, beside the skin.
 *
 * Node-only: the browser loads \`index.js\`, never this file. The navigation
 * *shape* is not here; it comes from the skin's \`layout\`.
 */
export default {
  vocab: {
    project: ['TODO'],
    profile: ['TODO'],
  },
};
`;
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
    description: 'TODO: one line on what the ${product} UI is.',
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
    description: 'TODO: one line on this forge’s markup.',
    label: '${label}',
    // The short product name the "open on the other host" action uses.
    product: '${label}',

    // TODO: bundle this forge by listing the hostnames it ships for. A bundled
    // host is granted at install and classified by \`kind\`; a GitHub-flavoured
    // forge sets \`kind: 'github'\`. Leave empty for a self-hosted-only forge.
    hosts: [],

    // TODO: the regions whose nav and top-bar labels may be rewritten. The
    // derived \`NAV_SCOPE\`/\`TOPBAR_SCOPE\` are the union across every source.
    navScope: [],
    topbarScope: [],

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

    // TODO: how much of each parity dimension this source can be credited
    // (a fraction in [0, 1]); see tools/compare/parity-score.mjs.
    compare: {
      palette: 0,
      nav: 0,
      page: 0,
      metadata: 0,
      profile: 0,
      refs: 0,
    },
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

import { loadSkin } from '../../../../tools/plugin-test.mjs';

const { skin: SKIN } = await loadSkin('${name}');

test('${name} registers a complete skin', () => {
  assert.ok(SKIN, 'the skin registered');
  assert.equal(SKIN.product, '${product}');
  assert.equal(SKIN.badge, '${badge}');
  assert.match(SKIN.color, /^#[0-9a-f]{6}$/i);
  assert.ok(['github', 'gitlab'].includes(SKIN.layout));
});

test('${name} builds a profile menu', () => {
  // Calling the skin's own functions is what the 100%-plugin-coverage gate
  // measures; fill this in as the menu grows.
  assert.ok(Array.isArray(SKIN.profileMenu('user', 'User')));
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

import { loadSource } from '../../../../tools/plugin-test.mjs';

const { source: SOURCE } = await loadSource('${name}');

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

async function scaffoldSkin(name, flags) {
  const product = flags.product ?? titleCase(name);
  const badge = (
    flags.badge ?? product.replace(/\W/g, '').slice(0, 2)
  ).toUpperCase();
  const color = flags.color ?? '#000000';

  const dir = `src/plugins/skins/${name}`;
  await write(
    join(root, dir, 'index.js'),
    skinContent(name, product, badge, color),
  );
  await write(join(root, dir, `as-${name}.css`), skinStylesheet(name, product));
  await write(
    join(root, dir, `${name}.test.mjs`),
    skinTest(name, product, badge),
  );
  // The reviewed target vocabulary `style-parity` scores against. The capture
  // skins and file names are derived, so a new skin needs no edit elsewhere.
  await write(join(root, dir, 'parity.mjs'), skinParity(product));

  return {
    what: `the ${product} skin (${dir}/)`,
    notes: [
      `palette: fill in ${dir}/as-${name}.css (light and .gs-dark) and its --gs-mark`,
      'vocabulary: the UX tests name the labels this skin does not translate yet',
      `tests: ${dir}/${name}.test.mjs runs with \`npm test\``,
      'coverage: npm test holds src/plugins/ at 100% — extend that test as the plugin grows',
      `parity vocab: replace the TODO in ${dir}/parity.mjs`,
      'compare: run `npm run screenshots` to capture the new skin; the capture table and file names are derived, so `npm test` names what is missing',
      'parity colours: add a reviewed tests/fixtures/target-chrome.json entry and list the skin in tools/compare',
    ],
  };
}

async function scaffoldSource(name, flags) {
  const label = flags.label ?? titleCase(name);
  const host = flags.host ?? `${name}.example.com`;
  const dir = `src/plugins/sources/${name}`;
  await write(join(root, dir, 'index.js'), sourceContent(name, label));
  await write(join(root, dir, `${name}.test.mjs`), sourceTest(name, label));
  // The capture and style-parity recipes, beside the source they describe.
  await write(join(root, dir, 'parity.mjs'), sourceParity(name, label, host));

  return {
    what: `the ${label} source (${dir}/)`,
    notes: [
      `hooks: replace the TODO selectors in ${dir}/index.js`,
      `canary: point the ${label} canary page at a real instance`,
      `hosts: list the hostname(s) in ${dir}/index.js \`hosts\` to bundle this forge (and set \`kind: 'github'\` if it speaks GitHub's dialect)`,
      `scopes: fill in \`navScope\`/\`topbarScope\` in ${dir}/index.js so its nav labels are rewritten`,
      `compare: replace the TODO urls/ready in ${dir}/parity.mjs`,
      `capabilities: set the ${name} \`compare\` values in ${dir}/index.js`,
      `tests: ${dir}/${name}.test.mjs runs with \`npm test\``,
      'coverage: npm test holds src/plugins/ at 100% — extend that test as the plugin grows',
      'nav: add a navRules entry to each skin that should reorder this source',
    ],
  };
}

const [kind, name, ...rest] = process.argv.slice(2);

if (!['skin', 'source'].includes(kind) || !name) {
  console.error(
    'usage: node tools/new-plugin.mjs <skin|source> <name> [--product P] [--badge BG] [--color #rrggbb] [--label L] [--host H]',
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

  if (DRY_RUN) {
    console.log(`\nwould scaffold ${result.what} (dry run — nothing written)`);
    process.exit(0);
  }

  // Relist it on the site and in plugins.json, now that the registry loads (and
  // validate that the new plugin loads at all, which is the same import).
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
