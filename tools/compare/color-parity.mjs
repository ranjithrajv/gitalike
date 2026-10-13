#!/usr/bin/env node
/**
 * Colour-match parity: how close a skin's colours are to the product it imitates.
 *
 * The colour half of parity was previously two things that could not catch each
 * other. `tests/compare/target-chrome.test.mjs` compared a skin's four chrome
 * tokens against `tests/fixtures/target-chrome.json` — which proves the skin
 * agrees with itself, so a token that is stale in *both* passes. And
 * `parity-visual.mjs --palette` compared screenshots on a `1 - distance/441`
 * scale, which maps every real comparison into the top 30% of the range and so
 * cannot separate a good skin from a wrong one. Two headers, `#25292e` against
 * the `#000000` github.com actually serves, scored 8.4 and 10.0.
 *
 * This module replaces both with three layers that are independent of each
 * other, so a mistake in one is visible in the others:
 *
 *   tokens    the skin's declared `--gs-*` palette against the reviewed
 *             reference, per token and per mode, on a perceptually uniform
 *             scale — light *and* dark, not four tokens in light alone
 *   pixels    the rendered screenshot of the skin against the rendered
 *             screenshot of the real product, region by region. This needs no
 *             reference at all: it is the fidelity measure, and it is the one
 *             that catches a skin which declares a correct colour and never
 *             paints it
 *   reference the reviewed reference against the real product's own
 *             screenshot, so a fixture that has gone stale fails instead of
 *             quietly lowering everyone's score
 *
 * ## The scale
 *
 * Distance is ΔE in OKLab, the perceptually uniform space from Björn
 * Ottosson's 2020 derivation: sRGB is linearised, taken to LMS, cube-rooted,
 * and mixed into (L, a, b). Uniformity is the point — an sRGB euclidean
 * distance spends most of its range on dark-to-light changes the eye barely
 * registers and under-counts a hue shift in a flat surface, which is exactly
 * the kind of error a chrome token makes. Two thresholds are used:
 *
 *   IMPERCEPTIBLE  0.02   a user cannot see the difference at all
 *   JND            0.05   a just-noticeable difference on a large flat field —
 *                        the line past which a skin is visibly *not* the product
 *
 * A gate, not a grade, is what fails the build: a token past `JND` is a wrong
 * colour, and one past `IMPERCEPTIBLE` is worth fixing while the file is open.
 * These design systems publish their tokens as exact hex, so there is no
 * defensible reason for a skin to be near rather than exact on a token the
 * product names.
 *
 *   node tools/compare/color-parity.mjs              the three layers, graded
 *   node tools/compare/color-parity.mjs --tokens     per token, both modes
 *   node tools/compare/color-parity.mjs --pixels     per region, per capture
 *   node tools/compare/color-parity.mjs --json
 *
 * Offline: it reads the skins' stylesheets and the committed screenshots in
 * `docs/`, and launches nothing. The live half — a skinned page measured in a
 * browser — is `style-parity.mjs`, which shares the `deltaE` and `parsePalette`
 * exported here so the two cannot drift.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { decodePng } from './png.mjs';
import { SOURCES as CAPTURES } from './captures.mjs';
import '../plugins.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const PLUGINS = globalThis.GITALIKE_PLUGINS;
const SKINS = Object.keys(PLUGINS.skins);

/* ------------------------------------------------------------------ colour -- */

/**
 * The per-axis tolerances, in OKLab's own axes. See the header for why a single
 * combined threshold does not work here.
 *
 * Calibrated so that, in one pass: the GitHub header painted `#25292e` instead
 * of `#000000` fails on lightness (0.279), the GitLab rail painted `#fbfafd`
 * instead of `#ececef` fails on lightness (0.043), GitHub's accent blue is
 * caught against GitLab's on chroma (0.036), and a one-unit border difference
 * (`#d1d9e0` against `#dcdcde`) passes on chroma (0.010).
 *
 * One known over-sensitivity, deliberately not smoothed over: OKLab's lightness
 * is not uniform at the dark end, so `#000000` against `#010409` — a one-step
 * difference no one can see — scores ΔL 0.104 and fails, while `#000000` against
 * `#25292e` fails by nearly three times as much. It cannot fire in practice,
 * because the reference is read per mode and no two tokens in one mode are that
 * close: GitHub's `#000000` light header and its `#010409` dark header are never
 * compared to each other. A lightness failure at L < 0.05 is a prompt to look,
 * which is what the failure message says.
 */
