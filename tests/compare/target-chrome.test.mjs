/**
 * The reviewed target-chrome reference, pinned to the skins' own light palettes.
 *
 * `tests/fixtures/target-chrome.json` holds the real products' chrome colours
 * and is the independent reference `tools/compare/style-parity.mjs` scores a live
 * page against. This test is the offline half of that gate: it catches a `--gs-*`
 * token edited in a theme without the reference being updated, so the score
 * keeps measuring fidelity to the product rather than the theme agreeing with
 * itself.
 *
 *   npm test
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(
  readFileSync(
    new URL('../fixtures/target-chrome.json', import.meta.url),
    'utf8',
  ),
);

const PRODUCTS = ['github', 'gitlab', 'bitbucket'];
const HEX = /^#[0-9a-f]{6}$/;

// The light palette only: the first `html.gs-theme-<product> {` block, cut
// before its `.gs-dark` override.
function lightPalette(product) {
  const css = readFileSync(
    new URL(`../../src/themes/as-${product}.css`, import.meta.url),
    'utf8',
  );
  const start = css.indexOf(`html.gs-theme-${product} {`);
  const end = css.indexOf(`html.gs-theme-${product}.gs-dark`);
  assert.ok(
    start !== -1 && end > start,
    `as-${product}.css has a light palette block`,
  );
  return css.slice(start, end);
}

const token = (block, name) => {
  const m = block.match(new RegExp(`--gs-${name}:\\s*(#[0-9a-fA-F]{6})`));
  return m ? m[1].toLowerCase() : null;
};

describe('target-chrome reference', () => {
  test('every skin has a reviewed, sourced entry', () => {
    for (const product of PRODUCTS) {
      const entry = fixture.products[product];
      assert.ok(entry, `${product} is in the fixture`);
      assert.match(
        String(entry.provenance ?? ''),
        /\S/,
        `${product} records where its values came from`,
      );
      for (const key of ['header', 'canvas', 'link', 'accent']) {
        assert.match(
          String(entry[key]),
          HEX,
          `${product}.${key} is a hex colour`,
        );
      }
    }
  });

  for (const product of PRODUCTS) {
    test(`${product}: the light palette matches the reviewed chrome`, () => {
      const block = lightPalette(product);
      const entry = fixture.products[product];
      assert.equal(token(block, 'header-bg'), entry.header, 'header');
      assert.equal(token(block, 'canvas'), entry.canvas, 'canvas');
      assert.equal(token(block, 'link'), entry.link, 'link');
      assert.equal(token(block, 'accent'), entry.accent, 'accent');
    });
  }
});
