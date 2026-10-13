/**
 * The measurement half of the colour gate: the skins against the reviewed
 * reference, and the reference against the products' own screenshots.
 *
 * `target-chrome.test.mjs` holds the shape of the fixture; this holds the
 * values. It is the test that makes a colour change fail for a *colour* reason.
 * Two things it catches that nothing here caught before:
 *
 *   - a skin that paints the wrong colour. The old test compared the skin's
 *     four chrome tokens against the fixture, which the fixture and the skin
 *     could both be wrong about together: the GitHub skin's header and the
 *     fixture's both said `#25292e` while github.com served `#000000`, and the
 *     build stayed green.
 *   - a skin that declares a right colour and never paints it. The GitLab skin
 *     carries `--gs-canvas-inset: #ececef`, GitLab's real rail grey, and binds
 *     it only to Primer tokens — which do not exist on a GitHub page — so the
 *     rail rendered `#fbfafd`. A token-value check scores that 10/10; only
 *     comparing pixels to the product's own pixels finds it.
 *
 *   npm test
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import '../../tools/plugins.mjs';
import {
  REFERENCE,
  TOLERANCE,
  compare,
  parsePalette,
  reports,
  scorePixels,
  scoreReference,
  scoreTokens,
  violations,
} from '../../tools/compare/color-parity.mjs';

const PLUGINS = globalThis.GITALIKE_PLUGINS;
const SKINS = Object.keys(PLUGINS.skins);

/** Every out-of-tolerance finding, as one readable list. */
const allViolations = () => SKINS.flatMap(violations);

describe('the OKLab scale', () => {
  test('the same colour is zero distance on every axis', () => {
    for (const hex of ['#000000', '#ffffff', '#0969da', '#ececef', '#25292e']) {
      const c = compare(hex, hex);
      assert.equal(c.delta, 0, hex);
      assert.equal(c.lightness, 0, hex);
      assert.equal(c.chroma, 0, hex);
      assert.equal(c.verdict, 'pass', hex);
    }
  });

  test('a hue is not judged when a colour has none', () => {
    // Two near-neutral borders a unit apart. A hue comparison here would be
    // comparing angles the colours do not have.
    const c = compare('#d1d9e0', '#dcdcde');
    assert.equal(c.hue, undefined, 'no hue is reported for a neutral pair');
    assert.equal(
      c.verdict,
      'pass',
      'a one-unit border step is within tolerance',
    );
  });

  test('a grey header is caught against a black one', () => {
    // The case the old gate missed entirely: the skin and the fixture both said
    // #25292e while github.com served #000000.
    assert.equal(compare('#000000', '#25292e').verdict, 'fail');
  });

  test('a one-step near-black is over the lightness tolerance, and that is known', () => {
    // OKLab's lightness is not uniform at the dark end: #000000 against #010409
    // is a one-step difference no one can see, and it still scores ΔL 0.104,
    // over three times the tolerance. Pinned here rather than left as a
    // surprise.
    //
    // It cannot fire in practice, because the reference is per mode and no two
    // tokens in one mode are that close — GitHub's #000000 light header and its
    // #010409 dark header are never compared to each other. The right reading
    // of a lightness failure at L < 0.05 is "look at it", which is what the
    // failure message asks for.
    const near = compare('#000000', '#010409');
    assert.ok(near.lightness > TOLERANCE.lightness, 'it is over tolerance');
    assert.ok(
      near.delta < compare('#000000', '#25292e').delta,
      'but it is much closer than a real header error',
    );
  });

  test("one product's brand hue is caught against another's", () => {
    // GitHub's accent against GitLab's: a lightness rule alone misses it, since
    // the two are only 0.019 apart in L.
    const c = compare('#0969da', '#1f75cb');
    assert.ok(c.lightness < TOLERANCE.lightness, 'lightness alone would pass');
    assert.equal(c.verdict, 'fail', 'chroma catches it');
  });

  test('a hue difference is wrapped, so 350° and 10° are 20° apart', () => {
    // Two saturated colours on opposite sides of the red axis.
    const c = compare('#ff0000', '#ff001a');
    assert.ok(c.hue < TOLERANCE.hue, `wrapped hue ${c.hue}`);
  });
});

