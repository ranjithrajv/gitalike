/**
 * The page kinds the comparison framework scores, derived from the plugins.
 *
 * `PAGE_KINDS` is the API's list; each source declares which it has; the
 * framework scores the kinds it has a rubric for. These tests pin the join, so a
 * new source or kind cannot silently drop out of a comparison table.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import '../../tools/plugins.mjs';
import {
  PAGE_KINDS,
  comparableKinds,
  coverage,
  declares,
  declaredKinds,
  has,
  kindLabel,
  missingRecipes,
} from '../../tools/compare/page-kinds.mjs';
import {
  COMPARED,
  NOT_COMPARED,
  RECIPE_KINDS,
  score,
} from '../../tools/compare/parity-score.mjs';

const PLUGINS = globalThis.GITALIKE_PLUGINS;
const SOURCES = Object.keys(PLUGINS.sources);

describe('page kinds', () => {
  test('come from the plugin API, not a second list', () => {
    assert.deepEqual(PAGE_KINDS, Object.keys(PLUGINS.PAGE_KINDS));
    assert.ok(PAGE_KINDS.length >= 2);
  });

  test('a kind is declared by every source to be comparable', () => {
    // `declaredKinds` is the intersection: a kind only some sources declare is
    // excluded, so no table is mostly blanks.
    const declared = declaredKinds();
    for (const kind of declared) {
      for (const source of SOURCES) {
        assert.ok(declares(source, kind), `${source} does not declare ${kind}`);
      }
    }
  });

  test('comparable kinds are declared kinds with a recipe', () => {
    const withRecipe = comparableKinds(RECIPE_KINDS);
    assert.deepEqual(withRecipe, COMPARED);
    for (const kind of COMPARED) assert.ok(PAGE_KINDS.includes(kind));
    // Anything declared but unscored is reported, never silently omitted.
    assert.deepEqual(
      [...COMPARED, ...NOT_COMPARED].sort(),
      [...declaredKinds()].sort(),
    );
  });

  test('a scored kind has a score for every real source × skin pair', () => {
    for (const kind of COMPARED) {
      for (const source of SOURCES) {
        assert.ok(declares(source, kind), `${source} declares ${kind}`);
        for (const skin of Object.keys(PLUGINS.skins)) {
          if (skin === source) continue;
          const value = score(source, skin, kind);
          assert.ok(
            Number.isFinite(value) && value >= 0 && value <= 10,
            `${kind} ${source}→${skin} scored ${value}`,
          );
        }
      }
    }
  });

  test('a source that has no such page is not scored there', () => {
    // Gerrit declares no dashboard and no sign-in form; `has` says so, and the
    // coverage grid carries it so a consumer can skip rather than assume.
    assert.equal(has('gerrit', 'dashboard'), false);
    assert.equal(has('gerrit', 'signIn'), false);
    assert.ok(declares('gerrit', 'dashboard'), 'but it does declare the kind');
    assert.equal(has('github', 'profile'), true);
    const gerrit = coverage().find((row) => row.source === 'gerrit');
    assert.equal(gerrit.pages.dashboard, null);
  });

  test('a kind has a stable display label', () => {
    assert.equal(kindLabel('project'), 'Project');
    assert.equal(kindLabel('signIn'), 'Sign-in');
    assert.equal(kindLabel('signOut'), 'Sign-out');
  });

  test('an unscored kind is only ever a declared kind', () => {
    // `missingRecipes` is the honest statement of what the framework does not
    // score yet; it must only ever name declared kinds.
    for (const kind of missingRecipes(RECIPE_KINDS)) {
      assert.ok(declaredKinds().includes(kind), `${kind} is declared`);
    }
  });
});
