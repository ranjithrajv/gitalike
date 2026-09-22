#!/usr/bin/env node
/**
 * GitAlike — the published plugin registry and catalog.
 *
 * The registry is *authored* in the source: one `defineSkin` folder under
 * `src/plugins/skins/`, one `defineSource` under `src/plugins/sources/`. This
 * tool turns that into the three public faces — `plugins.json` (machine
 * readable), `PLUGINS.md` (the author catalog) and the Plugins chips in
 * `docs/index.html` — so a plugin cannot ship while any of them still lists the
 * old set. It is standard-library only and loads the same files the extension
 * loads, so what it publishes is exactly what ships.
 *
 *   node tools/registry.mjs            # check (the CI / pre-commit gate)
 *   node tools/registry.mjs --write    # regenerate all three faces
 *   node tools/registry.mjs --list     # print the registry to the terminal
 *
 * The docs page and the catalog are hand-authored apart from the marked blocks,
 * so only those are rewritten. The test in `tests/contracts.test.mjs` calls
 * `registryProblems` directly, so drift fails `npm test` without a process.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import './plugins.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// The comment markers the generator owns in docs/index.html. The opening marker
// carries a trailing note, so it is matched by prefix and the closing marker
// exactly. Keep in step with the page.
const BLOCKS = {
  skins: ['<!-- plugins:skins', '<!-- /plugins:skins -->'],
  sources: ['<!-- plugins:sources', '<!-- /plugins:sources -->'],
};
// The same, for the popup's plugin <script> tags.
const POPUP_BLOCK = ['<!-- plugins:scripts', '<!-- /plugins:scripts -->'];

// The bundled hosts, grouped by the source they resolve to, so the manifest can
// say which sites a source is for.
function bundledHosts() {
  const hosts = {};
  for (const host of Object.keys(globalThis.GITALIKE.builtin)) {
    const source = globalThis.GITALIKE.sourceFor(host, null);
    (hosts[source] ??= []).push(host);
  }
  return hosts;
}

/**
 * The bundled hosts as manifest `host_permissions` match patterns. The same
 * declaration the picker reads (`GITALIKE.builtin`, derived from each source
 * plugin's `hosts`) also feeds the built manifest, so a bundled forge is one
 * edit in its plugin folder rather than two lists that can drift.
 */
export function hostPermissions() {
  return Object.keys(globalThis.GITALIKE.builtin)
    .sort()
    .map((host) => `*://${host}/*`);
}

/**
 * The registry as data, derived from the loaded modules. The order is the
 * declaration order in source (the plugin folders, sorted), so the site, the
 * catalog and the JSON list plugins the way the code does.
 */
export function registryObject() {
  const { API_VERSION, SKIN_CAPABILITIES, skins } = globalThis.GITALIKE_PLUGINS;
  const { SOURCES } = globalThis.GITALIKE_SOURCES;
  const hosts = bundledHosts();
  return {
    apiVersion: API_VERSION,
    skins: Object.entries(skins).map(([name, skin]) => ({
      name,
      product: skin.product,
      badge: skin.badge,
      color: skin.color,
      layout: skin.layout,
      description: skin.description ?? null,
      capabilities: Object.keys(SKIN_CAPABILITIES)
        .filter((capability) => skin.declared.has(capability))
        .sort(),
    })),
    sources: Object.entries(SOURCES).map(([name, source]) => ({
      name,
      label: source.label,
      description: source.description ?? null,
      markup: source.markup !== false,
      hosts: (hosts[name] ?? []).sort(),
      compare: source.compare,
      selectors: Object.keys(source.selectors),
      canary: source.canary.map((page) => page.url),
      // The page kinds it declares: route + how the subject is read from the
      // URL, or null for a kind it has none of. Absent kind = unspecified. This
      // is how a consumer (a page pass, the parity rubric, the docs) knows what
      // a source has instead of assuming every forge has a profile, a
      // dashboard or a sign-in form.
      pages: source.pages ?? {},
    })),
  };
}

// The chip markup the page renders for one plugin, at the block's indent.
const chip = (kind, name, label) =>
  `                <span class="chip" data-plugin="${kind}:${name}">${label}</span>`;

/** The two generated blocks of chip markup, keyed like `BLOCKS`. */
export function renderChips(registry) {
  return {
    skins: registry.skins
      .map((skin) => chip('skin', skin.name, `${skin.product} UI`))
      .join('\n'),
    sources: registry.sources
      .map((source) => chip('source', source.name, source.label))
      .join('\n'),
  };
}

