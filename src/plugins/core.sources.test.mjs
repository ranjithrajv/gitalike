/**
 * The plugin API's *source-field* validation, beside `core.js`.
 *
 * `defineSource` checks the optional per-forge vocabulary a source may carry
 * beyond its DOM hooks — the hosts it is, the routes/scopes its navigation lives
 * in, the labels its own markup uses, and the fields that describe a product
 * (`kind`, `product`, `counterpart`, `routes`, `activeTabs`). A fixture that
 * omits them is complete; one that declares a field in the wrong shape must be
 * named rather than silently ignored, which is what these cases pin.
 *
 * Split from `core.test.mjs` so each file has one concern, and because the
 * coverage gate needs every branch of `sourceFieldProblems` exercised.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import './core.js';

const { sourceProblems } = globalThis.GITALIKE_PLUGINS;

// The expected message for each optional list field, so a test names the shape
// rather than restating the validator's wording.
const EXPECTED_LIST = {
  hosts: 'hostnames',
  reserved: 'path segments',
  navScope: 'selector strings',
  topbarScope: 'selector strings',
  navWords: 'displayed labels',
  metadataHide: 'section labels',
};

test('a source’s optional list fields are checked for shape', () => {
  // The per-forge vocabulary a source may carry beyond its hooks: a fixture that
  // omits them is complete, but one that declares a field in the wrong shape is
  // named rather than silently ignored.
  assert.deepEqual(
    sourceProblems({
      label: 'Fixture',
      markup: false,
      hosts: ['a.example'],
      reserved: ['settings'],
      navScope: ['.nav'],
      topbarScope: ['#bar'],
      navWords: ['Code'],
      metadataHide: ['Releases'],
    }),
    [],
  );
  for (const field of [
    'hosts',
    'reserved',
    'navScope',
    'topbarScope',
    'navWords',
    'metadataHide',
  ]) {
    assert.deepEqual(
      sourceProblems({ label: 'Fixture', markup: false, [field]: 'nope' }),
      [`${field} — an array of ${EXPECTED_LIST[field]}`],
    );
  }
});

test('a malformed source field is named, not silently accepted', () => {
  const source = (fields) => ({ label: 'Fixture', markup: false, ...fields });
  assert.deepEqual(sourceProblems(source({ kind: '' })), [
    'kind — a non-empty string',
  ]);
  assert.deepEqual(sourceProblems(source({ counterpart: 7 })), [
    'counterpart — a source name, or null',
  ]);
  assert.deepEqual(sourceProblems(source({ product: '' })), [
    'product — a display name, a string',
  ]);
  // `counterpart: null` is the "no counterpart" declaration, not a bad value.
  assert.deepEqual(sourceProblems(source({ counterpart: null })), []);
  assert.deepEqual(sourceProblems(source({ routes: 'nope' })), [
    'routes — an object of segment -> segment',
  ]);
  assert.deepEqual(sourceProblems(source({ routes: { pull: 7 } })), [
    'routes — an object of segment -> segment',
  ]);
  assert.deepEqual(sourceProblems(source({ activeTabs: 'nope' })), [
    'activeTabs — an array of [pattern, label]',
  ]);
  // Each entry is exactly [RegExp, string]; a bare string, a one-element pair
  // and a pair whose label is not a string all fail.
  for (const activeTabs of [
    ['Code'],
    [[/^projects:show\b/]],
    [[/^projects:show\b/, 7]],
  ]) {
    assert.deepEqual(sourceProblems(source({ activeTabs })), [
      'activeTabs — an array of [pattern, label]',
    ]);
  }
  assert.deepEqual(
    sourceProblems(source({ activeTabs: [[/^projects:show\b/, 'Code']] })),
    [],
  );
});
