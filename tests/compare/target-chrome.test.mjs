/**
 * The contract half of the colour gate: every skin has a reviewed reference, and
 * the reference is internally coherent.
 *
 * The measurement half — the skins against the reference, and the reference
 * against the products' own screenshots — is `tools/compare/color-parity.mjs`,
 * run by `tests/compare/color-parity.test.mjs`. This file holds the parts that
 * are about the *shape* of the data rather than any one product's values: a skin
 * with no reference, a region with no token, a capture that is not in `docs/`.
 * Those are the ways the reference can rot silently, and none of them is a
 * colour question.
 *
 *   npm test
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import '../../tools/plugins.mjs';
import {
  REFERENCE,
  TOLERANCE,
  parsePalette,
} from '../../tools/compare/color-parity.mjs';

const PLUGINS = globalThis.GITALIKE_PLUGINS;
const SKINS = Object.keys(PLUGINS.skins);
const HEX = /^#[0-9a-f]{6}$/;
const MODES = ['light', 'dark'];

describe('target-chrome reference', () => {
  test('every skin has a reviewed, sourced entry', () => {
    for (const product of SKINS) {
      const entry = REFERENCE.products[product];
      assert.ok(entry, `${product} is in the fixture`);
      assert.match(
        String(entry.provenance ?? ''),
        /\S/,
        `${product} records where its values came from`,
      );
      for (const mode of MODES) {
        assert.ok(entry.modes?.[mode], `${product} has a ${mode} palette`);
        for (const [token, value] of Object.entries(entry.modes[mode])) {
          assert.match(
            value,
            HEX,
            `${product}/${mode}.${token} is a hex colour`,
          );
        }
      }
    }
  });

  test('the fixture records the tolerances it is scored against', () => {
    // A number in the fixture and a number in the module that nothing compares
    // is a number that will quietly stop meaning anything to either.
    assert.deepEqual(
      {
        lightness: REFERENCE.jnd.lightness,
        chroma: REFERENCE.jnd.chroma,
        hue: REFERENCE.jnd.hue,
      },
      TOLERANCE,
      'the fixture and the module agree on what a match is',
    );
  });

  test('every skin declares a palette in both modes', () => {
    // The old test read the light block only, so a skin's dark mode was never
    // checked at all. Both are read through the shared parser.
    for (const product of SKINS) {
      const palette = parsePalette(product);
      for (const mode of MODES) {
        assert.ok(
          Object.keys(palette[mode]).length,
          `${product} declares --gs-* colours in ${mode}`,
        );
        for (const token of Object.keys(
          REFERENCE.products[product].modes[mode],
        )) {
          assert.ok(
            palette[mode][token],
            `${product}/${mode} declares --gs-${token}`,
          );
        }
      }
    }
  });

  for (const product of SKINS) {
    test(`${product}: every named region resolves to a token and a capture`, () => {
      const entry = REFERENCE.products[product];
      // A region is a measured claim: it names a box in a capture and the token
      // the product's own value for that box. Either half missing makes the
      // region a guess, and a guessed region is worse than no region.
      for (const [role, region] of Object.entries(entry.regions ?? {})) {
        const [x0, y0, x1, y1] = region.box;
        assert.ok(
          [x0, y0, x1, y1].every((n) => Number.isInteger(n)),
          `${product}.${role} has an integer box`,
        );
        assert.ok(x1 > x0 && y1 > y0, `${product}.${role} is a real rectangle`);
        assert.ok(
          entry.modes.light[region.token],
          `${product}.${role} names --gs-${region.token}, which the light palette has`,
        );
        assert.match(
          String(region.note ?? ''),
          /\S/,
          `${product}.${role} says why that box is that region`,
        );
      }
      for (const [kind, file] of Object.entries(entry.captures ?? {})) {
        assert.ok(
          existsSync(new URL(`../../docs/${file}`, import.meta.url)),
          `${product}.${kind} capture docs/${file} exists`,
        );
      }
    });
  }

  for (const product of SKINS) {
    test(`${product}: compareOn names sources that have a capture`, () => {
      const entry = REFERENCE.products[product];
      const declared = PLUGINS.sources;
      for (const source of entry.compareOn ?? []) {
        assert.ok(
          declared[source],
          `${product}.compareOn "${source}" is a source`,
        );
      }
      // An empty compareOn is a deliberate "not measurable" and has to say so,
      // so a capture going missing later reads as a choice rather than an
      // accident.
      if (!(entry.compareOn ?? []).length) {
        assert.match(
          String(entry.compareOnNote ?? ''),
          /\S/,
          `${product} says why it has no comparable capture`,
        );
      }
    });
  }

  test('the asOf date is a date', () => {
    assert.match(REFERENCE.asOf, /^\d{4}-\d{2}-\d{2}$/);
  });
});
