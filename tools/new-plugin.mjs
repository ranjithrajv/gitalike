#!/usr/bin/env node
/**
 * GitAlike — scaffold a skin or a source.
 *
 * The claim in the docs is that a plugin is one object plus, for a skin, one
 * stylesheet. This tool makes that literal: it writes the object at the anchor
 * in the registry file, the stylesheet from a template, the stylesheet's entry
 * in `CONTENT_CSS`, and relists it on the site (`tools/registry.mjs`). What is
 * left is the judgement — the palette and the vocabulary — and `npm test` names
 * that, because the contract test is the checklist.
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
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKINS_FILE = join(root, 'src/lib/skins.js');
const SOURCES_FILE = join(root, 'src/lib/sources.js');
const BACKGROUND_FILE = join(root, 'src/background.js');
const ANCHOR = '// plugins:anchor';

// The name is the storage/theme key and the stylesheet suffix, so it has to be a
// plain lowercase token. Reserving the same shape for a source keeps the two
// consistent even though a source does not reach storage.
const NAME_RE = /^[a-z][a-z0-9-]*$/;

const titleCase = (name) =>
  name
    .replace(/(^|[-_])([a-z0-9])/g, (_, __, c) => ` ${c.toUpperCase()}`)
    .trim();

const indent = (text, spaces) =>
  text
    .split('\n')
    .map((line) => (line ? ' '.repeat(spaces) + line : line))
    .join('\n');

// Insert `snippet` on its own lines immediately before the anchor line.
async function insertBeforeAnchor(path, snippet) {
  const text = await readFile(path, 'utf8');
  const index = text.indexOf(ANCHOR);
  if (index === -1) {
    throw new Error(`${path} has no "${ANCHOR}" marker`);
  }
  const lineStart = text.lastIndexOf('\n', index) + 1;
  await writeFile(
    path,
    `${text.slice(0, lineStart)}${snippet}\n${text.slice(lineStart)}`,
  );
}

async function nameTaken(name) {
  for (const path of [SKINS_FILE, SOURCES_FILE]) {
    const text = await readFile(path, 'utf8');
    if (new RegExp(`^\\s*${name}: define`, 'm').test(text)) return true;
  }
  return false;
}

function skinObject(name, product, badge, color) {
  return indent(
    `${name}: defineSkin({
  product: '${product}',
  badge: '${badge}',
  color: '${color}',
  layout: 'github',

  // TODO: ${product}'s vocabulary. Start from a product the users of it know;
  // the UX tests name every label the other skins translate that this one does
  // not yet, and \`unmapped\` is where a feature with no counterpart is marked.
  phrases: {},
  nav: {},
  labels: {},
  chrome: {},
  unmapped: {},

  navRules: [],

  profileMenu: () => [],
}),
`,
    4,
  );
}

function sourceObject(name, label) {
  return indent(
    `${name}: defineSource({
  label: '${label}',

  // TODO: the DOM hooks the skins read on this forge's pages. Mark a hook a
  // stylesheet owns with \`// css\` so tests/ux.test.mjs can check the two agree.
  selectors: {
    repoNavList: 'TODO',
  },

  // TODO: a live page the daily canary can watch, and the selector keys it pins.
  canary: [
    {
      name: '${label} project page',
      url: 'https://example.com/owner/repo',
      keys: ['repoNavList'],
    },
  ],
}),
`,
    4,
  );
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

async function scaffoldSkin(name, flags) {
  const product = flags.product ?? titleCase(name);
  const badge = (
    flags.badge ?? product.replace(/\W/g, '').slice(0, 2)
  ).toUpperCase();
  const color = flags.color ?? '#000000';

  await insertBeforeAnchor(SKINS_FILE, skinObject(name, product, badge, color));

  // The file lives under src/; the bundle path CONTENT_CSS names is relative to
  // the built extension root, so the two differ.
  const cssFile = `src/themes/as-${name}.css`;
  const cssPath = `themes/as-${name}.css`;
  await mkdir(join(root, 'src/themes'), { recursive: true });
  await writeFile(join(root, cssFile), skinStylesheet(name, product));
  await insertBeforeAnchor(BACKGROUND_FILE, `  '${cssPath}',`);

  return {
    what: `skins/${name}`,
    notes: [
      `palette: fill in src/themes/as-${name}.css (light and .gs-dark) and its --gs-mark`,
      'vocabulary: the UX tests name the labels this skin does not translate yet',
      'parity: add a reviewed tests/fixtures/target-chrome.json entry and list the skin in tools/compare',
    ],
  };
}

async function scaffoldSource(name, flags) {
  const label = flags.label ?? titleCase(name);
  await insertBeforeAnchor(SOURCES_FILE, sourceObject(name, label));
  return {
    what: `sources/${name}`,
    notes: [
      `hooks: replace the TODO selectors in src/lib/sources.js (${name})`,
      `canary: point the ${name} page at a real instance`,
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
} else if (await nameTaken(name)) {
  console.error(`"${name}" is already declared in the registry`);
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
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
  if (registry.status !== 0) process.exitCode = registry.status;

  console.log(`\nscaffolded ${result.what}`);
  console.log(`\nnext:`);
  for (const note of result.notes) console.log(`  - ${note}`);
  console.log(
    `  - run \`npm test\` — the contract and UX tests name what is left`,
  );
}
