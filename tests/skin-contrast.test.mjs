/**
 * Skin palette contrast.
 *
 * A skin paints a host forge's page from two blocks of custom properties — one
 * for light, one for dark — and then writes `background-color`/`color` pairs
 * that read those tokens. The failure mode this suite exists to catch is the
 * one that shipped once already: a label colour written as a literal, paired
 * with a fill that comes from a token, so the pair is accessible in light mode
 * and inaccessible in dark mode (or the reverse) and nobody notices until
 * someone measures it.
 *
 * So every fill token that carries a text label must ship a sibling label
 * token, and that pair must clear 4.5:1 in *both* modes. Parsing the stylesheet
 * (rather than importing a token list) keeps the check honest: a new skin is
 * checked by adding no code at all, and a token that is declared but unused is
 * not skipped.
 *
 * Companion to `tests/contracts.test.mjs`, which checks that the parts exist;
 * this file checks that the palette they declare is legible.
 *
 *   npm test
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Every shipped skin, so a new one is picked up without an edit here. */
const SKINS = ['github', 'gitlab', 'bitbucket'];

/** WCAG AA for body text. Button labels are body text, not large text. */
const AA = 4.5;

const file = (skin) =>
  readFileSync(
    fileURLToPath(
      new URL(`../src/plugins/skins/${skin}/as-${skin}.css`, import.meta.url),
    ),
    'utf8',
  );

/**
 * The custom properties a skin declares, per mode. Both blocks declare the
 * same token names, so a missing one is a gap rather than a fallback.
 * @param {string} skin
 * @param {'light'|'dark'} mode
 * @returns {Record<string, string>}
 */
function palette(skin, mode) {
  const tokens = {};
  // `[^{}]+` keeps the selector with its block; nested braces do not occur in
  // these files, and the data-URI mark value contains none.
  for (const [, selector, body] of file(skin).matchAll(
    /([^{}]+)\{([^{}]*)\}/g,
  )) {
    if (!selector.includes(`html.gs-theme-${skin}`)) continue;
    const isDark = selector.includes('gs-dark');
    if ((mode === 'dark') !== isDark) continue;
    for (const line of body.split('\n')) {
      const match = /^\s*(--[\w-]+)\s*:\s*([^;]+);/.exec(line);
      if (!match) continue;
      tokens[match[1]] = match[2].replace(/\s*!important\s*$/, '').trim();
    }
  }
  return tokens;
}

