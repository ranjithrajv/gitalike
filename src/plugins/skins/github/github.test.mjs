/**
 * The GitHub skin's own tests, beside its definition and palette.
 *
 * Loads the plugin API and this skin alone, then the derivation, so it checks
 * the skin's own declarations rather than every skin at once — the cross-skin
 * invariants stay in `tests/ux.test.mjs`. Node's test runner discovers it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../../core.js';
import './index.js';
import '../../../lib/skins.js';

const SKIN = globalThis.GITALIKE_PLUGINS.skins.github;
const {
  NAV,
  LABELS,
  CHROME,
  UNMAPPED,
  SHORTCUTS,
  TOPBAR_HIDE,
  NAV_KEEP,
  NAV_RULES,
  PROJECT_TABS,
  PROFILE_MENU,
} = globalThis.GITALIKE_SKINS;

test('github registers the GitHub meta and shape', () => {
  assert.ok(SKIN, 'the skin registered');
  assert.equal(SKIN.product, 'GitHub');
  assert.equal(SKIN.badge, 'GH');
  assert.match(SKIN.color, /^#[0-9a-f]{6}$/i);
  assert.equal(SKIN.layout, 'github');
});

test('github rewrites GitLab vocabulary the GitHub way', () => {
  assert.equal(NAV.github.Repository, 'Code');
  assert.equal(NAV.github['CI/CD'], 'Actions');
  assert.equal(NAV.github['Work items'], 'Issues');
  assert.equal(LABELS.github.Merge, 'Merge pull request');
  assert.equal(CHROME.github['Your projects'], 'Your repositories');
  assert.equal(UNMAPPED.github.Epics, 'GitHub');
});

test('github whitelists its own project-page tabs', () => {
  // A whitelist, not a blacklist: only GitHub's own options are kept, however
  // the source presses the counter into the label.
  for (const keep of ['Code', 'Issues', 'Pull requests', 'Insights']) {
    assert.ok(NAV_KEEP.github.includes(keep), keep);
  }
  assert.ok(!NAV_KEEP.github.includes('Branches'));
  assert.ok(TOPBAR_HIDE.github.includes('Why GitLab'));
  assert.deepEqual(SHORTCUTS.github, { gp: 'gm', gb: 'gp', gn: 'gt' });
});

test('github resolves GitLab’s sidebar group and shares Gitea’s order', () => {
  const gitlab = NAV_RULES.github.find((rule) => rule.source === 'gitlab');
  assert.equal(gitlab.scope, '.super-sidebar');
  assert.equal(gitlab.contains, 'Code');
  assert.equal(gitlab.item, 'li');
  const gitea = NAV_RULES.github.find((rule) => rule.source === 'gitea');
  assert.equal(gitea.order, gitlab.order);
});

test('github builds its own project tab set', () => {
  assert.deepEqual(
    PROJECT_TABS.github('/a/b', { issues: '/a/b/-/issues' }).map(([l]) => l),
    [
      'Code',
      'Issues',
      'Pull requests',
      'Actions',
      'Projects',
      'Wiki',
      'Security and quality',
      'Insights',
    ],
  );
});

test('github lists its profile tabs', () => {
  assert.deepEqual(
    PROFILE_MENU.github('octocat').map(([label]) => label),
    ['Overview', 'Repositories', 'Projects', 'Packages', 'Stars'],
  );
});

test('github’s stylesheet is beside it and scoped to the skin', () => {
  const css = readFileSync(new URL('./as-github.css', import.meta.url), 'utf8');
  assert.match(css, /html\.gs-theme-github\s*\{/);
});
