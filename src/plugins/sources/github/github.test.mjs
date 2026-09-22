/**
 * The GitHub (Primer) source's own tests, beside its definition.
 *
 * Loads the plugin API and the sources it cross-references, then the
 * derivation. Node's test
 * runner discovers it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadSource } from '../../../../tools/plugin-test.mjs';

const { source: SOURCE, SELECTORS, CANARY_PAGES } = await loadSource('github');

test('github registers its Primer hooks', () => {
  assert.ok(SOURCE, 'the source registered');
  assert.match(SELECTORS.github.repoNavList, /UnderlineNav-body/);
  assert.equal(typeof SELECTORS.github.appHeader, 'string');
  assert.equal(typeof SELECTORS.github.metadataSidebar, 'string');
});

test('every github canary page pins a hook that exists', () => {
  assert.ok(CANARY_PAGES.length >= 2);
  for (const page of CANARY_PAGES) {
    assert.equal(page.source, 'github');
    assert.ok(page.name);
    assert.match(page.url, /^https:\/\//);
    for (const key of page.keys) {
      assert.equal(typeof SELECTORS.github[key], 'string', key);
    }
  }
});

test('github canaries a repository and a profile page', () => {
  const urls = CANARY_PAGES.map((page) => page.url);
  assert.ok(urls.includes('https://github.com/git/git'));
  assert.ok(urls.some((url) => url.includes('torvalds')));
});