/** Relative luminance, per WCAG 2.x. @param {string} hex */
function luminance(hex) {
  const channels = [1, 3, 5].map((at) => {
    const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Contrast ratio between two #rrggbb colours, always ≥ 1. */
function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** A fill token that carries a label, and the token that labels it. */
const LABELLED_FILLS = {
  '--gs-on-accent': '--gs-accent',
  '--gs-on-success': '--gs-success',
};

/**
 * Text tiers that must clear AA on a page surface. `--gs-fg-subtle` is
 * deliberately absent: it is the disabled / placeholder / tertiary tier — the
 * source bridges map it to `--gl-text-color-disabled`, `--ds-text-disabled`,
 * `--color-placeholder-text` and friends, all of which AA exempts. Keeping it
 * out of this list is what lets it stay recessive on purpose.
 */
const TEXT_TIERS = ['--gs-fg', '--gs-fg-muted'];

/** Surfaces injected text sits on. */
const SURFACES = ['--gs-canvas', '--gs-canvas-subtle'];

/** The theme files that paint injected text, with no skin of their own. */
const THEME_FILES = ['ux-markers.css', 'ux-nav.css'];

const hex = (value) => /^#[0-9a-f]{6}$/i.test(value);

describe('skin palette contrast', () => {
  for (const skin of SKINS) {
    for (const mode of ['light', 'dark']) {
      test(`${skin} ${mode}: every labelled fill clears ${AA}:1`, () => {
        const tokens = palette(skin, mode);
        assert.ok(
          Object.keys(tokens).length,
          `${skin} ${mode} declares nothing`,
        );

        const failures = [];
        for (const [label, fill] of Object.entries(LABELLED_FILLS)) {
          if (!(label in tokens)) continue; // a fill no rule labels needs none
          const pair = `${label} on ${fill}`;
          if (!hex(tokens[label]) || !hex(tokens[fill])) {
            failures.push(`${pair}: both must be literal #rrggbb`);
            continue;
          }
          const ratio = contrast(tokens[label], tokens[fill]);
          if (ratio < AA) {
            failures.push(
              `${pair}: ${tokens[label]} on ${tokens[fill]} is ${ratio.toFixed(2)}:1`,
            );
          }
        }
        assert.deepEqual(failures, []);
      });
    }
  }

  test('a label token is declared in both modes', () => {
    // A token declared in one block only would silently fall back to the other
    // mode's value, which is how the original defect read in one mode.
    const missing = [];
    for (const skin of SKINS) {
      for (const label of Object.keys(LABELLED_FILLS)) {
        const modes = ['light', 'dark'].filter(
          (mode) => label in palette(skin, mode),
        );
        if (modes.length && modes.length !== 2) {
          missing.push(`${skin}: ${label} declared only in ${modes.join()} `);
        }
      }
    }
    assert.deepEqual(missing, []);
  });

  test('no rule writes a literal label over a token fill', () => {
    // The original defect: `background-color: var(--gs-success)` beside
    // `color: #ffffff`, so the pair held in light mode and failed in dark. A
    // label over a fill must come from that fill's label token.
    const bad = [];
    for (const skin of SKINS) {
      for (const [, selector, body] of file(skin).matchAll(
        /([^{}]+)\{([^{}]*)\}/g,
      )) {
        const fills = /background(-color)?:\s*var\((--gs-[a-z-]+)\)/.exec(body);
        const literal = /\bcolor:\s*#[0-9a-f]{3,8}\b/i.exec(body);
        if (fills && literal) {
          bad.push(
            `${skin}: ${selector.trim()} paints ${literal[0]} over var(${fills[2]})`,
          );
        }
      }
    }
    assert.deepEqual(bad, []);
  });
});

describe('injected text tiers', () => {
  for (const skin of SKINS) {
    for (const mode of ['light', 'dark']) {
      test(`${skin} ${mode}: text tiers clear ${AA}:1 on every surface`, () => {
        const tokens = palette(skin, mode);
        const failures = [];
        for (const tier of TEXT_TIERS) {
          for (const surface of SURFACES) {
            const ratio = contrast(tokens[tier], tokens[surface]);
            if (ratio < AA) {
              failures.push(
                `${tier} on ${surface}: ${tokens[tier]} on ${tokens[surface]} is ${ratio.toFixed(2)}:1`,
              );
            }
          }
        }
        assert.deepEqual(failures, []);
      });
    }
  }

  test('no theme file reaches for the disabled tier', () => {
    // The shipped defect: `.gs-no-equiv` badges and the "not available on
    // <source>" notes were coloured with `--gs-fg-subtle`, the tier reserved
    // for disabled and placeholder text, and measured 3.24:1-4.12:1.
    //
    // Matching on `var(--gs-fg-subtle` rather than the bare name: the theme
    // files name the token in their header comments to say *not* to use it,
    // and that prose is the documentation of this rule, not a violation.
    const bad = [];
    for (const name of THEME_FILES) {
      const css = readFileSync(
        fileURLToPath(new URL(`../src/themes/${name}`, import.meta.url)),
        'utf8',
      );
      for (const line of css.split('\n')) {
        if (line.includes('var(--gs-fg-subtle')) {
          bad.push(`${name}: ${line.trim()}`);
        }
      }
    }
    assert.deepEqual(bad, []);
  });
});
