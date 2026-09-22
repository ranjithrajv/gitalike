#!/usr/bin/env node
/**
 * The plugin coverage gate.
 *
 * Every plugin is a self-contained folder with its own tests
 * (`src/plugins/<group>/<name>/<name>.test.mjs`), and this is the other half of
 * that policy: the plugin code those tests exercise must be **fully** covered —
 * 100% of lines, branches and functions under `src/plugins/`, or the gate fails.
 *
 * Node's test runner does the measuring, so this is a thin wrapper that pins the
 * scope (the plugins, not the rest of `src/`) and the thresholds (100). The whole
 * suite runs, so a plugin whose own test is thin is still exercised by the
 * cross-plugin tests; and `tests/contracts.test.mjs` loads the registry and
 * checks every folder carries a test, so nothing is silently left out of the
 * report. `npm test` runs this; `npm run test:unit` is the plain runner.
 *
 *   npm test
 *   npm run test:unit   # `node --test`, no coverage
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = [
  '--test',
  '--experimental-test-coverage',
  '--test-coverage-include=src/plugins/**',
  '--test-coverage-exclude=**/*.test.mjs',
  '--test-coverage-lines=100',
  '--test-coverage-branches=100',
  '--test-coverage-functions=100',
];

const result = spawnSync(process.execPath, args, {
  cwd: root,
  stdio: 'inherit',
});

if (result.error) {
  console.error(
    `plugin-coverage: could not run the test runner — ${result.error.message}`,
  );
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
