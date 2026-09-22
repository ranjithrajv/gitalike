/**
 * The plugin-coverage policy, pinned.
 *
 * The policy is that a plugin ships fully tested: every line, branch and
 * function under `src/plugins/` must be exercised, and `npm test` is the gate
 * that enforces it (`tools/plugin-coverage.mjs`). A plugin's own tests live in
 * its folder and `tests/contracts.test.mjs` fails one without; this test keeps
 * the gate itself from being quietly weakened — changing the scope or the
 * thresholds has to be a deliberate edit here too, where the reason is written
 * down.
 *
 * `npm run test:unit` stays the plain runner, so a contributor can see the test
 * results without the coverage report.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = (rel) =>
  readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const pkg = JSON.parse(file('package.json'));
const gate = file('tools/plugin-coverage.mjs');

test('npm test runs the plugin coverage gate', () => {
  assert.equal(pkg.scripts.test, 'node tools/plugin-coverage.mjs');
  assert.equal(pkg.scripts['test:unit'], 'node --test');
});

test('the gate covers the plugins at 100%', () => {
  assert.match(gate, /--test-coverage-include=src\/plugins\/\*\*/);
  assert.match(gate, /--test-coverage-exclude=\*\*\/\*\.test\.mjs/);
  for (const metric of ['lines', 'branches', 'functions']) {
    assert.match(
      gate,
      new RegExp(`--test-coverage-${metric}=100`),
      `${metric} must be held at 100%`,
    );
  }
});
