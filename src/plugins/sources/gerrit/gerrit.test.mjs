/**
 * The Gerrit source's own tests, beside its definition.
 *
 * The hook is PolyGerrit's server-served app shell, which the canary watches;
 * the palette pass re-points its root custom properties. Node's test runner
 * discovers it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadSource } from '../../../../tools/plugin-test.mjs';

const { source: SOURCE, SELECTORS, CANARY_PAGES } = await loadSource('gerrit');

test('gerrit registers its PolyGerrit app-shell hooks', () => {
  assert.ok(SOURCE, 'the source registered');
  assert.equal(SOURCE.markup, true);
  assert.equal(SOURCE.label, 'Gerrit');
  assert.equal(SELECTORS.gerrit.app, 'gr-app#pg-app');
  // The profile pass reshapes an owner query's user header and a project
  // query's repo header, so the hooks it keys on are declared here rather than
  // only as literals in the pass.
  assert.equal(SELECTORS.gerrit.userHeader, 'gr-user-header');
  assert.equal(SELECTORS.gerrit.repoHeader, 'gr-repo-header');
});

test('every gerrit canary page pins a hook that exists', () => {
  assert.ok(CANARY_PAGES.length >= 1);
  for (const page of CANARY_PAGES) {
    assert.equal(page.source, 'gerrit');
    assert.ok(page.name);
    assert.match(page.url, /^https:\/\//);
    for (const key of page.keys) {
      assert.equal(typeof SELECTORS.gerrit[key], 'string', key);
    }
  }
});
