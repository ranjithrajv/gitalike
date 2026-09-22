/**
 * The compare recipes each plugin must have.
 *
 * The comparison framework derives its lists from the plugin registry and each
 * folder's `parity.mjs`, so this is the contract that every folder carries one
 * and that the derived tables cover the registry: add a source or a skin and
 * `npm test` names the missing recipe instead of a tool silently skipping it.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';

import '../../tools/plugins.mjs';
import { SOURCES as CAPTURE_SOURCES } from '../../tools/compare/captures.mjs';
import {
  PROJECT_SELECTORS,
  PROFILE_SELECTORS,
  PROJECT_VOCAB,
  PROFILE_VOCAB,
} from '../../tools/compare/style-recipes.mjs';

const PLUGINS = globalThis.GITALIKE_PLUGINS;
const SOURCES = Object.keys(PLUGINS.sources);
const SKINS = Object.keys(PLUGINS.skins);

const folders = (group) =>
  readdirSync(new URL(`../../src/plugins/${group}`, import.meta.url), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

describe('compare recipes', () => {
  test('every plugin folder carries its parity.mjs', () => {
    const missing = [];
    for (const group of ['sources', 'skins']) {
      for (const name of folders(group)) {
        if (
          !existsSync(
            new URL(
              `../../src/plugins/${group}/${name}/parity.mjs`,
              import.meta.url,
            ),
          )
        ) {
          missing.push(`src/plugins/${group}/${name}/parity.mjs`);
        }
      }
    }
    assert.deepEqual(missing, [], `no parity.mjs for: ${missing.join(', ')}`);
  });

  test('every source has a capture, project and profile selectors', () => {
    const captured = new Set(CAPTURE_SOURCES.map((source) => source.key));
    const missing = [];
    for (const source of SOURCES) {
      if (!captured.has(source)) missing.push(`${source} capture`);
      if (!PROJECT_SELECTORS[source])
        missing.push(`${source} project selectors`);
      if (!PROFILE_SELECTORS[source])
        missing.push(`${source} profile selectors`);
    }
    assert.deepEqual(missing, [], `no recipe for: ${missing.join(', ')}`);
  });

  test('the capture table is the registry, in order', () => {
    assert.deepEqual(
      CAPTURE_SOURCES.map((source) => source.key),
      SOURCES,
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