describe('declared palettes', () => {
  for (const product of SKINS) {
    test(`${product}: every token is the product's own value`, () => {
      const out = scoreTokens(product).flatMap(({ mode, tokens }) =>
        tokens
          .filter((t) => t.verdict !== 'pass')
          .map(
            (t) =>
              `${product}/${mode} --gs-${t.token} is ${t.got}, the product's is ${t.want} (${t.verdict}, ΔE ${t.delta.toFixed(3)})`,
          ),
      );
      assert.deepEqual(out, [], out.join('\n'));
    });
  }

  test('a skin and its reference agree on every mode, not just the light one', () => {
    // The old gate read `html.gs-theme-<product> {` and stopped before the
    // `.gs-dark` block, so no dark palette was ever checked.
    for (const product of SKINS) {
      const modes = scoreTokens(product).map((m) => m.mode);
      assert.deepEqual(
        modes,
        ['light', 'dark'],
        `${product} is scored in both`,
      );
    }
  });

  test('the parser reads both palettes and nothing else', () => {
    const palette = parsePalette('github');
    assert.equal(palette.light['header-bg'], '#000000');
    assert.equal(palette.dark['header-bg'], '#010409');
    // `--gs-radius-sm: var(--gs-radius-md)` in the GitLab skin is an alias, not
    // a colour, and must not be harvested as one.
    assert.ok(!('radius-sm' in parsePalette('gitlab').light));
  });
});

describe('rendered pixels', () => {
  for (const product of SKINS) {
    test(`${product}: every region is painted the product's colour`, () => {
      const rows = scorePixels(product);
      const out = rows
        .filter((r) => r.verdict !== 'pass')
        .map(
          (r) =>
            `${r.capture} ${r.role} paints ${r.skinned}, the real page ${r.real} (${r.verdict}, ΔE ${r.delta.toFixed(3)})`,
        );
      assert.deepEqual(out, [], out.join('\n'));
    });
  }

  test('the reference still describes the products', () => {
    // A fixture that has gone stale lowers every score quietly. This is the
    // layer that makes it fail instead.
    const out = SKINS.flatMap(scoreReference)
      .filter((r) => r.verdict !== 'pass')
      .map(
        (r) =>
          `${r.file} ${r.role} renders ${r.measured}, the reference says ${r.reference}`,
      );
    assert.deepEqual(out, [], out.join('\n'));
  });
});

describe('the colour gate', () => {
  test('nothing is out of tolerance', () => {
    const out = allViolations();
    assert.deepEqual(
      out.map((v) => `[${v.layer}] ${v.line}`),
      [],
      `${out.length} colour(s) out of tolerance:\n${out.map((v) => v.line).join('\n')}`,
    );
  });

  test('the gate is not passing vacuously', () => {
    // Every skin must be reached by the layers that can judge it. A skin that
    // slipped out of the reference, lost its `compareOn`, or lost a capture
    // would otherwise score nothing and fail nothing.
    for (const { product, tokens, pixels, grades } of reports()) {
      assert.ok(
        tokens.flatMap((t) => t.tokens).length >= 15,
        `${product} is scored on a full palette`,
      );
      assert.ok(grades.tokens !== null, `${product} has a token grade`);
      assert.ok(grades.reference !== null, `${product} has a reference grade`);
      if (pixels.length === 0) {
        // Only legal with a written reason, which `target-chrome.test.mjs` also
        // requires — so the gate and the contract cannot disagree about whether
        // a missing layer is a decision or an accident.
        const entry = REFERENCE.products[product];
        assert.match(
          String(entry.compareOnNote ?? ''),
          /\S/,
          `${product} has no comparable capture and says why`,
        );
      }
    }
  });
});
