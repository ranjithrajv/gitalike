/**
 * Pins the UX parity scores quoted in docs/UX-PARITY.md to the module that
 * computes them, so the scorecard cannot drift from the tables it describes.
 *
 * The module derives each dimension from `src/lib/ux.js` and `src/lib/sites.js`
 * (see tools/compare/parity-score.mjs); this asserts the documented numbers, the
 * rubric's weight totals, and the shape of the two tables.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SOURCES,
  SKINS,
  RUBRICS,
  RUBRIC_TOTAL,
  isReal,
  breakdown,
  score,
  table,
  cell,
} from '../../tools/compare/parity-score.mjs';

const doc = readFileSync(
  new URL('../../docs/UX-PARITY.md', import.meta.url),
  'utf8',
);

const HEADINGS = {
  project: '### Project pages, sources × skins',
  profile: '### Profile pages, sources × skins',
};

/** The scoring tables as written in the doc: source label -> cell strings. */
function documented() {
  const out = {};
  for (const [pageType, heading] of Object.entries(HEADINGS)) {
    const start = doc.indexOf(heading);
    assert.notEqual(start, -1, `docs/UX-PARITY.md has "${heading}"`);
    const after = doc.slice(start + heading.length);
    const end = after.search(/\n#{2,4} /);
    const block = end === -1 ? after : after.slice(0, end);
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('|'));
    assert.ok(
      lines.length >= 2 + SOURCES.length,
      `${heading} has a full table`,
    );

    const header = lines[0]
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    assert.deepEqual(
      header.slice(1),
      SKINS.map((skin) => skin.label),
      `${heading} names the skins in order`,
    );

    const rows = {};
    for (const line of lines.slice(2)) {
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .slice(1, -1);
      rows[cells[0].replace(/\*\*/g, '')] = cells.slice(1);
    }
    out[pageType] = rows;
  }
  return out;
}

describe('parity rubric', () => {
  test('each page type weights to 100', () => {
    for (const [pageType, dims] of Object.entries(RUBRICS)) {
      const total = dims.reduce((sum, dim) => sum + dim.weight, 0);
      assert.equal(total, RUBRIC_TOTAL, pageType);
    }
  });

  test('every share is a fraction in [0, 1]', () => {
    for (const [pageType, dims] of Object.entries(RUBRICS)) {
      for (const { key: source } of SOURCES) {
        for (const { key: skin } of SKINS) {
          if (!isReal(source, skin)) continue;
          const parts = breakdown(source, skin, pageType);
          assert.deepEqual(
            parts.map((part) => part.key),
            dims.map((dim) => dim.key),
          );
          for (const part of parts) {
            assert.ok(
              part.share >= 0 && part.share <= 1,
              `${pageType} ${source}→${skin} ${part.key} = ${part.share}`,
            );
          }
        }
      }
    }
  });

  test('a source wearing its own UI is evaluated, and scores full marks', () => {
    // The rubric runs on the native pair too: every dimension is satisfied, so
    // the total is 100 and the score is 10 without a special case.
    for (const pageType of ['project', 'profile']) {
      for (const { key: source } of SOURCES) {
        assert.equal(score(source, source, pageType), 10);
        const parts = breakdown(source, source, pageType);
        assert.ok(
          parts.every((part) => part.share === 1),
          `${pageType} ${source} native shares are all satisfied`,
        );
      }
    }
  });

  test('every real score is in (0, 10]', () => {
    for (const pageType of ['project', 'profile']) {
      for (const { key: source } of SOURCES) {
        for (const { key: skin } of SKINS) {
          const value = score(source, skin, pageType);
          if (value === null) continue;
          assert.ok(
            value > 0 && value <= 10,
            `${pageType} ${source}→${skin} = ${value}`,
          );
        }
      }
    }
  });
});

describe('docs/UX-PARITY.md scorecard', () => {
  test('quotes exactly the computed scores', () => {
    const rows = documented();
    for (const [pageType, heading] of Object.entries(HEADINGS)) {
      const computed = table(pageType);
      const documentedRows = rows[pageType];
      assert.deepEqual(
        Object.keys(documentedRows).sort(),
        computed.map((row) => row.label).sort(),
        `${heading} lists every source`,
      );
      for (const row of computed) {
        assert.deepEqual(
          documentedRows[row.label],
          row.scores.map(cell),
          `${heading}: ${row.label}`,
        );
      }
    }
  });
});