// Replace everything between an opening marker line and a closing marker line,
// leaving both markers in place.
function setBlock(html, [start, end], body, where) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  if (from === -1 || to === -1) {
    throw new Error(`registry: ${where} has no "${start}" / "${end}" block`);
  }
  const bodyStart = html.indexOf('\n', from) + 1;
  const bodyEnd = html.lastIndexOf('\n', to) + 1;
  return `${html.slice(0, bodyStart)}${body}\n${html.slice(bodyEnd)}`;
}

/** `html` with both generated blocks rewritten from `registry`. */
export function applyToDocs(html, registry) {
  const chips = renderChips(registry);
  return setBlock(
    setBlock(html, BLOCKS.skins, chips.skins, 'docs/index.html'),
    BLOCKS.sources,
    chips.sources,
    'docs/index.html',
  );
}

/** The plugin paths in load order: the API, then the skins, then the sources. */
export function pluginPaths(registry) {
  return [
    'plugins/core.js',
    ...registry.skins.map((skin) => `plugins/skins/${skin.name}/index.js`),
    ...registry.sources.map(
      (source) => `plugins/sources/${source.name}/index.js`,
    ),
  ];
}

/**
 * `src/plugins/list.js`, the load lists for the contexts that cannot read the
 * folder: the Chromium service worker (`importScripts`) and the Firefox
 * background scripts. Node tools read `src/plugins/` directly, so this is only
 * the browser bridge.
 */
export function renderPluginList(registry) {
  const js = pluginPaths(registry);
  // A source's token map (when it has one) comes first, so a skin's own rule of
  // equal specificity still wins where it deliberately diverges; the skin
  // palettes follow. Which sources declare a `tokens.css` is the folder.
  const css = [
    ...registry.sources
      .map((source) => `plugins/sources/${source.name}/tokens.css`)
      .filter((path) => existsSync(join(root, 'src', path))),
    ...registry.skins.map(
      (skin) => `plugins/skins/${skin.name}/as-${skin.name}.css`,
    ),
    'themes/ux-markers.css',
    'themes/ux-nav.css',
  ];
  return `/**
 * Generated by \`npm run registry\` — do not edit.
 *
 * The plugin files and stylesheets in load order, for the contexts that cannot
 * read the folder: the Chromium service worker's \`importScripts\` and the
 * Firefox background scripts. Node tools read \`src/plugins/\` directly.
 * \`npm run registry:check\` fails if this is stale.
 */
globalThis.GITALIKE_PLUGIN_FILES = ${JSON.stringify({ js, css }, null, 2)};
`;
}

/** The popup's plugin `<script>` tags, at the block's indent. */
export function renderPopupScripts(registry) {
  return pluginPaths(registry)
    .map((path) => `    <script src="../${path}"></script>`)
    .join('\n');
}

/** `html` with the popup's generated plugin-script block rewritten. */
export function applyToPopup(html, registry) {
  return setBlock(
    html,
    POPUP_BLOCK,
    renderPopupScripts(registry),
    'src/popup/popup.html',
  );
}

const cell = (value) => String(value ?? '').replace(/\|/g, '\\|');

/**
 * The author catalog, `PLUGINS.md`: every plugin with what it is, where it
 * lives and what it can do. Generated from the same registry as the JSON, so a
 * contributor reads one list.
 */
