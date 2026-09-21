#!/usr/bin/env node
/**
 * GitAlike — the published plugin registry.
 *
 * The registry is *authored* in the source: one `defineSkin` file under
 * `src/plugins/skins/`, one `defineSource` under `src/plugins/sources/`. This
 * tool is the only thing that turns that into the two public faces —
 * `plugins.json` for tooling and the Plugins chips in `docs/index.html` — so a
 * plugin cannot ship while the site or the JSON still lists the old set. It is
 * standard-library only and loads the same files the extension loads, so what it
 * publishes is exactly what ships.
 *
 *   node tools/registry.mjs            # check (the CI / pre-commit gate)
 *   node tools/registry.mjs --write    # regenerate both faces
 *
 * The docs page is hand-authored; only the marked blocks below are generated.
 * The test in `tests/contracts.test.mjs` calls `registryProblems` directly, so
 * drift fails `npm test` without spawning a process.
 */
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

/**
 * The registry as data, derived from the loaded modules. The order is the
 * declaration order in source, so the site and the JSON list plugins the way
 * the code does.
 */
export function registryObject() {
  const { API_VERSION, SKINS } = globalThis.GITALIKE_SKINS;
  const { SOURCES } = globalThis.GITALIKE_SOURCES;
  return {
    apiVersion: API_VERSION,
    skins: Object.entries(SKINS).map(([name, skin]) => ({
      name,
      product: skin.product,
      badge: skin.badge,
      color: skin.color,
      layout: skin.layout,
    })),
    sources: Object.entries(SOURCES).map(([name, source]) => ({
      name,
      label: source.label,
      selectors: Object.keys(source.selectors),
      canary: source.canary.map((page) => page.url),
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
function setBlock(html, [start, end], body) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  if (from === -1 || to === -1) {
    throw new Error(
      `registry: docs/index.html has no "${start}" / "${end}" block`,
    );
  }
  const bodyStart = html.indexOf('\n', from) + 1;
  const bodyEnd = html.lastIndexOf('\n', to) + 1;
  return `${html.slice(0, bodyStart)}${body}\n${html.slice(bodyEnd)}`;
}

/** `html` with both generated blocks rewritten from `registry`. */
export function applyToDocs(html, registry) {
  const chips = renderChips(registry);
  return setBlock(
    setBlock(html, BLOCKS.skins, chips.skins),
    BLOCKS.sources,
    chips.sources,
  );
}

/**
 * Everything the committed public faces get wrong, named. Empty means the site
 * and `plugins.json` are exactly what the registry derives.
 */
export function registryProblems(html, json) {
  const registry = registryObject();
  const problems = [];
  if (json !== `${JSON.stringify(registry, null, 2)}\n`) {
    problems.push('plugins.json is out of date — run `npm run registry`');
  }
  if (html !== applyToDocs(html, registry)) {
    problems.push(
      'docs/index.html plugin chips are out of date — run `npm run registry`',
    );
  }
  return problems;
}

async function main() {
  const write = process.argv.includes('--write');
  const docsPath = join(root, 'docs/index.html');
  const jsonPath = join(root, 'plugins.json');
  const html = await readFile(docsPath, 'utf8');
  const registry = registryObject();

  const summary = `${registry.skins.length} skins, ${registry.sources.length} sources`;

  if (write) {
    await writeFile(jsonPath, `${JSON.stringify(registry, null, 2)}\n`);
    await writeFile(docsPath, applyToDocs(html, registry));
    console.log(
      `registry: wrote plugins.json and docs/index.html (${summary})`,
    );
    return;
  }

  let json = '';
  try {
    json = await readFile(jsonPath, 'utf8');
  } catch {
    json = '';
  }

  const problems = registryProblems(html, json);
  if (problems.length) {
    console.error('registry: out of date');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log(`registry: in sync (${summary})`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
