/**
 * The Gitea / Forgejo source's own tests, beside its definition.
 *
 * Loads the plugin API and the sources it cross-references, then the
 * derivation. Gitea and
 * Forgejo share one markup family across two hosts, so both are canaried. Node's
 * test runner discovers it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadSource } from '../../../../tools/plugin-test.mjs';

const { source: SOURCE, SELECTORS, CANARY_PAGES } = await loadSource('gitea');

test('gitea registers its Forgejo hooks', () => {
  assert.ok(SOURCE, 'the source registered');
  assert.match(SELECTORS.gitea.repoNavList, /overflow-menu/);
  assert.equal(typeof SELECTORS.gitea.themeMarker, 'string');
  assert.equal(typeof SELECTORS.gitea.repoHeader, 'string');
});

test('every gitea canary page pins a hook that exists', () => {
  assert.ok(CANARY_PAGES.length >= 2);
  for (const page of CANARY_PAGES) {
    assert.equal(page.source, 'gitea');
    assert.ok(page.name);
    assert.match(page.url, /^https:\/\//);
    for (const key of page.keys) {
      assert.equal(typeof SELECTORS.gitea[key], 'string', key);
    }
  }
});

test('gitea canaries both hosts of the shared markup family', () => {
  const urls = CANARY_PAGES.map((page) => page.url);
  for (const host of ['codeberg.org', 'gitea.com']) {
    assert.ok(
      urls.some((url) => url.includes(host)),
      `no canary page watches ${host}`,
    );
  }
});