export const TOLERANCE = { lightness: 0.03, chroma: 0.015, hue: 5 };
/** Below this chroma a colour has no meaningful hue to compare. */
const HUE_FLOOR = 0.02;
/**
 * The distance at which a graded colour earns nothing. Wide enough that two
 * products' greys are not both scored zero for being adjacent neutrals, tight
 * enough that a black header against a white one is not scored as a near miss.
 *
 * Shared with `parity-visual.mjs --palette`, so a "colour score" means one
 * thing across the repo.
 */
export const VOID = 0.35;

/** A `#rgb` / `#rrggbb` string to 0-255 sRGB. Throws on anything else. */
export function parseHex(value) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value).trim());
  if (!match) throw new Error(`not a hex colour: ${value}`);
  const h =
    match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** The sRGB companding curve's inverse: 0-255 sRGB to linear light. */
const linear = (channel) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/**
 * A hex colour to OKLab. The matrix rows are Ottosson's, in the order the LMS
 * mix is done in: linearise, take LMS, cube-root, then mix into Lab.
 */
export function oklab(value) {
  const [r, g, b] = parseHex(value).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/**
 * ΔE in OKLab between two hex colours. Zero is the same colour, and — unlike
 * an sRGB distance — the number means the same thing wherever in the gamut the
 * two colours sit.
 */
export function deltaE(a, b) {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * Two colours, decomposed into the three ways they can differ, each against
 * `TOLERANCE`. Hue is only reported where both colours are chromatic enough to
 * have one, so a pair of near-neutral borders is not judged on a hue neither of
 * them has.
 *
 * `verdict` is `'pass'`, `'review'` (one axis is over its tolerance but under
 * twice it — a difference worth a second pair of eyes) or `'fail'` (clearly
 * over). A fail is a colour that is not the product's.
 */
export function compare(a, b) {
  const A = oklab(a);
  const B = oklab(b);
  const chromaA = Math.hypot(A[1], A[2]);
  const chromaB = Math.hypot(B[1], B[2]);
  const axes = {
    lightness: Math.abs(A[0] - B[0]),
    chroma: Math.abs(chromaA - chromaB),
  };
  if (chromaA > HUE_FLOOR && chromaB > HUE_FLOOR) {
    // Wrapped to [0, 180]: hue is a circle, so 350° and 10° are 20° apart.
    const toDeg = (v) => (Math.atan2(v[2], v[1]) * 180) / Math.PI;
    const diff = Math.abs(toDeg(A) - toDeg(B)) % 360;
    axes.hue = diff > 180 ? 360 - diff : diff;
  }
  let over = 0;
  for (const [axis, value] of Object.entries(axes)) {
    const limit = TOLERANCE[axis];
    if (value > limit) over = Math.max(over, value / limit);
  }
  return {
    ...axes,
    delta: deltaE(a, b),
    verdict: over === 0 ? 'pass' : over > 2 ? 'fail' : 'review',
  };
}

/** `deltaE` as a 0-1 credit, so a near-match earns near-full marks. */
const fraction = (distance) => Math.max(0, Math.min(1, 1 - distance / VOID));

/* ---------------------------------------------------------------- palettes -- */

/**
 * A skin's declared palette, both modes, as `{ light, dark }` of
 * `--gs-<token>` to hex. One parser for the whole repo: the token gate and
 * this report must not be able to disagree about what a stylesheet declares.
 */
export function parsePalette(product) {
  const file = join(root, `src/plugins/skins/${product}/as-${product}.css`);
  const css = readFileSync(file, 'utf8');
  const darkStart = css.indexOf(`html.gs-theme-${product}.gs-dark`);
  const lightStart = css.indexOf(`html.gs-theme-${product} {`);
  if (lightStart === -1 || darkStart === -1 || darkStart < lightStart) {
    throw new Error(
      `as-${product}.css has no light palette block followed by a .gs-dark one`,
    );
  }
  const harvest = (block) => {
    const out = {};
    // Only literal colours: a token aliased to another token (`--gs-radius-sm:
    // var(--gs-radius-md)`) is a reference, not a value, and is not a colour.
    for (const m of block.matchAll(
      /--gs-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g,
    )) {
      out[m[1]] = m[2].toLowerCase();
    }
    return out;
  };
  return {
    light: harvest(css.slice(lightStart, darkStart)),
    dark: harvest(css.slice(darkStart)),
  };
}

/* --------------------------------------------------------------- reference -- */

/**
 * The reviewed target chrome: the real products' own values, in their own
 * names, for both modes. Independent of the skins by construction — nothing
 * writes a `--gs-*` value into it — and checked against the products' own
 * screenshots by the `reference` layer, so it cannot quietly go stale.
 */
export const REFERENCE = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/target-chrome.json'), 'utf8'),
);

/**
 * The regions of a product's page that carry its design language, as
 * `[x0, y0, x1, y1]` in the 1280x900 capture box, and which `--gs-*` token is
 * the product's own value for it. A region only a product's layout has (the
 * GitHub tab row, the GitLab and Bitbucket rail) is listed only for it, so the
 * `pixels` layer compares like with like.
 */
export function regions(product) {
  return REFERENCE.products[product]?.regions ?? {};
}

/**
 * The screenshots of the real product, by page kind. The `pixels` layer needs
 * both a real and a skinned frame of the *same* product, at the same viewport,
 * to compare regions against each other.
 */
export function captures(product) {
  return REFERENCE.products[product]?.captures ?? {};
}

/**
 * The sources whose page the skin rebuilds into the product's own chrome, so a
 * region-by-region compare against the product's own screenshot means the same
 * thing on both sides.
 *
 * This is deliberately narrow. A capture of a source the skin only *restyles*
 * still shows that source's layout — Gitea's own light header, a Bitbucket
 * cookie banner over the app bar, PolyGerrit's shadow-DOM shell — so comparing
 * its chrome against github.com's is measuring the source's layout, not the
 * skin's colour fidelity. How much of a surface a skin covers on a source the
 * rubric already answers, from the source's own `compare` capabilities; this
 * layer answers only whether the colours it *does* paint are the product's.
 */
export function comparableOn(product) {
  return REFERENCE.products[product]?.compareOn ?? [];
}

/* ------------------------------------------------------------ 1 · tokens -- */

/**
 * The declared palette against the reviewed reference, per mode. A token the
 * reference does not name is not scored — the reference is the reviewed set,
 * not a superset of whatever a skin happens to declare.
 */
export function scoreTokens(product) {
  const palette = parsePalette(product);
  const modes = REFERENCE.products[product]?.modes ?? {};
  return Object.entries(modes).map(([mode, expected]) => {
    const declared = palette[mode] ?? {};
    const tokens = Object.entries(expected)
      .filter(([token]) => declared[token])
      .map(([token, want]) => {
        const got = declared[token];
        const c = compare(got, want);
        return {
          token,
          got,
          want,
          delta: c.delta,
          verdict: c.verdict,
          score: fraction(c.delta) * 10,
        };
      })
      .sort((a, b) => b.delta - a.delta);
    const worst = tokens[0];
    const mean =
      tokens.reduce((sum, t) => sum + t.delta, 0) / (tokens.length || 1);
    const missing = Object.keys(expected).filter((t) => !declared[t]);
    return {
      mode,
      tokens,
      mean,
      worst,
      missing,
      // Scored on the worst token rather than the mean: these are published
      // hex values, so one wrong token is a wrong token, and a mean would let
      // a correct ramp average away a black header painted #25292e.
      score: (worst ? fraction(worst.delta) : 1) * 10,
      exact:
        tokens.filter((t) => t.verdict === 'pass').length /
        (tokens.length || 1),
    };
  });
}

/* ------------------------------------------------------------ 2 · pixels -- */

/**
 * The dominant colour of a rectangle: the chrome's own surface, with glyphs and
 * counters outvoted by the field they sit on. The single most common value, not
 * the median — a median averages a dark logo and a light field into a colour
 * neither of them is.
 */
export function dominant(png, [x0, y0, x1, y1]) {
  const counts = new Map();
  let total = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * png.width + x) * png.channels;
      const key = `${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total += 1;
    }
  }
  let best = null;
  let seen = 0;
  for (const [key, n] of counts) {
    if (n > seen) {
      seen = n;
      best = key;
    }
  }
  return {
    hex: `#${best
      .split(',')
      .map((v) => (+v).toString(16).padStart(2, '0'))
      .join('')}`,
    share: seen / total,
  };
}

const pngCache = new Map();
function loadCapture(file) {
  if (!pngCache.has(file)) {
    pngCache.set(file, decodePng(readFileSync(join(root, 'docs', file))));
  }
  return pngCache.get(file);
}

/** The capture file prefix a source writes its frames under (`gitea` → `codeberg`). */
const prefixOf = (source) => CAPTURES.find((s) => s.key === source)?.prefix;

/**
 * The measured layer: each skinned screenshot against the real product's own
 * screenshot of the same page, region by region. This compares pixels to
 * pixels, so it needs neither the reference nor a browser, and it is the only
 * layer that can see a skin which declares a right colour and leaves it
 * unpainted.
 */
export function scorePixels(product) {
  const box = regions(product);
  const kinds = captures(product);
  const rows = [];
  for (const kind of Object.keys(kinds)) {
    const real = kinds[kind];
    if (!existsSync(join(root, 'docs', real))) continue;
    for (const source of comparableOn(product)) {
      const prefix = prefixOf(source);
      if (!prefix) continue;
      const file = `${prefix}-${product}.png`;
      if (!existsSync(join(root, 'docs', file))) continue;
      for (const [role, region] of Object.entries(box)) {
        const [x0, y0, x1, y1] = region.box;
        const a = dominant(loadCapture(real), [x0, y0, x1, y1]);
        const b = dominant(loadCapture(file), [x0, y0, x1, y1]);
        const c = compare(a.hex, b.hex);
        rows.push({
          kind,
          source,
          capture: file,
          role,
          real: a.hex,
          skinned: b.hex,
          delta: c.delta,
          verdict: c.verdict,
          score: fraction(c.delta) * 10,
        });
      }
    }
  }
  return rows;
}

/* --------------------------------------------------------- 3 · reference -- */

/**
 * The reference itself, checked against the products' own screenshots. A
 * fixture that no longer describes the product is the failure this exists to
 * catch: with the old four-token test, a stale value in the fixture and the
 * same stale value in the skin agreed with each other and the build stayed
 * green while both were wrong.
 */
export function scoreReference(product) {
  const kinds = captures(product);
  const rows = [];
  for (const [kind, file] of Object.entries(kinds)) {
    if (!existsSync(join(root, 'docs', file))) continue;
    for (const [role, region] of Object.entries(regions(product))) {
      const [x0, y0, x1, y1] = region.box;
      const measured = dominant(loadCapture(file), [x0, y0, x1, y1]);
      const want = region.token
        ? REFERENCE.products[product].modes.light[region.token]
        : null;
      if (!want) continue;
      const c = compare(measured.hex, want);
      rows.push({
        kind,
        role,
        file,
        measured: measured.hex,
        reference: want,
        delta: c.delta,
        verdict: c.verdict,
        score: fraction(c.delta) * 10,
      });
    }
  }
  return rows;
}

/* -------------------------------------------------------------- grading -- */

const worst = (rows) =>
  rows.length ? Math.min(...rows.map((r) => r.score)) : null;
const mean = (rows) =>
  rows.length ? rows.reduce((s, r) => s + r.score, 0) / rows.length : null;

export function report(product) {
  const tokens = scoreTokens(product);
  const pixels = scorePixels(product);
  const reference = scoreReference(product);
  return {
    product,
    tokens,
    pixels,
    reference,
    grades: {
      // Scored on the worst token and the worst region, not an average: these
      // are published hex values on named surfaces, so one wrong token is one
      // visibly wrong surface, and a mean would let a correct ramp average away
      // a black header painted #25292e.
      tokens: worst(tokens.flatMap((t) => t.tokens)),
      tokensMean: mean(tokens.flatMap((t) => t.tokens)),
      pixels: worst(pixels),
      reference: worst(reference),
    },
  };
}

/** Every skin's report, registry order. */
export function reports() {
  return SKINS.map(report);
}

/**
 * The gate. A colour is out of tolerance when it is over `TOLERANCE` on any
 * axis, so the check is role-blind and lands on the same answer whether it is
 * run against a token, a rendered region, or the reference itself.
 *
 * Anything over tolerance fails. The tolerances are already set where a step in
 * a neutral ramp passes and a step in a brand hue does not, so the band above
 * them is not a grey zone — it is a colour that is measurably not the product's.
 * `verdict` only words how far over it is, so the message says whether a human
 * is looking at a barely-off value or a black header painted a shade of grey.
 */
const outOfTolerance = (rows) => rows.filter((r) => r.verdict !== 'pass');

/** Everything a build must fail on, for one skin. */
export function violations(product) {
  const out = [];
  for (const { mode, tokens } of scoreTokens(product)) {
    for (const { token, got, want, delta, verdict } of outOfTolerance(tokens)) {
      out.push({
        layer: 'tokens',
        line: `${product}/${mode} --gs-${token} is ${got}, the product's is ${want} (${verdict}, ΔE ${delta.toFixed(3)})`,
      });
    }
  }
  for (const { capture, role, skinned, real, delta, verdict } of outOfTolerance(
    scorePixels(product),
  )) {
    out.push({
      layer: 'pixels',
      line: `${product} ${capture} ${role} paints ${skinned}, the real page ${real} (${verdict}, ΔE ${delta.toFixed(3)})`,
    });
  }
  for (const {
    file,
    role,
    measured,
    reference,
    delta,
    verdict,
  } of outOfTolerance(scoreReference(product))) {
    out.push({
      layer: 'reference',
      line: `${product} the reference for ${role} says ${reference}, ${file} renders ${measured} — the reference is stale (${verdict}, ΔE ${delta.toFixed(3)})`,
    });
  }
  return out;
}

