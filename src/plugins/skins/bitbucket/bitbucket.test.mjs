/**
 * The Bitbucket skin's own tests, beside its definition and palette.
 *
 * The pinned suite at the bottom is the one anchored to a real capture rather
 * than to the source: Bitbucket no longer serves public repository pages, so a
 * saved menu model in `tests/fixtures/` is the reference. Node's test runner
 * discovers it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { loadSkin } from '../../../../tools/plugin-test.mjs';

const {
  skin: SKIN,
  NAV,
  NAV_KEEP,
  NAV_RULES,
  PROJECT_TABS,
  PROFILE_MENU,
  translate,
  translateControl,
  noEquivalentFor,
  activeTabFor,
  navGroupFor,
  projectTabs,
  repoNav,
} = await loadSkin('bitbucket');

test('bitbucket registers the Bitbucket meta and shape', () => {
  assert.ok(SKIN, 'the skin registered');
  assert.equal(SKIN.product, 'Bitbucket');
  assert.equal(SKIN.badge, 'BB');
  assert.match(SKIN.color, /^#[0-9a-f]{6}$/i);
  assert.equal(SKIN.layout, 'gitlab');
});

test('bitbucket maps each source’s words to its own', () => {
  assert.equal(translate('Merge requests', 'bitbucket'), 'Pull requests');
  assert.equal(translate('GitHub Actions', 'bitbucket'), 'Pipelines');
  assert.equal(translate('CI/CD', 'bitbucket'), 'Pipelines');
  assert.equal(NAV.bitbucket.Repository, 'Source');
  assert.equal(NAV.bitbucket['Work items'], 'Jira issues');
  assert.equal(translateControl('Squash and merge', 'bitbucket'), 'Squash');
  assert.equal(noEquivalentFor('Discussions', 'bitbucket'), 'Bitbucket');
});

test('bitbucket keeps only its own repo tabs, with no group headings', () => {
  for (const keep of ['Source', 'Pipelines', 'Jira issues']) {
    assert.ok(NAV_KEEP.bitbucket.includes(keep));
  }
  for (const drop of ['Projects', 'Insights', 'Wiki', 'Settings']) {
    assert.ok(!NAV_KEEP.bitbucket.includes(drop));
  }
  assert.equal(navGroupFor('Repository', 'bitbucket'), null);
});

test('bitbucket builds its own tab set and profile menu', () => {
  assert.deepEqual(
    PROJECT_TABS.bitbucket('/o/r', {}).map(([label]) => label),
    [
      'Source',
      'Commits',
      'Branches',
      'Pull requests',
      'Pipelines',
      'Deployments',
      'Jira issues',
      'Security',
      'Downloads',
    ],
  );
  assert.deepEqual(
    PROFILE_MENU.bitbucket('octocat').map(([label]) => label),
    ['Overview', 'Repositories', 'Projects', 'Snippets'],
  );
});

test('bitbucket relabels and reorders a Gitea tab bar', () => {
  const order = NAV_RULES.bitbucket.find((r) => r.source === 'gitea').order;
  const entries = repoNav(
    [
      { href: '/o/r', label: 'Code', active: true },
      { href: '/o/r/pulls', label: 'Pull requests' },
      { href: '/o/r/issues', label: 'Issues' },
      { href: '/o/r/actions', label: 'Actions' },
    ],
    'bitbucket',
    order,
  );
  assert.deepEqual(
    entries.map((entry) => entry.label),
    ['Source', 'Pull requests', 'Pipelines', 'Jira issues'],
  );
  assert.equal(entries[0].active, true);
});

test('bitbucket marks the active tab in its own words', () => {
  assert.equal(activeTabFor('projects:tree', 'bitbucket'), 'Source');
  assert.equal(activeTabFor('projects:pipelines', 'bitbucket'), 'Pipelines');
});

test('bitbucket’s stylesheet is beside it and scoped to the skin', () => {
  const css = readFileSync(
    new URL('./as-bitbucket.css', import.meta.url),
    'utf8',
  );
  assert.match(css, /html\.gs-theme-bitbucket\s*\{/);
});

// The skin pinned to a real capture: it must reorder to exactly the captured
// tabs, build exactly those tabs, keep only those tabs, and add no headings.
test('bitbucket matches its archived repository-page capture', () => {
  const capture = JSON.parse(
    readFileSync(
      new URL(
        '../../../../tests/fixtures/bitbucket-repo-tabs.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const captured = [...capture.tabs]
    .sort((a, b) => a.weight - b.weight)
    .map((tab) => tab.label);
  assert.match(capture.url, /^https:\/\/web\.archive\.org\//);
  assert.ok(captured.length > 3);
  assert.deepEqual(
    NAV_RULES.bitbucket.find((r) => r.source === 'gitea').order,
    captured,
  );
  assert.deepEqual(
    projectTabs('/o/r', {}, 'bitbucket').map(([label]) => label),
    captured,
  );
  assert.deepEqual(NAV_KEEP.bitbucket, captured);
  for (const label of captured) {
    assert.equal(navGroupFor(label, 'bitbucket'), null, label);
  }
});
