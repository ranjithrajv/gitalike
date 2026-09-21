/**
 * The plugin API's own tests, beside `core.js`.
 *
 * These exercise the constructors directly — what they fill, freeze and reject —
 * with fixtures, so they do not depend on the shipped plugins. That a registered
 * skin or source is complete is checked in `tests/contracts.test.mjs`, against
 * the real registry. Node's test runner discovers this file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import './core.js';

const {
  API_VERSION,
  SKIN_CAPABILITIES,
  defineSkin,
  defineSource,
  skinProblems,
  sourceProblems,
  assertCompatible,
} = globalThis.GITALIKE_PLUGINS;

const completeSkin = () => ({
  product: 'Fixture',
  badge: 'FX',
  color: '#000000',
  layout: 'github',
  phrases: {},
  nav: {},
  labels: {},
  chrome: {},
  unmapped: {},
  navRules: [],
  profileMenu: () => [],
});

test('defineSkin fills the optional capabilities and freezes', () => {
  const skin = defineSkin('fixture-capabilities', completeSkin());
  for (const capability of Object.keys(SKIN_CAPABILITIES)) {
    assert.ok(capability in skin, capability);
  }
  assert.deepEqual(skin.shortcuts, {});
  assert.deepEqual(skin.hide, []);
  assert.equal(skin.projectTabs, null);
  assert.equal(Object.isFrozen(skin), true);
});

test('defineSkin rejects a half-added skin with the whole list', () => {
  assert.throws(
    () => defineSkin('fixture-half', { product: 'Fixture' }),
    (error) =>
      error.message.includes("'fixture-half' is incomplete") &&
      error.message.includes('badge') &&
      error.message.includes('profileMenu'),
  );
});

test('defineSkin rejects a name that is already declared', () => {
  defineSkin('fixture-duplicate', completeSkin());
  assert.throws(
    () => defineSkin('fixture-duplicate', completeSkin()),
    /'fixture-duplicate' is declared twice/,
  );
});

test('skinProblems names a malformed field, not just a missing one', () => {
  assert.deepEqual(skinProblems({ ...completeSkin(), color: 'purple' }), [
    'color — a #rrggbb string',
  ]);
});

test('a source needs a label', () => {
  assert.deepEqual(sourceProblems({}), ['label — a display name, a string']);
});

test('a markup source needs hooks and a canary', () => {
  assert.deepEqual(sourceProblems({ label: 'Fixture' }), [
    'selectors — an object with at least one DOM hook',
    'canary — an array of pages, each with a name, a url and keys',
  ]);
});

test('a vocabulary-only source must not carry hooks or a canary', () => {
  assert.deepEqual(
    sourceProblems({
      label: 'Fixture',
      markup: false,
      selectors: { hook: '.x' },
      canary: [{ name: 'p', url: 'https://x', keys: ['hook'] }],
    }),
    [
      'selectors — a vocabulary-only source has none',
      'canary — a vocabulary-only source has none',
    ],
  );
});

test('a vocabulary-only source is complete with just a label', () => {
  const source = defineSource('fixture-vocabulary', {
    label: 'Fixture',
    markup: false,
  });
  assert.equal(source.markup, false);
  assert.deepEqual(source.selectors, {});
  assert.deepEqual(source.canary, []);
});

test('a plugin may pin the plugin API it was written against', () => {
  assert.throws(
    () => assertCompatible(API_VERSION + 1, 'future-plugin'),
    /needs plugin API/,
  );
  assert.doesNotThrow(() => assertCompatible(API_VERSION, 'today-plugin'));
  assert.throws(
    () =>
      defineSkin('fixture-future', {
        ...completeSkin(),
        minApiVersion: API_VERSION + 1,
      }),
    /needs plugin API/,
  );
});
