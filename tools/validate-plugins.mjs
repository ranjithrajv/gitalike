#!/usr/bin/env node
/**
 * Validate every plugin folder in isolation, so all the incomplete ones are
 * reported at once.
 *
 * `defineSkin`/`defineSource` throw on the first incomplete plugin, so importing
 * the whole registry stops there and a contributor fixes plugins one at a time.
 * This runs each folder in its own child process — with the sources a skin needs
 * to resolve its `navRules`, and the deriving library — and collects the
 * verdicts. Use it after scaffolding or a merge; `npm test` remains the gate.
 *
 *   node tools/validate-plugins.mjs
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = (...parts) => pathToFileURL(join(root, ...parts)).href;

const core = url('src', 'plugins', 'core.js');

const pluginNames = (group) => {
  try {
    return readdirSync(join(root, 'src/plugins', group), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
};

const sourceEntries = pluginNames('sources').map((name) =>
  url('src', 'plugins', 'sources', name, 'index.js'),
);
const sourceNames = pluginNames('sources');

// A child that imports `files` in order and reports the first failure. The
// `-e` script is built here so the child needs no file of its own.
function check(files) {
  const script = `for (const f of ${JSON.stringify(files)}) await import(f);`;
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    { encoding: 'utf8' },
  );
  if (result.status === 0) return null;
  return `${result.stderr || result.stdout || 'failed'}`
    .trim()
    .split('\n')
    .filter((line) => !/^\s+at\s/.test(line))
    .join('\n');
}

let failed = 0;
let checked = 0;

for (const group of ['skins', 'sources']) {
  for (const name of pluginNames(group)) {
    checked += 1;
    const entry = url('src', 'plugins', group, name, 'index.js');
    const files =
      group === 'skins'
        ? [core, ...sourceEntries, entry, url('src', 'lib', 'skins.js')]
        : [core, entry, url('src', 'lib', 'sources.js')];
    const problem = check(files);
    if (problem) {
      failed += 1;
      console.error(`FAIL  ${group}/${name}`);
      console.error(problem.replace(/^/gm, '      '));
    } else {
      console.log(`ok    ${group}/${name}`);
    }
  }
}

if (failed) {
  console.error(
    `\n${failed} of ${checked} plugin(s) incomplete — see the errors above`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `\n${checked} plugins valid (${pluginNames('skins').length} skins, ${sourceNames.length} sources)`,
  );
}
