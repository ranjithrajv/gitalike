/**
 * The GitLab skin's own tests, beside its definition and palette.
 *
 * Loads the plugin API and this skin alone, then the derivation, so it checks
 * the skin's own declarations rather than every skin at once — the cross-skin
 * invariants stay in `tests/ux.test.mjs`. Node's test runner discovers it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { loadSkin } from '../../../../tools/plugin-test.mjs';

const {
  skin: SKIN,
  NAV,
  LABELS,
  CHROME,
  UNMAPPED,
  SHORTCUTS,
  TOPBAR_HIDE,
  NAV_GROUPS,
  NAV_HIDE,
  NAV_RULES,
  PROFILE_MENU,
} = await loadSkin('gitlab');

test('gitlab registers the GitLab meta and shape', () => {
  assert.ok(SKIN, 'the skin registered');
  assert.equal(SKIN.product, 'GitLab');
  assert.equal(SKIN.badge, 'GL');
  assert.match(SKIN.color, /^#[0-9a-f]{6}$/i);
  assert.equal(SKIN.layout, 'gitlab');
  assert.equal(typeof SKIN.profileMenu, 'function');
});

test('gitlab rewrites GitHub vocabulary the GitLab way', () => {
  assert.equal(NAV.gitlab['Pull requests'], 'Merge requests');
  assert.equal(NAV.gitlab.Source, 'Repository');
  assert.equal(NAV.gitlab.Pipelines, 'CI/CD');
  assert.equal(LABELS.gitlab['Merge pull request'], 'Merge');
  assert.equal(CHROME.gitlab['Your repositories'], 'Your projects');
  assert.equal(UNMAPPED.gitlab.Discussions, 'GitLab');
});

test('gitlab groups its sidebar and hides what it has no page for', () => {
  assert.equal(NAV_GROUPS.gitlab['Merge requests'], 'Code');
  assert.equal(NAV_GROUPS.gitlab['Work items'], 'Plan');
  assert.deepEqual([...NAV_HIDE.gitlab].sort(), [
    'Discussions',
    'Marketplace',
    'Sponsors',
  ]);
});

test('gitlab maps its two-key combos onto the source site’s', () => {
  assert.deepEqual(SHORTCUTS.gitlab, { gm: 'gp', gp: 'gb', gt: 'gn' });
  assert.ok(TOPBAR_HIDE.gitlab.includes('Sign up'));
});

test('gitlab rules GitHub’s tab bar and shares Gitea’s order', () => {
  const github = NAV_RULES.gitlab.find((rule) => rule.source === 'github');
  assert.match(github.container, /UnderlineNav-body/);
  const gitea = NAV_RULES.gitlab.find((rule) => rule.source === 'gitea');
  assert.equal(gitea.order, github.order);
  // The order ranks the *displayed* labels: "Issues" is shown as "Work items".
  assert.ok(github.order.includes('Work items'));
  assert.ok(!github.order.includes('Issues'));
});

test('gitlab names its profile menu after the user', () => {
  const menu = PROFILE_MENU.gitlab('octocat', 'The Octocat');
  assert.equal(menu[0][0], 'The Octocat');
  assert.deepEqual(
    menu.map(([label]) => label),
    [
      'The Octocat',
      'Activity',
      'Groups',
      'Contributed projects',
      'Personal projects',
      'Starred projects',
      'Snippets',
      'Followers',
      'Following',
    ],
  );
});

test('gitlab declares no project tabs, so the default applies', () => {
  // The GitLab skin leaves the rebuilt GitHub tab set to GitHub's default; the
  // shared fallback is covered in tests/ux.test.mjs.
  assert.equal(globalThis.GITALIKE_SKINS.PROJECT_TABS.gitlab, undefined);
});

test('gitlab’s stylesheet is beside it and scoped to the skin', () => {
  const css = readFileSync(new URL('./as-gitlab.css', import.meta.url), 'utf8');
  assert.match(css, /html\.gs-theme-gitlab\s*\{/);
});
