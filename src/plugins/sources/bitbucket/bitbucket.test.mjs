/**
 * The Bitbucket source's own tests, beside its definition.
 *
 * The hooks are Bitbucket Cloud's server-served app shell, which the canary
 * watches. Node's test runner discovers it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadSource } from '../../../../tools/plugin-test.mjs';

const {
  source: SOURCE,
  SELECTORS,
  CANARY_PAGES,
} = await loadSource('bitbucket');

test('bitbucket registers its Cloud app-shell hooks', () => {
  assert.ok(SOURCE, 'the source registered');
  assert.equal(SOURCE.markup, true);
  assert.equal(SOURCE.label, 'Bitbucket');
  assert.equal(SELECTORS.bitbucket.app, '#root');
  assert.equal(SELECTORS.bitbucket.bootstrap, 'meta#bb-bootstrap');
  assert.equal(SELECTORS.bitbucket.viewName, 'meta[name="bb-view-name"]');
});

test('every bitbucket canary page pins a hook that exists', () => {
  assert.ok(CANARY_PAGES.length >= 1);
  for (const page of CANARY_PAGES) {
    assert.equal(page.source, 'bitbucket');
    assert.ok(page.name);
    assert.match(page.url, /^https:\/\//);
    for (const key of page.keys) {
      assert.equal(typeof SELECTORS.bitbucket[key], 'string', key);
    }
  }
});
