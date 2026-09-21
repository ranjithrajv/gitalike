/**
 * The GitLab (Pajamas) source's own tests, beside its definition.
 *
 * Loads the plugin API and this source alone, then the derivation. Node's test
 * runner discovers it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import '../../core.js';
import './index.js';
import '../../../lib/sources.js';

const SOURCE = globalThis.GITALIKE_PLUGINS.sources.gitlab;
const { SELECTORS, CANARY_PAGES } = globalThis.GITALIKE_SOURCES;

test('gitlab registers its Pajamas hooks', () => {
  assert.ok(SOURCE, 'the source registered');
  assert.equal(SELECTORS.gitlab.superSidebar, '.super-sidebar');
  assert.equal(typeof SELECTORS.gitlab.projectSidebarBlock, 'string');
  assert.equal(typeof SELECTORS.gitlab.profileHeader, 'string');
});

test('every gitlab canary page pins a hook that exists', () => {
  assert.ok(CANARY_PAGES.length >= 2);
  for (const page of CANARY_PAGES) {
    assert.equal(page.source, 'gitlab');
    assert.ok(page.name);
    assert.match(page.url, /^https:\/\//);
    for (const key of page.keys) {
      assert.equal(typeof SELECTORS.gitlab[key], 'string', key);
    }
  }
});

test('gitlab canaries a project page and a profile page', () => {
  const urls = CANARY_PAGES.map((page) => page.url);
  assert.ok(urls.includes('https://gitlab.com/gitlab-org/gitlab'));
  assert.ok(urls.some((url) => url.includes('dzaporozhets')));
});
