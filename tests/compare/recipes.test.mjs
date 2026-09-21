/**
 * The compare recipes each plugin must have.
 *
 * The comparison framework reads its lists from the plugin registry, but three
 * things are genuinely per-site and cannot be derived: a live capture (a URL and
 * a readiness selector), the computed-style selectors style-parity drives, and
 * the reviewed vocabulary each target product's menu carries. This test is the
 * contract for those, the way `tests/contracts.test.mjs` is for the plugins
 * themselves: add a source or a skin and `npm test` names the missing recipe
 * instead of a tool silently skipping it.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import '../../tools/plugins.mjs';
import {
  NO_CAPTURE,
  SOURCES as CAPTURE_SOURCES,
} from '../../tools/compare/captures.mjs';
import {
  PROJECT_SELECTORS,
  PROFILE_SELECTORS,
  PROJECT_VOCAB,
  PROFILE_VOCAB,
} from '../../tools/compare/style-recipes.mjs';

const PLUGINS = globalThis.GITALIKE_PLUGINS;
const SOURCES = Object.keys(PLUGINS.sources);
const SKINS = Object.keys(PLUGINS.skins);
const captured = new Set(CAPTURE_SOURCES.map((source) => source.key));

describe('compare recipes', () => {
  test('every source has a capture or a documented exclusion', () => {
    const missing = SOURCES.filter(
      (source) => !captured.has(source) && !NO_CAPTURE.has(source),
    );
    assert.deepEqual(
      missing,
      [],
      `no capture recipe for: ${missing.join(', ')}`,
    );
  });

  test('every source has project and profile selectors', () => {
    const missing = [];
    for (const source of SOURCES) {
      if (!PROJECT_SELECTORS[source]) missing.push(`${source} project`);
      if (!PROFILE_SELECTORS[source]) missing.push(`${source} profile`);
    }
    assert.deepEqual(
      missing,
      [],
      `no style-parity selectors for: ${missing.join(', ')}`,
    );
  });

  test('every source declares all of its compare capabilities', () => {
    // The rubric reads these; a source that omits one is scored as if it had no
    // coverage there, so require the whole set explicitly.
    const missing = [];
    for (const source of SOURCES) {
      const compare = PLUGINS.sources[source].compare ?? {};
      for (const key of PLUGINS.COMPARE_KEYS) {
        if (typeof compare[key] !== 'number')
          missing.push(`${source}.compare.${key}`);
      }
    }
    assert.deepEqual(
      missing,
      [],
      `missing compare capabilities: ${missing.join(', ')}`,
    );
  });

  test('every skin has a target vocabulary for both page types', () => {
    const missing = [];
    for (const skin of SKINS) {
      if (!PROJECT_VOCAB[skin]) missing.push(`${skin} project vocab`);
      if (!PROFILE_VOCAB[skin]) missing.push(`${skin} profile vocab`);
    }
    assert.deepEqual(
      missing,
      [],
      `no target vocabulary for: ${missing.join(', ')}`,
    );
  });
});