export function renderCatalog(registry) {
  const table = (headers, items, columns) =>
    [
      `| ${headers.join(' | ')} |`,
      `| ${headers.map(() => '---').join(' | ')} |`,
      ...items.map(
        (item) => `| ${columns.map((fn) => cell(fn(item))).join(' | ')} |`,
      ),
    ].join('\n');

  const skins = table(
    ['Product', 'Skin', 'Layout', 'Capabilities', 'Folder', 'Notes'],
    registry.skins,
    [
      (skin) => skin.product,
      (skin) => skin.name,
      (skin) => skin.layout,
      (skin) => skin.capabilities.join(', ') || '—',
      (skin) => `\`src/plugins/skins/${skin.name}/\``,
      (skin) => skin.description ?? '',
    ],
  );
  const sources = table(
    ['Source', 'Name', 'Markup', 'Bundled hosts', 'Folder', 'Notes'],
    registry.sources,
    [
      (source) => source.label,
      (source) => source.name,
      (source) => (source.markup ? 'yes' : 'no'),
      (source) => source.hosts.join(', ') || '—',
      (source) => `\`src/plugins/sources/${source.name}/\``,
      (source) => source.description ?? '',
    ],
  );

  return `# Plugins

<!-- Generated by \`npm run registry\`; edit the plugin folders, not this file. -->

GitAlike is assembled from two kinds of plugin, and the registry is open. A
**skin** is a target UI a page is made to look like; a **source** is a forge's
markup. They are independent — any source can wear any skin — and each is a
self-contained folder under \`src/plugins/\`: its \`index.js\`, its tests, and, for
a skin, its stylesheet. The plugin API is version ${registry.apiVersion}; its
contract is [docs/PLUGIN-API.md](docs/PLUGIN-API.md).

Run \`node tools/new-plugin.mjs skin <name>\` (or \`source <name>\`) to scaffold
one, and \`npm run registry\` to relist it here and in \`plugins.json\`.

## Skins

${skins}

## Sources

${sources}

A source carries the DOM hooks a skin reads (\`selectors\`) and the live page the
daily canary watches (\`canary\`). A source whose UI is client-rendered is
recoloured through the custom properties it reads — Bitbucket Cloud's Atlassian
\`--ds-*\`, PolyGerrit's root properties — not by reaching into its tree; the
mapping is in the source's \`tokens.css\`, beside its \`index.js\`. A source with
no hooks at all can still declare \`markup: false\`.
`;
}

/**
 * Everything the committed public faces get wrong, named. Empty means the site,
 * the catalog and `plugins.json` are exactly what the registry derives.
 */
export function registryProblems(files) {
  const { docs, json, catalog, list, popup } = files;
  const registry = registryObject();
  const problems = [];
  if (json !== `${JSON.stringify(registry, null, 2)}\n`) {
    problems.push('plugins.json is out of date — run `npm run registry`');
  }
  if (catalog !== renderCatalog(registry)) {
    problems.push('PLUGINS.md is out of date — run `npm run registry`');
  }
  if (docs !== applyToDocs(docs, registry)) {
    problems.push(
      'docs/index.html plugin chips are out of date — run `npm run registry`',
    );
  }
  if (list !== renderPluginList(registry)) {
    problems.push(
      'src/plugins/list.js is out of date — run `npm run registry`',
    );
  }
  if (popup !== applyToPopup(popup, registry)) {
    problems.push(
      'src/popup/popup.html plugin scripts are out of date — run `npm run registry`',
    );
  }
  return problems;
}

const SUMMARY = (registry) =>
  `${registry.skins.length} skins, ${registry.sources.length} sources`;

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const docsPath = join(root, 'docs/index.html');
  const jsonPath = join(root, 'plugins.json');
  const catalogPath = join(root, 'PLUGINS.md');
  const listPath = join(root, 'src/plugins/list.js');
  const popupPath = join(root, 'src/popup/popup.html');
  const html = await readFile(docsPath, 'utf8');
  const popup = await readFile(popupPath, 'utf8');
  const registry = registryObject();

  if (args.includes('--list')) {
    console.log(`plugin API ${registry.apiVersion} — ${SUMMARY(registry)}\n`);
    console.log('skins:');
    for (const skin of registry.skins) {
      console.log(`  ${skin.name.padEnd(12)} ${skin.product} (${skin.layout})`);
    }
    console.log('sources:');
    for (const source of registry.sources) {
      const kind = source.markup ? 'markup' : 'vocabulary-only';
      console.log(`  ${source.name.padEnd(12)} ${source.label} — ${kind}`);
    }
    return;
  }

  if (write) {
    await writeFile(jsonPath, `${JSON.stringify(registry, null, 2)}\n`);
    await writeFile(catalogPath, renderCatalog(registry));
    await writeFile(docsPath, applyToDocs(html, registry));
    await writeFile(listPath, renderPluginList(registry));
    await writeFile(popupPath, applyToPopup(popup, registry));
    console.log(
      'registry: wrote plugins.json, PLUGINS.md, docs/index.html, ' +
        `src/plugins/list.js and popup.html (${SUMMARY(registry)})`,
    );
    return;
  }

  const read = async (path) => {
    try {
      return await readFile(path, 'utf8');
    } catch {
      return '';
    }
  };
  const problems = registryProblems({
    docs: html,
    json: await read(jsonPath),
    catalog: await read(catalogPath),
    list: await read(listPath),
    popup,
  });
  if (problems.length) {
    console.error('registry: out of date');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log(`registry: in sync (${SUMMARY(registry)})`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