/* ------------------------------------------------------------------- cli -- */

const pad = (n) => String(n).padEnd(14);
/** A score, or an honest `n/a` where a layer has nothing comparable to say. */
const f = (v) => (v === null ? '  n/a' : v.toFixed(2).padStart(5));
/** ← fails a build, ~ over tolerance but only just. */
const MARK = { fail: ' ←', review: ' ~', pass: '' };

function main(args) {
  if (args.has('--json')) {
    console.log(JSON.stringify(reports(), null, 2));
  } else if (args.has('--tokens')) {
    console.log(
      '\nDeclared palette against the reviewed reference, both modes\n',
    );
    for (const { product, tokens } of reports()) {
      console.log(`${product}`);
      for (const { mode, tokens: rows, missing } of tokens) {
        const worst = rows[0];
        console.log(
          `  ${mode.padEnd(5)} ${f(rows.reduce((s, t) => s + t.score, 0) / (rows.length || 1))}/10 mean  ${f(worst?.score)}/10 worst${missing.length ? `  missing ${missing.join(', ')}` : ''}`,
        );
        for (const t of rows.slice(0, 5)) {
          console.log(
            `      --gs-${pad(t.token)} ${t.got} vs ${t.want}  ΔE ${t.delta.toFixed(4)}${MARK[t.verdict]}`,
          );
        }
      }
      console.log();
    }
  } else if (args.has('--pixels')) {
    console.log(
      '\nRendered pixels against the real product, region by region\n',
    );
    for (const { product, pixels } of reports()) {
      if (!pixels.length) {
        console.log(
          `${product}\n  n/a — no comparable skinned capture (see compareOnNote)\n`,
        );
        continue;
      }
      console.log(`${product}`);
      for (const row of pixels) {
        console.log(
          `  ${pad(row.capture)} ${pad(row.role)} ${row.skinned} vs real ${row.real}  ΔE ${row.delta.toFixed(3)}  ${f(row.score)}/10${MARK[row.verdict]}`,
        );
      }
      console.log();
    }
  } else {
    console.log('\nColour-match parity\n');
    console.log(`  ${pad('skin')} ${pad('layer')}   ${'worst'}  ${'mean'}\n`);
    for (const { product, grades } of reports()) {
      for (const [layer, worstScore, meanScore] of [
        ['tokens', grades.tokens, grades.tokensMean],
        ['pixels', grades.pixels, grades.pixels],
        ['reference', grades.reference, grades.reference],
      ]) {
        console.log(
          `  ${pad(product)} ${pad(layer)}  ${f(worstScore)}  ${f(meanScore ?? worstScore)}`,
        );
      }
      console.log();
    }
    console.log(
      '  tokens     the declared --gs-* palette vs the reviewed reference, both modes\n' +
        '  pixels     the rendered screenshot vs the real product, region by region\n' +
        '  reference  the reference itself vs the real product, so it cannot go stale\n',
    );
    console.log(
      `  graded on the worst, not the mean: one wrong token is one visibly wrong surface\n` +
        `  tolerances  L ${TOLERANCE.lightness}  C ${TOLERANCE.chroma}  h ${TOLERANCE.hue}°\n` +
        `  any colour over tolerance fails; "review" and "fail" say how far over\n`,
    );
  }

  const failed = SKINS.flatMap(violations);
  if (failed.length) {
    console.log(`${failed.length} colour(s) out of tolerance:\n`);
    for (const { layer, line } of failed) {
      console.log(`  [${pad(layer)}] ${line}`);
    }
    process.exitCode = 1;
  }
}

// Only when run as a program — the tests import this module for its scoring
// functions, and a report printed on import would be noise, and an exit code
// would fail every test that imports it.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(new Set(process.argv.slice(2)));
}
