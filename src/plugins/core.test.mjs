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

test('a source that declares no pages is complete', () => {
  // `pages` is optional; absent means "says nothing", which is not incomplete.
  assert.deepEqual(sourceProblems({ label: 'Fixture', markup: false }), []);
});

test('pages must be an object when declared', () => {
  assert.deepEqual(
    sourceProblems({ label: 'Fixture', markup: false, pages: 'nope' }),
    ['pages — an object keyed by page kind'],
  );
});

test('a page names a route shape, a from, or is null', () => {
  const source = (pages) => ({ label: 'Fixture', markup: false, pages });
  assert.deepEqual(
    sourceProblems(source({ project: { route: '/x', from: 'path' } })),
    [],
  );
  assert.deepEqual(sourceProblems(source({ project: null })), []);
  // A route may be a list of shapes, and a shape may carry its namespace name.
  assert.deepEqual(
    sourceProblems(
      source({
        project: {
          route: ['/<owner>/<repo>', { path: '/<name>', namespace: 'user' }],
          from: 'path',
        },
      }),
    ),
    [],
  );
});

test('a malformed page is named, not silently accepted', () => {
  const source = (pages) => ({ label: 'Fixture', markup: false, pages });
  assert.deepEqual(
    sourceProblems(source({ nope: { route: '/x', from: 'p' } })),
    [
      'pages.nope — not a page kind (project, profile, dashboard, settings, signIn, signOut)',
    ],
  );
  assert.deepEqual(sourceProblems(source({ project: 7 })), [
    'pages.project — an object, or null for “has none”',
  ]);
  assert.deepEqual(sourceProblems(source({ project: [] })), [
    'pages.project — an object, or null for “has none”',
  ]);
  // A route with no path, or a list with a bad entry, is named by position.
  assert.deepEqual(sourceProblems(source({ project: { from: 'path' } })), [
    "pages.project.route — a path shape starting with '/'",
  ]);
  assert.deepEqual(
    sourceProblems(source({ project: { route: [], from: 'path' } })),
    ['pages.project.route — one path shape, or a list'],
  );
  assert.deepEqual(
    sourceProblems(
      source({ project: { route: ['/ok', 'nope'], from: 'path' } }),
    ),
    ["pages.project.route[1] — a path shape starting with '/'"],
  );
  assert.deepEqual(
    sourceProblems(source({ project: { route: '/x', from: 'pathname' } })),
    [],
  );
  assert.deepEqual(sourceProblems(source({ project: { route: '/x' } })), [
    'pages.project.from — how the subject is read from the URL',
  ]);
  // `namespace` is only read when `from` parses the path.
  assert.deepEqual(
    sourceProblems(
      source({ project: { route: '/x', from: null, namespace: 'user' } }),
    ),
    ['pages.project.namespace — only meaningful when `from` reads the path'],
  );
});

test('a canary page needs a name, a url and a non-empty keys list', () => {
  const source = (canary) => ({
    label: 'Fixture',
    selectors: { hook: '.x' },
    canary,
  });
  assert.deepEqual(
    sourceProblems(source([{ name: 'p', url: 'https://x', keys: ['hook'] }])),
    [],
  );
  const incomplete = [
    [{}], // no name
    [{ name: 'p' }], // no url
    [{ name: 'p', url: 'https://x' }], // no keys
    [{ name: 'p', url: 'https://x', keys: [] }], // empty keys
  ];
  for (const canary of incomplete) {
    assert.deepEqual(sourceProblems(source(canary)), [
      'canary — every page needs a name, a url and a non-empty keys list',
    ]);
  }
});

test('sourceProblems tolerates a missing source', () => {
  // `source?.label` short-circuits rather than throwing on a nullish argument.
  assert.deepEqual(sourceProblems(), ['label — a display name, a string']);
});

test('a compare fraction outside [0, 1] is rejected', () => {
  assert.deepEqual(
    sourceProblems({
      label: 'Fixture',
      markup: false,
      compare: { palette: 2 },
    }),
    ['compare.palette — a number in [0, 1]'],
  );
});

test('defineSkin needs a name', () => {
  assert.throws(
    () => defineSkin(undefined, completeSkin()),
    /a skin needs a name/,
  );
  assert.throws(() => defineSkin('', completeSkin()), /a skin needs a name/);
});

test('defineSkin/defineSource tolerate a missing partial', () => {
  // The `partial?.` reads short-circuit rather than throwing a TypeError.
  assert.throws(() => defineSkin('fixture-no-partial'), /is incomplete/);
  assert.throws(() => defineSource('fixture-no-partial'), /is incomplete/);
});

test('defineSource rejects an incomplete source with the whole list', () => {
  assert.throws(
    () => defineSource('fixture-incomplete', {}),
    (error) =>
      error.message.includes("'fixture-incomplete' is incomplete") &&
      error.message.includes('label'),
  );
});

test('a plugin may pin the plugin API it was written against', () => {
  assert.throws(
    () => assertCompatible(API_VERSION + 1, 'future-plugin'),
    /needs plugin API/,
  );
  assert.throws(
    () => assertCompatible('1', 'badly-pinned-plugin'),
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
